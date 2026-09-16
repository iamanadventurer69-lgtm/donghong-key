#!/usr/bin/env node
/**
 * WXML 排版器（项目自用，零依赖）
 *
 * 目标：缩进 2 空格；开标签过长时属性一行一个，其余尽量一个元素一行。
 *
 * 两条不可违背的规则：
 *  1. 文本节点里的字符一个都不改。WXML 的 <text> 会保留空格与换行，
 *     在文本中间插入换行，真机上就会多出可见空白。
 *  2. 只在「子节点全是块级元素」的地方折行，也不在行内元素（text / image / icon）
 *     之间折行，避免凭空多出一个会影响渲染的空白文本节点。
 *
 * 用法：node tools/format-wxml.mjs [--check] [文件或目录 ...]
 *   --check 只报告哪些文件未排版，不写回。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PRINT_WIDTH = 120;
const INDENT = '  ';
/** 行内元素：它们之间的空白会参与渲染，因此不在彼此之间折行。 */
const INLINE_TAGS = new Set(['text', 'image', 'icon']);

/** 子节点能不能安全地折行：不能有实际文本子节点，且不能出现两个相邻的行内元素。 */
function canBreakChildren(children) {
  const kept = children.filter((child) => child.type === 'element' || child.raw.trim() !== '');
  if (kept.some((child) => child.type === 'text')) return false;
  const elements = kept.filter((child) => child.type === 'element');
  for (let i = 1; i < elements.length; i += 1) {
    if (INLINE_TAGS.has(elements[i - 1].name) && INLINE_TAGS.has(elements[i].name)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ 词法分析

/** 切开源码，得到 text / comment / open / close 四种 token（引号内的 > 不算标签结束）。 */
function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    // {{ }} 里可能有 < 或 >（例如 {{a < b ? x : y}}），先整体跳过。
    if (source.startsWith('{{', i)) {
      const end = source.indexOf('}}', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      tokens.push({ type: 'text', raw: source.slice(i, stop) });
      i = stop;
      continue;
    }
    if (source[i] !== '<') {
      const candidates = [source.indexOf('<', i), source.indexOf('{{', i)].filter((n) => n !== -1);
      const end = candidates.length === 0 ? source.length : Math.min(...candidates);
      if (end > i) tokens.push({ type: 'text', raw: source.slice(i, end) });
      i = end;
      continue;
    }
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i);
      const stop = end === -1 ? source.length : end + 3;
      tokens.push({ type: 'comment', raw: source.slice(i, stop) });
      i = stop;
      continue;
    }
    let j = i + 1;
    let quote = null;
    let closed = false;
    while (j < source.length) {
      const ch = source[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        closed = true;
        break;
      }
      j += 1;
    }
    const raw = source.slice(i, closed ? j + 1 : source.length);
    tokens.push({ type: raw.startsWith('</') ? 'close' : 'open', raw });
    i = closed ? j + 1 : source.length;
  }
  return tokens;
}

/** 拆开一个开标签：标签名、属性、自闭合写法。 */
function parseOpenTag(raw) {
  const selfClosing = /\/>$/.test(raw);
  const spacedSlash = / \/>$/.test(raw);
  const inner = raw.slice(1, raw.length - (selfClosing ? (spacedSlash ? 3 : 2) : 1)).trim();
  const name = inner.split(/\s/, 1)[0];
  const attrs = [];
  let rest = inner.slice(name.length).trim();
  while (rest.length > 0) {
    const eq = rest.indexOf('=');
    if (eq === -1) {
      attrs.push(rest);
      break;
    }
    const key = rest.slice(0, eq).trim();
    const quote = rest[eq + 1];
    const end = rest.indexOf(quote, eq + 2);
    if (end === -1) throw new Error(`属性引号未闭合：${raw}`);
    attrs.push(`${key}=${rest.slice(eq + 1, end + 1)}`);
    rest = rest.slice(end + 1).trim();
  }
  return { name, attrs, selfClosing, spacedSlash };
}

// ------------------------------------------------------------------ 语法分析

/** 建树；WXML 是良构的，遇到问题直接抛错，不静默改坏模板。 */
function parse(tokens) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  for (const token of tokens) {
    const top = stack[stack.length - 1];
    if (token.type === 'text') {
      top.children.push({ type: 'text', raw: token.raw });
    } else if (token.type === 'comment') {
      top.children.push({ type: 'comment', raw: token.raw });
    } else if (token.type === 'open') {
      const node = { type: 'element', ...parseOpenTag(token.raw), children: [] };
      top.children.push(node);
      if (!node.selfClosing) stack.push(node);
    } else {
      const node = stack.pop();
      if (!node || node.type !== 'element') throw new Error(`多余的闭合标签 ${token.raw}`);
      if (token.raw.replace(/\s+>$/, '>') !== `</${node.name}>`) {
        throw new Error(`闭合标签不匹配：期望 </${node.name}>，实际 ${token.raw}`);
      }
    }
  }
  if (stack.length !== 1) throw new Error(`标签未闭合：<${stack[stack.length - 1].name}>`);
  return root;
}

// ------------------------------------------------------------------ 排版输出

/** 需要人工确认、但不阻断排版的情况。 */
export const warnings = [];

/** 标签的开头与结尾（不含属性以外的内容）。 */
function tagParts(node) {
  const attrs = node.attrs.length > 0 ? ` ${node.attrs.join(' ')}` : '';
  return {
    head: `<${node.name}${attrs}`,
    tail: node.selfClosing ? (node.spacedSlash ? ' />' : '/>') : '>'
  };
}

/** 不折行时，这个节点的完整形态。 */
function renderInline(node) {
  if (node.type === 'text' || node.type === 'comment') return node.raw;
  const { head, tail } = tagParts(node);
  const close = node.selfClosing ? '' : `</${node.name}>`;
  // 折行安全时，元素之间的纯空白只是缩进残留，去掉它；不安全时原样保留。
  const droppable = canBreakChildren(node.children);
  const body = node.children
    .filter((child) => !(droppable && child.type === 'text' && child.raw.trim() === ''))
    .map(renderInline)
    .join('');
  return `${head}${tail}${body}${close}`;
}

/** 开标签；属性放不下时一行一个。 */
function renderOpenTag(node, indent) {
  const { head, tail } = tagParts(node);
  const oneLine = `${indent}${head}${tail}`;
  if (node.attrs.length === 0 || oneLine.length <= PRINT_WIDTH) return [oneLine];
  const lines = [`${indent}<${node.name}`];
  for (const attr of node.attrs) lines.push(`${indent}${INDENT}${attr}`);
  lines.push(`${indent}${tail.trim()}`);
  return lines;
}

/** 把一个节点渲染成若干行（已含缩进）。 */
function render(node, depth) {
  const indent = INDENT.repeat(depth);
  if (node.type === 'text' || node.type === 'comment') return [indent + node.raw];

  const { head, tail } = tagParts(node);
  const close = node.selfClosing ? '' : `</${node.name}>`;
  const droppable = canBreakChildren(node.children);
  const body = node.children
    .filter((child) => !(droppable && child.type === 'text' && child.raw.trim() === ''))
    .map(renderInline)
    .join('');
  const inline = `${head}${tail}${body}${close}`;
  const fits = indent.length + inline.length <= PRINT_WIDTH;

  if (node.selfClosing) return renderOpenTag(node, indent);

  // 含文本或相邻行内子节点：折行会凭空多出空白，宁可让这一行超宽。
  if (fits || !droppable) {
    if (!fits) warnings.push(`${node.name} 保持单行但超过 ${PRINT_WIDTH} 列`);
    const lines = renderOpenTag(node, indent);
    if (lines.length === 1) return [indent + inline];
    lines[lines.length - 1] = `${lines[lines.length - 1]}${body}${close}`;
    return lines;
  }

  // 子节点全是块级元素：可以安全折行。
  const lines = renderOpenTag(node, indent);
  for (const child of node.children) {
    if (child.type === 'text') continue;
    lines.push(...render(child, depth + 1));
  }
  lines.push(`${indent}</${node.name}>`);
  return lines;
}

/** 排版一段 WXML 源码，返回新源码（warnings 里放需要人工确认的点）。 */
export function formatWxml(source) {
  warnings.length = 0;
  const tree = parse(tokenize(source));
  const lines = [];
  for (const child of tree.children) {
    if (child.type === 'text') continue;
    lines.push(...render(child, 0));
  }
  return `${lines.join('\n')}\n`;
}

// ------------------------------------------------------------------ 命令行

function collect(targets) {
  const files = [];
  for (const target of targets) {
    if (fs.statSync(target).isDirectory()) {
      for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        files.push(...collect([path.join(target, entry.name)]));
      }
    } else if (target.endsWith('.wxml')) {
      files.push(target);
    }
  }
  return files;
}

function main(argv) {
  const check = argv.includes('--check');
  const targets = argv.filter((arg) => !arg.startsWith('--'));
  if (targets.length === 0) targets.push('miniprogram');

  let changed = 0;
  for (const file of collect(targets)) {
    const source = fs.readFileSync(file, 'utf8');
    const formatted = formatWxml(source);
    for (const warning of warnings) console.warn(`  ! ${file}: ${warning}`);
    if (formatted === source) continue;
    changed += 1;
    if (check) console.error(`未排版: ${file}`);
    else fs.writeFileSync(file, formatted);
  }
  console.log(`${check ? '需要排版' : '已排版'} ${changed} 个文件。`);
  if (check && changed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2));
}
