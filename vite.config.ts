import { defineConfig } from 'vite';

/**
 * Vite configuration for the city block timelapse scaffold.
 * t11-app-integration owns final composition wiring on top of this shell.
 */
export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});