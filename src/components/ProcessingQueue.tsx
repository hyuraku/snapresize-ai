import { useImageStore } from '../store/imageStore';
import { getTranslation } from '../constants/translations';
import { Image, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ProcessingStatus } from '../types';

interface ProcessingQueueProps {
  lang?: 'ja' | 'en';
}

const getStatusConfig = (status: ProcessingStatus) => {
  const configs = {
    pending: {
      color: 'text-[--color-navy-light]',
      bg: 'bg-[--color-sand]',
      progressBg: 'bg-[--color-sand]',
      icon: Image,
    },
    processing: {
      color: 'text-[--color-coral]',
      bg: 'bg-[--color-coral]/10',
      progressBg: 'bg-gradient-to-r from-[--color-coral] to-[--color-coral-light]',
      icon: Loader2,
    },
    completed: {
      color: 'text-[--color-sage]',
      bg: 'bg-[--color-sage]/10',
      progressBg: 'bg-[--color-sage]',
      icon: CheckCircle,
    },
    failed: {
      color: 'text-red-500',
      bg: 'bg-red-50',
      progressBg: 'bg-red-400',
      icon: XCircle,
    },
  };
  return configs[status] || configs.pending;
};

export const ProcessingQueue = ({ lang = 'ja' }: ProcessingQueueProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const files = useImageStore((state) => state.files);
  const unit = t('unitImages');

  return (
    <section className="mt-8 animate-fade-in-up delay-300">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-navy]/5">
              <Image className="w-5 h-5 text-[--color-navy]" />
            </div>
            <h2 className="text-lg font-bold text-[--color-navy]">{t('queueTitle')}</h2>
          </div>
          <span className="text-sm font-medium text-[--color-navy-light] bg-[--color-sand]/50 px-3 py-1 rounded-full">
            {files.length}
            {unit}
          </span>
        </div>
        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[--color-sand]/50 flex items-center justify-center mb-4">
                <Image className="w-8 h-8 text-[--color-navy-light]/40" />
              </div>
              <p className="text-[--color-navy-light]">{t('queueEmpty')}</p>
            </div>
          ) : (
            files.map((file) => {
              const config = getStatusConfig(file.status);
              const IconComponent = config.icon;

              return (
                <div
                  key={file.id}
                  className={`rounded-xl border border-[--color-sand] p-4 transition-all ${config.bg}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <IconComponent
                        className={`w-4 h-4 flex-shrink-0 ${config.color} ${file.status === 'processing' ? 'animate-spin' : ''}`}
                      />
                      <span className="text-sm font-medium text-[--color-navy] truncate">
                        {file.name}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${config.color} ml-2`}>
                      {file.progress}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${config.progressBg}`}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
