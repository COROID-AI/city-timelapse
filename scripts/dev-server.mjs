/**
 * Minimal dev server for the City Time Period Timelapse.
 *
 * Serves the composed scene at the app root (`/`) so the scene can be
 * previewed during development. It returns a small HTML shell that loads the
 * compiled React entrypoint (`dist/src/App.js`) and mounts the full
 * CityScene, and additionally serves static assets from `dist/` and `public/`.
 *
 * No external dependencies: built on Node's `http` module.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 4173);
const DIST = join(process.cwd(), 'dist');
const PUBLIC = join(process.cwd(), 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/** The app shell served at the root. */
const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>City Time Period Timelapse</title>
    <style>
      html, body { margin: 0; height: 100%; }
      #app { position: fixed; inset: 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>window.__CITY_SCENE__ = { mount: true };</script>
    <script type="module" src="/src/App.js"></script>
  </body>
</html>
`;

function resolveFile(pathname) {
  const candidates = [
    join(DIST, pathname),
    join(PUBLIC, pathname),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const server = createServer((req, res) => {
  const pathname = normalize(decodeURIComponent(req.url.split('?')[0]));
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'content-type': MIME['.html'] });
    res.end(SHELL);
    return;
  }
  const file = resolveFile(pathname);
  if (file === null) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

server.listen(PORT, () => {
  console.log(`City dev server listening on http://localhost:${PORT}`);
});