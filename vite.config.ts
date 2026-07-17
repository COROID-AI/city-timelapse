import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simple config without complex manual chunks
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    outDir: 'dist',
  },
})