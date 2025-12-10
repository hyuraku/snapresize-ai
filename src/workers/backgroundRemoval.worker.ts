// 背景除去 Web Worker (Transformers.js + RMBG-1.4)
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';

// Hugging Face Hub からモデルをダウンロードするように設定
env.allowLocalModels = false;
env.useBrowserCache = true;

let model: Awaited<ReturnType<typeof AutoModel.from_pretrained>> | null = null;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let device: 'webgpu' | 'wasm' = 'wasm';

// WebGPU サポートチェック
const checkWebGPUSupport = async (): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gpu = (navigator as any).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
};

// モデル初期化
const initModel = async () => {
  try {
    // WebGPU サポートチェック
    const hasWebGPU = await checkWebGPUSupport();
    device = hasWebGPU ? 'webgpu' : 'wasm';

    self.postMessage({
      type: 'progress',
      payload: {
        status: 'loading',
        progress: 0,
        message: hasWebGPU ? 'WebGPUモードで初期化中...' : 'WASMモードで初期化中（処理が遅くなります）...',
        device,
      },
    });

    const modelId = 'briaai/RMBG-1.4';

    // モデルとプロセッサを初期化
    model = await AutoModel.from_pretrained(modelId, {
      device: device,
      progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
        if (progress.status === 'progress' && progress.progress !== undefined) {
          self.postMessage({
            type: 'progress',
            payload: {
              status: 'loading',
              progress: Math.round(progress.progress),
              message: `モデルをダウンロード中... ${progress.file || ''}`,
              device,
            },
          });
        }
      },
    });

    processor = await AutoProcessor.from_pretrained(modelId);

    self.postMessage({
      type: 'progress',
      payload: {
        status: 'ready',
        progress: 100,
        message: 'AI準備完了！',
        device,
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        message: `モデルの初期化に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    });
  }
};

// 画像から背景を除去
const processImage = async (width: number, height: number, buffer: ArrayBuffer, id: string) => {
  if (!model || !processor) {
    self.postMessage({
      type: 'error',
      payload: {
        id,
        message: 'モデルが初期化されていません',
      },
    });
    return;
  }

  try {
    // ArrayBuffer から ImageData を再構築
    const uint8Array = new Uint8ClampedArray(buffer);
    const imageData = new ImageData(uint8Array, width, height);

    self.postMessage({
      type: 'progress',
      payload: {
        status: 'processing',
        progress: 10,
        message: '背景を解析中...',
        id,
      },
    });

    // ImageData を Blob に変換
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });

    self.postMessage({
      type: 'progress',
      payload: {
        status: 'processing',
        progress: 30,
        message: 'AIで背景を検出中...',
        id,
      },
    });

    // RawImage に変換
    const image = await RawImage.fromBlob(blob);
    
    // プロセッサで前処理
    const { pixel_values } = await processor(image);

    self.postMessage({
      type: 'progress',
      payload: {
        status: 'processing',
        progress: 50,
        message: 'AIモデルで推論中...',
        id,
      },
    });

    // モデルで推論
    const { output } = await model({ input: pixel_values });

    self.postMessage({
      type: 'progress',
      payload: {
        status: 'processing',
        progress: 80,
        message: 'マスクを適用中...',
        id,
      },
    });

    // マスクを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maskData = (output as any).tolist()[0][0];
    const maskHeight = maskData.length;
    const maskWidth = maskData[0].length;

    // 元画像にマスクを適用
    const outputCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) throw new Error('Output canvas context not available');

    // 元画像を描画
    outputCtx.putImageData(imageData, 0, 0);
    const outputImageData = outputCtx.getImageData(0, 0, imageData.width, imageData.height);

    // マスクをリサイズして適用
    const scaleX = imageData.width / maskWidth;
    const scaleY = imageData.height / maskHeight;

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const maskX = Math.min(Math.floor(x / scaleX), maskWidth - 1);
        const maskY = Math.min(Math.floor(y / scaleY), maskHeight - 1);
        const outputIndex = (y * imageData.width + x) * 4;

        // マスクの値を0-255に変換してアルファに適用
        const maskValue = maskData[maskY][maskX];
        const alpha = Math.round(Math.max(0, Math.min(1, maskValue)) * 255);
        outputImageData.data[outputIndex + 3] = alpha;
      }
    }

    console.log('[Worker] 処理完了、結果送信:', { id, width: outputImageData.width, height: outputImageData.height });
    // ImageData を転送可能な形式に変換
    const resultBuffer = outputImageData.data.buffer.slice(0);
    self.postMessage(
      {
        type: 'result',
        payload: {
          id,
          width: outputImageData.width,
          height: outputImageData.height,
          buffer: resultBuffer,
        },
      },
      [resultBuffer]
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        id,
        message: `処理エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    });
  }
};

// メッセージハンドラ
self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;
  console.log('[Worker] メッセージ受信:', type, { hasBuffer: !!payload?.buffer, id: payload?.id, width: payload?.width, height: payload?.height });

  switch (type) {
    case 'init':
      await initModel();
      break;
    case 'process':
      if (payload?.buffer && payload?.id && payload?.width && payload?.height) {
        console.log('[Worker] processImage開始');
        await processImage(payload.width, payload.height, payload.buffer, payload.id);
        console.log('[Worker] processImage完了');
      } else {
        console.error('[Worker] Invalid payload:', payload);
        self.postMessage({
          type: 'error',
          payload: {
            id: payload?.id,
            message: '無効なペイロードです',
          },
        });
      }
      break;
    default:
      console.warn('Unknown message type:', type);
  }
};

export {};
