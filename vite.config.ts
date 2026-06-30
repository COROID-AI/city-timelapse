import { defineConfig } from 'vite';

// Vite does not auto-read the PORT env var, so bind explicitly. This lets the
// dev server honour the runner-provided $PORT while defaulting to 5173 locally.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: Boolean(process.env.PORT),
  },
  build: {
    target: 'es2020',
  },
});
