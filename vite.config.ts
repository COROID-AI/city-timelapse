import { defineConfig } from "vite";

// Minimal Vite config. The app is fully procedural (no binary assets),
// so no special plugins or asset handling are required.
export default defineConfig({
  server: {
    // The runner injects PORT; respect it so the readiness probe hits us.
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
