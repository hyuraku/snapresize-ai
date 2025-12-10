/**
 * AIモデルローダー
 * ARCHITECTURE.md に記載されたプログレッシブローディングを実装
 */

// モデルのURLとキャッシュ設定
const MODEL_CACHE_NAME = 'snapresize-ai-models-v1';
const MODEL_URL = 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx';
const MODEL_SIZE_ESTIMATE = 177 * 1024 * 1024; // 177MB

export interface LoadProgress {
  percent: number;
  loaded: number;
  total: number;
  status: 'checking' | 'downloading' | 'cached' | 'ready' | 'error';
  message: string;
}

export type ProgressCallback = (progress: LoadProgress) => void;

class ModelLoader {
  private cache: Cache | null = null;
  private isLoading = false;
  private loadedModel: ArrayBuffer | null = null;

  /**
   * キャッシュを初期化
   */
  private async initCache(): Promise<Cache | null> {
    if (this.cache) return this.cache;

    try {
      if ('caches' in window) {
        this.cache = await caches.open(MODEL_CACHE_NAME);
        return this.cache;
      }
    } catch (error) {
      console.warn('ModelLoader: Cache Storage not available:', error);
    }
    return null;
  }

  /**
   * キャッシュからモデルを確認
   */
  async checkCache(): Promise<ArrayBuffer | null> {
    const cache = await this.initCache();
    if (!cache) return null;

    try {
      const response = await cache.match(MODEL_URL);
      if (response) {
        console.log('ModelLoader: Found cached model');
        return await response.arrayBuffer();
      }
    } catch (error) {
      console.warn('ModelLoader: Failed to read cache:', error);
    }
    return null;
  }

  /**
   * モデルをキャッシュに保存
   */
  private async cacheModel(buffer: ArrayBuffer): Promise<void> {
    const cache = await this.initCache();
    if (!cache) return;

    try {
      const response = new Response(buffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.byteLength.toString(),
          'X-Cached-At': new Date().toISOString(),
        },
      });
      await cache.put(MODEL_URL, response);
      console.log('ModelLoader: Model cached successfully');
    } catch (error) {
      console.warn('ModelLoader: Failed to cache model:', error);
    }
  }

  /**
   * プログレス付きでモデルをロード
   */
  async loadWithProgress(onProgress: ProgressCallback): Promise<ArrayBuffer> {
    if (this.loadedModel) {
      onProgress({
        percent: 100,
        loaded: this.loadedModel.byteLength,
        total: this.loadedModel.byteLength,
        status: 'ready',
        message: 'モデルは既にロード済みです',
      });
      return this.loadedModel;
    }

    if (this.isLoading) {
      throw new Error('Model is already being loaded');
    }

    this.isLoading = true;

    try {
      // Step 1: キャッシュを確認
      onProgress({
        percent: 0,
        loaded: 0,
        total: MODEL_SIZE_ESTIMATE,
        status: 'checking',
        message: 'キャッシュを確認中...',
      });

      const cached = await this.checkCache();
      if (cached) {
        this.loadedModel = cached;
        onProgress({
          percent: 100,
          loaded: cached.byteLength,
          total: cached.byteLength,
          status: 'cached',
          message: 'キャッシュからロード完了！',
        });
        return cached;
      }

      // Step 2: ダウンロード開始
      onProgress({
        percent: 0,
        loaded: 0,
        total: MODEL_SIZE_ESTIMATE,
        status: 'downloading',
        message: 'AIモデルをダウンロード中...',
      });

      const response = await fetch(MODEL_URL, {
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const contentLength = parseInt(response.headers.get('Content-Length') || '0') || MODEL_SIZE_ESTIMATE;
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      // Step 3: プログレス付きでダウンロード
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        const percent = Math.min(99, (receivedLength / contentLength) * 100);
        onProgress({
          percent,
          loaded: receivedLength,
          total: contentLength,
          status: 'downloading',
          message: `ダウンロード中... ${this.formatBytes(receivedLength)} / ${this.formatBytes(contentLength)}`,
        });
      }

      // Step 4: チャンクを結合
      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      // Step 5: キャッシュに保存
      await this.cacheModel(allChunks.buffer);

      this.loadedModel = allChunks.buffer;

      onProgress({
        percent: 100,
        loaded: receivedLength,
        total: contentLength,
        status: 'ready',
        message: 'ダウンロード完了！',
      });

      return allChunks.buffer;
    } catch (error) {
      onProgress({
        percent: 0,
        loaded: 0,
        total: MODEL_SIZE_ESTIMATE,
        status: 'error',
        message: `ダウンロードエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * モデルがロード済みか確認
   */
  isModelLoaded(): boolean {
    return this.loadedModel !== null;
  }

  /**
   * モデルがキャッシュ済みか確認
   */
  async isModelCached(): Promise<boolean> {
    const cached = await this.checkCache();
    return cached !== null;
  }

  /**
   * キャッシュをクリア
   */
  async clearCache(): Promise<void> {
    try {
      if ('caches' in window) {
        await caches.delete(MODEL_CACHE_NAME);
        console.log('ModelLoader: Cache cleared');
      }
    } catch (error) {
      console.warn('ModelLoader: Failed to clear cache:', error);
    }
    this.loadedModel = null;
    this.cache = null;
  }

  /**
   * バイト数をフォーマット
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * 推定ダウンロード時間を取得
   */
  getEstimatedDownloadTime(speedMbps: number = 10): number {
    // speedMbps: Mbps (メガビット/秒)
    const sizeMb = MODEL_SIZE_ESTIMATE / 1024 / 1024; // MB
    const speedMBps = speedMbps / 8; // MB/秒
    return Math.ceil(sizeMb / speedMBps); // 秒
  }

  /**
   * モデルサイズを取得
   */
  getModelSizeEstimate(): number {
    return MODEL_SIZE_ESTIMATE;
  }
}

// シングルトンインスタンス
export const modelLoader = new ModelLoader();
export default modelLoader;
