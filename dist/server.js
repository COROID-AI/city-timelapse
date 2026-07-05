const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const rootDir = path.join(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return true;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // HTML entry
    if (pathname === '/' || pathname === '/index.html') {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Serve compiled assets from /dist
    if (pathname.startsWith('/dist/')) {
      const filePath = path.join(rootDir, pathname);
      serveFile(res, filePath);
      return;
    }

    // Serve compiled JS for TS module specifiers.
    // If browser asks for /src/x.ts, serve /dist/x.js
    if (pathname.startsWith('/src/')) {
      const rel = pathname.slice('/src/'.length);
      const jsName = rel.replace(/\.ts$/i, '.js');
      const filePath = path.join(rootDir, 'dist', jsName);
      if (fs.existsSync(filePath)) {
        serveFile(res, filePath);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // Everything else: attempt to serve from repo root as static (rare).
    const filePath = path.join(rootDir, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveFile(res, filePath);
      return;
    }

    // SPA fallback to index.
    const html = fs.readFileSync(indexPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
