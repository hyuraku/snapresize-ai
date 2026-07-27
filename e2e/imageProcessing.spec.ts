import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = path.resolve(__dirname, '../test-images/test_image.png');

// UI は data-testid で参照する。
// 表示文言でしか特定できない要素だけ getByText を使い、
// その場合も playwright.config.ts の locale: 'ja-JP' に依存する点に注意。

test.describe('SnapResize AI - Image Processing E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the application title and header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('SnapResize AI');
    await expect(
      page.getByText('画像リサイズ・背景除去・透かし追加をブラウザだけで')
    ).toBeVisible();
  });

  test('should display key features badges', async ({ page }) => {
    await expect(page.getByText('完全無料')).toBeVisible();
    await expect(page.getByText('データ送信なし')).toBeVisible();
  });

  test('should display initial upload message', async ({ page }) => {
    await expect(page.getByTestId('statusMessage')).toContainText('画像をアップロードしてください');
  });

  test('should have start button disabled initially', async ({ page }) => {
    await expect(page.getByTestId('startBtn')).toBeDisabled();
  });

  test('should display file upload zone', async ({ page }) => {
    await expect(page.getByTestId('dropZone')).toBeVisible();
    await expect(page.getByText('画像をドラッグ＆ドロップ')).toBeVisible();
    await expect(page.getByText('JPG / PNG / WebP')).toBeVisible();
  });

  test('should upload image files', async ({ page }) => {
    await page.getByTestId('fileInput').setInputFiles(TEST_IMAGE);

    await expect(page.getByTestId('statusMessage')).not.toContainText(
      '画像をアップロードしてください'
    );
    await expect(page.getByTestId('selectedCount')).toContainText('1');
  });

  test('should enable start button after file upload', async ({ page }) => {
    await page.getByTestId('fileInput').setInputFiles(TEST_IMAGE);

    await expect(page.getByTestId('startBtn')).toBeEnabled();
  });

  test('should display settings panel', async ({ page }) => {
    await expect(page.getByText('出力設定')).toBeVisible();
    await expect(page.getByTestId('settingsToggle')).toBeVisible();
  });

  test('should toggle settings panel', async ({ page }) => {
    const settingsToggle = page.getByTestId('settingsToggle');
    const settingsPanel = page.getByTestId('settingsPanel');

    // 初期状態では開いている
    await expect(settingsPanel).toBeVisible();

    // 閉じる（パネルは条件付きレンダリングなので DOM から消える）
    await settingsToggle.click();
    await expect(settingsPanel).toHaveCount(0);

    // 再度開く
    await settingsToggle.click();
    await expect(settingsPanel).toBeVisible();
  });

  test('should display SNS preset options', async ({ page }) => {
    await expect(page.getByTestId('preset-instagram-square')).toBeVisible();
    await expect(page.getByTestId('preset-instagram-story')).toBeVisible();
    await expect(page.getByTestId('preset-twitter-landscape')).toBeVisible();
    await expect(page.getByTestId('preset-custom')).toBeVisible();
  });

  test('should select different SNS presets', async ({ page }) => {
    // radio 本体は sr-only なので、ラベルをクリックして選択する
    await page.getByTestId('preset-instagram-story').click();
    await expect(page.locator('input[name="preset"][value="instagram-story"]')).toBeChecked();

    await page.getByTestId('preset-twitter-landscape').click();
    await expect(page.locator('input[name="preset"][value="twitter-landscape"]')).toBeChecked();
  });

  test('should show custom size inputs when custom preset selected', async ({ page }) => {
    // 初期状態では存在しない
    await expect(page.getByTestId('customSizeInputs')).toHaveCount(0);

    await page.getByTestId('preset-custom').click();

    await expect(page.getByTestId('customSizeInputs')).toBeVisible();
    await expect(page.getByTestId('customWidth')).toBeVisible();
    await expect(page.getByTestId('customHeight')).toBeVisible();
  });

  test('should adjust quality slider', async ({ page }) => {
    const qualitySlider = page.getByTestId('quality');
    const qualityValue = page.getByTestId('qualityValue');

    await expect(qualityValue).toHaveText('90');

    await qualitySlider.fill('75');
    await expect(qualityValue).toHaveText('75');
  });

  test('should toggle watermark options', async ({ page }) => {
    const watermarkToggle = page.getByTestId('watermarkToggle');

    // 初期状態では存在しない
    await expect(page.getByTestId('watermarkOptions')).toHaveCount(0);

    await watermarkToggle.click();
    await expect(page.getByTestId('watermarkOptions')).toBeVisible();

    await watermarkToggle.click();
    await expect(page.getByTestId('watermarkOptions')).toHaveCount(0);
  });

  test('should input watermark text', async ({ page }) => {
    await page.getByTestId('watermarkToggle').click();

    const watermarkText = page.getByTestId('watermarkText');
    await watermarkText.fill('My Watermark');

    await expect(watermarkText).toHaveValue('My Watermark');
  });

  test('should display step indicator', async ({ page }) => {
    await expect(page.getByText('かんたん3ステップ')).toBeVisible();
    await expect(page.getByTestId('step1')).toBeVisible();
    await expect(page.getByTestId('step2')).toBeVisible();
    await expect(page.getByTestId('step3')).toBeVisible();
  });

  test('should display processing queue', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '画像一覧' })).toBeVisible();
    await expect(page.getByTestId('queueList')).toBeVisible();
  });

  test('should display file counters', async ({ page }) => {
    await expect(page.getByTestId('selectedCount')).toContainText('0');
    await expect(page.getByTestId('processedCount')).toContainText('0');
  });

  test('should have clear button', async ({ page }) => {
    const clearBtn = page.getByTestId('clearBtn');
    await expect(clearBtn).toBeVisible();
    await expect(clearBtn).toContainText('すべてクリア');
  });

  test('should display privacy section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'プライバシー保護' })).toBeVisible();
    await expect(page.getByText('すべての処理はお使いのブラウザ内で完結')).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'GitHub' })).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('dropZone')).toBeVisible();
    await expect(page.getByTestId('settingsToggle')).toBeVisible();
  });

  test('should handle file drag and drop zone hover', async ({ page }) => {
    const dropZone = page.getByTestId('dropZone');

    await dropZone.hover();

    await expect(dropZone).toBeVisible();
  });

  test('should update settings summary', async ({ page }) => {
    const settingsSummary = page.getByTestId('settingsSummary');

    await expect(settingsSummary).toContainText('Instagram 正方形');

    await page.getByTestId('preset-twitter-landscape').click();

    await expect(settingsSummary).toContainText('X（Twitter）横長');
  });

  test('should clear files when clear button clicked', async ({ page }) => {
    await page.getByTestId('fileInput').setInputFiles(TEST_IMAGE);
    await expect(page.getByTestId('selectedCount')).toContainText('1');

    await page.getByTestId('clearBtn').click();

    await expect(page.getByTestId('statusMessage')).toContainText('画像をアップロードしてください');
    await expect(page.getByTestId('selectedCount')).toContainText('0');
  });

  test('should show model download notice when background removal is enabled', async ({ page }) => {
    // 背景除去が無効なうちはモデルを読み込まない
    await expect(page.getByText('モデルをダウンロードします')).toHaveCount(0);

    await page.getByTestId('bgRemovalToggle').click();

    // dtype に応じたサイズが表示される（fp32:176MB / fp16:88MB / q8:44MB）
    await expect(page.getByText(/初回は(44|88|176)MBのモデルをダウンロードします/)).toBeVisible();
    await expect(page.getByTestId('settingsSummary')).toContainText('背景除去');
  });
});

test.describe('Accessibility Tests', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
  });

  test('should have accessible form controls', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.getByTestId('fileInput');
    await expect(fileInput).toHaveAttribute('type', 'file');
    await expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
  });

  test('should have proper button labels', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('startBtn')).toContainText('処理を開始');
    await expect(page.getByTestId('clearBtn')).toContainText('すべてクリア');
  });
});

test.describe('Performance Tests', () => {
  test('should load page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');

    expect(errors).toHaveLength(0);
  });
});
