import { useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Image, Sparkles, AlertTriangle, X } from 'lucide-react';
import { useImageStore } from '../store/imageStore';
import { getTranslation } from '../constants/translations';
import { formatRejectionReason } from '../utils/rejectionReason';

interface FileUploadProps {
  lang?: 'ja' | 'en';
}

export const FileUpload = ({ lang = 'ja' }: FileUploadProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = useImageStore((state) => state.addFiles);
  const rejectedFiles = useImageStore((state) => state.rejectedFiles);
  const dismissRejected = useImageStore((state) => state.dismissRejected);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add(
      'ring-2',
      'ring-(--color-coral)',
      'ring-offset-2',
      'bg-(--color-coral)/5'
    );
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove(
      'ring-2',
      'ring-(--color-coral)',
      'ring-offset-2',
      'bg-(--color-coral)/5'
    );
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove(
        'ring-2',
        'ring-(--color-coral)',
        'ring-offset-2',
        'bg-(--color-coral)/5'
      );
      // 拒否理由は store の rejectedFiles に入り、下のパネルに表示される
      await addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        await addFiles(Array.from(e.target.files));
      }
      // リセットして同じファイルを再選択可能に
      e.target.value = '';
    },
    [addFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="mt-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className="relative overflow-hidden rounded-2xl border-2 border-dashed border-(--color-sand) bg-gradient-to-br from-white to-(--color-cream) p-10 text-center transition-all duration-300 hover:border-(--color-coral)/50 hover:shadow-lg cursor-pointer group"
        data-testid="dropZone"
      >
        {/* 装飾アイコン */}
        <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-opacity">
          <Sparkles className="w-8 h-8 text-(--color-coral)" />
        </div>
        <div className="absolute bottom-4 left-4 opacity-20 group-hover:opacity-40 transition-opacity">
          <Image className="w-8 h-8 text-(--color-sage)" />
        </div>

        {/* メインコンテンツ */}
        <div className="relative z-10">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-(--color-coral)/10 to-(--color-sage)/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <Upload className="h-8 w-8 text-(--color-coral)" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-semibold text-(--color-navy)">{t('dropZoneTitle')}</p>
          <p className="mt-2 text-sm text-(--color-navy-light)">{t('dropZoneSubtitle')}</p>
          <p className="mt-2 text-xs text-(--color-navy-light)/60">{t('dropZoneFormats')}</p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-(--color-navy) px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-(--color-navy-light) hover:shadow-lg group-hover:scale-105">
            <Upload className="w-4 h-4" />
            <span>{t('btnSelectFiles')}</span>
          </button>
        </div>
      </div>
      {rejectedFiles.length > 0 && (
        <div
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          role="alert"
          data-testid="rejectedPanel"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-800">{t('rejectedTitle')}</p>
              <ul className="mt-2 space-y-1.5">
                {rejectedFiles.map((rejected, index) => (
                  <li
                    key={`${rejected.name}-${index}`}
                    className="text-xs text-amber-700 break-words"
                  >
                    <span className="font-medium">{rejected.name}</span>：
                    {formatRejectionReason(rejected.reason, lang)}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={dismissRejected}
              aria-label={t('rejectedDismiss')}
              data-testid="dismissRejected"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-amber-700 transition-colors hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        data-testid="fileInput"
      />
    </div>
  );
};
