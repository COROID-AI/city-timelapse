import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the city block timelapse.
 *
 * Core runtime/layout tests run in the default Node environment (no DOM, no
 * WebGL). Timeline UI tests created later by the UI task run headless in
 * jsdom: global file globs are mapped below and each ui test file additionally
 * carries a `// @vitest-environment jsdom` docblock.
 */
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
  },
});