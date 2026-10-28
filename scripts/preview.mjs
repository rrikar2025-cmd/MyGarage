import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/__preview/mobile') {
      const width = [320, 390, 430].includes(Number(url.searchParams.get('width')))
        ? Number(url.searchParams.get('width'))
        : 390;
      response
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(
          `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Мій гараж · mobile preview</title></head><body style="margin:0;background:#cedbd7;display:flex;justify-content:center;min-height:100vh"><iframe title="My Garage mobile preview" src="/" style="border:0;width:${width}px;height:100vh;max-width:100%;background:#f1f4f3"></iframe></body></html>`,
        );
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep) && file !== root) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) file = resolve(root, 'index.html');
    response
      .writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(await readFile(file));
  } catch {
    response.writeHead(500).end('Preview failed');
  }
}).listen(8082, '127.0.0.1', () => console.log('My Garage preview: http://localhost:8082'));
