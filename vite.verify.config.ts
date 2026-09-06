import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'verify-buildings.ts',
      formats: ['es'],
      fileName: () => 'verify-buildings.mjs',
    },
    outDir: '_verify-out',
    rollupOptions: {
      external: ['three'],
    },
  },
});