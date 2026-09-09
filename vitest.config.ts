/**
 * Vitest configuration for the City Time Period Timelapse scaffold.
 *
 * Unit tests run in the jsdom environment so RAF/Loop behavior can be tested
 * without a real WebGL context (the render loop is mocked at the RAF seam).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});