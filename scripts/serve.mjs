// Local preview server that behaves like GitHub Pages: folders serve their
// index.html and unknown addresses get 404.html. Run with: npm run dev

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

async function findFile(pathname) {
  const target = join(ROOT, pathname);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  try {
    const info = await stat(target);
    if (info.isFile()) return target;
    if (info.isDirectory() && pathname.endsWith('/')) {
      const index = join(target, 'index.html');
      if ((await stat(index)).isFile()) return index;
    }
  } catch {
    // Doesn't exist, so the caller falls back to the 404 page.
  }
  return null;
}

createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const file = await findFile(pathname);
  const served = file ?? join(ROOT, '404.html');
  response.writeHead(file ? 200 : 404, {
    'Content-Type': TYPES[extname(served)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(served).pipe(response);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}/`);
});
