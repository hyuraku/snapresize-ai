import './setupBase';
import { vi } from 'vitest';

/**
 * unit テスト用の設定。共通設定に加えて FileReader を差し替える。
 * 統合テスト（vitest.integration.config.ts）は setupBase.ts だけを読み込み、
 * jsdom 本来の FileReader を使う。
 */

// Mock FileReader
(globalThis as typeof globalThis & { FileReader: typeof FileReader }).FileReader =
  class MockFileReader {
    readAsDataURL = vi.fn();
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
    result: string | ArrayBuffer | null = '';
  } as unknown as typeof FileReader;
