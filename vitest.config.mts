import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      all: true,
      reporter: ['text', 'html', 'lcov'],
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
