import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      all: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*'],
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});
