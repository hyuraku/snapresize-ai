import type { WatermarkPosition } from '../types';
import { SNS_PRESETS } from '../constants/presets';
import type { SNSPresetKey } from '../types';

/**
 * 画像をリサイズする
 */
export const resizeImage = (
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // アスペクト比を維持してフィット（cover方式）
  const imgRatio = img.width / img.height;
  const canvasRatio = targetWidth / targetHeight;
  let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

  if (imgRatio > canvasRatio) {
    drawHeight = targetHeight;
    drawWidth = drawHeight * imgRatio;
    offsetX = (targetWidth - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = targetWidth;
    drawHeight = drawWidth / imgRatio;
    offsetX = 0;
    offsetY = (targetHeight - drawHeight) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  return canvas;
};

/**
 * 透かしを追加する
 */
export const addWatermark = (
  canvas: HTMLCanvasElement,
  text: string,
  position: WatermarkPosition
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontSize = Math.max(16, Math.floor(canvas.width / 30));
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;

  const padding = 20;
  const textWidth = ctx.measureText(text).width;
  const textHeight = fontSize;

  let x: number, y: number;

  switch (position) {
    case 'bottomRight':
      x = canvas.width - textWidth - padding;
      y = canvas.height - padding;
      break;
    case 'bottomLeft':
      x = padding;
      y = canvas.height - padding;
      break;
    case 'topRight':
      x = canvas.width - textWidth - padding;
      y = textHeight + padding;
      break;
    case 'topLeft':
      x = padding;
      y = textHeight + padding;
      break;
    case 'center':
    default:
      x = (canvas.width - textWidth) / 2;
      y = canvas.height / 2;
      break;
  }

  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
};

/**
 * 背景除去済みの画像を適用する
 */
export const applyBackgroundRemoval = (
  canvas: HTMLCanvasElement,
  maskData: ImageData
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 元画像のサイズにマスクをリサイズして適用
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = maskData.width;
  tempCanvas.height = maskData.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.putImageData(maskData, 0, 0);

  // 元のキャンバスにマスク済み画像を描画
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
};

/**
 * Canvas を Blob に変換する
 */
export const canvasToBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
  hasTransparency: boolean
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const mimeType = hasTransparency ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      quality / 100
    );
  });
};

/**
 * Blob から ImageData を取得する
 */
export const blobToImageData = (blob: Blob): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Blob から HTMLImageElement を取得する
 */
export const blobToImage = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * プリセットからサイズを取得する
 */
export const getPresetSize = (
  preset: SNSPresetKey,
  customWidth?: number,
  customHeight?: number
): { width: number; height: number } => {
  if (preset === 'custom') {
    return {
      width: customWidth || 1080,
      height: customHeight || 1080,
    };
  }
  const presetConfig = SNS_PRESETS[preset];
  return {
    width: presetConfig.width,
    height: presetConfig.height,
  };
};

/**
 * ファイルサイズをフォーマットする
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
};
