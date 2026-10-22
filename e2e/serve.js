// Serves the static site with the headers from vercel.json, so a CSP violation fails the E2E run.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const headers = Object.fromEntries(config.headers[0].headers.map((h) => [h.key, h.value]));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
const port = Number(process.env.PORT || 4173);

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = normalize(path === '/' ? '/index.html' : path);
  const allowed = file === '/index.html' || ['/app.js', '/questions.js', '/styles.css'].includes(file) || file.startsWith('/fonts/');
  if (!allowed) { res.writeHead(404, headers).end(); return; }
  try {
    const body = await readFile(join(root, file));
    res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, headers).end();
  }
}).listen(port, '127.0.0.1');
