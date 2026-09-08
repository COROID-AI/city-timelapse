import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the browser QA harness.
 *
 * Serves the composed CityScene entrypoint (`src/main.tsx`) so Playwright can
 * drive the real top timeline slider across all five eras and screenshot the
 * transforming scene. Not used by the `build`/`test`/`typecheck` gates (those
 * remain tsc + jest + vitest); only by `npm run dev:qa` + Playwright.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist-web',
  },
});