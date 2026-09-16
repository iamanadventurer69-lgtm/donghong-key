const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../miniprogram');
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((f) => (f.isDirectory() ? walk(path.join(dir, f.name)) : [path.join(dir, f.name)]));
}
const files = walk(root);
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.js')) new vm.Script(s, { filename: f });
  if (f.endsWith('.json')) JSON.parse(s);
}

const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
for (const p of config.pages) {
  for (const ext of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(root, p + '.' + ext)), p + '.' + ext);
  }
  let page;
  const code = fs.readFileSync(path.join(root, p + '.js'), 'utf8');
  const req = require('node:module').createRequire(path.join(root, p + '.js'));
  vm.runInNewContext(code, { Page: (def) => (page = def), require: req });
  const markup = fs.readFileSync(path.join(root, p + '.wxml'), 'utf8');
  for (const m of markup.matchAll(
    /(?:bind|catch)(?:tap|touchstart|touchmove|touchend|touchcancel|changing|change)="(\w+)"/g
  )) {
    assert.equal(typeof page[m[1]], 'function', `${p} missing ${m[1]}`);
  }
}

// 跳转目标与任务清单里的页面路径必须是真实存在的页面：
// 之前序章领完密钥跳的还是已删除的 pages/chapter，真机上点了没反应。
const routes = new Set(config.pages.map((p) => '/' + p));
let routesChecked = 0;
for (const f of files) {
  if (!f.endsWith('.js')) continue;
  const source = fs.readFileSync(f, 'utf8');
  for (const m of source.matchAll(/['"](\/pages\/[\w/-]+)['"]/g)) {
    routesChecked += 1;
    assert.ok(routes.has(m[1]), `${path.relative(root, f)} 指向不存在的页面 ${m[1]}`);
  }
}
// 反向检查：每个页面都应当能在某个地方被跳到（首页除外）
const referenced = new Set();
for (const f of files) {
  if (!f.endsWith('.js')) continue;
  const source = fs.readFileSync(f, 'utf8');
  for (const m of source.matchAll(/['"](\/pages\/[\w/-]+)['"]/g)) referenced.add(m[1]);
}
for (const p of config.pages) {
  if (p === 'pages/home/home') continue;
  assert.ok(referenced.has('/' + p), `${p} 没有任何入口`);
}

console.log(
  `PASS: ${files.length} native source files; ${config.pages.length} complete pages; ` +
    `${routesChecked} page routes checked; JSON, JS syntax and event bindings checked.`
);
