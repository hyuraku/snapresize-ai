import { AlertTriangle, HardDrive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { memoryManager } from '../lib/memoryManager';
import { getTranslation } from '../constants/translations';
import type { Backend } from '../lib/capabilityDetector';

interface StatusIndicatorProps {
  backend: Backend | 'detecting';
  lang?: 'ja' | 'en';
}

export const StatusIndicator = ({ backend, lang = 'ja' }: StatusIndicatorProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const [isMemoryWarning, setIsMemoryWarning] = useState(false);

  useEffect(() => {
    // メモリ使用量を定期的に更新
    const interval = setInterval(() => {
      setIsMemoryWarning(memoryManager.isWarning());
    }, 2000);

    // メモリ警告リスナー
    const unsubscribe = memoryManager.onWarning(() => {
      setIsMemoryWarning(true);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  // 検出中は何も表示しない
  if (backend === 'detecting') {
    return null;
  }

  // 警告がない場合は何も表示しない
  if (!isMemoryWarning) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* メモリ使用量（警告時のみ表示） */}
      <div className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs bg-red-500/10 border-red-500/30">
        <HardDrive className="h-3.5 w-3.5 text-red-400" />
        <span className="text-red-300">{t('statusHighMemory')}</span>
      </div>
    </div>
  );
};

/**
 * WASM警告バナー
 */
export const WASMWarningBanner = ({ lang = 'ja' }: { lang?: 'ja' | 'en' }) => {
  const t = (key: string) => getTranslation(key, lang);

  return (
    <div className="rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-200">{t('wasmWarningTitle')}</h3>
          <p className="mt-1 text-sm text-amber-300/80">{t('wasmWarningDesc')}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">
              Chrome 113+
            </span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">
              Edge 113+
            </span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">
              Opera 99+
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusIndicator;
