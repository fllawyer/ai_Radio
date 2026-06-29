/**
 * STATIC.JS — 静态文件服务
 */
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createReadStream } from 'node:fs';

const PWA_DIR = 'pwa';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

export async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let path = url.pathname;

  // SPA fallback
  if (path === '/') path = '/index.html';

  // TTS 缓存文件
  if (path.startsWith('/tts/')) {
    return serveFile(join('cache', path), res);
  }

  // PWA 静态文件
  const filePath = join(PWA_DIR, path);
  return serveFile(filePath, res);
}

async function serveFile(filePath, res) {
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('404');
  }
}
