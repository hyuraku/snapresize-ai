import { useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Image, Sparkles } from 'lucide-react';
import { useImageStore } from '../store/imageStore';
import { getTranslation } from '../constants/translations';

interface FileUploadProps {
  lang?: 'ja' | 'en';
}

export const FileUpload = ({ lang = 'ja' }: FileUploadProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = useImageStore((state) => state.addFiles);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add(
      'ring-2',
      'ring-[--color-coral]',
      'ring-offset-2',
      'bg-[--color-coral]/5'
    );
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove(
      'ring-2',
      'ring-[--color-coral]',
      'ring-offset-2',
      'bg-[--color-coral]/5'
    );
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove(
        'ring-2',
        'ring-[--color-coral]',
        'ring-offset-2',
        'bg-[--color-coral]/5'
      );
      const droppedFiles = Array.from(e.dataTransfer.files);
      const result = await addFiles(droppedFiles);
      if (result.rejected.length > 0) {
        console.warn('Rejected files:', result.rejected);
      }
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        const result = await addFiles(selectedFiles);
        if (result.rejected.length > 0) {
          console.warn('Rejected files:', result.rejected);
        }
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
        className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[--color-sand] bg-gradient-to-br from-white to-[--color-cream] p-10 text-center transition-all duration-300 hover:border-[--color-coral]/50 hover:shadow-lg cursor-pointer group"
      >
        {/* 装飾アイコン */}
        <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-opacity">
          <Sparkles className="w-8 h-8 text-[--color-coral]" />
        </div>
        <div className="absolute bottom-4 left-4 opacity-20 group-hover:opacity-40 transition-opacity">
          <Image className="w-8 h-8 text-[--color-sage]" />
        </div>

        {/* メインコンテンツ */}
        <div className="relative z-10">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[--color-coral]/10 to-[--color-sage]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <Upload className="h-8 w-8 text-[--color-coral]" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-semibold text-[--color-navy]">{t('dropZoneTitle')}</p>
          <p className="mt-2 text-sm text-[--color-navy-light]">{t('dropZoneSubtitle')}</p>
          <p className="mt-2 text-xs text-[--color-navy-light]/60">{t('dropZoneFormats')}</p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-[--color-navy] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[--color-navy-light] hover:shadow-lg group-hover:scale-105">
            <Upload className="w-4 h-4" />
            <span>{t('btnSelectFiles')}</span>
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />
    </div>
  );
};
