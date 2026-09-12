/**
 * ファイルバリデーションユーティリティ
 * マジックバイト検証によるファイル内容の確認と、ヘッダからの寸法取得
 */

import { HEADER_READ_BYTES } from '../constants/limits';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ValidationResult {
  isValid: boolean;
  detectedType: string | null;
  error?: string;
  /** ヘッダから読み取れた寸法。解析できなければ undefined */
  width?: number;
  height?: number;
}

/** noUncheckedIndexedAccess 下で境界チェック済みの位置を読むための補助 */
const byteAt = (bytes: Uint8Array, index: number): number => bytes[index] ?? 0;

/**
 * PNG の IHDR から寸法を読む。
 * 先頭 8 バイトがシグネチャ、次が長さ(4)+'IHDR'(4)、offset 16 から幅・高さ各 4 バイト BE。
 */
const readPngDimensions = (bytes: Uint8Array): ImageDimensions | undefined => {
  if (bytes.length < 24) return undefined;
  // 'IHDR'
  if (
    byteAt(bytes, 12) !== 0x49 ||
    byteAt(bytes, 13) !== 0x48 ||
    byteAt(bytes, 14) !== 0x44 ||
    byteAt(bytes, 15) !== 0x52
  ) {
    return undefined;
  }
  const readUint32BE = (offset: number): number =>
    byteAt(bytes, offset) * 0x1000000 +
    (byteAt(bytes, offset + 1) << 16) +
    (byteAt(bytes, offset + 2) << 8) +
    byteAt(bytes, offset + 3);

  const width = readUint32BE(16);
  const height = readUint32BE(20);
  if (width <= 0 || height <= 0) return undefined;
  return { width, height };
};

/** SOF マーカーか（0xC0–0xCF のうち DHT/JPG/DAC を除く） */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/**
 * JPEG のセグメントを走査して SOF から寸法を読む。
 * SOF は EXIF(APP1) などの後ろに来るため、セグメント長で読み飛ばしながら探す。
 */
const readJpegDimensions = (bytes: Uint8Array): ImageDimensions | undefined => {
  let offset = 2; // SOI(FFD8) の次から
  while (offset + 1 < bytes.length) {
    if (byteAt(bytes, offset) !== 0xff) return undefined;

    // 0xFF はフィルバイトとして連続しうる
    let marker = byteAt(bytes, offset + 1);
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = byteAt(bytes, offset + 1);
    }
    offset += 2;

    // 長さを持たないマーカー
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    // SOS/EOI まで来たら SOF は見つからない
    if (marker === 0xda || marker === 0xd9) return undefined;

    if (offset + 1 >= bytes.length) return undefined;
    const segmentLength = (byteAt(bytes, offset) << 8) | byteAt(bytes, offset + 1);
    if (segmentLength < 2) return undefined;

    if (isStartOfFrame(marker)) {
      // セグメント: 長さ(2) + 精度(1) + 高さ(2) + 幅(2)
      if (offset + 6 >= bytes.length) return undefined;
      const height = (byteAt(bytes, offset + 3) << 8) | byteAt(bytes, offset + 4);
      const width = (byteAt(bytes, offset + 5) << 8) | byteAt(bytes, offset + 6);
      if (width <= 0 || height <= 0) return undefined;
      return { width, height };
    }

    offset += segmentLength;
  }
  return undefined;
};

/**
 * WebP の寸法を読む（RIFF コンテナの最初のチャンク種別ごとに形式が違う）。
 * - 'VP8 ': ロスあり。キーフレームヘッダの開始コード 9d 01 2a の後に 14bit 幅・高さ(LE)
 * - 'VP8L': ロスレス。シグネチャ 0x2f の後に 14bit の (幅-1)・(高さ-1)
 * - 'VP8X': 拡張。24bit LE の (キャンバス幅-1) が offset 24、(高さ-1) が offset 27
 */
const readWebpDimensions = (bytes: Uint8Array): ImageDimensions | undefined => {
  if (bytes.length < 30) return undefined;
  const fourCC = String.fromCharCode(
    byteAt(bytes, 12),
    byteAt(bytes, 13),
    byteAt(bytes, 14),
    byteAt(bytes, 15)
  );

  if (fourCC === 'VP8 ') {
    // チャンクデータは offset 20 から。3 バイトのフレームタグの後が開始コード
    if (byteAt(bytes, 23) !== 0x9d || byteAt(bytes, 24) !== 0x01 || byteAt(bytes, 25) !== 0x2a) {
      return undefined;
    }
    const width = ((byteAt(bytes, 27) << 8) | byteAt(bytes, 26)) & 0x3fff;
    const height = ((byteAt(bytes, 29) << 8) | byteAt(bytes, 28)) & 0x3fff;
    if (width <= 0 || height <= 0) return undefined;
    return { width, height };
  }

  if (fourCC === 'VP8L') {
    if (byteAt(bytes, 20) !== 0x2f) return undefined;
    const bits =
      (byteAt(bytes, 21) |
        (byteAt(bytes, 22) << 8) |
        (byteAt(bytes, 23) << 16) |
        (byteAt(bytes, 24) << 24)) >>>
      0;
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (fourCC === 'VP8X') {
    const width = (byteAt(bytes, 24) | (byteAt(bytes, 25) << 8) | (byteAt(bytes, 26) << 16)) + 1;
    const height = (byteAt(bytes, 27) | (byteAt(bytes, 28) << 8) | (byteAt(bytes, 29) << 16)) + 1;
    return { width, height };
  }

  return undefined;
};

/**
 * 画像ヘッダから寸法を読む（デコードしない）。
 * 解析できない場合は undefined を返し、判定はデコード時の再チェックに委ねる。
 */
export const readImageDimensions = (
  bytes: Uint8Array,
  detectedType: string
): ImageDimensions | undefined => {
  try {
    switch (detectedType) {
      case 'image/png':
        return readPngDimensions(bytes);
      case 'image/jpeg':
        return readJpegDimensions(bytes);
      case 'image/webp':
        return readWebpDimensions(bytes);
      default:
        return undefined;
    }
  } catch {
    // 想定外のヘッダでも「寸法不明」として通す（拒否は decode 経路が担保する）
    return undefined;
  }
};

/**
 * 画像ファイルのマジックバイトを検証し、ヘッダから寸法を読む
 * 拡張子だけでなく、ファイルの実際の内容を確認
 */
export async function validateImageFile(file: File): Promise<ValidationResult> {
  try {
    // 先頭 64KB を読み取る（JPEG の SOF は EXIF の後ろに来ることがある）
    const buffer = await file.slice(0, HEADER_READ_BYTES).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPNG =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    // JPEG: FF D8 FF
    const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
    const isWebP =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    // 検出されたタイプを判定
    let detectedType: string | null = null;
    if (isPNG) {
      detectedType = 'image/png';
    } else if (isJPEG) {
      detectedType = 'image/jpeg';
    } else if (isWebP) {
      detectedType = 'image/webp';
    }

    // マジックバイトの検証結果
    if (!detectedType) {
      return {
        isValid: false,
        detectedType: null,
        error: 'Invalid image file format. Only PNG, JPEG, and WebP are supported.',
      };
    }

    // MIMEタイプの整合性チェック（JPEGはimage/jpegとimage/jpg両方許容）
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileMimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

    if (!validMimeTypes.includes(fileMimeType)) {
      return {
        isValid: false,
        detectedType,
        error: `Invalid MIME type: ${file.type}. Expected ${validMimeTypes.join(', ')}.`,
      };
    }

    // MIMEタイプとマジックバイトの一致確認
    if (fileMimeType !== detectedType) {
      // JPEG/JPG の場合は許容
      if (!(fileMimeType === 'image/jpeg' && detectedType === 'image/jpeg')) {
        return {
          isValid: false,
          detectedType,
          error: `File content mismatch: declared as ${file.type} but detected as ${detectedType}.`,
        };
      }
    }

    const dimensions = readImageDimensions(bytes, detectedType);

    return {
      isValid: true,
      detectedType,
      width: dimensions?.width,
      height: dimensions?.height,
    };
  } catch (error) {
    return {
      isValid: false,
      detectedType: null,
      error: `Failed to validate file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 複数のファイルをまとめて検証する（並列に読み取り、入力順で結果を返す）。
 * 枚数・サイズ・総量の判定は store 側が順序を保って行うため、ここでは行わない。
 */
export async function validateImageFiles(files: File[]): Promise<ValidationResult[]> {
  return Promise.all(files.map((file) => validateImageFile(file)));
}
