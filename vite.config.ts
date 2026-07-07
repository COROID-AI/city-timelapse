import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '3000')
  },
  preview: {
    port: parseInt(process.env.PORT || '3000'),
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});