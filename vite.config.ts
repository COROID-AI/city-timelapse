import { defineConfig } from 'vite';

// No external assets; everything is generated procedurally at runtime.
// Honor the runner-provided PORT env var so smoke checks can probe the server.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

export default defineConfig({
  server: {
    port,
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  preview: {
    port,
    host: true,
  },
});
