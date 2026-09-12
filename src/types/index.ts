// ===== 画像ファイル関連 =====
export interface ImageFile {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  thumbnail?: string;
  status: ProcessingStatus;
  progress: number;
  error?: string;
  /** 失敗理由の構造化表現（UI が言語に応じて文字列化する） */
  errorReason?: RejectionReason;
}

/**
 * 拒否・失敗の理由。
 * 文言を持たず「翻訳キー＋パラメータ」で表すことで、UI 側が JA/EN を出し分けられる。
 */
export interface RejectionReason {
  key: string;
  params?: Record<string, string | number>;
}

/** 追加できなかったファイルと、その理由 */
export interface RejectedFile {
  name: string;
  reason: RejectionReason;
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessedImage {
  id: string;
  originalId: string;
  name: string;
  blob: Blob;
  preset: SNSPreset;
  hasWatermark: boolean;
  hasBackgroundRemoval: boolean;
  quality: number;
}

// ===== SNSプリセット =====
export type SNSPresetKey =
  | 'instagram-square'
  | 'instagram-portrait'
  | 'instagram-story'
  | 'twitter-square'
  | 'twitter-landscape'
  | 'twitter-header'
  | 'linkedin-post'
  | 'linkedin-banner'
  | 'facebook-post'
  | 'facebook-cover'
  | 'custom';

export interface SNSPreset {
  key: SNSPresetKey;
  label: string;
  labelEn: string;
  width: number;
  height: number;
  platform: 'instagram' | 'twitter' | 'linkedin' | 'facebook' | 'custom';
}

// ===== 設定 =====
export interface ProcessingSettings {
  preset: SNSPresetKey;
  customWidth: number;
  customHeight: number;
  quality: number;
  enableWatermark: boolean;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  enableBackgroundRemoval: boolean;
}

export type WatermarkPosition = 'bottomRight' | 'bottomLeft' | 'center' | 'topRight' | 'topLeft';

// ===== モデル状態 =====
export interface ModelState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;
  message: string;
  device: 'webgpu' | 'wasm' | null;
}

// ===== Worker メッセージ =====
export interface WorkerMessage {
  type: 'init' | 'process' | 'progress' | 'result' | 'error';
  payload?: unknown;
}

export interface InitMessage {
  type: 'init';
}

export interface ProcessMessage {
  type: 'process';
  payload: {
    imageData: ImageData;
    id: string;
  };
}

export interface ProgressMessage {
  type: 'progress';
  payload: {
    status: string;
    progress: number;
    message: string;
  };
}

export interface ResultMessage {
  type: 'result';
  payload: {
    id: string;
    maskData: ImageData;
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    id?: string;
    message: string;
  };
}

// ===== 多言語対応 =====
export type Language = 'ja' | 'en';

export interface Translations {
  [key: string]: string;
}
