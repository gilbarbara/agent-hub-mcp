import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      all: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*'],
      exclude: ['src/index.ts', 'src/index-http.ts', 'src/servers/**/*'],
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['test/e2e/**'],
  },
});
