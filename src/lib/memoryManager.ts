/**
 * メモリ管理モジュール
 * ARCHITECTURE.md に記載されたメモリ管理戦略を実装
 */

interface ResourceTracker {
  id: string;
  size: number;
  timestamp: number;
}

class MemoryManager {
  private trackedResources = new Map<string, ResourceTracker>();
  private blobUrls = new Set<string>();

  // 1GB制限
  private readonly MAX_MEMORY = 1024 * 1024 * 1024;
  // 800MB警告閾値
  private readonly WARNING_THRESHOLD = 0.8;

  // リスナー
  private warningListeners: Set<(usage: number) => void> = new Set();

  /**
   * リソースを追跡する
   */
  track(resourceId: string, size: number): void {
    this.trackedResources.set(resourceId, {
      id: resourceId,
      size,
      timestamp: Date.now(),
    });
    this.checkMemoryPressure();
  }

  /**
   * リソースを解放する
   */
  release(resourceId: string): void {
    this.trackedResources.delete(resourceId);
  }

  /**
   * Blob URLを追跡する
   */
  trackBlobUrl(url: string): void {
    this.blobUrls.add(url);
  }

  /**
   * Blob URLを解放する
   */
  releaseBlobUrl(url: string): void {
    if (this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
    }
  }

  /**
   * 現在のメモリ使用量を取得
   */
  getCurrentUsage(): number {
    // Chrome の performance.memory が利用可能な場合
    if ('memory' in performance) {
      return (performance as unknown as { memory: { usedJSHeapSize: number } }).memory
        .usedJSHeapSize;
    }

    // フォールバック: 追跡リソースから推定
    let total = 0;
    for (const resource of this.trackedResources.values()) {
      total += resource.size;
    }
    return total;
  }

  /**
   * 追加の割り当てが可能か確認
   */
  canAllocate(size: number): boolean {
    const current = this.getCurrentUsage();
    return current + size < this.MAX_MEMORY;
  }

  /**
   * メモリ使用率を取得（0-1）
   */
  getUsageRatio(): number {
    return this.getCurrentUsage() / this.MAX_MEMORY;
  }

  /**
   * 警告閾値を超えているか確認
   */
  isWarning(): boolean {
    return this.getUsageRatio() > this.WARNING_THRESHOLD;
  }

  /**
   * すべてのリソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('MemoryManager: Starting cleanup...');

    // すべての Blob URL を解放
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();

    // 追跡リソースをクリア
    this.trackedResources.clear();

    // GC ヒント（Chrome のみ、アドバイザリー）
    if ('gc' in window) {
      (window as unknown as { gc: () => void }).gc();
    }

    // クリーンアップが落ち着くまで待機
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('MemoryManager: Cleanup complete');
  }

  /**
   * 古いリソースをクリーンアップ（LRU方式）
   */
  async cleanupOldResources(maxAge: number = 5 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let freedCount = 0;

    for (const [id, resource] of this.trackedResources.entries()) {
      if (now - resource.timestamp > maxAge) {
        this.release(id);
        freedCount++;
      }
    }

    return freedCount;
  }

  /**
   * メモリ圧力をチェックし、必要に応じて警告を発行
   */
  private checkMemoryPressure(): void {
    const usage = this.getCurrentUsage();
    const threshold = this.MAX_MEMORY * this.WARNING_THRESHOLD;

    if (usage > threshold) {
      console.warn(`MemoryManager: High memory usage: ${this.formatBytes(usage)}`);

      // 警告イベントを発行
      window.dispatchEvent(
        new CustomEvent('memory-warning', {
          detail: { usage, max: this.MAX_MEMORY },
        })
      );

      // リスナーに通知
      this.warningListeners.forEach((listener) => listener(usage));
    }
  }

  /**
   * 警告リスナーを追加
   */
  onWarning(callback: (usage: number) => void): () => void {
    this.warningListeners.add(callback);
    return () => this.warningListeners.delete(callback);
  }

  /**
   * 画像のメモリ使用量を推定
   */
  calculateImageMemory(width: number, height: number, hasAlpha = true): number {
    const bytesPerPixel = hasAlpha ? 4 : 3;
    return width * height * bytesPerPixel;
  }

  /**
   * バイト数を人間が読みやすい形式にフォーマット
   */
  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  /**
   * 診断情報を取得
   */
  getDiagnostics(): {
    currentUsage: number;
    maxMemory: number;
    usageRatio: number;
    isWarning: boolean;
    trackedResources: number;
    blobUrls: number;
  } {
    return {
      currentUsage: this.getCurrentUsage(),
      maxMemory: this.MAX_MEMORY,
      usageRatio: this.getUsageRatio(),
      isWarning: this.isWarning(),
      trackedResources: this.trackedResources.size,
      blobUrls: this.blobUrls.size,
    };
  }
}

// シングルトンインスタンス
export const memoryManager = new MemoryManager();
export default memoryManager;
