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
  for (const ext of ['js', 'json', 'wxml', 'wxss'])
    assert.ok(fs.existsSync(path.join(root, p + '.' + ext)), p + '.' + ext);
  let page;
  const code = fs.readFileSync(path.join(root, p + '.js'), 'utf8');
  const req = require('node:module').createRequire(path.join(root, p + '.js'));
  vm.runInNewContext(code, { Page: (p) => (page = p), require: req });
  const markup = fs.readFileSync(path.join(root, p + '.wxml'), 'utf8');
  for (const m of markup.matchAll(
    /(?:bind|catch)(?:tap|touchstart|touchmove|touchend|touchcancel)="(\w+)"/g
  ))
    assert.equal(typeof page[m[1]], 'function', `${p} missing ${m[1]}`);
}
console.log(
  `PASS: ${files.length} native source files; ${config.pages.length} complete pages; JSON, JS syntax and event bindings checked.`
);
