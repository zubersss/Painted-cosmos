// Tiny static file server for local runs and headless checks. No dependencies.
// Usage: node tools/serve.mjs [port] [rootDir]   (port 0 = pick a free port; prints the URL)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm',
};

export function startServer(port = 0, root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + p); return; }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` });
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await startServer(Number(process.argv[2] || 8080), process.argv[3] ? path.resolve(process.argv[3]) : undefined);
  console.log('serving', url);
}
