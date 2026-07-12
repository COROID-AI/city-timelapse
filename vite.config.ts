import { defineConfig } from 'vite';

// Vite config. The dev server binds to the runner-provided PORT (if any) so
// that smoke checks / preview probes against 127.0.0.1:$PORT succeed.
export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    port: process.env.PORT ? Number(process.env.PORT) : 4173,
    host: '127.0.0.1',
    strictPort: true,
  },
});
