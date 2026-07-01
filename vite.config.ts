import { defineConfig } from 'vite';

// No external assets; everything is generated procedurally at runtime.
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  // Ensure the dev server uses the runner-provided port when present.
  preview: {
    port: 5173,
    host: true,
  },
});
