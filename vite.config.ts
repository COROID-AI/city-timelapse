import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitePluginGlsl from 'vite-plugin-glsl'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), vitePluginGlsl()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei']
  },
  server: {
    port: 5173
  }
})