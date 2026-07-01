import { defineConfig } from 'vite';

// The runner / smoke-check provides a PORT via env. Bind to it exactly so the
// readiness probe on 127.0.0.1:$PORT hits our server. Fall back to Vite defaults
// for local development when no PORT is supplied.
const port = Number(process.env.PORT);

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: Number.isFinite(port) && port > 0 ? port : 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: Number.isFinite(port) && port > 0 ? port : 4173,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
