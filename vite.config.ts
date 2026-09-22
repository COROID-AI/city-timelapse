import { defineConfig } from 'vitest/config';

/**
 * Vite configuration for the Timelapse City single-page app.
 *
 * The test environment is jsdom so scaffold smoke tests can exercise both the
 * pure Three.js scene graph and the overlay DOM root without a GPU. The app
 * itself runs entirely in the browser: purely client-side, procedural assets
 * only, and no backend services.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
