const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
function component(name) {
  let def;
  global.Component = (d) => (def = d);
  const file = path.resolve(__dirname, `../miniprogram/components/${name}/${name}.js`);
  delete require.cache[file];
  require(file);
  const instance = {
    ...def.methods,
    data: { ...(def.data || {}), active: 3 },
    setData(v) {
      Object.assign(this.data, v);
    },
    triggerEvent(name, detail) {
      this.events = this.events || [];
      this.events.push({ name, detail });
    },
    alive: true,
    visible: true
  };
  let next = 0;
  const scheduled = new Map();
  instance.canvas = {
    requestAnimationFrame(fn) {
      scheduled.set(++next, fn);
      return next;
    },
    cancelAnimationFrame(id) {
      scheduled.delete(id);
    }
  };
  instance.draw = () => {};
  return { def, instance, scheduled };
}
test('能源动画隐藏/卸载时取消循环，恢复时只有一个循环', () => {
  const { def, instance: p, scheduled } = component('energy-network');
  p.start();
  assert.equal(scheduled.size, 1);
  def.pageLifetimes.hide.call(p);
  assert.equal(scheduled.size, 0);
  def.pageLifetimes.show.call(p);
  p.start();
  assert.equal(scheduled.size, 1);
  def.lifetimes.detached.call(p);
  assert.equal(scheduled.size, 0);
});
