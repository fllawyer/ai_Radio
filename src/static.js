/**
 * STATIC.JS — 静态文件服务
 */
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PWA_DIR = join(PROJECT_ROOT, 'pwa');
const CACHE_DIR = process.env.CACHE_DIR || join(PROJECT_ROOT, 'cache');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function safeJoin(base, requestPath) {
  const clean = normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  return join(base, clean);
}

export async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);

  // SPA fallback
  if (path === '/') path = '/index.html';

  // TTS 缓存文件
  if (path.startsWith('/tts/')) {
    return serveFile(safeJoin(CACHE_DIR, path), res);
  }

  // PWA 静态文件
  return serveFile(safeJoin(PWA_DIR, path), res);
}

async function serveFile(filePath, res) {
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}
