import { defineConfig } from 'vite';

/**
 * Vite configuration for the City Time Period Timelapse.
 * The build resolves index.html -> /src/main.ts as the single entrypoint
 * and emits a dist/ bundle.
 */
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});