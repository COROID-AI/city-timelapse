import { defineConfig } from 'vite';

// Vite configuration for the neon-racer foundation app.
// Uses the default browser target; the app is a full-viewport WebGL game.
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});