import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * 統合テスト用の設定。
 *
 * unit（vitest.config.ts）との違いは対象範囲とカバレッジ閾値だけで、
 * 環境は同じ jsdom を使う。したがって守れるのは「本番 store・フック・
 * 出力命名・実 JSZip の配線」までで、canvas が出す画素と Service Worker は
 * ここでは検証できない。そちらは e2e/releaseGate.spec.ts が見る。
 *
 * 実行: npm run test:integration
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setupBase.ts'],
    include: ['src/integration/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],
    // 統合テストは経路を通すことが目的で、網羅率は unit 側の責任。
    coverage: {
      enabled: false,
    },
  },
});
