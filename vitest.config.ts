import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/build/',
        '**/*.test.{ts,tsx}',
        'src/integration/',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    // src/integration/ は vitest.integration.config.ts が担当する（二重実行を避ける）
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build', 'src/integration/**'],
  },
});
