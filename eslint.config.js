import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Build output and generated artifacts
  {
    ignores: ['dist', 'dev-dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'],
  },

  // Application & worker source
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // New in eslint-plugin-react-hooks v7's recommended set. It flags the
      // existing derived-step useEffect in App.tsx. Disabled here to keep this
      // dependency migration behavior-neutral; revisit the pattern separately.
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Node-based tooling/config files
  {
    files: ['**/*.config.{ts,js}', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Test files (Vitest + Playwright e2e)
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.node,
      },
    },
    rules: {
      // Mocks and fixtures legitimately rely on `any` and scratch variables.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
