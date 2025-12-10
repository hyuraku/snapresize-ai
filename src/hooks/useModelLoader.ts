/**
 * モデルローダーフック
 */
import { useState, useEffect, useCallback } from 'react';
import { modelLoader, type LoadProgress } from '../lib/modelLoader';

export interface UseModelLoaderResult {
  isLoading: boolean;
  isReady: boolean;
  isCached: boolean | null;
  progress: LoadProgress | null;
  error: Error | null;
  load: () => Promise<void>;
  checkCache: () => Promise<boolean>;
  clearCache: () => Promise<void>;
}

export const useModelLoader = (): UseModelLoaderResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCached, setIsCached] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // 初期化時にキャッシュを確認
  useEffect(() => {
    const checkInitialCache = async () => {
      const cached = await modelLoader.isModelCached();
      setIsCached(cached);
      if (modelLoader.isModelLoaded()) {
        setIsReady(true);
      }
    };
    checkInitialCache();
  }, []);

  const load = useCallback(async () => {
    if (isLoading || isReady) return;

    setIsLoading(true);
    setError(null);

    try {
      await modelLoader.loadWithProgress((progressUpdate) => {
        setProgress(progressUpdate);
        if (progressUpdate.status === 'cached') {
          setIsCached(true);
        }
      });
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isReady]);

  const checkCache = useCallback(async () => {
    const cached = await modelLoader.isModelCached();
    setIsCached(cached);
    return cached;
  }, []);

  const clearCache = useCallback(async () => {
    await modelLoader.clearCache();
    setIsCached(false);
    setIsReady(false);
    setProgress(null);
  }, []);

  return {
    isLoading,
    isReady,
    isCached,
    progress,
    error,
    load,
    checkCache,
    clearCache,
  };
};

export default useModelLoader;
