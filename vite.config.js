import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    strictPort: false
  },
  build: {
    target: 'es2020',
    sourcemap: false
  }
});
