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

  // File operations
  addFiles: (files: File[]) => Promise<{ added: number; rejected: Array<{ name: string; error: string }> }>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  updateFileStatus: (id: string, status: ImageFile['status'], progress?: number, error?: string) => void;

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
      rejected: invalidFiles.map((f) => ({ name: f.file.name, error: f.error })),
    };
  },

  removeFile: (id: string) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    }));
  },

  clearFiles: () => {
    set({ files: [], processed: [] });
  },

  updateFileStatus: (id, status, progress, error) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id
          ? { ...f, status, progress: progress ?? f.progress, error }
          : f
      ),
    }));
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
}));
