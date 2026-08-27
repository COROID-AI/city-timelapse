import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Split heavy vendor code into cacheable chunks so the app chunk stays small
 * and the vendor chunks are reused between deployments. Chunking is done at
 * the top-level package boundary to keep the dependency graph acyclic (no
 * `vendor -> react -> vendor` cycles).
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  const pkg = match ? match[1] : '';

  // three core + its examples helpers share the same runtime surface.
  if (pkg === 'three' || pkg.startsWith('three/')) return 'three';
  // React runtime + scheduler + the zustand store (react-bound) stay together.
  if (
    pkg === 'react' ||
    pkg === 'react-dom' ||
    pkg === 'scheduler' ||
    pkg === 'use-sync-external-store' ||
    pkg === 'zustand'
  ) {
    return 'react';
  }
  // R3F + drei depend on react + three only (acyclic).
  if (pkg === '@react-three/fiber' || pkg === '@react-three/drei') {
    return 'r3f';
  }
  return 'vendor';
}

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
    // three.js + R3F + drei is inherently a few hundred kB gzipped. Raising the
    // warn threshold keeps CI focused on real bloat (new accidental deps)
    // rather than the expected 3D-vendor size.
    chunkSizeWarningLimit: 1000,
  },
});