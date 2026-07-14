import { defineConfig } from 'vite';

const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: './',
  server: {
    port,
    strictPort: false,
    host: '127.0.0.1'
  },
  build: {
    target: 'es2022',
    sourcemap: false
  }
});
