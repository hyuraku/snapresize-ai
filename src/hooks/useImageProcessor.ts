import { useCallback, useRef, useEffect } from 'react';
import { useImageStore } from '../store/imageStore';
import {
  blobToImage,
  imageToImageData,
  resizeImage,
  addWatermark,
  canvasToBlob,
  getPresetSize,
} from '../utils/imageProcessing';
import { buildOutputName } from '../utils/outputNaming';
import { SNS_PRESETS } from '../constants/presets';
import { MAX_INPUT_EDGE_PX, MAX_INPUT_PIXELS, formatPixels } from '../constants/limits';
import { formatRejectionReason } from '../utils/rejectionReason';
import type { ImageFile, ProcessedImage, ProcessingSettings, RejectionReason } from '../types';

/** モデル準備完了を待つ上限 */
const MODEL_READY_TIMEOUT_MS = 120000;
/** Worker の背景除去結果を待つ上限 */
const MASK_RESULT_TIMEOUT_MS = 60000;

/** バッチが無効化された（クリア／新バッチ開始）ことを表すエラー */
class BatchAbortedError extends Error {
  constructor(message = '処理が中断されました') {
    super(message);
    this.name = 'BatchAbortedError';
  }
}

/**
 * 上限超過・デコード失敗など、理由と対処を UI に出せる失敗。
 * 文言は持たず構造化した理由だけを持ち、表示側が言語に応じて組み立てる。
 */
class RejectedFileError extends Error {
  readonly reason: RejectionReason;

  constructor(reason: RejectionReason) {
    // store の error（文字列）にも同じ内容が入るよう、既定言語で文字列化しておく
    super(formatRejectionReason(reason));
    this.name = 'RejectedFileError';
    this.reason = reason;
  }
}

/** Worker への 1 要求 ＝ 1 Promise。タイマーも一緒に持ち、解決時に必ず解除する */
interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
}

export const useImageProcessor = () => {
  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef<boolean>(false);
  /** モデル初期化に失敗したときのエラー。以降の待機は即座に失敗させる */
  const modelErrorRef = useRef<Error | null>(null);
  /** 要求ID -> 結果待ちの Promise。ポーリングの代わりにこれで待つ */
  const pendingRequestsRef = useRef<Map<string, PendingRequest<ImageData>>>(new Map());
  /** モデル準備完了を待っている処理 */
  const modelWaitersRef = useRef<Set<PendingRequest<void>>>(new Set());
  const requestCounterRef = useRef<number>(0);

  const settings = useImageStore((state) => state.settings);
  const updateFileStatus = useImageStore((state) => state.updateFileStatus);
  const addProcessedImage = useImageStore((state) => state.addProcessedImage);
  const setModelState = useImageStore((state) => state.setModelState);

  /** 待機中の要求とモデル待ちをすべて失敗させ、タイマーを解除する */
  const rejectAllPending = useCallback((error: Error) => {
    const requests = Array.from(pendingRequestsRef.current.values());
    pendingRequestsRef.current.clear();
    for (const request of requests) {
      clearTimeout(request.timerId);
      request.reject(error);
    }

    const waiters = Array.from(modelWaitersRef.current);
    modelWaitersRef.current.clear();
    for (const waiter of waiters) {
      clearTimeout(waiter.timerId);
      waiter.reject(error);
    }
  }, []);

  // Worker の初期化
  useEffect(() => {
    if (settings.enableBackgroundRemoval && !workerRef.current) {
      modelReadyRef.current = false;
      modelErrorRef.current = null;

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
              modelErrorRef.current = null;
              // 準備完了を待っている処理をすべて再開させる
              const waiters = Array.from(modelWaitersRef.current);
              modelWaitersRef.current.clear();
              for (const waiter of waiters) {
                clearTimeout(waiter.timerId);
                waiter.resolve();
              }
            }
            setModelState({
              status: payload.status === 'ready' ? 'ready' : 'loading',
              progress: payload.progress,
              message: payload.message,
              device: payload.device || null,
            });
            break;
          case 'result': {
            // 待機中の要求が無い＝中断済みバッチの遅延結果。取り込まずに捨てる
            const request = payload.id ? pendingRequestsRef.current.get(payload.id) : undefined;
            if (!request) break;
            pendingRequestsRef.current.delete(payload.id);
            clearTimeout(request.timerId);

            if (!payload.buffer) {
              request.reject(new Error('背景除去の結果が空でした'));
              break;
            }

            // ArrayBuffer から ImageData を再構築
            const uint8Array = new Uint8ClampedArray(payload.buffer);
            const imageData = new ImageData(uint8Array, payload.width, payload.height);
            // 処理完了後、modelStateを「ready」に戻す
            setModelState({
              status: 'ready',
              progress: 100,
              message: 'AI準備完了！',
            });
            request.resolve(imageData);
            break;
          }
          case 'error': {
            console.error('[useImageProcessor] Workerエラー:', payload.message);
            const error = new Error(payload.message ?? 'Workerエラー');

            if (payload.id) {
              // 特定の画像の処理失敗。モデル自体は生きているので他の要求は継続する
              const failed = pendingRequestsRef.current.get(payload.id);
              if (failed) {
                pendingRequestsRef.current.delete(payload.id);
                clearTimeout(failed.timerId);
                failed.reject(error);
              }
              break;
            }

            // 初期化失敗。待機中のものをすべて即座に失敗させ、
            // 以降のファイルも 120 秒待たずに即座に失敗させる
            modelReadyRef.current = false;
            modelErrorRef.current = error;
            setModelState({
              status: 'error',
              message: payload.message,
            });
            rejectAllPending(error);
            break;
          }
        }
      };

      workerRef.current.onerror = (e) => {
        console.error('[useImageProcessor] Worker実行エラー:', e.message);
        const error = new Error(`Workerエラー: ${e.message}`);
        modelReadyRef.current = false;
        modelErrorRef.current = error;
        setModelState({
          status: 'error',
          message: error.message,
        });
        rejectAllPending(error);
      };

      // モデル初期化
      workerRef.current.postMessage({ type: 'init' });
    }

    // 背景除去が無効になった場合はWorkerを終了
    if (!settings.enableBackgroundRemoval && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      modelReadyRef.current = false;
      rejectAllPending(new BatchAbortedError('背景除去が無効化されました'));
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
        rejectAllPending(new BatchAbortedError('Workerが終了しました'));
      }
    };
  }, [settings.enableBackgroundRemoval, setModelState, rejectAllPending]);

  // バッチが無効化されたら（クリア／新バッチ開始）、待機中の要求を即座に終わらせる。
  // Worker 自体は終了しない（モデルの再ダウンロードを避けるため）。
  // 遅れて届く結果は pendingRequests に居ないので破棄される。
  useEffect(() => {
    return useImageStore.subscribe((state, prevState) => {
      if (state.currentBatchId !== prevState.currentBatchId) {
        rejectAllPending(new BatchAbortedError());
      }
    });
  }, [rejectAllPending]);

  /** モデル準備完了を Promise で待つ（ポーリングしない） */
  const waitForModelReady = useCallback((): Promise<void> => {
    if (modelReadyRef.current) return Promise.resolve();
    // 初期化に失敗している間は待たずに即座に失敗させる（120 秒待機を残さない）
    if (modelErrorRef.current) return Promise.reject(modelErrorRef.current);

    return new Promise<void>((resolve, reject) => {
      const waiter: PendingRequest<void> = {
        resolve,
        reject,
        timerId: setTimeout(() => {
          modelWaitersRef.current.delete(waiter);
          reject(new Error('AIモデルの読み込みがタイムアウトしました'));
        }, MODEL_READY_TIMEOUT_MS),
      };
      modelWaitersRef.current.add(waiter);
    });
  }, []);

  /** Worker に背景除去を依頼し、結果を Promise で受け取る（要求IDで対応付ける） */
  const requestMask = useCallback((worker: Worker, imageData: ImageData): Promise<ImageData> => {
    requestCounterRef.current += 1;
    const requestId = `req-${requestCounterRef.current}`;
    // ImageData を転送可能な形式に変換して Worker に送信
    const buffer = imageData.data.buffer.slice(0);

    const result = new Promise<ImageData>((resolve, reject) => {
      const request: PendingRequest<ImageData> = {
        resolve,
        reject,
        timerId: setTimeout(() => {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('背景除去処理がタイムアウトしました'));
        }, MASK_RESULT_TIMEOUT_MS),
      };
      pendingRequestsRef.current.set(requestId, request);
    });

    worker.postMessage(
      {
        type: 'process',
        payload: {
          width: imageData.width,
          height: imageData.height,
          buffer,
          id: requestId,
        },
      },
      [buffer]
    );

    return result;
  }, []);

  // 単一画像を処理
  const processFile = useCallback(
    async (
      fileId: string,
      options?: { batchId?: string | null; settings?: ProcessingSettings }
    ): Promise<ProcessedImage | null> => {
      const initialState = useImageStore.getState();
      // 結果を store に書き戻してよいかは「バッチIDが現行と一致」かつ
      // 「対象ファイルがまだ store にある」で判定する
      const batchId =
        options?.batchId !== undefined ? options.batchId : initialState.currentBatchId;
      // 設定はバッチ開始時の snapshot を使い、処理中の変更が途中から混ざらないようにする
      const activeSettings = options?.settings ?? initialState.settings;
      const file = initialState.files.find((f) => f.id === fileId);
      if (!file) return null;

      const isValid = (): boolean => {
        const state = useImageStore.getState();
        return state.currentBatchId === batchId && state.files.some((f) => f.id === fileId);
      };
      const assertValid = (): void => {
        if (!isValid()) throw new BatchAbortedError();
      };
      const setStatus = (
        status: ImageFile['status'],
        progress?: number,
        error?: string,
        errorReason?: RejectionReason
      ): void => {
        if (isValid()) updateFileStatus(fileId, status, progress, error, errorReason);
      };

      try {
        assertValid();
        setStatus('processing', 10);

        // Blob から Image を取得（デコードはここ 1 回だけ）
        let img: HTMLImageElement;
        try {
          img = await blobToImage(file.blob);
        } catch {
          // 壊れた画像。待機を残さずこのファイルだけ失敗させる
          throw new RejectedFileError({ key: 'errorDecodeFailed' });
        }
        assertValid();

        // ヘッダ解析で寸法が取れなかった場合の保険。
        // 実寸を確保する前にここで拒否する
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        if (naturalWidth > MAX_INPUT_EDGE_PX || naturalHeight > MAX_INPUT_EDGE_PX) {
          throw new RejectedFileError({
            key: 'rejectEdgeTooLarge',
            params: { width: naturalWidth, height: naturalHeight, max: MAX_INPUT_EDGE_PX },
          });
        }
        if (naturalWidth * naturalHeight > MAX_INPUT_PIXELS) {
          throw new RejectedFileError({
            key: 'rejectTooManyPixels',
            params: {
              pixels: formatPixels(naturalWidth * naturalHeight),
              width: naturalWidth,
              height: naturalHeight,
              max: formatPixels(MAX_INPUT_PIXELS),
            },
          });
        }

        setStatus('processing', 20);

        // 背景除去が有効な場合
        let maskData: ImageData | undefined;
        if (activeSettings.enableBackgroundRemoval && workerRef.current) {
          // モデル準備完了まで待機。初期化エラー・中断時は即座に reject される
          await waitForModelReady();
          assertValid();

          // デコード済みの画像を使い回す（Blob から再デコードしない）
          const imageData = imageToImageData(img);
          assertValid();
          setStatus('processing', 30);

          const worker = workerRef.current;
          if (!worker) throw new Error('Workerが利用できません');
          maskData = await requestMask(worker, imageData);
          assertValid();
          setStatus('processing', 70);
        }

        setStatus('processing', 75);

        // リサイズ
        const { width, height } = getPresetSize(
          activeSettings.preset,
          activeSettings.customWidth,
          activeSettings.customHeight
        );

        let canvas: HTMLCanvasElement;

        if (maskData) {
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
          // 原寸の一時 canvas を抱え続けない
          tempCanvas.width = 0;
          tempCanvas.height = 0;
        } else {
          // 通常のリサイズ
          canvas = resizeImage(img, width, height);
        }

        setStatus('processing', 85);

        // 透かし追加
        if (activeSettings.enableWatermark && activeSettings.watermarkText) {
          addWatermark(canvas, activeSettings.watermarkText, activeSettings.watermarkPosition);
        }

        setStatus('processing', 90);

        // Blob に変換
        const blob = await canvasToBlob(
          canvas,
          activeSettings.quality,
          activeSettings.enableBackgroundRemoval
        );

        // ここから先は store への書き込みなので、最後にもう一度だけ有効性を確認する。
        // 無効なら「旧バッチの結果」なので processed には一切入れない。
        if (!isValid()) return null;

        setStatus('completed', 100);

        const preset = SNS_PRESETS[activeSettings.preset];
        const extension = activeSettings.enableBackgroundRemoval ? 'png' : 'jpg';
        const newName = buildOutputName(file.name, preset.key, extension);

        const processedImage: ProcessedImage = {
          id: crypto.randomUUID(),
          originalId: file.id,
          name: newName,
          blob,
          preset,
          hasWatermark: activeSettings.enableWatermark,
          hasBackgroundRemoval: activeSettings.enableBackgroundRemoval,
          quality: activeSettings.quality,
        };

        addProcessedImage(processedImage);
        return processedImage;
      } catch (error) {
        // 中断済みバッチの失敗は UI に出さない（クリア後に failed が復活しないように）
        if (error instanceof BatchAbortedError || !isValid()) {
          return null;
        }
        console.error('Processing error:', error);
        setStatus(
          'failed',
          0,
          error instanceof Error ? error.message : 'Unknown error',
          error instanceof RejectedFileError ? error.reason : undefined
        );
        return null;
      }
    },
    [updateFileStatus, addProcessedImage, waitForModelReady, requestMask]
  );

  // バッチ処理
  const processAll = useCallback(async () => {
    const store = useImageStore.getState();
    if (store.isProcessing) return;

    // 再試行: 失敗したファイルを pending に戻してから新しいバッチで処理する
    store.resetFailedFiles();

    const batchId = store.startBatch();
    // 処理中の設定変更が途中から混ざらないよう、バッチ開始時点の設定を固定する
    const batchSettings: ProcessingSettings = { ...useImageStore.getState().settings };

    try {
      // 各反復で store の最新状態を見る。クリアなどで中断されたら即座に抜ける
      for (;;) {
        const state = useImageStore.getState();
        if (state.currentBatchId !== batchId) return;

        const next = state.files.find((f) => f.status === 'pending');
        if (!next) break;

        await processFile(next.id, { batchId, settings: batchSettings });

        const after = useImageStore.getState();
        if (after.currentBatchId !== batchId) return;

        // 念のため: pending のまま戻ってきた場合は失敗扱いにして無限ループを防ぐ
        if (after.files.find((f) => f.id === next.id)?.status === 'pending') {
          after.updateFileStatus(next.id, 'failed', 0, '処理を開始できませんでした');
        }

        // UI更新のための小休止
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally {
      useImageStore.getState().endBatch(batchId);
    }
  }, [processFile]);

  return {
    processFile,
    processAll,
  };
};
