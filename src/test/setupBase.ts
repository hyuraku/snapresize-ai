import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * unit / integration で共通のテスト環境設定。
 *
 * FileReader のモックはここに含めない。JSZip は入力 Blob を
 * FileReader.readAsArrayBuffer で読むため、実 ZIP を組み立てる統合テストでは
 * jsdom 本来の FileReader が必要になる。
 * FileReader を差し替えたいテストは setup.ts（unit 側）を使う。
 */

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Web APIs that might not be available in jsdom
(globalThis as typeof globalThis & { URL: typeof URL }).URL.createObjectURL = vi.fn(
  () => 'mock-url'
);
(globalThis as typeof globalThis & { URL: typeof URL }).URL.revokeObjectURL = vi.fn();

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillStyle: '',
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  strokeText: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// 実際の画素は出ない。ZIP に入る中身を検証したい場合は
// e2e/releaseGate.spec.ts（本番ビルド + 実ブラウザ）を使う。
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback(new Blob(['mock-image'], { type: 'image/jpeg' }));
});

// Mock crypto.randomUUID
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {};
}
(globalThis.crypto as any).randomUUID = vi.fn(() => 'mock-uuid-1234-5678-9012-345678901234');
