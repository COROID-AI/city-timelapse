/**
 * Vite configuration for the City Time Period Timelapse scaffold.
 *
 * This file is part of the frozen scaffold set (package.json, tsconfig.json,
 * vite.config.ts, vitest.config.ts, index.html). Later era-system tasks must
 * not modify it.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Bind to the loopback address so `npm run dev` is always reachable at
    // http://127.0.0.1:5173 in managed browser checks.
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});