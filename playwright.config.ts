import { defineConfig, devices } from '@playwright/test';

// E2E は 2 つの対象を持つ。
//   既定            : dev サーバー（npm run dev）。表示・操作の回帰試験。
//   E2E_TARGET=preview : 本番ビルド（vite preview）。リリースゲート用。
//
// SW・precache・実 canvas 出力は dist にしか存在しないため、
// e2e/releaseGate.spec.ts は必ず preview 側で走らせる。
const isPreview = process.env.E2E_TARGET === 'preview';

// 4173 は vite preview の既定だが、開発機では別プロジェクトに使われていることがある。
// その場合は E2E_PREVIEW_PORT で逃がす。
const previewPort = Number(process.env.E2E_PREVIEW_PORT ?? 4173);
const devPort = 3000;
const port = isPreview ? previewPort : devPort;

// Pages 用ビルド（VITE_BASE_URL=/snapresize-ai/）を試験するときは
// preview も同じサブパスで配信されるため、baseURL 側も合わせる。
const basePath = process.env.E2E_BASE_PATH ?? '/';
const host = isPreview ? '127.0.0.1' : 'localhost';
const baseURL = `http://${host}:${port}${basePath.replace(/\/$/, '')}/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // UI は detectLanguage() でブラウザ言語から日本語/英語を切り替える。
    // 既定のロケール(en-US)のままだと英語UIになり、日本語を期待するアサーションが落ちる。
    locale: 'ja-JP',
  },

  projects: [
    // リリースゲート。本番ビルドに対してのみ意味を持つので、
    // 所要時間を抑えるため chromium 1 本に絞る。
    {
      name: 'release-gate',
      testMatch: /releaseGate\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 既存の表示・操作スイート。ゲートは含めない。
    {
      name: 'chromium',
      testIgnore: /releaseGate\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: /releaseGate\.spec\.ts$/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: /releaseGate\.spec\.ts$/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      testIgnore: /releaseGate\.spec\.ts$/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      testIgnore: /releaseGate\.spec\.ts$/,
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: isPreview
      ? // --no-open: vite.config.ts の preview.open が true のため CI で明示的に打ち消す
        `npx vite preview --port ${port} --strictPort --host 127.0.0.1 --no-open`
      : 'npm run dev',
    url: baseURL,
    // vite preview は vite.config.ts を読み直すため、base は
    // ビルド時と同じ VITE_BASE_URL からしか決まらない。
    // これを渡さないと dist は /snapresize-ai/ 前提の HTML なのに
    // 配信は / になり、SPA fallback で 200 は返るがアセットが全て 404 になる。
    env: { VITE_BASE_URL: basePath },
    // preview は「今ある dist」を配る。CI では直前の build 成果物をそのまま試験する。
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
