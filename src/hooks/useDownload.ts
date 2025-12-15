import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useCallback, useState } from 'react';
import { useImageStore } from '../store/imageStore';

export const useDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const processed = useImageStore((state) => state.processed);

  const downloadAll = useCallback(async () => {
    if (processed.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // 1枚の場合は単体ファイルをダウンロード
      if (processed.length === 1) {
        const item = processed[0];
        if (item) {
          saveAs(item.blob, item.name);
          setDownloadProgress(100);
        }
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder('snapresize-ai');
      if (!folder) throw new Error('Failed to create ZIP folder');

      // 各画像を ZIP に追加
      for (let i = 0; i < processed.length; i++) {
        const item = processed[i];
        if (item) {
          folder.file(item.name, item.blob);
        }
        setDownloadProgress(Math.round(((i + 1) / processed.length) * 50));
      }

      // ZIP ファイルを生成
      const content = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          setDownloadProgress(50 + Math.round(metadata.percent / 2));
        }
      );

      // ダウンロード
      const timestamp = new Date().toISOString().slice(0, 10);
      saveAs(content, `snapresize-ai_${timestamp}.zip`);

      setDownloadProgress(100);
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    } finally {
      setIsDownloading(false);
    }
  }, [processed]);

  const downloadSingle = useCallback(
    (index: number) => {
      const item = processed[index];
      if (!item) return;

      saveAs(item.blob, item.name);
    },
    [processed]
  );

  return {
    downloadAll,
    downloadSingle,
    isDownloading,
    downloadProgress,
  };
};
