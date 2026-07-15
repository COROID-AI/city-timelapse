import { defineConfig } from 'vite';

// Vite reads the PORT injected by the execution runner (native PORT handling)
// and binds only to localhost.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
