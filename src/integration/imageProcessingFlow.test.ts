import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import JSZip from 'jszip';
import { useImageStore } from '../store/imageStore';
import { useDownload } from '../hooks/useDownload';
import { buildOutputName } from '../utils/outputNaming';
import { SNS_PRESETS } from '../constants/presets';
import type { ProcessedImage } from '../types';

/**
 * 保存経路の統合テスト。
 *
 * 本番の store（useImageStore）と本番の useDownload、実物の JSZip を通す。
 * 以前はこのファイル内で ImageProcessingService というモックを定義して
 * それ自身を試験していたため、本番コードの不具合を一切検出できなかった。
 *
 * 守れる範囲:
 *   - 出力名の生成と ZIP 内での一意化（同名入力で成果物が落ちないこと）
 *   - 1 枚なら単体保存、複数枚なら ZIP という分岐
 *   - バッチ境界（クリア・2 バッチ目）で自動保存の状態が正しく張り直されること
 *
 * 守れない範囲（jsdom の限界。e2e/releaseGate.spec.ts が担当）:
 *   - ZIP に入った画像が実際に復号できるか・指定寸法か
 *     src/test/setup.ts が toBlob を Blob(['mock-image']) に差し替えているため、
 *     ここで ZIP から取り出せるのは 10 バイトの文字列でしかない。
 *   - Service Worker / precache / オフライン起動
 */

// file-saver はブラウザのダウンロード機構を叩くので、ここだけ差し替えて
// 「何という名前で、どんな Blob が保存されたか」を捕まえる。
const saveAsMock = vi.fn();
vi.mock('file-saver', () => ({
  saveAs: (blob: Blob, name: string) => saveAsMock(blob, name),
}));

const preset = SNS_PRESETS['instagram-square'];

/** 処理済み画像を 1 件作る。blob の中身は jsdom では意味を持たない */
const makeProcessed = (inputName: string, index: number): ProcessedImage => ({
  id: `processed-${index}`,
  originalId: `file-${index}`,
  name: buildOutputName(inputName, preset.key, 'jpg'),
  blob: new Blob([`image-bytes-${index}`], { type: 'image/jpeg' }),
  preset,
  hasWatermark: false,
  hasBackgroundRemoval: false,
  quality: 90,
});

/** saveAs が受け取った ZIP を読み戻し、ディレクトリを除いたエントリ名を返す */
const readSavedZipEntryNames = async (): Promise<string[]> => {
  expect(saveAsMock).toHaveBeenCalledTimes(1);
  const [blob] = saveAsMock.mock.calls[0]!;
  const zip = await JSZip.loadAsync(await (blob as Blob).arrayBuffer());
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .sort();
};

describe('保存フロー（本番 store + useDownload + 実 JSZip）', () => {
  beforeEach(() => {
    saveAsMock.mockClear();
    act(() => {
      useImageStore.getState().clearFiles();
    });
  });

  it('同名入力が 2 枚あっても ZIP に 2 枚とも残る', async () => {
    const { result } = renderHook(() => useDownload());

    act(() => {
      useImageStore.getState().addProcessedImage(makeProcessed('same.png', 1));
      useImageStore.getState().addProcessedImage(makeProcessed('same.png', 2));
    });

    await act(async () => {
      await result.current.downloadAll();
    });

    expect(await readSavedZipEntryNames()).toEqual([
      'snapresize-ai/same_instagram-square (2).jpg',
      'snapresize-ai/same_instagram-square.jpg',
    ]);
  });

  it('拡張子なし・日本語名でも成果物が落ちない', async () => {
    const { result } = renderHook(() => useDownload());

    act(() => {
      useImageStore.getState().addProcessedImage(makeProcessed('拡張子なし', 1));
      useImageStore.getState().addProcessedImage(makeProcessed('拡張子なし', 2));
      useImageStore.getState().addProcessedImage(makeProcessed('写真.jpeg', 3));
    });

    await act(async () => {
      await result.current.downloadAll();
    });

    const names = await readSavedZipEntryNames();
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
    expect(names).toContain('snapresize-ai/写真_instagram-square.jpg');
  });

  it('1 枚だけなら ZIP にせず単体ファイルとして保存する', async () => {
    const { result } = renderHook(() => useDownload());

    act(() => {
      useImageStore.getState().addProcessedImage(makeProcessed('solo.png', 1));
    });

    await act(async () => {
      await result.current.downloadAll();
    });

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const [, name] = saveAsMock.mock.calls[0]!;
    expect(name).toBe('solo_instagram-square.jpg');
  });

  it('処理済みが 0 件なら保存しない', async () => {
    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.downloadAll();
    });

    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it('クリアすると過去の成果物が次の保存に混ざらない', async () => {
    const { result } = renderHook(() => useDownload());

    act(() => {
      useImageStore.getState().addProcessedImage(makeProcessed('old.png', 1));
      useImageStore.getState().addProcessedImage(makeProcessed('old.png', 2));
      useImageStore.getState().clearFiles();
      useImageStore.getState().addProcessedImage(makeProcessed('new.png', 3));
      useImageStore.getState().addProcessedImage(makeProcessed('new.png', 4));
    });

    await act(async () => {
      await result.current.downloadAll();
    });

    const names = await readSavedZipEntryNames();
    expect(names.every((name) => name.includes('new_'))).toBe(true);
    expect(names).toHaveLength(2);
  });

  it('自動保存の記録はバッチ単位で、クリア後の 2 バッチ目で張り直される', () => {
    const store = useImageStore.getState();

    let firstBatch = '';
    act(() => {
      firstBatch = store.startBatch();
      useImageStore.getState().markBatchDownloaded(firstBatch);
    });
    expect(useImageStore.getState().downloadedBatchId).toBe(firstBatch);

    // クリアでバッチも自動保存の記録も外れる
    act(() => {
      useImageStore.getState().clearFiles();
    });
    expect(useImageStore.getState().currentBatchId).toBeNull();
    expect(useImageStore.getState().downloadedBatchId).toBeNull();

    // 2 バッチ目は別 ID になり、まだ保存済みではない（= 自動保存が再武装する）
    let secondBatch = '';
    act(() => {
      secondBatch = useImageStore.getState().startBatch();
    });
    expect(secondBatch).not.toBe(firstBatch);
    expect(useImageStore.getState().downloadedBatchId).not.toBe(secondBatch);
  });
});
