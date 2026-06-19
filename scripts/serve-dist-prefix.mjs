#!/usr/bin/env node
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'dist');
const prefix = String(process.argv[2] || '').replace(/^\/+|\/+$/g, '');
const port = Number(process.argv[3] || process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.gz': 'application/gzip'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safePath(urlPath) {
  const rel = urlPath.replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  let pathname = decodeURIComponent(url.pathname);
  const base = prefix ? `/${prefix}` : '';

  if (base) {
    if (pathname === '/') {
      res.writeHead(302, { Location: `${base}/` });
      res.end();
      return;
    }
    if (pathname === base) pathname = '/';
    else if (pathname.startsWith(`${base}/`)) pathname = pathname.slice(base.length);
    else {
      send(res, 404, 'Not found');
      return;
    }
  }

  let filePath = safePath(pathname);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  const base = prefix ? `/${prefix}/` : '/';
  console.log(`Serving ${root} at http://${host}:${port}${base}`);
});
