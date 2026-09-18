/**
 * 部署时给 index.html 里的本地 js / css 加上内容哈希：
 *   <script src="canvas.js"> → <script src="canvas.js?v=8f3a1c22">
 *
 * 目的：GitHub Pages 对每个文件都设 max-age=600，改了代码但文件名没变，
 * 用户（和评审同事）十分钟内刷新拿到的还是旧文件。加了 ?v=<哈希> 之后，
 * 文件一变 URL 就变，浏览器只能重新下载——不用再教人「硬刷新」。
 *
 * 只在部署流水线里跑（见 .github/workflows/pages.yml），本地仓库保持原样。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const index = path.join(web, 'index.html');

if (!fs.existsSync(index)) {
  console.error('找不到 web/index.html');
  process.exit(1);
}

const before = fs.readFileSync(index, 'utf8');
let stamped = 0;

const after = before.replace(/(src|href)="([^"?:]+\.(?:js|css))"/g, (all, attr, file) => {
  const target = path.join(web, file);
  if (!fs.existsSync(target)) return all;
  const hash = crypto.createHash('sha1').update(fs.readFileSync(target)).digest('hex').slice(0, 8);
  stamped += 1;
  return `${attr}="${file}?v=${hash}"`;
});

fs.writeFileSync(index, after);
console.log(`index.html 已加版本号：${stamped} 个资源`);
