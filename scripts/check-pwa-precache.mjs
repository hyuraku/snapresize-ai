/**
 * PWA ビルド成果物の precache 資産を検査する
 *
 * 実行:  node scripts/check-pwa-precache.mjs
 *
 * オフライン背景除去に必須の ONNX Runtime 資産（.wasm / .mjs）と worker JS が
 * 生成された Service Worker の precache manifest に含まれていること、
 * manifest.webmanifest が参照する icons の PNG が dist 内に実在することを検証する。
 * どちらか欠けていればビルドを失敗させる（exit code 1）。
 *
 * 背景: vite-plugin-pwa (workbox generateSW) の既定 globPatterns は .mjs を
 * 対象にしないため、ONNX Runtime の ort-wasm-simd-threaded.asyncify-*.mjs が
 * precache から漏れ、オフライン初回起動後の背景除去が失敗する不具合があった。
 * vite.config.ts の globPatterns 明示に依存せず、ビルドのたびに実際の出力を検証する。
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const swPath = resolve(distDir, 'sw.js');
const manifestPath = resolve(distDir, 'manifest.webmanifest');

let hasError = false;
const fail = (message) => {
  console.error(`[check-pwa-precache] NG: ${message}`);
  hasError = true;
};
const ok = (message) => {
  console.log(`[check-pwa-precache] OK: ${message}`);
};

if (!existsSync(swPath)) {
  console.error('[check-pwa-precache] dist/sw.js が見つかりません（先に vite build を実行してください）');
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error('[check-pwa-precache] dist/manifest.webmanifest が見つかりません');
  process.exit(1);
}

const swSource = await readFile(swPath, 'utf8');

// precacheAndRoute([...]) の配列部分だけを取り出す。
// 配列の要素は {} のみでネストした [] を含まないため、最初に現れる `]` が配列の終端になる。
const precacheMatch = swSource.match(/precacheAndRoute\((\[[\s\S]*?\])/);
if (!precacheMatch) {
  console.error('[check-pwa-precache] sw.js から precacheAndRoute の呼び出しを見つけられませんでした');
  process.exit(1);
}
const precacheUrls = [...precacheMatch[1].matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);

console.log(`[check-pwa-precache] precache entries: ${precacheUrls.length}`);

const requiredPatterns = [
  { name: 'ONNX Runtime wasm (.wasm)', pattern: /^assets\/.*\.wasm$/ },
  { name: 'ONNX Runtime mjs (ort-wasm*.mjs)', pattern: /^assets\/.*ort-wasm.*\.mjs$/ },
  { name: '背景除去 worker JS', pattern: /^assets\/.*worker.*\.js$/i }
];

for (const { name, pattern } of requiredPatterns) {
  const found = precacheUrls.find((url) => pattern.test(url));
  if (found) {
    ok(`${name} が precache に含まれています (${found})`);
  } else {
    fail(`${name} が precache manifest に見つかりません`);
  }
}

// manifest.webmanifest の icons が dist 内に実在する PNG を指しているか検証する。
// icons[].src は相対パス（例: "icons/icon-192x192.png"）を想定するが、
// base 付き絶対パス（例: "/snapresize-ai/icons/icon-192x192.png"）でも
// manifest 自身の scope/start_url から base を推定して解決できるようにする。
const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8'));
const base = (manifestJson.scope || manifestJson.start_url || '/').replace(/[^/]*$/, '');

for (const icon of manifestJson.icons ?? []) {
  let iconPath = icon.src;
  if (iconPath.startsWith('/')) {
    iconPath = base !== '/' && iconPath.startsWith(base)
      ? iconPath.slice(base.length)
      : iconPath.replace(/^\/+/, '');
  }
  const absolutePath = resolve(distDir, iconPath);
  if (existsSync(absolutePath)) {
    ok(`manifest icon が実在します: ${icon.src} -> dist/${iconPath}`);
  } else {
    fail(`manifest icon が dist 内に見つかりません: ${icon.src} (解決先: ${absolutePath})`);
  }
}

if (hasError) {
  console.error('[check-pwa-precache] 検査に失敗しました');
  process.exit(1);
}

console.log('[check-pwa-precache] すべての検査に合格しました');
