import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('SnapResize AI - Image Processing E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the application title and header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('SnapResize AI');
    await expect(page.getByText('画像リサイズ・背景除去・透かし追加をブラウザだけで')).toBeVisible();
  });

  test('should display key features badges', async ({ page }) => {
    await expect(page.getByText('✓ 完全無料')).toBeVisible();
    await expect(page.getByText('✓ 登録不要')).toBeVisible();
    await expect(page.getByText('✓ データ送信なし')).toBeVisible();
  });

  test('should display initial upload message', async ({ page }) => {
    await expect(page.locator('#statusMessage')).toContainText('画像をアップロードしてください');
  });

  test('should have start button disabled initially', async ({ page }) => {
    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toBeDisabled();
  });

  test('should display file upload zone', async ({ page }) => {
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.getByText('📸 画像をドラッグ＆ドロップ')).toBeVisible();
    await expect(page.getByText('JPG / PNG / WebP')).toBeVisible();
  });

  test('should upload image files', async ({ page }) => {
    // Create a test file path (you need to have actual test images)
    const fileInput = page.locator('#fileInput');

    // Mock file upload using setInputFiles
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-content'),
    });

    // Wait for file to be processed
    await page.waitForTimeout(500);

    // Check if status message updates
    const statusMessage = page.locator('#statusMessage');
    await expect(statusMessage).not.toContainText('画像をアップロードしてください');
  });

  test('should enable start button after file upload', async ({ page }) => {
    const fileInput = page.locator('#fileInput');

    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-content'),
    });

    await page.waitForTimeout(500);

    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toBeEnabled();
  });

  test('should display settings panel', async ({ page }) => {
    await expect(page.getByText('⚙️ 出力設定')).toBeVisible();
    await expect(page.locator('#settingsToggle')).toBeVisible();
  });

  test('should toggle settings panel', async ({ page }) => {
    const settingsToggle = page.locator('#settingsToggle');
    const settingsPanel = page.locator('#settingsPanel');

    // Panel should be visible initially
    await expect(settingsPanel).toBeVisible();

    // Click to collapse
    await settingsToggle.click();
    await expect(settingsPanel).toBeHidden();

    // Click to expand
    await settingsToggle.click();
    await expect(settingsPanel).toBeVisible();
  });

  test('should display SNS preset options', async ({ page }) => {
    await expect(page.getByText('Instagram 正方形')).toBeVisible();
    await expect(page.getByText('Instagram ストーリー')).toBeVisible();
    await expect(page.getByText('X（Twitter）横長')).toBeVisible();
    await expect(page.getByText('カスタムサイズ')).toBeVisible();
  });

  test('should select different SNS presets', async ({ page }) => {
    // Select Instagram Story
    await page.locator('input[value="instagram-story"]').click();
    await expect(page.locator('input[value="instagram-story"]')).toBeChecked();

    // Select Twitter
    await page.locator('input[value="twitter"]').click();
    await expect(page.locator('input[value="twitter"]')).toBeChecked();
  });

  test('should show custom size inputs when custom preset selected', async ({ page }) => {
    const customSizeInputs = page.locator('#customSizeInputs');

    // Initially hidden
    await expect(customSizeInputs).toBeHidden();

    // Select custom preset
    await page.locator('input[value="custom"]').click();

    // Should now be visible
    await expect(customSizeInputs).toBeVisible();
    await expect(page.locator('#customWidth')).toBeVisible();
    await expect(page.locator('#customHeight')).toBeVisible();
  });

  test('should adjust quality slider', async ({ page }) => {
    const qualitySlider = page.locator('#quality');
    const qualityValue = page.locator('#qualityValue');

    // Initial value should be 90
    await expect(qualityValue).toHaveText('90');

    // Change quality
    await qualitySlider.fill('75');
    await expect(qualityValue).toHaveText('75');
  });

  test('should toggle watermark options', async ({ page }) => {
    const watermarkToggle = page.locator('#watermarkToggle');
    const watermarkOptions = page.locator('#watermarkOptions');

    // Initially hidden
    await expect(watermarkOptions).toBeHidden();

    // Enable watermark
    await watermarkToggle.check();
    await expect(watermarkOptions).toBeVisible();

    // Disable watermark
    await watermarkToggle.uncheck();
    await expect(watermarkOptions).toBeHidden();
  });

  test('should input watermark text', async ({ page }) => {
    const watermarkToggle = page.locator('#watermarkToggle');
    const watermarkText = page.locator('#watermarkText');

    await watermarkToggle.check();
    await watermarkText.fill('My Watermark');

    await expect(watermarkText).toHaveValue('My Watermark');
  });

  test('should display step indicator', async ({ page }) => {
    await expect(page.getByText('📋 かんたん3ステップ')).toBeVisible();
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#step3')).toBeVisible();
  });

  test('should display processing queue', async ({ page }) => {
    await expect(page.getByText('処理キュー')).toBeVisible();
    await expect(page.locator('#queueList')).toBeVisible();
  });

  test('should display file counters', async ({ page }) => {
    await expect(page.locator('#selectedCount')).toContainText('0枚');
    await expect(page.locator('#processedCount')).toContainText('0枚');
  });

  test('should have clear button', async ({ page }) => {
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toContainText('すべてクリア');
  });

  test('should display privacy section', async ({ page }) => {
    await expect(page.getByText('🔒')).toBeVisible();
    await expect(page.getByText('プライバシー保護')).toBeVisible();
    await expect(page.getByText('すべての処理はお使いのブラウザ内で完結')).toBeVisible();
  });

  test('should display ad section', async ({ page }) => {
    await expect(page.getByText('PR')).toBeVisible();
    await expect(page.locator('#adHeadline')).toBeVisible();
    await expect(page.locator('#adCopy')).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await expect(page.getByText('© 2025 SnapResize AI')).toBeVisible();
    await expect(page.getByText('利用規約')).toBeVisible();
    await expect(page.getByText('プライバシーポリシー')).toBeVisible();
    await expect(page.getByText('お問い合わせ')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#settingsToggle')).toBeVisible();
  });

  test('should handle file drag and drop zone hover', async ({ page }) => {
    const dropZone = page.locator('#dropZone');

    // Simulate hover
    await dropZone.hover();

    // Check if drop zone is interactive
    await expect(dropZone).toBeVisible();
  });

  test('should update settings summary', async ({ page }) => {
    const settingsSummary = page.locator('#settingsSummary');

    // Initial summary
    await expect(settingsSummary).toContainText('Instagram 正方形');

    // Change preset
    await page.locator('input[value="twitter"]').click();

    // Summary should update
    await expect(settingsSummary).toContainText('X（Twitter）横長');
  });

  test('should clear files when clear button clicked', async ({ page }) => {
    // Upload a file
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-content'),
    });

    await page.waitForTimeout(500);

    // Click clear button
    await page.locator('#clearBtn').click();

    // Status should reset
    await expect(page.locator('#statusMessage')).toContainText('画像をアップロードしてください');
    await expect(page.locator('#selectedCount')).toContainText('0枚');
  });

  test('should display model loading section initially', async ({ page }) => {
    const modelLoadingSection = page.locator('#modelLoadingSection');
    await expect(modelLoadingSection).toBeVisible();
    await expect(page.locator('#modelStatus')).toContainText('AIモデルを準備中');
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

    const fileInput = page.locator('#fileInput');
    await expect(fileInput).toHaveAttribute('type', 'file');
    await expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
  });

  test('should have proper button labels', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#startBtn')).toContainText('処理を開始');
    await expect(page.locator('#clearBtn')).toContainText('すべてクリア');
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
