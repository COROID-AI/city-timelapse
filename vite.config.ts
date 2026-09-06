import { defineConfig } from 'vite';

// Vite configuration for the city-timelapse scaffold.
// The dev server binds to all interfaces by default; the foundation
// verification script targets 127.0.0.1:5173 explicitly.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2020',
  },
});