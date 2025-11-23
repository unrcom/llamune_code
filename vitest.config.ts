import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000, // API calls may take time
    hookTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
  },
});
