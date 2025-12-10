import { useImageStore } from '../store/imageStore';
import { getTranslation } from '../constants/translations';
import { formatBytes } from '../utils/imageProcessing';
import { useDownload } from '../hooks/useDownload';
import { Image, Loader2, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import type { ProcessingStatus } from '../types';

interface FileListProps {
  lang?: 'ja' | 'en';
}

const getStatusConfig = (status: ProcessingStatus, t: (key: string) => string) => {
  const configs = {
    pending: { 
      text: t('filePending'), 
      color: 'text-[--color-navy-light]',
      bgColor: 'bg-[--color-sand]/30',
      icon: Clock
    },
    processing: { 
      text: t('fileProcessing'), 
      color: 'text-[--color-coral]',
      bgColor: 'bg-[--color-coral]/5',
      icon: Loader2
    },
    completed: { 
      text: t('fileCompleted'), 
      color: 'text-[--color-sage]',
      bgColor: 'bg-[--color-sage]/5',
      icon: CheckCircle
    },
    failed: { 
      text: t('fileFailed'), 
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      icon: XCircle
    },
  };
  return configs[status] || configs.pending;
};

export const FileList = ({ lang = 'ja' }: FileListProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const files = useImageStore((state) => state.files);
  const processed = useImageStore((state) => state.processed);
  const { downloadSingle } = useDownload();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-2">
      {files.map((file) => {
        const config = getStatusConfig(file.status, t);
        const IconComponent = config.icon;
        const isCompleted = file.status === 'completed';
        // originalId で処理済み画像を検索
        const processedItem = processed.find(p => p.originalId === file.id);
        const processedIndex = processedItem ? processed.indexOf(processedItem) : -1;
        
        return (
          <div
            key={file.id}
            className={`flex items-center justify-between rounded-xl border border-[--color-sand] px-4 py-3 transition-all ${config.bgColor}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-lg bg-white border border-[--color-sand] flex items-center justify-center flex-shrink-0">
                <Image className="w-5 h-5 text-[--color-navy-light]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[--color-navy] text-sm truncate">{file.name}</p>
                <p className="text-xs text-[--color-navy-light]">{formatBytes(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                <IconComponent className={`w-4 h-4 ${file.status === 'processing' ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{config.text}</span>
              </div>
              {isCompleted && processedIndex >= 0 && (
                <button
                  onClick={() => downloadSingle(processedIndex)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[--color-sage] text-white text-xs font-medium hover:bg-[--color-sage]/90 transition-all hover:shadow-md"
                  aria-label={`${file.name}をダウンロード`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('btnDownload')}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
