import { defineConfig } from 'vite';

// Bind to the PORT the execution runner injects so the smoke check can probe it.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    sourcemap: false,
  },
});
