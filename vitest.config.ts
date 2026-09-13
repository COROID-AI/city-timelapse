import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration.
 *
 * jsdom is the default environment so DOM, Three.js and UI-layer tests run
 * without per-file environment overrides. WebGL-dependent code deliberately
 * stays out of the scaffold; later scene tests can opt into a headless GL
 * setup explicitly when they need it.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});