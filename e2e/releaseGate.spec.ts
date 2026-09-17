import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

/**
 * リリースゲート。
 *
 * ここにあるのは「本番ビルドを実ブラウザで動かさないと分からないこと」だけ。
 * 表示・操作の回帰は imageProcessing.spec.ts、配線は src/integration/ が見る。
 *
 * 必ず本番ビルド（vite preview）に対して走らせる:
 *   npm run build && npm run test:e2e:gate
 * dev サーバーには Service Worker も precache manifest も存在しないため、
 * このファイルを dev 相手に走らせても守りたいものを一切守れない。
 *
 * 背景除去モデル（約 44MB / Hugging Face）はここでは取得しない。
 * CI に外部ネットワーク依存と数十秒の待ちを持ち込まないため。
 * モデル取得・復旧の検証は Eval A の範囲。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../test-images/test_image.png');

/** 既定プリセット instagram-square の出力寸法 */
const EXPECTED_WIDTH = 1080;
const EXPECTED_HEIGHT = 1080;

/**
 * 出力 1 枚あたりの最小バイト数。
 * 現行フィクスチャでの実測は約 7.7KB なので、通常の出力には十分な余裕がある。
 */
const MIN_IMAGE_BYTES = 1024;

/**
 * JPEG のヘッダから寸法を読む。
 * SOF0/1/2/3/5/6/7/9/10/11/13/14/15 セグメントの先頭に高さ・幅が入っている。
 * 画像ライブラリを増やさずに「本当に復号できる JPEG か」を判定するために使う。
 */
const readJpegSize = (buffer: Buffer): { width: number; height: number } => {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('JPEG の SOI マーカー(FFD8)がありません');
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      throw new Error(`マーカー境界が壊れています (offset=${offset})`);
    }
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);

    // SOF セグメント（DHT=C4 / JPG=C8 / DAC=CC は除く）
    const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSOF) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  throw new Error('SOF セグメントが見つかりませんでした');
};

/**
 * ZIP から取り出した 1 エントリが「配って良い成果物か」を判定する。
 *
 * ここが jsdom 側と決定的に違う点。src/test/setup.ts は toBlob を
 * Blob(['mock-image']) に差し替えているため、vitest ではこの判定ができない。
 */
const assertDeliverableImage = (name: string, buffer: Buffer): void => {
  // 下限 1KB が捕まえるのは、切り詰められた blob・空の blob・
  // 画素が書かれずヘッダだけになった出力。
  // 逆に、単色 1080x1080 の JPEG は数 KB になるため「真っ白な出力」は通過する。
  // それを見分けるには画素を読むしかないが、JPEG エンコーダはブラウザ・OS で
  // 異なるため、画素値やバイト数の上限に依存させると本物の不具合でないのに
  // デプロイが止まる。ここでは寸法を厳格に見ることと引き換えに、その判定は持たない。
  expect(buffer.byteLength, `${name} の中身が小さすぎる`).toBeGreaterThanOrEqual(MIN_IMAGE_BYTES);

  // 寸法は厳格に見る。プリセット指定どおりでなければ成果物として配れない。
  const { width, height } = readJpegSize(buffer);
  expect({ name, width, height }).toEqual({
    name,
    width: EXPECTED_WIDTH,
    height: EXPECTED_HEIGHT,
  });
};

/** SW が活性化し、precache の書き込みが終わるまで待つ */
const waitForServiceWorker = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => 'serviceWorker' in navigator, undefined, { timeout: 30_000 });
  await page.evaluate(async () => {
    // registerType: 'autoUpdate' なので skipWaiting/clientsClaim 済み。
    // ready は active な worker が出るまで待つ = install(=precache 書き込み)完了後。
    await navigator.serviceWorker.ready;
  });
};

/** 同じ名前の画像を 2 枚投入する（ZIP 内での名前衝突を実際に起こす） */
const uploadSameNameTwice = async (page: Page): Promise<void> => {
  const buffer = await readFile(FIXTURE);
  await page.setInputFiles('[data-testid="fileInput"]', [
    { name: 'same.png', mimeType: 'image/png', buffer },
    { name: 'same.png', mimeType: 'image/png', buffer },
  ]);
  await expect(page.getByTestId('selectedCount')).toContainText('2');
};

test.describe('リリースゲート（本番ビルド）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('G1: ZIP の中身が実際に配れる画像になっている', async ({ page }) => {
    await uploadSameNameTwice(page);

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByTestId('startBtn').click();

    // 2 枚とも完了してから自動保存が走る
    await expect(page.getByTestId('processedCount')).toContainText('2', { timeout: 60_000 });

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^snapresize-ai_\d{4}-\d{2}-\d{2}\.zip$/);

    const zipPath = await download.path();
    const zip = await JSZip.loadAsync(await readFile(zipPath));

    const entries = Object.values(zip.files).filter((file) => !file.dir);
    expect(entries).toHaveLength(2);

    // 同名入力でもエントリ名が衝突していない（#63 の再発防止）
    const names = entries.map((entry) => entry.name).sort();
    expect(new Set(names).size).toBe(2);
    expect(names).toEqual([
      'snapresize-ai/same_instagram-square (2).jpg',
      'snapresize-ai/same_instagram-square.jpg',
    ]);

    // 名前だけでなく中身を見る
    for (const entry of entries) {
      const buffer = Buffer.from(await entry.async('nodebuffer'));
      assertDeliverableImage(entry.name, buffer);
    }
  });

  test('G2: オフライン背景除去に必要な資産が実際にキャッシュへ載っている', async ({ page }) => {
    await waitForServiceWorker(page);

    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          urls.push(new URL(request.url).pathname);
        }
      }
      return urls;
    });

    expect(cachedUrls.length).toBeGreaterThan(0);

    // scripts/check-pwa-precache.mjs は sw.js の静的検査。
    // 「実際にキャッシュへ載ったか」はここでしか分からない（#65 の再発防止）。
    const required: Array<[string, RegExp]> = [
      ['ONNX Runtime wasm', /\.wasm$/],
      ['ONNX Runtime mjs ローダ', /ort-wasm.*\.mjs$/],
      ['背景除去 worker JS', /worker.*\.js$/i],
      ['アプリ本体 HTML', /index\.html$|\/$/],
    ];

    for (const [label, pattern] of required) {
      expect(
        cachedUrls.some((url) => pattern.test(url)),
        `${label} がキャッシュにない。cached=${JSON.stringify(cachedUrls, null, 2)}`
      ).toBe(true);
    }
  });

  test('G3: オフライン再起動後もリサイズが最後まで通る', async ({ page, context }) => {
    await waitForServiceWorker(page);

    await context.setOffline(true);
    try {
      await page.reload();

      // まずアプリが起動すること
      await expect(page.locator('h1')).toContainText('SnapResize AI');
      await expect(page.getByTestId('dropZone')).toBeVisible();

      // そのうえで処理が完走し、成果物が出ること
      await uploadSameNameTwice(page);

      const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
      await page.getByTestId('startBtn').click();
      await expect(page.getByTestId('processedCount')).toContainText('2', { timeout: 60_000 });

      const download = await downloadPromise;
      const zip = await JSZip.loadAsync(await readFile(await download.path()));
      const entries = Object.values(zip.files).filter((file) => !file.dir);
      expect(entries).toHaveLength(2);

      for (const entry of entries) {
        assertDeliverableImage(entry.name, Buffer.from(await entry.async('nodebuffer')));
      }
    } finally {
      await context.setOffline(false);
    }
  });
});
