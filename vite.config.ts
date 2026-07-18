import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    open: false
  },
  preview: {
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})