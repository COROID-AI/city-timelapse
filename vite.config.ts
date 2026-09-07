import { defineConfig, Plugin } from 'vitest/config';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Small Vite plugin that serves a JSON /healthz endpoint on both the dev
 * server and the preview server, proving the app is alive.
 */
function healthzPlugin(): Plugin {
  // Handler used by both dev and preview servers. Vite's middleware signature
  // is connect-style (req, res, next).
  const handler = (
    req: IncomingMessage & { url?: string },
    res: ServerResponse,
    next: () => void,
  ) => {
    const url = req.url ?? '';
    if (url === '/healthz' || url === '/healthz/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ status: 'ok', service: 'city-time-period-timelapse' }),
      );
      return;
    }
    next();
  };

  return {
    name: 'healthz-plugin',
    configureServer(server) {
      server.middlewares.use(handler as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler as never);
    },
  };
}

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  plugins: [healthzPlugin()],
});