import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'verify-scene.ts',
      formats: ['es'],
      fileName: () => 'verify-scene.mjs',
    },
    outDir: '_verify-out',
    rollupOptions: {
      external: ['three'],
    },
  },
});