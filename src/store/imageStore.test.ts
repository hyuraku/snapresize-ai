import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useImageStore } from './imageStore';
import type { ImageFile, ProcessedImage, SNSPreset } from '../types';
import { SNS_PRESETS } from '../constants/presets';
import {
  MAX_BATCH_TOTAL_BYTES,
  MAX_FILES,
  MAX_FILE_SIZE_BYTES,
  MAX_INPUT_EDGE_PX,
  MAX_INPUT_PIXELS,
  MAX_OUTPUT_PX,
  MIN_OUTPUT_PX,
} from '../constants/limits';

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

// ---------------------------------------------------------------------------
// 入力・出力の画素予算
// ---------------------------------------------------------------------------

/** PNG シグネチャ + IHDR（寸法を指定できる最小ヘッダ） */
const makePngBytes = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

/** 実バイト列は小さいまま、size だけ大きく見せるファイル（巨大ファイルを確保しない） */
const makePngFile = (
  name: string,
  options: { width?: number; height?: number; size?: number } = {}
): File => {
  const { width = 100, height = 100, size } = options;
  const file = new File([makePngBytes(width, height)], name, { type: 'image/png' });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

const MIB = 1024 * 1024;

describe('imageStore - pixel budget', () => {
  let uuidCounter = 0;

  beforeEach(() => {
    uuidCounter = 0;
    // setup.ts は randomUUID を固定値にしているので、ここでは連番にする
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`
    );
    useImageStore.setState({
      files: [],
      processed: [],
      rejectedFiles: [],
      customSizeClamped: false,
      isProcessing: false,
      currentBatchId: null,
      downloadedBatchId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addFiles - rejection reasons', () => {
    it('rejects files beyond MAX_FILES and keeps the ones that fit', async () => {
      useImageStore.setState({
        files: Array.from({ length: MAX_FILES - 1 }, (_, i) => makeFile(`seed-${i}`)),
      });

      const result = await useImageStore
        .getState()
        .addFiles([makePngFile('a.png'), makePngFile('b.png')]);

      expect(result.added).toBe(1);
      expect(useImageStore.getState().files).toHaveLength(MAX_FILES);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0]?.name).toBe('b.png');
      expect(result.rejected[0]?.reason).toEqual({
        key: 'rejectTooManyFiles',
        params: { max: MAX_FILES },
      });
    });

    it('rejects a single file larger than MAX_FILE_SIZE_BYTES with the actual size', async () => {
      const result = await useImageStore
        .getState()
        .addFiles([makePngFile('huge.png', { size: 80 * MIB })]);

      expect(result.added).toBe(0);
      expect(result.rejected[0]?.reason.key).toBe('rejectFileTooLarge');
      expect(result.rejected[0]?.reason.params).toEqual({ size: '80MB', max: '50MB' });
    });

    it('rejects a file one byte over MAX_FILE_SIZE_BYTES', async () => {
      const result = await useImageStore
        .getState()
        .addFiles([makePngFile('edge-ng.png', { size: MAX_FILE_SIZE_BYTES + 1 })]);

      expect(result.added).toBe(0);
      expect(result.rejected[0]?.reason.key).toBe('rejectFileTooLarge');
    });

    it('accepts a file exactly at MAX_FILE_SIZE_BYTES', async () => {
      const result = await useImageStore
        .getState()
        .addFiles([makePngFile('edge.png', { size: MAX_FILE_SIZE_BYTES })]);

      expect(result.added).toBe(1);
      expect(result.rejected).toHaveLength(0);
    });

    it('rejects a non-image with an unsupported-format reason', async () => {
      const notAnImage = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', {
        type: 'application/pdf',
      });

      const result = await useImageStore.getState().addFiles([notAnImage]);

      expect(result.added).toBe(0);
      expect(result.rejected[0]?.reason).toEqual({ key: 'rejectUnsupportedFormat' });
    });

    it('rejects a PNG disguised as a JPEG with a mismatch reason', async () => {
      const disguised = new File([makePngBytes(10, 10)], 'a.jpg', { type: 'image/jpeg' });

      const result = await useImageStore.getState().addFiles([disguised]);

      expect(result.added).toBe(0);
      expect(result.rejected[0]?.reason).toEqual({
        key: 'rejectFormatMismatch',
        params: { detected: 'image/png' },
      });
    });

    it('accepts an edge of exactly MAX_INPUT_EDGE_PX and rejects one pixel more', async () => {
      const accepted = await useImageStore
        .getState()
        .addFiles([makePngFile('edge-ok.png', { width: MAX_INPUT_EDGE_PX, height: 100 })]);
      expect(accepted.added).toBe(1);
      expect(accepted.rejected).toHaveLength(0);

      const rejected = await useImageStore
        .getState()
        .addFiles([makePngFile('edge-ng.png', { width: MAX_INPUT_EDGE_PX + 1, height: 100 })]);
      expect(rejected.added).toBe(0);
      expect(rejected.rejected[0]?.reason).toEqual({
        key: 'rejectEdgeTooLarge',
        params: { width: MAX_INPUT_EDGE_PX + 1, height: 100, max: MAX_INPUT_EDGE_PX },
      });
    });

    it('accepts exactly MAX_INPUT_PIXELS and rejects one pixel more', async () => {
      // 8000 x 5000 = 40,000,000
      const accepted = await useImageStore
        .getState()
        .addFiles([makePngFile('px-ok.png', { width: 8000, height: 5000 })]);
      expect(accepted.added).toBe(1);
      expect(accepted.rejected).toHaveLength(0);

      // 8000 x 5001 = 40,008,000（辺の上限は超えない）
      const rejected = await useImageStore
        .getState()
        .addFiles([makePngFile('px-ng.png', { width: 8000, height: 5001 })]);
      expect(rejected.added).toBe(0);
      expect(rejected.rejected[0]?.reason.key).toBe('rejectTooManyPixels');
      expect(rejected.rejected[0]?.reason.params).toEqual({
        pixels: '40,008,000',
        width: 8000,
        height: 5001,
        max: '40,000,000',
      });
      expect(MAX_INPUT_PIXELS).toBe(40_000_000);
    });

    it('states the exact pixel count, not a rounded value that matches the limit', async () => {
      // 6400 x 6251 = 40,006,400。MP に丸めるとどちらも「40MP」になってしまう
      const rejected = await useImageStore
        .getState()
        .addFiles([makePngFile('near-limit.png', { width: 6400, height: 6251 })]);

      expect(rejected.added).toBe(0);
      const params = rejected.rejected[0]?.reason.params;
      expect(params?.pixels).toBe('40,006,400');
      expect(params?.max).toBe('40,000,000');
      expect(params?.pixels).not.toBe(params?.max);
    });

    it('accepts an image whose header cannot be parsed (decode re-checks it later)', async () => {
      const broken = makePngBytes(100, 100);
      broken[12] = 0x00; // IHDR を壊す
      const result = await useImageStore
        .getState()
        .addFiles([new File([broken], 'broken.png', { type: 'image/png' })]);

      expect(result.added).toBe(1);
      expect(result.rejected).toHaveLength(0);
    });

    it('rejects only the file that would exceed the batch total and keeps evaluating the rest', async () => {
      // 40MB × 19 = 760MB。45MB は入らないが、その後の 30MB は入る
      const files = [
        ...Array.from({ length: 19 }, (_, i) => makePngFile(`fill-${i}.png`, { size: 40 * MIB })),
        makePngFile('over.png', { size: 45 * MIB }),
        makePngFile('fits.png', { size: 30 * MIB }),
      ];

      const result = await useImageStore.getState().addFiles(files);

      expect(result.added).toBe(20);
      expect(useImageStore.getState().files.at(-1)?.name).toBe('fits.png');
      expect(useImageStore.getState().files.some((f) => f.name === 'over.png')).toBe(false);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0]?.name).toBe('over.png');
      expect(result.rejected[0]?.reason).toEqual({
        key: 'rejectBatchTooLarge',
        params: { max: '800MB' },
      });
      expect(MAX_BATCH_TOTAL_BYTES).toBe(800 * MIB);
    });

    it('counts already added files toward the batch total', async () => {
      await useImageStore
        .getState()
        .addFiles(
          Array.from({ length: 19 }, (_, i) => makePngFile(`fill-${i}.png`, { size: 40 * MIB }))
        );
      const result = await useImageStore
        .getState()
        .addFiles([makePngFile('second.png', { size: 45 * MIB })]);

      expect(result.added).toBe(0);
      expect(result.rejected[0]?.reason.key).toBe('rejectBatchTooLarge');
    });

    it('reports every rejection kind in one call', async () => {
      const notAnImage = new File([new Uint8Array([0x00, 0x01])], 'a.gif', { type: 'image/gif' });
      const result = await useImageStore
        .getState()
        .addFiles([
          makePngFile('ok.png'),
          makePngFile('too-big.png', { size: MAX_FILE_SIZE_BYTES + 1 }),
          notAnImage,
          makePngFile('too-wide.png', { width: MAX_INPUT_EDGE_PX + 1, height: 10 }),
        ]);

      expect(result.added).toBe(1);
      expect(result.rejected.map((r) => r.reason.key)).toEqual([
        'rejectFileTooLarge',
        'rejectUnsupportedFormat',
        'rejectEdgeTooLarge',
      ]);
    });
  });

  describe('rejectedFiles', () => {
    it('is replaced on every addFiles call and cleared by dismissRejected', async () => {
      await useImageStore
        .getState()
        .addFiles([makePngFile('a.pdf', { size: MAX_FILE_SIZE_BYTES + 1 })]);
      expect(useImageStore.getState().rejectedFiles).toHaveLength(1);

      // 次の追加が成功すれば前回の理由は消える
      await useImageStore.getState().addFiles([makePngFile('ok.png')]);
      expect(useImageStore.getState().rejectedFiles).toHaveLength(0);

      await useImageStore.getState().addFiles([makePngFile('ng.png', { width: 9000, height: 10 })]);
      expect(useImageStore.getState().rejectedFiles).toHaveLength(1);

      useImageStore.getState().dismissRejected();
      expect(useImageStore.getState().rejectedFiles).toHaveLength(0);
    });

    it('is cleared by clearFiles', async () => {
      await useImageStore.getState().addFiles([makePngFile('ng.png', { width: 9000, height: 10 })]);
      expect(useImageStore.getState().rejectedFiles).toHaveLength(1);

      useImageStore.getState().clearFiles();
      expect(useImageStore.getState().rejectedFiles).toEqual([]);
    });
  });

  describe('setCustomSize', () => {
    it('keeps values inside the output range untouched', () => {
      useImageStore.getState().setCustomSize(1200, 800);
      expect(useImageStore.getState().settings.customWidth).toBe(1200);
      expect(useImageStore.getState().settings.customHeight).toBe(800);
      expect(useImageStore.getState().customSizeClamped).toBe(false);
    });

    it('clamps values above MAX_OUTPUT_PX and flags it', () => {
      useImageStore.getState().setCustomSize(10000, 20000);
      expect(useImageStore.getState().settings.customWidth).toBe(MAX_OUTPUT_PX);
      expect(useImageStore.getState().settings.customHeight).toBe(MAX_OUTPUT_PX);
      expect(useImageStore.getState().customSizeClamped).toBe(true);
    });

    it('clamps values below MIN_OUTPUT_PX and flags it', () => {
      useImageStore.getState().setCustomSize(1, 1);
      expect(useImageStore.getState().settings.customWidth).toBe(MIN_OUTPUT_PX);
      expect(useImageStore.getState().settings.customHeight).toBe(MIN_OUTPUT_PX);
      expect(useImageStore.getState().customSizeClamped).toBe(true);
    });

    it('accepts the boundary values without flagging a clamp', () => {
      useImageStore.getState().setCustomSize(MIN_OUTPUT_PX, MAX_OUTPUT_PX);
      expect(useImageStore.getState().settings.customWidth).toBe(MIN_OUTPUT_PX);
      expect(useImageStore.getState().settings.customHeight).toBe(MAX_OUTPUT_PX);
      expect(useImageStore.getState().customSizeClamped).toBe(false);
    });

    it('clears the flag once a valid size is set again', () => {
      useImageStore.getState().setCustomSize(10000, 10000);
      expect(useImageStore.getState().customSizeClamped).toBe(true);

      useImageStore.getState().setCustomSize(1080, 1080);
      expect(useImageStore.getState().customSizeClamped).toBe(false);
    });
  });
});
