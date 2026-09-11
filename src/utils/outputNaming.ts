import type { ProcessedImage } from '../types';

/**
 * ファイル名を「拡張子を除いた部分」と「拡張子（ドット込み）」に分割する。
 * 拡張子がない場合（ドットが無い、またはドットが先頭のみ）は ext を空文字にする。
 */
const splitNameExtension = (name: string): { base: string; ext: string } => {
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0) {
    return { base: name.slice(0, lastDot), ext: name.slice(lastDot) };
  }
  return { base: name, ext: '' };
};

/**
 * 出力ファイル名を生成する。
 * 入力名に拡張子が無い場合でも、必ずプリセット接尾辞と拡張子を付与する。
 * 非ASCII文字（日本語など）はそのまま保持する。
 */
export const buildOutputName = (inputName: string, presetKey: string, extension: string): string => {
  const { base } = splitNameExtension(inputName);
  return `${base}_${presetKey}.${extension}`;
};

/**
 * 名前の配列を、入力順を保ったまま重複しない名前の配列に変換する。
 * 衝突した名前には `name (2).ext`, `name (3).ext` のように連番を付与する。
 * 連番付与後の名前が既存の別名と再衝突する場合は、空いている番号まで進める。
 * 大文字小文字は区別する（`a.jpg` と `A.jpg` は別名として扱う）。
 */
export const uniquifyNames = (names: string[]): string[] => {
  const used = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    if (!used.has(name)) {
      used.add(name);
      result.push(name);
      continue;
    }

    const { base, ext } = splitNameExtension(name);
    let counter = 2;
    let candidate = `${base} (${counter})${ext}`;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `${base} (${counter})${ext}`;
    }

    used.add(candidate);
    result.push(candidate);
  }

  return result;
};

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/**
 * 処理済み画像の配列から、ZIP に格納する一意な名前付きエントリの配列を組み立てる。
 * 入力順は保持され、同名の出力があってもすべてのエントリが ZIP に残る。
 */
export const buildZipEntries = (processed: Pick<ProcessedImage, 'name' | 'blob'>[]): ZipEntry[] => {
  const uniqueNames = uniquifyNames(processed.map((item) => item.name));
  return processed.map((item, index) => ({
    name: uniqueNames[index] ?? item.name,
    blob: item.blob,
  }));
};
