import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/setupTests.ts'],
    css: true,
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
