import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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

HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback(new Blob(['mock-image'], { type: 'image/jpeg' }));
});

// Mock FileReader
(globalThis as typeof globalThis & { FileReader: typeof FileReader }).FileReader =
  class MockFileReader {
    readAsDataURL = vi.fn();
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
    result: string | ArrayBuffer | null = '';
  } as unknown as typeof FileReader;

// Mock crypto.randomUUID
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {};
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis.crypto as any).randomUUID = vi.fn(() => 'mock-uuid-1234-5678-9012-345678901234');
