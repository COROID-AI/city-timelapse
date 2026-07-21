import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
  },
  // Pre-bundle all heavy 3D/R3F dependencies up front. Without this, Vite
  // discovers dependencies lazily during the first page load, which triggers a
  // full reload (deps hash changes) and can abort already-requested dep chunks
  // (net::ERR_ABORTED on three.module / postprocessing). Pre-bundling removes
  // the race entirely so the scene loads on the first paint with no flakiness.
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      'react-dom',
      'three',
      'three-stdlib',
      '@react-three/fiber',
      '@react-three/drei',
      'postprocessing',
      'zustand',
    ],
  },
});
