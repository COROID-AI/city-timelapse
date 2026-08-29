import { defineConfig } from 'vite';

// Vite configuration for the City Era Timelapse scaffold.
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
});