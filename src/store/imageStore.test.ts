import { describe, it, expect, beforeEach } from 'vitest';
import { useImageStore } from './imageStore';
import type { ImageFile, ProcessedImage, SNSPreset } from '../types';
import { SNS_PRESETS } from '../constants/presets';

const makeFile = (id: string, status: ImageFile['status'] = 'pending'): ImageFile => ({
  id,
  name: `${id}.jpg`,
  size: 1000,
  type: 'image/jpeg',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  status,
  progress: 0,
});

const preset: SNSPreset = SNS_PRESETS['instagram-square'];

const makeProcessed = (id: string, originalId: string): ProcessedImage => ({
  id,
  originalId,
  name: `${id}.jpg`,
  blob: new Blob(['y'], { type: 'image/jpeg' }),
  preset,
  hasWatermark: false,
  hasBackgroundRemoval: false,
  quality: 90,
});

describe('imageStore - batch lifecycle', () => {
  beforeEach(() => {
    useImageStore.setState({
      files: [],
      processed: [],
      isProcessing: false,
      currentBatchId: null,
      downloadedBatchId: null,
    });
  });

  describe('startBatch / endBatch', () => {
    it('issues a unique batch id and marks processing', () => {
      const first = useImageStore.getState().startBatch();
      expect(useImageStore.getState().currentBatchId).toBe(first);
      expect(useImageStore.getState().isProcessing).toBe(true);

      const second = useImageStore.getState().startBatch();
      expect(second).not.toBe(first);
      expect(useImageStore.getState().currentBatchId).toBe(second);
    });

    it('endBatch only ends the batch that is still current', () => {
      const first = useImageStore.getState().startBatch();
      const second = useImageStore.getState().startBatch();

      // 旧バッチの終了通知は現行バッチに影響しない
      useImageStore.getState().endBatch(first);
      expect(useImageStore.getState().isProcessing).toBe(true);
      expect(useImageStore.getState().currentBatchId).toBe(second);

      useImageStore.getState().endBatch(second);
      expect(useImageStore.getState().isProcessing).toBe(false);
      // バッチ ID は終了後も「直近のバッチ」として残す（自動保存の紐づけに使う）
      expect(useImageStore.getState().currentBatchId).toBe(second);
    });

    it('abortBatch invalidates the current batch', () => {
      const batchId = useImageStore.getState().startBatch();
      useImageStore.getState().abortBatch();

      expect(useImageStore.getState().currentBatchId).toBeNull();
      expect(useImageStore.getState().isProcessing).toBe(false);
      expect(useImageStore.getState().currentBatchId).not.toBe(batchId);
    });
  });

  describe('clearFiles', () => {
    it('invalidates the in-flight batch and stops processing', () => {
      useImageStore.setState({
        files: [makeFile('f1', 'processing'), makeFile('f2')],
        processed: [makeProcessed('p1', 'f1')],
      });
      const batchId = useImageStore.getState().startBatch();
      expect(useImageStore.getState().isProcessing).toBe(true);

      useImageStore.getState().clearFiles();

      const state = useImageStore.getState();
      expect(state.files).toEqual([]);
      expect(state.processed).toEqual([]);
      expect(state.isProcessing).toBe(false);
      expect(state.currentBatchId).toBeNull();
      expect(state.currentBatchId).not.toBe(batchId);
    });

    it('resets the downloaded batch marker so the next batch can auto-save again', () => {
      const batchId = useImageStore.getState().startBatch();
      useImageStore.getState().markBatchDownloaded(batchId);
      expect(useImageStore.getState().downloadedBatchId).toBe(batchId);

      useImageStore.getState().clearFiles();
      expect(useImageStore.getState().downloadedBatchId).toBeNull();
    });

    it('endBatch after a clear does not resurrect the processing flag', () => {
      const batchId = useImageStore.getState().startBatch();
      useImageStore.getState().clearFiles();
      useImageStore.getState().endBatch(batchId);

      expect(useImageStore.getState().isProcessing).toBe(false);
      expect(useImageStore.getState().currentBatchId).toBeNull();
    });
  });

  describe('markBatchDownloaded', () => {
    it('records the batch that has already been auto-saved', () => {
      const batchId = useImageStore.getState().startBatch();
      expect(useImageStore.getState().downloadedBatchId).toBeNull();

      useImageStore.getState().markBatchDownloaded(batchId);
      expect(useImageStore.getState().downloadedBatchId).toBe(batchId);

      // 次のバッチでは自動保存が再び有効になる
      const next = useImageStore.getState().startBatch();
      expect(useImageStore.getState().downloadedBatchId).not.toBe(next);
    });
  });

  describe('resetFailedFiles', () => {
    it('moves failed files back to pending for retry', () => {
      useImageStore.setState({
        files: [
          makeFile('f1', 'completed'),
          { ...makeFile('f2', 'failed'), error: 'boom', progress: 0 },
          makeFile('f3', 'pending'),
        ],
      });

      const reset = useImageStore.getState().resetFailedFiles();

      expect(reset).toBe(1);
      const files = useImageStore.getState().files;
      expect(files[0]?.status).toBe('completed');
      expect(files[1]?.status).toBe('pending');
      expect(files[1]?.error).toBeUndefined();
      expect(files[2]?.status).toBe('pending');
    });

    it('returns 0 when nothing failed', () => {
      useImageStore.setState({ files: [makeFile('f1', 'completed')] });
      expect(useImageStore.getState().resetFailedFiles()).toBe(0);
    });
  });
});
