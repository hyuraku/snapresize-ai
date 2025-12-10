import { useCallback, useRef, useEffect } from 'react';
import { useImageStore } from '../store/imageStore';
import {
  blobToImage,
  blobToImageData,
  resizeImage,
  addWatermark,
  canvasToBlob,
  getPresetSize,
} from '../utils/imageProcessing';
import { SNS_PRESETS } from '../constants/presets';
import type { ProcessedImage } from '../types';

export const useImageProcessor = () => {
  const workerRef = useRef<Worker | null>(null);
  const maskCacheRef = useRef<Map<string, ImageData>>(new Map());
  const modelReadyRef = useRef<boolean>(false);

  const files = useImageStore((state) => state.files);
  const settings = useImageStore((state) => state.settings);
  const updateFileStatus = useImageStore((state) => state.updateFileStatus);
  const addProcessedImage = useImageStore((state) => state.addProcessedImage);
  const setModelState = useImageStore((state) => state.setModelState);
  const setIsProcessing = useImageStore((state) => state.setIsProcessing);

  // Worker の初期化
  useEffect(() => {
    if (settings.enableBackgroundRemoval && !workerRef.current) {
      modelReadyRef.current = false;
      
      // Web Worker を動的にインポート
      workerRef.current = new Worker(
        new URL('../workers/backgroundRemoval.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (e) => {
        const { type, payload } = e.data;

        switch (type) {
          case 'progress':
            if (payload.status === 'ready') {
              modelReadyRef.current = true;
            }
            setModelState({
              status: payload.status === 'ready' ? 'ready' : 'loading',
              progress: payload.progress,
              message: payload.message,
              device: payload.device || null,
            });
            break;
          case 'result':
            console.log('[useImageProcessor] result受信:', { id: payload.id, hasBuffer: !!payload.buffer });
            if (payload.id && payload.buffer) {
              // ArrayBuffer から ImageData を再構築
              const uint8Array = new Uint8ClampedArray(payload.buffer);
              const imageData = new ImageData(uint8Array, payload.width, payload.height);
              console.log('[useImageProcessor] maskCacheに保存:', payload.id, { width: imageData.width, height: imageData.height });
              maskCacheRef.current.set(payload.id, imageData);
              // 処理完了後、modelStateを「ready」に戻す
              setModelState({
                status: 'ready',
                progress: 100,
                message: 'AI準備完了！',
              });
            }
            break;
          case 'error':
            console.error('[useImageProcessor] Workerエラー:', payload.message);
            modelReadyRef.current = false;
            setModelState({
              status: 'error',
              message: payload.message,
            });
            break;
        }
      };

      workerRef.current.onerror = (e) => {
        console.error('[useImageProcessor] Worker実行エラー:', e.message);
        modelReadyRef.current = false;
        setModelState({
          status: 'error',
          message: `Workerエラー: ${e.message}`,
        });
      };

      // モデル初期化
      workerRef.current.postMessage({ type: 'init' });
    }

    // 背景除去が無効になった場合はWorkerを終了
    if (!settings.enableBackgroundRemoval && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      modelReadyRef.current = false;
      setModelState({
        status: 'idle',
        progress: 0,
        message: '',
        device: null,
      });
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        modelReadyRef.current = false;
      }
    };
  }, [settings.enableBackgroundRemoval, setModelState]);

  // 単一画像を処理
  const processFile = useCallback(
    async (fileId: string): Promise<ProcessedImage | null> => {
      const file = files.find((f) => f.id === fileId);
      if (!file) return null;

      try {
        updateFileStatus(fileId, 'processing', 10);

        // Blob から Image を取得
        const img = await blobToImage(file.blob);
        updateFileStatus(fileId, 'processing', 20);

        // 背景除去が有効な場合
        let maskData: ImageData | undefined;
        if (settings.enableBackgroundRemoval && workerRef.current) {
          console.log('[useImageProcessor] 背景除去開始');
          
          // モデルが準備完了するまで待機
          if (!modelReadyRef.current) {
            console.log('[useImageProcessor] モデル準備待機中...');
            const modelTimeout = 120000; // 2分
            const modelStartTime = Date.now();
            while (!modelReadyRef.current) {
              if (Date.now() - modelStartTime > modelTimeout) {
                throw new Error('AIモデルの読み込みがタイムアウトしました');
              }
              await new Promise((r) => setTimeout(r, 200));
            }
            console.log('[useImageProcessor] モデル準備完了');
          }
          
          const imageData = await blobToImageData(file.blob);
          console.log('[useImageProcessor] imageData取得:', { width: imageData.width, height: imageData.height, dataLength: imageData.data.length });
          
          // ImageData を転送可能な形式に変換して Worker に送信
          const buffer = imageData.data.buffer.slice(0);
          console.log('[useImageProcessor] buffer作成:', { byteLength: buffer.byteLength });
          workerRef.current.postMessage(
            {
              type: 'process',
              payload: {
                width: imageData.width,
                height: imageData.height,
                buffer: buffer,
                id: fileId,
              },
            },
            [buffer]
          );
          console.log('[useImageProcessor] Workerにメッセージ送信完了');

          // 結果を待つ（最大60秒）
          const timeout = 60000;
          const startTime = Date.now();
          while (!maskCacheRef.current.has(fileId)) {
            if (Date.now() - startTime > timeout) {
              throw new Error('背景除去処理がタイムアウトしました');
            }
            await new Promise((r) => setTimeout(r, 100));
            updateFileStatus(fileId, 'processing', Math.min(70, 30 + ((Date.now() - startTime) / timeout) * 40));
          }

          maskData = maskCacheRef.current.get(fileId);
          console.log('[useImageProcessor] maskData取得:', { fileId, hasMaskData: !!maskData });
          maskCacheRef.current.delete(fileId);
        }

        updateFileStatus(fileId, 'processing', 75);

        // リサイズ
        const { width, height } = getPresetSize(
          settings.preset,
          settings.customWidth,
          settings.customHeight
        );

        let canvas: HTMLCanvasElement;

        console.log('[useImageProcessor] 最終maskData:', { hasMaskData: !!maskData, width: maskData?.width, height: maskData?.height });
        if (maskData) {
          console.log('[useImageProcessor] 背景除去パス実行');
          // 背景除去済みの場合はマスク画像を使用
          canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: true });
          if (!ctx) throw new Error('Canvas context not available');

          // キャンバスを透明でクリア
          ctx.clearRect(0, 0, width, height);

          // マスク適用済みの画像をキャンバスに描画
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = maskData.width;
          tempCanvas.height = maskData.height;
          const tempCtx = tempCanvas.getContext('2d', { alpha: true });
          if (!tempCtx) throw new Error('Temp canvas context not available');
          tempCtx.putImageData(maskData, 0, 0);

          // リサイズして描画
          const imgRatio = maskData.width / maskData.height;
          const canvasRatio = width / height;
          let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

          if (imgRatio > canvasRatio) {
            drawHeight = height;
            drawWidth = drawHeight * imgRatio;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
          } else {
            drawWidth = width;
            drawHeight = drawWidth / imgRatio;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
          }

          ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);
        } else {
          // 通常のリサイズ
          canvas = resizeImage(img, width, height);
        }

        updateFileStatus(fileId, 'processing', 85);

        // 透かし追加
        if (settings.enableWatermark && settings.watermarkText) {
          addWatermark(canvas, settings.watermarkText, settings.watermarkPosition);
        }

        updateFileStatus(fileId, 'processing', 90);

        // Blob に変換
        const blob = await canvasToBlob(
          canvas,
          settings.quality,
          settings.enableBackgroundRemoval
        );

        updateFileStatus(fileId, 'completed', 100);

        const preset = SNS_PRESETS[settings.preset];
        const extension = settings.enableBackgroundRemoval ? 'png' : 'jpg';
        const newName = file.name.replace(/\.[^.]+$/, `_${preset.key}.${extension}`);

        const processedImage: ProcessedImage = {
          id: crypto.randomUUID(),
          originalId: file.id,
          name: newName,
          blob,
          preset,
          hasWatermark: settings.enableWatermark,
          hasBackgroundRemoval: settings.enableBackgroundRemoval,
          quality: settings.quality,
        };

        addProcessedImage(processedImage);
        return processedImage;
      } catch (error) {
        console.error('Processing error:', error);
        updateFileStatus(
          fileId,
          'failed',
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
        return null;
      }
    },
    [files, settings, updateFileStatus, addProcessedImage]
  );

  // バッチ処理
  const processAll = useCallback(async () => {
    setIsProcessing(true);

    const pendingFiles = files.filter((f) => f.status === 'pending');
    for (const file of pendingFiles) {
      await processFile(file.id);
      // UI更新のための小休止
      await new Promise((r) => setTimeout(r, 50));
    }

    setIsProcessing(false);
  }, [files, processFile, setIsProcessing]);

  return {
    processFile,
    processAll,
  };
};
