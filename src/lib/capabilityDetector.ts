/**
 * WebGPU/WASM検出モジュール
 * ARCHITECTURE.md に記載されたリスク2対策を実装
 */

export type Backend = 'webgpu' | 'wasm';

export interface CapabilityInfo {
  backend: Backend;
  isWebGPUAvailable: boolean;
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
      return this.createWASMFallback();
    }

    try {
      // アダプタをリクエスト
      const adapter = await gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        console.warn('CapabilityDetector: No GPU adapter available');
        return this.createWASMFallback();
      }

      // デバイスをリクエスト
      const device = await adapter.requestDevice();
      if (!device) {
        console.warn('CapabilityDetector: Failed to get GPU device');
        return this.createWASMFallback();
      }

      // アダプタ情報を取得
      const adapterInfo = (await adapter.requestAdapterInfo?.()) || null;

      console.log('CapabilityDetector: WebGPU available', {
        vendor: adapterInfo?.vendor,
        architecture: adapterInfo?.architecture,
        device: adapterInfo?.device,
      });

      // デバイスをクリーンアップ
      device.destroy();

      return {
        backend: 'webgpu',
        isWebGPUAvailable: true,
        adapterInfo,
        recommendedChunkSize: 5, // WebGPU: 5画像並列
        estimatedSpeedMultiplier: 1,
      };
    } catch (error) {
      console.warn('CapabilityDetector: WebGPU detection failed:', error);
      return this.createWASMFallback();
    }
  }

  /**
   * WASMフォールバック情報を作成
   */
  private createWASMFallback(): CapabilityInfo {
    return {
      backend: 'wasm',
      isWebGPUAvailable: false,
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
   * WebGPU サポートブラウザか確認
   */
  isWebGPUSupportedBrowser(): boolean {
    const ua = navigator.userAgent;

    // Chrome 113+
    const chromeMatch = ua.match(/Chrome\/(\d+)/);
    if (chromeMatch && chromeMatch[1] && parseInt(chromeMatch[1], 10) >= 113) {
      return true;
    }

    // Edge 113+
    const edgeMatch = ua.match(/Edg\/(\d+)/);
    if (edgeMatch && edgeMatch[1] && parseInt(edgeMatch[1], 10) >= 113) {
      return true;
    }

    // Opera 99+
    const operaMatch = ua.match(/OPR\/(\d+)/);
    if (operaMatch && operaMatch[1] && parseInt(operaMatch[1], 10) >= 99) {
      return true;
    }

    // Safari 26+ (将来的に)
    const safariMatch = ua.match(/Version\/(\d+).*Safari/);
    if (safariMatch && safariMatch[1] && parseInt(safariMatch[1], 10) >= 26) {
      return true;
    }

    return false;
  }

  /**
   * 推奨ブラウザを取得
   */
  getRecommendedBrowsers(): string[] {
    return ['Chrome 113以上', 'Edge 113以上', 'Opera 99以上', 'Safari 26以上（macOS/iOS）'];
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
