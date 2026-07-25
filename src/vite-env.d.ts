/// <reference types="vite/client" />

// Fontsource packages ship plain CSS with no type declarations, so the
// side-effect imports in main.tsx have nothing to resolve to. TypeScript 6.0
// enables `noUncheckedSideEffectImports` by default, which reports those as
// TS2882; declaring the subpath pattern keeps the check on for everything else.
declare module '@fontsource-variable/*';

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
