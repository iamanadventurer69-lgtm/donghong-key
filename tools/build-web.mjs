#!/usr/bin/env node
/**
 * 构建网页版产物（零依赖）：
 *
 *   1. web/bundle.js   —— 把小程序里那几份「共享内核」（data/content.js、
 *      utils/state.js、utils/match3.js）打包成浏览器可用的 CommonJS 注册表，
 *      挂到 window.DHK。网页版和小程序因此共用同一套规则与文案，改一处两边同步。
 *   2. web/styles.css  —— 把小程序各页 WXSS 转成浏览器 CSS：page→body、
 *      view→div、text→span（不动 .text-button 这类类名），并按 app → 组件 → 页面的
 *      顺序拼接，保证层叠顺序与小程序一致。
 *
 * 用法：node tools/build-web.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const mini = path.join(root, 'miniprogram');
const web = path.join(root, 'web');

/** 共享内核：虚拟 id 必须与 require() 的相对路径能对上。 */
const MODULES = ['data/content.js', 'utils/state.js', 'utils/match3.js'];

function wrapModule(id, source) {
  return `define(${JSON.stringify(id)}, function (require, module, exports) {\n${source}\n});\n`;
}

/** 只在内存里生成，用于 --check 比对。 */
function generateBundle() {
  const parts = [
    `/* 由 tools/build-web.mjs 生成，不要手改。来源：miniprogram/ 的共享内核 */`,
    `(function (global) {
  const registry = {};
  const cache = {};
  function normalize(dir, spec) {
    if (spec.slice(0, 2) !== './' && spec.slice(0, 3) !== '../') return spec + '.js';
    const base = dir ? dir.split('/') : [];
    for (const piece of spec.split('/')) {
      if (piece === '.' || piece === '') continue;
      if (piece === '..') base.pop();
      else base.push(piece);
    }
    const id = base.join('/');
    return id.endsWith('.js') ? id : id + '.js';
  }
  function dirOf(id) {
    const parts = id.split('/');
    parts.pop();
    return parts.join('/');
  }
  function define(id, factory) {
    registry[id] = factory;
  }
  function makeRequire(dir) {
    return function require(spec) {
      const id = normalize(dir, spec);
      if (!registry[id]) throw new Error('模块没打进包里: ' + id);
      if (!cache[id]) {
        cache[id] = { exports: {} };
        registry[id](makeRequire(dirOf(id)), cache[id], cache[id].exports);
      }
      return cache[id].exports;
    };
  }
  global.DHK = {
    require(spec) {
      return makeRequire('')(spec);
    },
    module(id) {
      return makeRequire('')(id.replace(/\\.js$/, ''));
    }
  };
`
  ];
  for (const id of MODULES) {
    parts.push(wrapModule(id, fs.readFileSync(path.join(mini, id), 'utf8')));
  }
  parts.push(`})(typeof window !== 'undefined' ? window : globalThis);\n`);
  const out = parts.join('\n');
  return { content: out, modules: MODULES.length, bytes: Buffer.byteLength(out) };
}

function buildBundle() {
  const bundle = generateBundle();
  fs.writeFileSync(path.join(web, 'bundle.js'), bundle.content);
  return bundle;
}

/** WXSS → CSS：只替换独立出现的 view / text 标签名与 page 选择器。 */
function portWxss(source) {
  return source
    .replace(/(^|\n)\s*page\s*\{/g, '$1body {')
    .replace(/(?<![.\w-])view(?![-\w])/g, 'div')
    .replace(/(?<![.\w-])text(?![-\w])/g, 'span')
    .replace(/:host/g, '.component-host');
}

/**
 * 把一页的 CSS 限定在它的页面容器下。
 *
 * 小程序里每个页面的 WXSS 只加载到那个页面，所以各页可以重复使用 .back /
 * .option / .card 这些类名；合并成一份网页 CSS 就会互相污染（典型：翻牌页的
 * .back{rotateY(180deg)} 把值班页的「退回」按钮翻了个面）。
 * 这里给每条顶层规则加作用域前缀，@media 递归处理，@keyframes 原样保留。
 */
function scopeCss(source, scope) {
  const cleaned = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const prefix = (selectors) =>
    selectors
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `${scope} ${item}`)
      .join(', ');

  let out = '';
  let i = 0;
  while (i < cleaned.length) {
    const open = cleaned.indexOf('{', i);
    if (open === -1) {
      out += cleaned.slice(i);
      break;
    }
    const selector = cleaned.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < cleaned.length && depth > 0) {
      if (cleaned[j] === '{') depth += 1;
      else if (cleaned[j] === '}') depth -= 1;
      j += 1;
    }
    const body = cleaned.slice(open + 1, j - 1);
    if (/^@(media|supports|container|layer)/.test(selector)) {
      out += `${selector} {\n${scopeCss(body, scope)}}\n`;
    } else if (selector.startsWith('@')) {
      out += `${selector} {${body}}\n`;
    } else {
      out += `${prefix(selector)} {${body}}\n`;
    }
    i = j;
  }
  return out;
}

function generateStyles() {
  const files = [
    { file: 'app.wxss', scope: null },
    { file: 'components/energy-network/energy-network.wxss', scope: '.component-host' },
    { file: 'components/live-meter/live-meter.wxss', scope: '.component-host' },
    ...fs
      .readdirSync(path.join(mini, 'pages'))
      .sort()
      .map((page) => ({ file: `pages/${page}/${page}.wxss`, scope: `.page-${page}` }))
  ].filter((entry) => fs.existsSync(path.join(mini, entry.file)));

  const chunks = files.map(({ file, scope }) => {
    const ported = portWxss(fs.readFileSync(path.join(mini, file), 'utf8'));
    const head = `/* ==== ${file}${scope ? ` → ${scope}` : ''} ==== */`;
    return `${head}\n${scope ? scopeCss(ported, scope) : ported}`;
  });
  const out = `/* 由 tools/build-web.mjs 生成，不要手改。来源：miniprogram 的 WXSS */\n${chunks.join('\n')}\n`;
  return { content: out, files: files.length, bytes: Buffer.byteLength(out) };
}

function buildStyles() {
  const styles = generateStyles();
  fs.writeFileSync(path.join(web, 'styles.css'), styles.content);
  return styles;
}

fs.mkdirSync(web, { recursive: true });
const check = process.argv.includes('--check');

if (check) {
  // 校验产物是不是最新的：重新生成一遍，和磁盘上的逐字节比较
  const stale = [];
  for (const [file, generated] of [
    ['bundle.js', generateBundle().content],
    ['styles.css', generateStyles().content]
  ]) {
    const target = path.join(web, file);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) stale.push(file);
  }
  if (stale.length > 0) {
    console.error(`网页版产物过期，请运行 npm run build:web（${stale.join('、')}）`);
    process.exitCode = 1;
  } else {
    console.log('PASS: 网页版产物是最新的（bundle.js、styles.css）');
  }
} else {
  const bundle = buildBundle();
  const styles = buildStyles();
  console.log(
    `网页版产物已生成：bundle.js（${bundle.modules} 个共享模块，${(bundle.bytes / 1024).toFixed(1)}KB）、` +
      `styles.css（${styles.files} 份 WXSS，${(styles.bytes / 1024).toFixed(1)}KB）`
  );
}
