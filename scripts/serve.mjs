#!/usr/bin/env node
/**
 * Zero-dependency static file server for game/.
 *
 * Serves files from the game/ directory (relative to this repo root) with
 * correct MIME types and no framework. Run with:
 *
 *   node scripts/serve.mjs
 *
 * Then open http://localhost:8080/ in a browser.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(__dirname, '..', 'game');
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Resolve a request path safely inside the game/ root.
 * Rejects path traversal outside the served directory.
 *
 * @param {string} urlPath - Raw request URL path.
 * @returns {string} Absolute filesystem path within ROOT.
 */
function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  // Normalize and ensure the result stays within ROOT.
  const abs = normalize(join(ROOT, rel));
  if (!abs.startsWith(resolve(ROOT) + sep)) {
    throw new Error('Forbidden');
  }
  return abs;
}

const server = createServer(async (req, res) => {
  try {
    const filePath = resolvePath(req.url || '/');
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    res.end(data);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Game server running at http://localhost:${PORT}/`);
});