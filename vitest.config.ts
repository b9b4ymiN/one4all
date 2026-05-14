import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.real.test.ts',
      'apps/*/tests/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
    ],
    testTimeout: 60000, // 60 second timeout for real API tests
    setupFiles: [],
    env: {
      // Enable real API testing flags (default to false for safety)
      TEST_REAL_API: 'false',
      TEST_CLAUDE_REAL: 'false',
      TEST_ZAI_REAL: 'false',
      TEST_GEMINI_REAL: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.real.test.ts', // Exclude real API tests from coverage
      ],
    },
  },
  resolve: {
    alias: {
      '@one4all/shared': '/home/dasimoa/one4all/packages/shared/src',
      '@one4all/kernel': '/home/dasimoa/one4all/packages/kernel/src',
      '@one4all/observability': '/home/dasimoa/one4all/packages/observability/src',
      '@one4all/adapters': '/home/dasimoa/one4all/packages/adapters/src',
      '@one4all/cli': '/home/dasimoa/one4all/packages/cli/src',
      '@one4all/a2a': '/home/dasimoa/one4all/packages/a2a/src',
    },
  },
});
