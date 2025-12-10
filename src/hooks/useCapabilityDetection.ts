/**
 * WebGPU/WASM検出フック
 */
import { useState, useEffect } from 'react';
import { capabilityDetector, type Backend, type CapabilityInfo } from '../lib/capabilityDetector';

export interface UseCapabilityDetectionResult {
  backend: Backend | 'detecting';
  isDetecting: boolean;
  capabilityInfo: CapabilityInfo | null;
  recommendedChunkSize: number;
  estimatedTime: (imageCount: number) => string;
}

export const useCapabilityDetection = (): UseCapabilityDetectionResult => {
  const [isDetecting, setIsDetecting] = useState(true);
  const [capabilityInfo, setCapabilityInfo] = useState<CapabilityInfo | null>(null);

  useEffect(() => {
    let mounted = true;

    const detect = async () => {
      try {
        const info = await capabilityDetector.detectBestBackend();
        if (mounted) {
          setCapabilityInfo(info);
          setIsDetecting(false);
        }
      } catch (error) {
        console.error('Capability detection failed:', error);
        if (mounted) {
          // エラー時はWASMにフォールバック
          setCapabilityInfo({
            backend: 'wasm',
            isWebGPUAvailable: false,
            adapterInfo: null,
            recommendedChunkSize: 2,
            estimatedSpeedMultiplier: 100,
          });
          setIsDetecting(false);
        }
      }
    };

    detect();

    return () => {
      mounted = false;
    };
  }, []);

  const estimatedTime = (imageCount: number): string => {
    if (!capabilityInfo) return '計算中...';
    return capabilityDetector.getEstimatedTimeString(capabilityInfo.backend, imageCount);
  };

  return {
    backend: isDetecting ? 'detecting' : (capabilityInfo?.backend ?? 'wasm'),
    isDetecting,
    capabilityInfo,
    recommendedChunkSize: capabilityInfo?.recommendedChunkSize ?? 2,
    estimatedTime,
  };
};

export default useCapabilityDetection;
