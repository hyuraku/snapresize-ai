/**
 * WebGPU/WASM検出モジュール
 * ARCHITECTURE.md に記載されたリスク2対策を実装
 *
 * 判定は UA 文字列ではなく機能検出のみで行う。
 * 2026年時点で WebGPU は主要4ブラウザすべてが出荷済みだが、
 * 同じブラウザでも OS・GPU・設定によって可否が変わるため、
 * バージョン番号から可否を推測することはできない。
 */

export type Backend = 'webgpu' | 'wasm';

/** Transformers.js に渡すモデルの量子化形式 */
export type ModelDtype = 'fp16' | 'fp32' | 'q8';

/**
 * RMBG-1.4 の各 dtype の実サイズ（MB, 10進）
 * https://huggingface.co/api/models/briaai/RMBG-1.4/tree/main/onnx の値を丸めたもの
 */
const MODEL_SIZE_MB: Record<ModelDtype, number> = {
  fp32: 176, // onnx/model.onnx
  fp16: 88, // onnx/model_fp16.onnx
  q8: 44, // onnx/model_quantized.onnx
};

export interface CapabilityInfo {
  backend: Backend;
  isWebGPUAvailable: boolean;
  /** GPU が 16bit 浮動小数点シェーダをサポートするか */
  supportsF16: boolean;
  /** この環境で使うべきモデルの量子化形式 */
  dtype: ModelDtype;
  adapterInfo?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  } | null;
  recommendedChunkSize: number;
  estimatedSpeedMultiplier: number;
}

class CapabilityDetector {
  private cachedResult: CapabilityInfo | null = null;
  private detecting = false;
  private detectPromise: Promise<CapabilityInfo> | null = null;

  /**
   * 最適なバックエンドを検出
   */
  async detectBestBackend(): Promise<CapabilityInfo> {
    // キャッシュがあれば返す
    if (this.cachedResult) {
      return this.cachedResult;
    }

    // 既に検出中なら待つ
    if (this.detectPromise) {
      return this.detectPromise;
    }

    this.detecting = true;
    this.detectPromise = this.performDetection();

    try {
      const result = await this.detectPromise;
      this.cachedResult = result;
      return result;
    } finally {
      this.detecting = false;
      this.detectPromise = null;
    }
  }

  /**
   * 実際の検出処理
   */
  private async performDetection(): Promise<CapabilityInfo> {
    // navigator.gpu が存在しない場合
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu;
    if (!gpu) {
      console.warn('CapabilityDetector: WebGPU not available in this browser');
      return this.getWASMFallback();
    }

    try {
      // アダプタをリクエスト
      const adapter = await gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        console.warn('CapabilityDetector: No GPU adapter available');
        return this.getWASMFallback();
      }

      // fp16 モデルを使えるかはアダプタの機能次第
      const supportsF16 = adapter.features?.has('shader-f16') ?? false;

      // デバイスを実際に取得できるかまで確認する
      // （アダプタが取れてもデバイス生成に失敗する環境があるため）
      const device = await adapter.requestDevice();
      if (!device) {
        console.warn('CapabilityDetector: Failed to get GPU device');
        return this.getWASMFallback();
      }

      // アダプタ情報を取得
      // adapter.info が現行の標準。requestAdapterInfo() は非推奨のため後方互換用。
      const adapterInfo = adapter.info ?? (await adapter.requestAdapterInfo?.()) ?? null;

      console.log('CapabilityDetector: WebGPU available', {
        vendor: adapterInfo?.vendor,
        architecture: adapterInfo?.architecture,
        device: adapterInfo?.device,
        supportsF16,
      });

      // 検出用に作ったデバイスは解放する
      device.destroy();

      return {
        backend: 'webgpu',
        isWebGPUAvailable: true,
        supportsF16,
        // fp16 が使えれば DL 量を約半分にできる。使えなければ精度を落とさず fp32。
        dtype: supportsF16 ? 'fp16' : 'fp32',
        adapterInfo,
        recommendedChunkSize: 5, // WebGPU: 5画像並列
        estimatedSpeedMultiplier: 1,
      };
    } catch (error) {
      console.warn('CapabilityDetector: WebGPU detection failed:', error);
      return this.getWASMFallback();
    }
  }

  /**
   * WASMフォールバック情報を作成
   * 検出に失敗した呼び出し側も、同じ既定値を使えるよう公開している
   */
  getWASMFallback(): CapabilityInfo {
    return {
      backend: 'wasm',
      isWebGPUAvailable: false,
      supportsF16: false,
      // CPU 実行では fp16 の恩恵がないため、DL 量が最小の q8 を使う
      dtype: 'q8',
      adapterInfo: null,
      recommendedChunkSize: 2, // WASM: 2画像並列
      estimatedSpeedMultiplier: 100, // 最大100倍遅い
    };
  }

  /**
   * 推奨チャンクサイズを取得
   */
  getRecommendedChunkSize(backend: Backend): number {
    return backend === 'webgpu' ? 5 : 2;
  }

  /**
   * 推定処理時間を計算（秒）
   * NOTE: 実測値ではなく設計時の見積もり。特に WASM 側は環境差が大きい。
   */
  estimateProcessingTime(backend: Backend, imageCount: number): number {
    const timePerImage = backend === 'webgpu' ? 3 : 300; // 秒
    return imageCount * timePerImage;
  }

  /**
   * 人間が読みやすい推定時間を取得
   */
  getEstimatedTimeString(backend: Backend, imageCount: number): string {
    const totalSeconds = this.estimateProcessingTime(backend, imageCount);

    if (totalSeconds < 60) {
      return `約${Math.ceil(totalSeconds)}秒`;
    } else if (totalSeconds < 3600) {
      return `約${Math.ceil(totalSeconds / 60)}分`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.ceil((totalSeconds % 3600) / 60);
      return `約${hours}時間${minutes}分`;
    }
  }

  /**
   * この環境でダウンロードされるモデルのサイズ表記を取得
   * 検出前は最大値（fp32）を示し、実際より小さく見せないようにする
   */
  getModelSizeLabel(dtype?: ModelDtype): string {
    return `${MODEL_SIZE_MB[dtype ?? 'fp32']}MB`;
  }

  /**
   * WebGPU が動く代表的なブラウザを取得（未対応環境への案内用）
   * 2026年時点で主要4ブラウザすべてが出荷済み。
   */
  getRecommendedBrowsers(): string[] {
    return ['Chrome 113+', 'Edge 113+', 'Safari 26+', 'Firefox 141+'];
  }

  /**
   * 検出中か確認
   */
  isDetecting(): boolean {
    return this.detecting;
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cachedResult = null;
  }
}

// シングルトンインスタンス
export const capabilityDetector = new CapabilityDetector();
export default capabilityDetector;
