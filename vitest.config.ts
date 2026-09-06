import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', '_qa/**/*.spec.ts'],
    environment: 'node',
  },
});