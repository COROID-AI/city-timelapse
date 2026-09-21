import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Single source of truth for the dev server, production build and unit-test
 * harness. Later tasks treat this file as immutable: everything they need is
 * already wired here (React fast refresh, jsdom unit tests, a fixed dev port
 * that `playwright.config.ts` reuses).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2048,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    // `.test.*` is the default suite; `.spec.*` carries the cross-module
    // composition suites (real layout + real era registry + real content layer)
    // that later phases add next to their unit tests.
    include: ['tests/**/*.test.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 20_000,
    reporters: 'default',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
        pretendToBeVisual: true,
      },
    },
  },
})
