// eslint-disable-next-line unicorn/prevent-abbreviations
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/e2e/**/*.{test,spec}.{ts,tsx}'],
  },
});
