import { create } from 'zustand';
import type {
  ImageFile,
  ProcessedImage,
  ProcessingSettings,
  ModelState,
  RejectedFile,
  RejectionReason,
  SNSPresetKey,
  WatermarkPosition,
} from '../types';
import { validateImageFiles } from '../utils/fileValidation';
import {
  MAX_BATCH_TOTAL_BYTES,
  MAX_FILES,
  MAX_FILE_SIZE_BYTES,
  MAX_INPUT_EDGE_PX,
  MAX_INPUT_PIXELS,
  clampOutputSize,
  toMegabytes,
  formatPixels,
} from '../constants/limits';

interface ImageStore {
  // State
  files: ImageFile[];
  processed: ProcessedImage[];
  settings: ProcessingSettings;
  modelState: ModelState;
  isProcessing: boolean;
  /**
   * 現在（または直近）のバッチ ID。
   * クリア時に null になり、進行中のバッチが「無効になった」ことを表す。
   */
  currentBatchId: string | null;
  /** 自動保存（ZIP 保存）が完了済みのバッチ ID */
  downloadedBatchId: string | null;
  /** 直近の addFiles で拒否されたファイルと理由（UI 表示用） */
  rejectedFiles: RejectedFile[];
  /** 出力サイズがクランプされたか（設定 UI の注記に使う） */
  customSizeClamped: boolean;

  // File operations
  addFiles: (files: File[]) => Promise<{
    added: number;
    rejected: RejectedFile[];
  }>;
  /** 拒否理由の表示を閉じる */
  dismissRejected: () => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  updateFileStatus: (
    id: string,
    status: ImageFile['status'],
    progress?: number,
    error?: string,
    errorReason?: RejectionReason
  ) => void;
  /** failed のファイルを pending に戻す（再試行用）。戻した件数を返す */
  resetFailedFiles: () => number;

  // Processed image operations
  addProcessedImage: (image: ProcessedImage) => void;
  clearProcessed: () => void;

  // Settings operations
  setPreset: (preset: SNSPresetKey) => void;
  setCustomSize: (width: number, height: number) => void;
  setQuality: (quality: number) => void;
  setWatermark: (enabled: boolean, text?: string, position?: WatermarkPosition) => void;
  setBackgroundRemoval: (enabled: boolean) => void;

  // Model state
  setModelState: (state: Partial<ModelState>) => void;

  // Processing state
  setIsProcessing: (isProcessing: boolean) => void;

  // Batch lifecycle
  /** 新しいバッチを開始し、そのバッチ ID を返す */
  startBatch: () => string;
  /** バッチを終了する。現行バッチでない場合は何もしない */
  endBatch: (batchId: string) => void;
  /** 進行中のバッチを無効化する（結果の取り込みを止める） */
  abortBatch: () => void;
  /** 自動保存が完了したバッチを記録する */
  markBatchDownloaded: (batchId: string) => void;
}

const initialSettings: ProcessingSettings = {
  preset: 'instagram-square',
  customWidth: 1080,
  customHeight: 1080,
  quality: 90,
  enableWatermark: false,
  watermarkText: '',
  watermarkPosition: 'bottomRight',
  enableBackgroundRemoval: false,
};

// バッチ ID は「同一セッション内で絶対に重複しない」ことだけが要件なので、
// crypto.randomUUID（テストでモックされうる）ではなく単調増加カウンタで作る。
let batchCounter = 0;
const nextBatchId = (): string => `batch-${++batchCounter}`;

const initialModelState: ModelState = {
  status: 'idle',
  progress: 0,
  message: '',
  device: null,
};

export const useImageStore = create<ImageStore>((set, get) => ({
  // Initial state
  files: [],
  processed: [],
  settings: initialSettings,
  modelState: initialModelState,
  isProcessing: false,
  currentBatchId: null,
  downloadedBatchId: null,
  rejectedFiles: [],
  customSizeClamped: false,

  // File operations
  addFiles: async (newFiles: File[]) => {
    // 読み取り（I/O）は並列に、判定は入力順に行う。
    // 総量の判定は「それまでに受け入れた分」に依存するので順序が意味を持つ。
    const validations = await validateImageFiles(newFiles);

    const existing = get().files;
    let acceptedCount = existing.length;
    let acceptedBytes = existing.reduce((total, file) => total + file.size, 0);

    const imageFiles: ImageFile[] = [];
    const rejected: RejectedFile[] = [];

    newFiles.forEach((file, index) => {
      // 1. 枚数
      if (acceptedCount >= MAX_FILES) {
        rejected.push({
          name: file.name,
          reason: { key: 'rejectTooManyFiles', params: { max: MAX_FILES } },
        });
        return;
      }

      // 2. 単体サイズ
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push({
          name: file.name,
          reason: {
            key: 'rejectFileTooLarge',
            params: { size: toMegabytes(file.size), max: toMegabytes(MAX_FILE_SIZE_BYTES) },
          },
        });
        return;
      }

      // 3. 形式（マジックバイト）
      const validation = validations[index];
      if (!validation || !validation.isValid) {
        rejected.push({
          name: file.name,
          reason: validation?.detectedType
            ? {
                key: 'rejectFormatMismatch',
                params: { detected: validation.detectedType },
              }
            : { key: 'rejectUnsupportedFormat' },
        });
        return;
      }

      // 4. 寸法（ヘッダから読めた場合のみ。読めない場合はデコード時に再チェックする）
      const { width, height } = validation;
      if (width !== undefined && height !== undefined) {
        if (width > MAX_INPUT_EDGE_PX || height > MAX_INPUT_EDGE_PX) {
          rejected.push({
            name: file.name,
            reason: {
              key: 'rejectEdgeTooLarge',
              params: { width, height, max: MAX_INPUT_EDGE_PX },
            },
          });
          return;
        }
        if (width * height > MAX_INPUT_PIXELS) {
          rejected.push({
            name: file.name,
            reason: {
              key: 'rejectTooManyPixels',
              params: {
                pixels: formatPixels(width * height),
                width,
                height,
                max: formatPixels(MAX_INPUT_PIXELS),
              },
            },
          });
          return;
        }
      }

      // 5. バッチ総量（超えた 1 枚だけを拒否し、残りは順に評価し続ける）
      if (acceptedBytes + file.size > MAX_BATCH_TOTAL_BYTES) {
        rejected.push({
          name: file.name,
          reason: {
            key: 'rejectBatchTooLarge',
            params: { max: toMegabytes(MAX_BATCH_TOTAL_BYTES) },
          },
        });
        return;
      }

      acceptedCount += 1;
      acceptedBytes += file.size;
      imageFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        blob: file,
        status: 'pending' as const,
        progress: 0,
      });
    });

    set((state) => ({
      files: [...state.files, ...imageFiles],
      // 表示は「直近の追加操作の結果」だけにする
      rejectedFiles: rejected,
    }));

    return {
      added: imageFiles.length,
      rejected,
    };
  },

  dismissRejected: () => {
    set({ rejectedFiles: [] });
  },

  removeFile: (id: string) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    }));
  },

  clearFiles: () => {
    // 進行中のバッチを無効化する。currentBatchId を null にすることで
    // useImageProcessor 側が待機中の Worker 要求を reject し、
    // 遅れて届いた結果は破棄される。
    set({
      files: [],
      processed: [],
      currentBatchId: null,
      downloadedBatchId: null,
      isProcessing: false,
      rejectedFiles: [],
    });
  },

  updateFileStatus: (id, status, progress, error, errorReason) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, status, progress: progress ?? f.progress, error, errorReason } : f
      ),
    }));
  },

  resetFailedFiles: () => {
    let reset = 0;
    set((state) => ({
      files: state.files.map((f) => {
        if (f.status !== 'failed') return f;
        reset += 1;
        return {
          ...f,
          status: 'pending' as const,
          progress: 0,
          error: undefined,
          errorReason: undefined,
        };
      }),
    }));
    return reset;
  },

  // Processed image operations
  addProcessedImage: (image: ProcessedImage) => {
    set((state) => ({
      processed: [...state.processed, image],
    }));
  },

  clearProcessed: () => {
    set({ processed: [] });
  },

  // Settings operations
  setPreset: (preset: SNSPresetKey) => {
    set((state) => ({
      settings: { ...state.settings, preset },
    }));
  },

  setCustomSize: (width: number, height: number) => {
    // 出力側の画素予算。Canvas の確保に失敗する大きさを設定できないようにする
    const clampedWidth = clampOutputSize(width);
    const clampedHeight = clampOutputSize(height);
    set((state) => ({
      settings: { ...state.settings, customWidth: clampedWidth, customHeight: clampedHeight },
      customSizeClamped: clampedWidth !== width || clampedHeight !== height,
    }));
  },

  setQuality: (quality: number) => {
    set((state) => ({
      settings: { ...state.settings, quality },
    }));
  },

  setWatermark: (enabled: boolean, text?: string, position?: WatermarkPosition) => {
    set((state) => ({
      settings: {
        ...state.settings,
        enableWatermark: enabled,
        watermarkText: text ?? state.settings.watermarkText,
        watermarkPosition: position ?? state.settings.watermarkPosition,
      },
    }));
  },

  setBackgroundRemoval: (enabled: boolean) => {
    set((state) => ({
      settings: { ...state.settings, enableBackgroundRemoval: enabled },
    }));
  },

  // Model state
  setModelState: (newState: Partial<ModelState>) => {
    set((state) => ({
      modelState: { ...state.modelState, ...newState },
    }));
  },

  // Processing state
  setIsProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },

  // Batch lifecycle
  startBatch: () => {
    const batchId = nextBatchId();
    set({ currentBatchId: batchId, isProcessing: true });
    return batchId;
  },

  endBatch: (batchId: string) => {
    // 既に別のバッチが始まっている／クリアされている場合は触らない
    if (get().currentBatchId !== batchId) return;
    set({ isProcessing: false });
  },

  abortBatch: () => {
    set({ currentBatchId: null, isProcessing: false });
  },

  markBatchDownloaded: (batchId: string) => {
    set({ downloadedBatchId: batchId });
  },
}));
