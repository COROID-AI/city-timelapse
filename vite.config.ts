import { defineConfig } from 'vite';

// Vite config for the procedural city timelapse scene.
// Dev server honours the canonical Vite port 5173 (acceptance criterion #1).
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
