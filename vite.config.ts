import { defineConfig, type PluginOption } from 'vite';

// The runner / smoke-check provides a PORT via env. Bind to it exactly so the
// readiness probe on 127.0.0.1:$PORT hits our server. Fall back to Vite defaults
// for local development when no PORT is supplied.
const port = Number(process.env.PORT);

/**
 * Intercept /favicon.ico requests and return 204 No Content. Browsers
 * auto-request this URL even when a data-URI favicon is declared in the HTML,
 * which would otherwise surface as a 404 console error during smoke checks.
 */
function faviconNoContent(): PluginOption {
  const handler = (_req: unknown, res: { statusCode: number; end: () => void }) => {
    res.statusCode = 204;
    res.end();
  };
  return {
    name: 'favicon-no-content',
    configureServer(server) {
      server.middlewares.use('/favicon.ico', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/favicon.ico', handler);
    },
  };
}

export default defineConfig({
  plugins: [faviconNoContent()],
  server: {
    host: '0.0.0.0',
    port: Number.isFinite(port) && port > 0 ? port : 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: Number.isFinite(port) && port > 0 ? port : 4173,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
