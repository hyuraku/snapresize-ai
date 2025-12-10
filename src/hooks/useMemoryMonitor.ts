/**
 * メモリ監視フック
 */
import { useState, useEffect, useCallback } from 'react';
import { memoryManager } from '../lib/memoryManager';

export interface UseMemoryMonitorResult {
  currentUsage: number;
  usageRatio: number;
  isWarning: boolean;
  formatBytes: (bytes: number) => string;
  cleanup: () => Promise<void>;
  diagnostics: ReturnType<typeof memoryManager.getDiagnostics>;
}

export const useMemoryMonitor = (updateInterval = 2000): UseMemoryMonitorResult => {
  const [diagnostics, setDiagnostics] = useState(memoryManager.getDiagnostics());

  useEffect(() => {
    // 定期的に診断情報を更新
    const interval = setInterval(() => {
      setDiagnostics(memoryManager.getDiagnostics());
    }, updateInterval);

    // メモリ警告イベントを購読
    const unsubscribe = memoryManager.onWarning(() => {
      setDiagnostics(memoryManager.getDiagnostics());
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [updateInterval]);

  const cleanup = useCallback(async () => {
    await memoryManager.cleanup();
    setDiagnostics(memoryManager.getDiagnostics());
  }, []);

  return {
    currentUsage: diagnostics.currentUsage,
    usageRatio: diagnostics.usageRatio,
    isWarning: diagnostics.isWarning,
    formatBytes: memoryManager.formatBytes.bind(memoryManager),
    cleanup,
    diagnostics,
  };
};

export default useMemoryMonitor;
