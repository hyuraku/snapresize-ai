import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import JSZip from 'jszip';
import { buildOutputName, uniquifyNames, buildZipEntries } from './outputNaming';
import type { ProcessedImage } from '../types';

// ダウンロード経路のテストでは実際のファイル保存は発生させない
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// jsdom 環境の FileReader は src/test/setup.ts でサムネイル生成用に
// readAsDataURL のみのモックへ差し替えられている。JSZip は Blob を扱う際に
// readAsArrayBuffer を要求するため、このテストファイル内でのみ
// Blob.arrayBuffer() ベースの実装に差し替える（他ファイルには影響しない）。
class ArrayBufferFileReader {
  onload: ((ev: { target: { result: ArrayBuffer | null } }) => void) | null = null;
  onerror: ((ev: { target: { error: unknown } }) => void) | null = null;
  result: ArrayBuffer | null = null;

  readAsArrayBuffer(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onload?.({ target: { result: buffer } });
      })
      .catch((error: unknown) => {
        this.onerror?.({ target: { error } });
      });
  }
}

let originalFileReader: typeof FileReader;

beforeAll(() => {
  originalFileReader = globalThis.FileReader;
  globalThis.FileReader = ArrayBufferFileReader as unknown as typeof FileReader;
});

afterAll(() => {
  globalThis.FileReader = originalFileReader;
});

describe('buildOutputName', () => {
  it('通常の拡張子ありの入力に接尾辞と拡張子を付与する', () => {
    expect(buildOutputName('photo.jpg', 'instagram-square', 'jpg')).toBe(
      'photo_instagram-square.jpg'
    );
  });

  it('拡張子なしの入力にも接尾辞と拡張子を付与する', () => {
    expect(buildOutputName('photo', 'instagram-square', 'jpg')).toBe(
      'photo_instagram-square.jpg'
    );
  });

  it('日本語などの非ASCII文字を保持する', () => {
    expect(buildOutputName('写真.png', 'twitter-square', 'png')).toBe(
      '写真_twitter-square.png'
    );
  });

  it('背景除去時など出力拡張子が入力と異なる場合も入力の拡張子を除去する', () => {
    expect(buildOutputName('a.png', 'instagram-square', 'jpg')).toBe(
      'a_instagram-square.jpg'
    );
  });
});

describe('uniquifyNames', () => {
  it('衝突がない場合は名前を変えない', () => {
    const input = ['a.jpg', 'b.jpg', 'c.png'];
    expect(uniquifyNames(input)).toEqual(['a.jpg', 'b.jpg', 'c.png']);
  });

  it('同名2枚は2枚目に (2) を付ける', () => {
    const input = ['same.png', 'same.png'];
    expect(uniquifyNames(input)).toEqual(['same.png', 'same (2).png']);
  });

  it('同名3枚以上は連番で一意化する', () => {
    const input = ['same.png', 'same.png', 'same.png'];
    expect(uniquifyNames(input)).toEqual(['same.png', 'same (2).png', 'same (3).png']);
  });

  it('ベース名が同じでも拡張子が異なれば衝突しない', () => {
    const input = ['a.png', 'a.jpg'];
    expect(uniquifyNames(input)).toEqual(['a.png', 'a.jpg']);
  });

  it('拡張子なしの名前が衝突しても一意化する', () => {
    const input = ['a', 'a'];
    expect(uniquifyNames(input)).toEqual(['a', 'a (2)']);
  });

  it('日本語名の衝突も一意化する', () => {
    const input = ['写真.png', '写真.png'];
    expect(uniquifyNames(input)).toEqual(['写真.png', '写真 (2).png']);
  });

  it('既に (2) を含む名前と再衝突する場合は空いている番号まで進める', () => {
    const input = ['a.jpg', 'a (2).jpg', 'a.jpg'];
    expect(uniquifyNames(input)).toEqual(['a.jpg', 'a (2).jpg', 'a (3).jpg']);
  });

  it('大文字小文字の違いは別名として扱う', () => {
    const input = ['A.jpg', 'a.jpg'];
    expect(uniquifyNames(input)).toEqual(['A.jpg', 'a.jpg']);
  });
});

describe('buildZipEntries', () => {
  const makeProcessed = (name: string, content: string): Pick<ProcessedImage, 'name' | 'blob'> => ({
    name,
    blob: new Blob([content], { type: 'text/plain' }),
  });

  it('同名の入力が複数あっても衝突しないエントリ名を返す', () => {
    const processed = [makeProcessed('same.png', 'one'), makeProcessed('same.png', 'two')];
    const entries = buildZipEntries(processed);

    expect(entries.map((e) => e.name)).toEqual(['same.png', 'same (2).png']);
    expect(entries[0]?.blob).toBe(processed[0]?.blob);
    expect(entries[1]?.blob).toBe(processed[1]?.blob);
  });
});

describe('ZIP 生成（実際の JSZip を使用）', () => {
  it('同名の ProcessedImage を複数含めても、すべてのエントリが ZIP に残り内容が対応する', async () => {
    const processed = [
      { name: 'same.png', blob: new Blob(['content-A'], { type: 'image/png' }) },
      { name: 'same.png', blob: new Blob(['content-B'], { type: 'image/png' }) },
      { name: 'same.png', blob: new Blob(['content-C'], { type: 'image/png' }) },
    ];

    const entries = buildZipEntries(processed);

    const zip = new JSZip();
    const folder = zip.folder('snapresize-ai');
    if (!folder) throw new Error('Failed to create ZIP folder');

    for (const entry of entries) {
      folder.file(entry.name, entry.blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const readBack = await JSZip.loadAsync(content);

    const files = Object.keys(readBack.files).filter((path) => !readBack.files[path]?.dir);
    expect(files.sort()).toEqual(
      ['snapresize-ai/same.png', 'snapresize-ai/same (2).png', 'snapresize-ai/same (3).png'].sort()
    );

    const expectedContents = ['content-A', 'content-B', 'content-C'];
    for (let i = 0; i < entries.length; i++) {
      const entryName = entries[i]?.name;
      const zipFile = readBack.file(`snapresize-ai/${entryName}`);
      expect(zipFile).not.toBeNull();
      const text = await zipFile?.async('text');
      expect(text).toBe(expectedContents[i]);
    }
  });
});
