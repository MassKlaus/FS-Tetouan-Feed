/** Tiny static server to preview dist/ locally. It applies dist/_headers like Cloudflare Pages would. */
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { PATHS } from './config.ts';

const { dist } = PATHS;
const port = Number(process.env.PORT ?? 4173);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/atom+xml',
  '.webp': 'image/webp',
};

/** Headers from the `/*` block of `_headers` (the ones that apply to every page). */
async function globalHeaders(): Promise<Record<string, string>> {
  const rules = await fs.readFile(path.join(dist, '_headers'), 'utf8').catch(() => '');
  const block = rules.split(/\n\s*\n/).find((section) => section.startsWith('/*')) ?? '';
  const headers: Record<string, string> = {};
  for (const line of block.split('\n').slice(1)) {
    const [name, ...value] = line.trim().split(':');
    if (name) headers[name.toLowerCase()] = value.join(':').trim();
  }
  return headers;
}

http
  .createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const file = path.join(dist, pathname);
    if (!file.startsWith(dist)) return void res.writeHead(403).end();

    try {
      const body = await fs.readFile(file);
      res
        .writeHead(200, {
          'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
          ...(await globalHeaders()),
        })
        .end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  })
  .listen(port, () => console.log(`http://localhost:${port}`));
