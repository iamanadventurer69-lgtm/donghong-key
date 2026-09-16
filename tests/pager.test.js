const { test } = require('node:test');
const assert = require('node:assert/strict');
const { direction, methods } = require('../miniprogram/utils/pager');
const gesture = (x, y) => ({ clientX: x, clientY: y });
test('横向滑动翻页，点击/纵向/短距离/取消手势不翻页', () => {
  assert.equal(direction(gesture(180, 100), gesture(100, 103)), 1);
  assert.equal(direction(gesture(100, 100), gesture(180, 103)), -1);
  assert.equal(direction(gesture(100, 100), gesture(103, 180)), 0);
  assert.equal(direction(gesture(100, 100), gesture(130, 100)), 0);
  assert.equal(direction(null, gesture(100, 100)), 0);
});
test('普通页边界与交互区隔离：滑杆和拖拽不能触发翻页', () => {
  const p = {
    ...methods,
    data: { panel: 0, panelCount: 3 },
    setData(d) {
      Object.assign(this.data, d);
    }
  };
  p.prevPanel();
  assert.equal(p.data.panel, 0);
  p.swipeStart({ touches: [gesture(180, 100)] });
  p.holdGesture();
  p.swipeEnd({ changedTouches: [gesture(50, 100)] });
  assert.equal(p.data.panel, 0);
  p.nextPanel();
  p.nextPanel();
  p.nextPanel();
  assert.equal(p.data.panel, 2);
  p.swipeStart({ touches: [gesture(180, 100)] });
  p.swipeCancel();
  assert.equal(p.swipeOrigin, null);
});
test('所有原生页面禁用纵向滚动；任务关使用独立固定视图，交互组件隔离翻页事件', () => {
  const fs = require('node:fs'),
    path = require('node:path');
  const r = path.resolve(__dirname, '../miniprogram');
  for (const p of require(r + '/app.json').pages) {
    assert.equal(require(r + '/' + p + '.json').disableScroll, true);
    const w = fs.readFileSync(r + '/' + p + '.wxml', 'utf8');
    assert.ok(
      p === 'pages/mission/mission'
        ? w.includes('class="mission-page"')
        : w.includes('class="viewport"')
    );
    assert.ok(!w.includes('scroll-view'));
  }
  const chapter = fs.readFileSync(r + '/pages/chapter/chapter.wxml', 'utf8');
  assert.equal((chapter.match(/catchtouchstart="holdGesture"/g) || []).length, 2);
});
