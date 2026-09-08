/**
 * City Time Period Timelapse — dev server.
 *
 * Starts the Vite dev server programmatically through its Node API. This is the
 * correct way to serve the app during development: Vite transforms the ES module
 * source (TSX) on the fly and serves true browser ESM, so the composed CityScene
 * mounts and renders without the `exports is not defined` defect that a naive
 * static server hits when it serves CommonJS build output (`dist/*.js`) as if it
 * were browser ESM.
 *
 * Run with `npm run dev` (port 5173, strict).
 */
import { createServer } from 'vite';

const PORT = 5173;

async function main() {
  const server = await createServer({
    server: {
      port: PORT,
      strictPort: true,
    },
    logLevel: 'info',
  });
  await server.listen();
  server.printUrls();
  return server;
}

main().catch((err) => {
  console.error('Failed to start the City Time Period Timelapse dev server:', err);
  process.exit(1);
});