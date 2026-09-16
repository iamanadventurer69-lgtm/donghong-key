#!/usr/bin/env node
/**
 * 本地打开网页版（零依赖静态服务器）。
 * 用法：npm run web  → 浏览器打开提示的地址
 *
 * 用 file:// 直接双击 index.html 也能跑，但部分浏览器会限制 file:// 下的
 * localStorage（存档就存不了），所以推荐用这个服务器看。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const webDir = path.resolve(import.meta.dirname, '../web');
const port = Number(process.env.PORT || 4173);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(webDir, rel);
  if (!file.startsWith(webDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`网页版已启动：http://127.0.0.1:${port}/`);
  console.log(`（产物由 npm run build:web 生成，改了小程序里的内容/状态机后要重新构建）`);
});
