import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default environment is node for engine/registry tests. The DOM-based
    // timeline slider test opts into happy-dom via the file-scoped
    // `// @vitest-environment happy-dom` comment.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'src/engine/__tests__/**/*.test.ts'],
  },
});