import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'verify-postfx.ts',
      formats: ['es'],
      fileName: () => 'verify-postfx.mjs',
    },
    outDir: '_verify-out',
    rollupOptions: {
      external: ['three'],
    },
  },
});