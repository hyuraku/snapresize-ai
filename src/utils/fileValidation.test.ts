import { describe, it, expect } from 'vitest';
import { validateImageFile, readImageDimensions } from './fileValidation';
import { MAX_INPUT_EDGE_PX } from '../constants/limits';

// ---------------------------------------------------------------------------
// 実バイナリのヘッダを組み立てる（デコードは一切しない）
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG: シグネチャ + IHDR チャンク（長さ・型・幅・高さ） */
const makePngHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  bytes.set(PNG_SIGNATURE, 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13); // IHDR のデータ長
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8; // bit depth
  bytes[25] = 6; // color type (RGBA)
  return bytes;
};

/**
 * JPEG: SOI + 任意の先行セグメント + SOF + SOS
 * `leadingSegments` は [marker, dataBytes] の配列（APP1/EXIF などの模擬）。
 */
const makeJpegHeader = (
  width: number,
  height: number,
  options: { sofMarker?: number; leadingSegments?: Array<[number, number[]]> } = {}
): Uint8Array => {
  const { sofMarker = 0xc0, leadingSegments = [] } = options;
  const bytes: number[] = [0xff, 0xd8];

  for (const [marker, data] of leadingSegments) {
    const length = data.length + 2;
    bytes.push(0xff, marker, (length >> 8) & 0xff, length & 0xff, ...data);
  }

  // SOF: 長さ(2) + 精度(1) + 高さ(2) + 幅(2) + 成分数(1)
  bytes.push(
    0xff,
    sofMarker,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03
  );
  // 成分ごとの記述（3 成分 × 3 バイト）
  bytes.push(0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01);
  bytes.push(0xff, 0xda); // SOS
  return new Uint8Array(bytes);
};

/** RIFF コンテナの共通部分 */
const makeRiffContainer = (fourCC: string, chunkData: number[]): Uint8Array => {
  const bytes: number[] = [];
  const push = (text: string): void => {
    for (const char of text) bytes.push(char.charCodeAt(0));
  };
  push('RIFF');
  const riffSize = 4 + 8 + chunkData.length;
  bytes.push(riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, 0);
  push('WEBP');
  push(fourCC);
  const size = chunkData.length;
  bytes.push(size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, 0);
  bytes.push(...chunkData);
  // チャンクが短くても読み取り位置まで届くようにパディングする
  while (bytes.length < 40) bytes.push(0);
  return new Uint8Array(bytes);
};

/** WebP ロスあり（VP8 ）: フレームタグ(3) + 開始コード(3) + 幅(2) + 高さ(2) */
const makeWebpLossy = (width: number, height: number): Uint8Array =>
  makeRiffContainer('VP8 ', [
    0x00,
    0x00,
    0x00, // frame tag
    0x9d,
    0x01,
    0x2a, // start code
    width & 0xff,
    (width >> 8) & 0x3f,
    height & 0xff,
    (height >> 8) & 0x3f,
  ]);

/** WebP ロスレス（VP8L）: 0x2f + 14bit(幅-1) + 14bit(高さ-1) */
const makeWebpLossless = (width: number, height: number): Uint8Array => {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return makeRiffContainer('VP8L', [
    0x2f,
    bits & 0xff,
    (bits >>> 8) & 0xff,
    (bits >>> 16) & 0xff,
    (bits >>> 24) & 0xff,
  ]);
};

/** WebP 拡張（VP8X）: フラグ(1) + 予約(3) + 24bit(幅-1) + 24bit(高さ-1) */
const makeWebpExtended = (width: number, height: number): Uint8Array => {
  const w = width - 1;
  const h = height - 1;
  return makeRiffContainer('VP8X', [
    0x10,
    0x00,
    0x00,
    0x00,
    w & 0xff,
    (w >> 8) & 0xff,
    (w >> 16) & 0xff,
    h & 0xff,
    (h >> 8) & 0xff,
    (h >> 16) & 0xff,
  ]);
};

const makeFile = (bytes: Uint8Array, name: string, type: string): File =>
  new File([bytes], name, { type });

describe('readImageDimensions', () => {
  describe('PNG', () => {
    it('reads width and height from IHDR', () => {
      expect(readImageDimensions(makePngHeader(1920, 1080), 'image/png')).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it('reads the boundary size 8192x8192', () => {
      expect(readImageDimensions(makePngHeader(8192, 8192), 'image/png')).toEqual({
        width: MAX_INPUT_EDGE_PX,
        height: MAX_INPUT_EDGE_PX,
      });
    });

    it('reads sizes above 16 bits without sign errors', () => {
      expect(readImageDimensions(makePngHeader(70000, 3), 'image/png')).toEqual({
        width: 70000,
        height: 3,
      });
    });

    it('returns undefined when IHDR is missing', () => {
      const bytes = makePngHeader(100, 100);
      bytes[12] = 0x00; // 'IHDR' を壊す
      expect(readImageDimensions(bytes, 'image/png')).toBeUndefined();
    });

    it('returns undefined for a truncated header', () => {
      expect(
        readImageDimensions(makePngHeader(100, 100).slice(0, 20), 'image/png')
      ).toBeUndefined();
    });
  });

  describe('JPEG', () => {
    it('reads width and height from SOF0', () => {
      expect(readImageDimensions(makeJpegHeader(4000, 3000), 'image/jpeg')).toEqual({
        width: 4000,
        height: 3000,
      });
    });

    it('skips APP1 (EXIF) and finds a later SOF2', () => {
      const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...new Array(2000).fill(0x00)];
      const bytes = makeJpegHeader(6000, 4000, {
        sofMarker: 0xc2,
        leadingSegments: [
          [0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]], // APP0
          [0xe1, exif], // APP1 (EXIF)
          [0xdb, new Array(64).fill(0x10)], // DQT
        ],
      });
      expect(readImageDimensions(bytes, 'image/jpeg')).toEqual({ width: 6000, height: 4000 });
    });

    it('does not treat DHT (0xC4) as a SOF marker', () => {
      const bytes = makeJpegHeader(800, 600, {
        leadingSegments: [[0xc4, new Array(20).fill(0x01)]],
      });
      expect(readImageDimensions(bytes, 'image/jpeg')).toEqual({ width: 800, height: 600 });
    });

    it('returns undefined when SOS is reached before any SOF', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]);
      expect(readImageDimensions(bytes, 'image/jpeg')).toBeUndefined();
    });

    it('returns undefined for a corrupted segment structure', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0x12, 0x34, 0x56, 0x78]);
      expect(readImageDimensions(bytes, 'image/jpeg')).toBeUndefined();
    });
  });

  describe('WebP', () => {
    it('reads VP8 (lossy) dimensions', () => {
      expect(readImageDimensions(makeWebpLossy(1280, 720), 'image/webp')).toEqual({
        width: 1280,
        height: 720,
      });
    });

    it('reads VP8L (lossless) dimensions', () => {
      expect(readImageDimensions(makeWebpLossless(3000, 2000), 'image/webp')).toEqual({
        width: 3000,
        height: 2000,
      });
    });

    it('reads VP8X (extended) dimensions', () => {
      expect(readImageDimensions(makeWebpExtended(10000, 9000), 'image/webp')).toEqual({
        width: 10000,
        height: 9000,
      });
    });

    it('returns undefined when the VP8 start code is wrong', () => {
      const bytes = makeWebpLossy(100, 100);
      bytes[23] = 0x00;
      expect(readImageDimensions(bytes, 'image/webp')).toBeUndefined();
    });

    it('returns undefined for an unknown chunk type', () => {
      expect(
        readImageDimensions(makeRiffContainer('ANIM', [0, 0, 0]), 'image/webp')
      ).toBeUndefined();
    });
  });

  it('returns undefined for an unknown media type', () => {
    expect(readImageDimensions(makePngHeader(10, 10), 'image/gif')).toBeUndefined();
  });
});

describe('validateImageFile', () => {
  it('accepts a PNG and reports its dimensions', async () => {
    const result = await validateImageFile(
      makeFile(makePngHeader(1200, 800), 'a.png', 'image/png')
    );
    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe('image/png');
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
  });

  it('accepts a JPEG whose SOF sits after a large EXIF block', async () => {
    const bytes = makeJpegHeader(8192, 4096, {
      leadingSegments: [[0xe1, new Array(30000).fill(0x00)]],
    });
    const result = await validateImageFile(makeFile(bytes, 'a.jpg', 'image/jpeg'));
    expect(result.isValid).toBe(true);
    expect(result.width).toBe(8192);
    expect(result.height).toBe(4096);
  });

  it('accepts a WebP and reports its dimensions', async () => {
    const result = await validateImageFile(
      makeFile(makeWebpLossless(640, 480), 'a.webp', 'image/webp')
    );
    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe('image/webp');
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
  });

  it('rejects a file whose magic bytes are not an image', async () => {
    const result = await validateImageFile(
      makeFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'a.pdf', 'application/pdf')
    );
    expect(result.isValid).toBe(false);
    expect(result.detectedType).toBeNull();
  });

  it('rejects a PNG that claims to be a JPEG', async () => {
    const result = await validateImageFile(makeFile(makePngHeader(10, 10), 'a.jpg', 'image/jpeg'));
    expect(result.isValid).toBe(false);
    expect(result.detectedType).toBe('image/png');
  });

  it('passes a valid image with an unparseable header through with no dimensions', async () => {
    // シグネチャは正しいが IHDR が壊れている
    const bytes = makePngHeader(100, 100);
    bytes[12] = 0x00;
    const result = await validateImageFile(makeFile(bytes, 'a.png', 'image/png'));
    expect(result.isValid).toBe(true);
    expect(result.width).toBeUndefined();
    expect(result.height).toBeUndefined();
  });
});
