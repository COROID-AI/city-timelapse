import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT ?? 3000);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function send404(res) {
  send(res, 404, 'Not found', 'text/plain; charset=utf-8');
}

function tryServeFile(res, filePath, contentType) {
  if (!existsSync(filePath)) {
    return false;
  }
  const body = readFileSync(filePath);
  send(res, 200, body, contentType);
  return true;
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.map')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}

function resolveDistPath(urlPath) {
  // urlPath is like '/dist/hud/timeline.js'
  const clean = urlPath.replace(/^\//, '');
  return path.join(__dirname, clean);
}

function remapRequestPath(urlPath) {
  // Handle bare specifier requests (e.g. import "three" → request for "/three").
  if (!urlPath.startsWith('/dist/') && !urlPath.startsWith('/node_modules/') && urlPath.startsWith('/')) {
    const bare = urlPath.slice(1);
    if (bare && !bare.includes('/')) {
      // Prefer package module entry.
      const candidate = path.join(__dirname, 'node_modules', bare);
      if (existsSync(candidate)) {
        const pkgJson = path.join(candidate, 'package.json');
        if (existsSync(pkgJson)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
            const entry = pkg.module ?? pkg.main;
            if (typeof entry === 'string') {
              return `/node_modules/${bare}/${entry}`;
            }
          } catch {
            // ignore
          }
        }
        // Fallback to directory index.js.
        const indexJs = path.join(candidate, 'index.js');
        if (existsSync(indexJs)) {
          return `/node_modules/${bare}/index.js`;
        }
      }
    }
  }

  // Make extensionless module imports work.
  if (urlPath.startsWith('/dist/') && !path.extname(urlPath)) {
    return `${urlPath}.js`;
  }

  // Handle internal imports that might be requested without a /dist prefix.
  const under = (prefix) => urlPath.startsWith(prefix);
  if (under('/hud/') || under('/eras/') || under('/audio/') || under('/assetBuilder/')) {
    return `/dist${urlPath}`;
  }

  return urlPath;
}

const server = http.createServer((req, res) => {
  try {
    const rawUrl = req.url;
    if (!rawUrl) {
      send404(res);
      return;
    }

    const urlObj = new URL(rawUrl, `http://localhost:${port}`);
    let urlPath = urlObj.pathname;

    // Root always returns index.
    if (urlPath === '/' || urlPath === '/index.html') {
      const indexPath = path.join(__dirname, 'index.html');
      if (existsSync(indexPath)) {
        tryServeFile(res, indexPath, 'text/html; charset=utf-8');
        return;
      }
      send404(res);
      return;
    }

    // Handle bare specifier requests for ESM imports.
    // Some runtimes rewrite `import "three"` to GET /three.
    if (!path.extname(urlPath) && !urlPath.startsWith('/dist/')) {
      const candidate = path.join(__dirname, 'node_modules', urlPath);
      if (existsSync(candidate)) {
        // Prefer package module entry.
        const pkgJson = path.join(candidate, 'package.json');
        if (existsSync(pkgJson)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
            const entry = pkg.module ?? pkg.main;
            if (typeof entry === 'string') {
              const entryPath = path.join(candidate, entry);
              if (existsSync(entryPath) && !statSync(entryPath).isDirectory()) {
                tryServeFile(res, entryPath, contentTypeFor(entryPath));
                return;
              }
            }
          } catch {
            // Fall back to the directory handler.
          }
        }
      }
    }

    if (urlPath.startsWith('/node_modules/')) {
      const filePath = path.join(__dirname, urlPath);
      if (!existsSync(filePath)) {
        send404(res);
        return;
      }
      tryServeFile(res, filePath, contentTypeFor(filePath));
      return;
    }

    // Remap internal compiled assets.
    urlPath = remapRequestPath(urlPath);

    // Handle bare ESM package requests rewritten to path-less URL (e.g. /three).
    if (!urlPath.startsWith('/dist/') && !urlPath.includes('/')) {
      const candidate = path.join(__dirname, 'node_modules', urlPath);
      if (existsSync(candidate)) {
        const indexCandidate = path.join(candidate, 'index.js');
        const pkgJson = path.join(candidate, 'package.json');
        if (existsSync(pkgJson)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
            const entry = pkg.module ?? pkg.main;
            if (typeof entry === 'string') {
              const entryPath = path.join(candidate, entry);
              if (existsSync(entryPath) && !statSync(entryPath).isDirectory()) {
                tryServeFile(res, entryPath, contentTypeFor(entryPath));
                return;
              }
            }
          } catch {
            // ignore
          }
        }
        if (existsSync(indexCandidate) && !statSync(indexCandidate).isDirectory()) {
          tryServeFile(res, indexCandidate, contentTypeFor(indexCandidate));
          return;
        }
      }
    }

    // Serve /dist compiled artifacts.
    if (urlPath.startsWith('/dist/')) {
      const filePath = resolveDistPath(urlPath);
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        send404(res);
        return;
      }
      tryServeFile(res, filePath, contentTypeFor(filePath));
      return;
    }

    // Serve any static file under project root (best-effort).
    const candidate = path.join(__dirname, urlPath.replace(/^\//, ''));
    if (existsSync(candidate) && !statSync(candidate).isDirectory()) {
      tryServeFile(res, candidate, contentTypeFor(candidate));
      return;
    }

    send404(res);
  } catch {
    send404(res);
  }
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`City Time Period Timelapse server listening on http://localhost:${port}`);
});
