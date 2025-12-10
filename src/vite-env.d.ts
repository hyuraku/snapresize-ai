/// <reference types="vite/client" />

declare module '@xenova/transformers' {
  export function pipeline(
    task: string,
    model: string,
    options?: {
      device?: 'webgpu' | 'wasm' | 'cpu';
      progress_callback?: (progress: { status: string; progress?: number; file?: string }) => void;
    }
  ): Promise<ImageSegmentationPipeline>;

  export interface ImageSegmentationPipeline {
    (input: string | Blob | ImageData): Promise<ImageSegmentationResult[]>;
  }

  export interface ImageSegmentationResult {
    label: string;
    score: number;
    mask: RawImage;
  }

  export class RawImage {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    toCanvas(): HTMLCanvasElement;
  }
}
