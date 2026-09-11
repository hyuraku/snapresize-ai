import { create } from 'zustand';
import type {
  ImageFile,
  ProcessedImage,
  ProcessingSettings,
  ModelState,
  SNSPresetKey,
  WatermarkPosition,
} from '../types';
import { validateImageFiles } from '../utils/fileValidation';

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

  // File operations
  addFiles: (files: File[]) => Promise<{
    added: number;
    rejected: Array<{ name: string; error: string }>;
  }>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  updateFileStatus: (
    id: string,
    status: ImageFile['status'],
    progress?: number,
    error?: string
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

  // File operations
  addFiles: async (newFiles: File[]) => {
    // Apply size limit first
    const sizeFilteredFiles = newFiles
      .filter((file) => file.size <= 50 * 1024 * 1024) // 50MB limit
      .slice(0, 50 - get().files.length); // Max 50 files

    // Execute magic byte validation
    const { validFiles, invalidFiles } = await validateImageFiles(sizeFilteredFiles);

    const imageFiles: ImageFile[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      blob: file,
      status: 'pending' as const,
      progress: 0,
    }));

    set((state) => ({
      files: [...state.files, ...imageFiles],
    }));

    return {
      added: imageFiles.length,
      rejected: invalidFiles.map((f) => ({
        name: f.file.name,
        error: f.error,
      })),
    };
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
    });
  },

  updateFileStatus: (id, status, progress, error) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, status, progress: progress ?? f.progress, error } : f
      ),
    }));
  },

  resetFailedFiles: () => {
    let reset = 0;
    set((state) => ({
      files: state.files.map((f) => {
        if (f.status !== 'failed') return f;
        reset += 1;
        return { ...f, status: 'pending' as const, progress: 0, error: undefined };
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
    set((state) => ({
      settings: { ...state.settings, customWidth: width, customHeight: height },
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
