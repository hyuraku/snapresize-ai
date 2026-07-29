/**
 * PWA アイコン（PNG）を SVG から生成する
 *
 * 実行:  node scripts/generate-icons.mjs
 *
 * 変換には devDependencies に既にある Playwright の Chromium を使う。
 * このためだけに sharp や pwa-asset-generator を足すことはしない。
 *
 * public/favicon.svg を編集したら、public/favicon-maskable.svg も
 * 合わせて直してからこのスクリプトを再実行すること。
 */
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

/** [出力ファイル名, ソース SVG, 一辺の px] */
const TARGETS = [
  ['icon-192x192.png', 'public/favicon.svg', 192],
  ['icon-512x512.png', 'public/favicon.svg', 512],
  ['icon-512x512-maskable.png', 'public/favicon-maskable.svg', 512],
];

const browser = await chromium.launch();

try {
  await mkdir(outDir, { recursive: true });

  for (const [name, source, size] of TARGETS) {
    const svg = await readFile(resolve(root, source), 'utf8');

    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    // 背景は SVG 自身が持つため、body 側は透明のままにする。
    // maskable でないアイコンは角丸の外側が透過で残る。
    await page.setContent(
      `<!doctype html><style>
         html,body { margin:0; padding:0; background:transparent; }
         svg { display:block; width:${size}px; height:${size}px; }
       </style>${svg}`
    );

    const buffer = await page.locator('svg').screenshot({ omitBackground: true });
    await writeFile(resolve(outDir, name), buffer);
    await page.close();

    console.log(`${name} (${size}x${size}) <- ${source}`);
  }
} finally {
  await browser.close();
}
