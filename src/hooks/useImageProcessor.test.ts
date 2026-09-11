import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useImageStore } from '../store/imageStore';
import { useImageProcessor } from './useImageProcessor';
import type { ImageFile } from '../types';

// canvasToBlob を任意のタイミングで止められるようにするゲート。
// 「処理の途中」を作り出して、そこでクリアや設定変更を割り込ませるために使う。
const h = vi.hoisted(() => {
  const gate = {
    blocked: false,
    waiters: [] as Array<() => void>,
    wait(): Promise<void> {
      if (!gate.blocked) return Promise.resolve();
      return new Promise<void>((resolve) => {
        gate.waiters.push(resolve);
      });
    },
    release(): void {
      const waiters = gate.waiters;
      gate.waiters = [];
      gate.blocked = false;
      for (const resolve of waiters) resolve();
    },
    reset(): void {
      gate.blocked = false;
      gate.waiters = [];
    },
  };
  // canvasToBlob を指定回数だけ失敗させる（再試行テスト用）
  const failures = { canvasToBlob: 0 };
  return { gate, failures };
});

// Canvas 依存のユーティリティは差し替える
vi.mock('../utils/imageProcessing', () => ({
  blobToImage: vi.fn(async () => ({ width: 800, height: 600 }) as unknown as HTMLImageElement),
  blobToImageData: vi.fn(async () => new ImageData(new Uint8ClampedArray(4 * 4 * 4), 4, 4)),
  blobToImageDataAsync: vi.fn(),
  resizeImage: vi.fn(() => document.createElement('canvas')),
  addWatermark: vi.fn(),
  applyBackgroundRemoval: vi.fn(),
  canvasToBlob: vi.fn(async () => {
    await h.gate.wait();
    if (h.failures.canvasToBlob > 0) {
      h.failures.canvasToBlob -= 1;
      throw new Error('canvasToBlob失敗');
    }
    return new Blob(['out'], { type: 'image/jpeg' });
  }),
  getPresetSize: vi.fn(() => ({ width: 1080, height: 1080 })),
  formatBytes: vi.fn(() => '1 KB'),
}));

// ---------------------------------------------------------------------------
// Worker の偽実装。result / error を任意のタイミングで投げられる
// ---------------------------------------------------------------------------
interface PostedMessage {
  type: string;
  payload?: { id?: string; width?: number; height?: number; buffer?: ArrayBuffer };
}

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;
  posted: PostedMessage[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: PostedMessage): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(): void {}
  removeEventListener(): void {}

  /** Worker からメインスレッドへのメッセージを模擬する */
  emit(data: unknown): void {
    this.onmessage?.({ data });
  }

  get processMessages(): PostedMessage[] {
    return this.posted.filter((m) => m.type === 'process');
  }
}

class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace = 'srgb' as const;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

const makeFile = (id: string): ImageFile => ({
  id,
  name: `${id}.jpg`,
  size: 1000,
  type: 'image/jpeg',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  status: 'pending',
  progress: 0,
});

const seedFiles = (count: number): void => {
  useImageStore.setState({
    files: Array.from({ length: count }, (_, i) => makeFile(`file-${i + 1}`)),
    processed: [],
    isProcessing: false,
    currentBatchId: null,
    downloadedBatchId: null,
  });
};

const setBackgroundRemoval = (enabled: boolean): void => {
  useImageStore.setState((state) => ({
    settings: { ...state.settings, enableBackgroundRemoval: enabled },
  }));
};

const currentWorker = (): FakeWorker => {
  const worker = FakeWorker.instances.at(-1);
  if (!worker) throw new Error('Worker が生成されていません');
  return worker;
};

const emitModelReady = async (): Promise<void> => {
  await act(async () => {
    currentWorker().emit({
      type: 'progress',
      payload: { status: 'ready', progress: 100, message: 'AI準備完了！', device: 'wasm' },
    });
  });
};

const maskResultPayload = (id: string) => ({
  type: 'result',
  payload: {
    id,
    width: 4,
    height: 4,
    buffer: new Uint8ClampedArray(4 * 4 * 4).buffer,
  },
});

/** マイクロタスクと 0ms タイマーを流す */
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('useImageProcessor - batch lifecycle', () => {
  let uuidCounter = 0;

  beforeEach(() => {
    FakeWorker.instances = [];
    h.gate.reset();
    h.failures.canvasToBlob = 0;
    uuidCounter = 0;

    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('ImageData', FakeImageData);

    // setup.ts は randomUUID を固定値にしているので、ここでは連番にする
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`
    );

    // 背景除去パスが使う 2D コンテキストのメソッドを揃える
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn(() => new FakeImageData(new Uint8ClampedArray(4 * 4 * 4), 4, 4)),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    useImageStore.setState({
      files: [],
      processed: [],
      isProcessing: false,
      currentBatchId: null,
      downloadedBatchId: null,
      settings: {
        preset: 'instagram-square',
        customWidth: 1080,
        customHeight: 1080,
        quality: 90,
        enableWatermark: false,
        watermarkText: '',
        watermarkPosition: 'bottomRight',
        enableBackgroundRemoval: false,
      },
    });
  });

  afterEach(() => {
    h.gate.release();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // (a) 処理中クリア
  it('drops results of a batch that was cleared mid-flight', async () => {
    seedFiles(3);
    const { result, unmount } = renderHook(() => useImageProcessor());

    h.gate.blocked = true;
    let running!: Promise<void>;
    await act(async () => {
      running = result.current.processAll();
    });

    // 1 枚目が canvasToBlob で止まっている状態
    await waitFor(() => expect(useImageStore.getState().isProcessing).toBe(true));
    const batchId = useImageStore.getState().currentBatchId;
    expect(batchId).not.toBeNull();

    // 処理の途中でクリア
    await act(async () => {
      useImageStore.getState().clearFiles();
    });

    expect(useImageStore.getState().isProcessing).toBe(false);
    expect(useImageStore.getState().currentBatchId).toBeNull();

    // 止めていた処理を再開させても、旧バッチの結果は 1 枚も入らない
    await act(async () => {
      h.gate.release();
      await running;
    });

    const state = useImageStore.getState();
    expect(state.processed).toHaveLength(0);
    expect(state.files).toHaveLength(0);
    expect(state.isProcessing).toBe(false);
    expect(state.currentBatchId).toBeNull();

    unmount();
  });

  // (b) Worker の init エラー
  it('fails every waiting request immediately on worker init error and leaves no pending timers', async () => {
    vi.useFakeTimers();
    try {
      setBackgroundRemoval(true);
      seedFiles(2);
      const { result, unmount } = renderHook(() => useImageProcessor());

      expect(FakeWorker.instances).toHaveLength(1);
      expect(currentWorker().posted[0]?.type).toBe('init');

      let running!: Promise<void>;
      await act(async () => {
        running = result.current.processAll();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // 1 枚目がモデル準備を待っている
      expect(useImageStore.getState().files[0]?.status).toBe('processing');

      // id なしのエラー（初期化失敗）
      await act(async () => {
        currentWorker().emit({
          type: 'error',
          payload: { message: 'モデルの初期化に失敗しました' },
        });
      });

      // 待機は即座に打ち切られ、バッチは 120 秒待たずに終わる
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
        await running;
      });

      const afterError = useImageStore.getState();
      expect(afterError.isProcessing).toBe(false);
      expect(afterError.files.map((f) => f.status)).toEqual(['failed', 'failed']);
      expect(afterError.files[0]?.error).toBe('モデルの初期化に失敗しました');
      expect(afterError.processed).toHaveLength(0);

      // 120 秒進めても追加の副作用は起きない
      const snapshot = JSON.stringify(
        useImageStore.getState().files.map((f) => [f.id, f.status, f.error])
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120000);
      });
      expect(
        JSON.stringify(useImageStore.getState().files.map((f) => [f.id, f.status, f.error]))
      ).toBe(snapshot);
      expect(useImageStore.getState().processed).toHaveLength(0);
      expect(useImageStore.getState().isProcessing).toBe(false);

      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  // (c) process エラー（id 付き）
  it('fails only the affected file on a per-request worker error and continues', async () => {
    setBackgroundRemoval(true);
    seedFiles(2);
    const { result, unmount } = renderHook(() => useImageProcessor());

    let running!: Promise<void>;
    await act(async () => {
      running = result.current.processAll();
    });
    await emitModelReady();

    await waitFor(() => expect(currentWorker().processMessages).toHaveLength(1));
    const firstRequestId = currentWorker().processMessages[0]?.payload?.id;
    expect(firstRequestId).toBeDefined();

    // 1 枚目だけ失敗させる
    await act(async () => {
      currentWorker().emit({
        type: 'error',
        payload: { id: firstRequestId, message: '処理エラー: boom' },
      });
    });

    // 2 枚目はそのまま処理が進む
    await waitFor(() => expect(currentWorker().processMessages).toHaveLength(2));
    const secondRequestId = currentWorker().processMessages[1]?.payload?.id;
    expect(secondRequestId).not.toBe(firstRequestId);

    await act(async () => {
      currentWorker().emit(maskResultPayload(secondRequestId as string));
      await running;
    });

    const state = useImageStore.getState();
    expect(state.files[0]?.status).toBe('failed');
    expect(state.files[0]?.error).toBe('処理エラー: boom');
    expect(state.files[1]?.status).toBe('completed');
    expect(state.processed).toHaveLength(1);
    expect(state.processed[0]?.originalId).toBe('file-2');
    expect(state.isProcessing).toBe(false);
    // モデルの再ダウンロードを避けるため Worker は生かしたまま
    expect(currentWorker().terminated).toBe(false);

    unmount();
  });

  // (d) 遅延結果
  it('ignores a worker result that arrives after the batch was cleared', async () => {
    setBackgroundRemoval(true);
    seedFiles(2);
    const { result, unmount } = renderHook(() => useImageProcessor());

    let running!: Promise<void>;
    await act(async () => {
      running = result.current.processAll();
    });
    await emitModelReady();

    await waitFor(() => expect(currentWorker().processMessages).toHaveLength(1));
    const requestId = currentWorker().processMessages[0]?.payload?.id as string;

    await act(async () => {
      useImageStore.getState().clearFiles();
    });

    // クリア後に旧バッチの結果が届く
    await act(async () => {
      currentWorker().emit(maskResultPayload(requestId));
      await running;
    });
    await flush();

    const state = useImageStore.getState();
    expect(state.processed).toHaveLength(0);
    expect(state.files).toHaveLength(0);
    expect(state.isProcessing).toBe(false);
    expect(state.currentBatchId).toBeNull();
    // 2 枚目の要求は送られない
    expect(currentWorker().processMessages).toHaveLength(1);

    unmount();
  });

  // (d) 待機残留なし: クリアで Worker 待ちが即座に終わる
  it('settles the batch immediately when cleared while waiting on the worker', async () => {
    vi.useFakeTimers();
    try {
      setBackgroundRemoval(true);
      seedFiles(2);
      const { result, unmount } = renderHook(() => useImageProcessor());

      let running!: Promise<void>;
      await act(async () => {
        running = result.current.processAll();
      });
      let settled = false;
      void running.then(() => {
        settled = true;
      });

      await act(async () => {
        currentWorker().emit({
          type: 'progress',
          payload: { status: 'ready', progress: 100, message: 'AI準備完了！', device: 'wasm' },
        });
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(currentWorker().processMessages).toHaveLength(1);
      expect(settled).toBe(false);

      // クリア。Worker の結果は一切届かない
      await act(async () => {
        useImageStore.getState().clearFiles();
        await vi.advanceTimersByTimeAsync(0);
      });

      // 60 秒のタイムアウトを待たずにバッチが終わる
      expect(settled).toBe(true);
      expect(useImageStore.getState().isProcessing).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(useImageStore.getState().processed).toHaveLength(0);
      expect(useImageStore.getState().files).toHaveLength(0);
      expect(currentWorker().processMessages).toHaveLength(1);

      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  // (e) 再試行
  it('retries failed files in a new batch on the next run', async () => {
    seedFiles(1);
    h.failures.canvasToBlob = 1;
    const { result, unmount } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.processAll();
    });

    const firstBatchId = useImageStore.getState().currentBatchId;
    expect(useImageStore.getState().files[0]?.status).toBe('failed');
    expect(useImageStore.getState().processed).toHaveLength(0);

    // 「処理を開始」をもう一度押す＝failed を pending に戻して新しいバッチで処理
    await act(async () => {
      await result.current.processAll();
    });

    const state = useImageStore.getState();
    expect(state.currentBatchId).not.toBe(firstBatchId);
    expect(state.files[0]?.status).toBe('completed');
    expect(state.files[0]?.error).toBeUndefined();
    expect(state.processed).toHaveLength(1);
    expect(state.isProcessing).toBe(false);

    unmount();
  });

  // (g) 設定変更
  it('uses the settings snapshotted at batch start for every file', async () => {
    seedFiles(2);
    const { result, unmount } = renderHook(() => useImageProcessor());

    h.gate.blocked = true;
    let running!: Promise<void>;
    await act(async () => {
      running = result.current.processAll();
    });
    await waitFor(() => expect(useImageStore.getState().isProcessing).toBe(true));

    // バッチ実行中に設定を変更する
    await act(async () => {
      useImageStore.getState().setPreset('twitter-landscape');
      useImageStore.getState().setQuality(50);
    });

    await act(async () => {
      h.gate.release();
      await running;
    });

    const state = useImageStore.getState();
    expect(state.processed).toHaveLength(2);
    for (const image of state.processed) {
      expect(image.preset.key).toBe('instagram-square');
      expect(image.quality).toBe(90);
    }
    // store 側の設定自体は変わっている（次のバッチから反映される）
    expect(state.settings.preset).toBe('twitter-landscape');

    unmount();
  });

  it('does not start a second batch while one is running', async () => {
    seedFiles(2);
    const { result, unmount } = renderHook(() => useImageProcessor());

    h.gate.blocked = true;
    let running!: Promise<void>;
    await act(async () => {
      running = result.current.processAll();
    });
    await waitFor(() => expect(useImageStore.getState().isProcessing).toBe(true));
    const batchId = useImageStore.getState().currentBatchId;

    await act(async () => {
      await result.current.processAll();
    });
    expect(useImageStore.getState().currentBatchId).toBe(batchId);

    await act(async () => {
      h.gate.release();
      await running;
    });
    expect(useImageStore.getState().processed).toHaveLength(2);

    unmount();
  });

  it('still completes the happy path with background removal enabled', async () => {
    setBackgroundRemoval(true);
    seedFiles(2);
    const { result, unmount } = renderHook(() => useImageProcessor());

    let running!: Promise<void>;
    await act(async () => {
      running = result.current.processAll();
    });
    await emitModelReady();

    await waitFor(() => expect(currentWorker().processMessages).toHaveLength(1));
    await act(async () => {
      currentWorker().emit(
        maskResultPayload(currentWorker().processMessages[0]?.payload?.id as string)
      );
    });

    await waitFor(() => expect(currentWorker().processMessages).toHaveLength(2));
    await act(async () => {
      currentWorker().emit(
        maskResultPayload(currentWorker().processMessages[1]?.payload?.id as string)
      );
      await running;
    });

    const state = useImageStore.getState();
    expect(state.files.map((f) => f.status)).toEqual(['completed', 'completed']);
    expect(state.processed).toHaveLength(2);
    expect(state.processed[0]?.hasBackgroundRemoval).toBe(true);

    unmount();
  });
});
