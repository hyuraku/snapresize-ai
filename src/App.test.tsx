import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useImageStore } from './store/imageStore';
import type { ImageFile } from './types';

const h = vi.hoisted(() => ({
  downloadAll: vi.fn(async () => {}),
}));

// 自動保存が何回走ったかだけを見たいので ZIP 生成は差し替える
vi.mock('./hooks/useDownload', () => ({
  useDownload: () => ({
    downloadAll: h.downloadAll,
    downloadSingle: vi.fn(),
    isDownloading: false,
    downloadProgress: 0,
  }),
}));

// Canvas 依存のユーティリティは差し替える
vi.mock('./utils/imageProcessing', () => ({
  blobToImage: vi.fn(async () => ({ width: 800, height: 600 }) as unknown as HTMLImageElement),
  imageToImageData: vi.fn(),
  resizeImage: vi.fn(() => document.createElement('canvas')),
  addWatermark: vi.fn(),
  applyBackgroundRemoval: vi.fn(),
  canvasToBlob: vi.fn(async () => new Blob(['out'], { type: 'image/jpeg' })),
  getPresetSize: vi.fn(() => ({ width: 1080, height: 1080 })),
  formatBytes: vi.fn(() => '1 KB'),
}));

const makeFile = (id: string): ImageFile => ({
  id,
  name: `${id}.jpg`,
  size: 1000,
  type: 'image/jpeg',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  status: 'pending',
  progress: 0,
});

const seedFiles = (ids: string[]): void => {
  act(() => {
    useImageStore.setState({ files: ids.map(makeFile) });
  });
};

describe('App - auto save is scoped to a batch', () => {
  let uuidCounter = 0;

  beforeEach(() => {
    h.downloadAll.mockClear();
    uuidCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`
    );
    useImageStore.setState({
      files: [],
      processed: [],
      isProcessing: false,
      currentBatchId: null,
      downloadedBatchId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // (f) 連続 2 バッチ
  it('auto-saves again on the second batch after a clear, and only once per batch', async () => {
    seedFiles(['file-1']);
    render(<App />);

    // --- 1 回目のバッチ ---
    await act(async () => {
      fireEvent.click(screen.getByTestId('startBtn'));
    });
    await waitFor(() => expect(useImageStore.getState().processed).toHaveLength(1), {
      timeout: 3000,
    });
    await waitFor(() => expect(h.downloadAll).toHaveBeenCalledTimes(1), { timeout: 3000 });

    const firstBatchId = useImageStore.getState().currentBatchId;
    expect(useImageStore.getState().downloadedBatchId).toBe(firstBatchId);

    // 同じバッチで二重に走らない
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(h.downloadAll).toHaveBeenCalledTimes(1);

    // --- クリアして 2 回目のバッチ ---
    await act(async () => {
      fireEvent.click(screen.getByTestId('clearBtn'));
    });
    expect(useImageStore.getState().currentBatchId).toBeNull();
    expect(screen.getByTestId('selectedCount')).toHaveTextContent('0');
    expect(screen.getByTestId('processedCount')).toHaveTextContent('0');

    seedFiles(['file-2']);
    await act(async () => {
      fireEvent.click(screen.getByTestId('startBtn'));
    });
    await waitFor(() => expect(useImageStore.getState().processed).toHaveLength(1), {
      timeout: 3000,
    });

    // クリア後の 2 回目でも自動保存が発火する
    await waitFor(() => expect(h.downloadAll).toHaveBeenCalledTimes(2), { timeout: 3000 });

    const secondBatchId = useImageStore.getState().currentBatchId;
    expect(secondBatchId).not.toBe(firstBatchId);
    expect(useImageStore.getState().downloadedBatchId).toBe(secondBatchId);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(h.downloadAll).toHaveBeenCalledTimes(2);
  }, 20000);
});
