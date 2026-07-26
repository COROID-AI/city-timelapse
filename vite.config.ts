import { defineConfig } from 'vite';

// Minimal Vite config for the Three.js era-timelapse scaffold.
// The renderer, post-processing pipeline, and timeline UI are set up in src/main.ts.
export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
