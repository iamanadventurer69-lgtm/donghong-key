const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const c = require('../miniprogram/data/content');

function setup() {
  const db = {};
  const routes = [];
  global.wx = {
    getStorageSync: (k) => db[k],
    setStorageSync: (k, v) => {
      db[k] = JSON.parse(JSON.stringify(v));
    },
    navigateTo: (o) => routes.push(o.url),
    redirectTo: (o) => routes.push(o.url),
    reLaunch: (o) => routes.push(o.url),
    pageScrollTo: () => {},
    showToast: () => {},
    showModal: () => {}
  };
  delete require.cache[require.resolve('../miniprogram/utils/storage')];
  return { db, routes, store: require('../miniprogram/utils/storage') };
}

function page(name) {
  let p;
  global.Page = (def) => (p = def);
  const f = path.resolve(__dirname, `../miniprogram/pages/${name}/${name}.js`);
  delete require.cache[f];
  require(f);
  p.data = JSON.parse(JSON.stringify(p.data));
  p.setData = (d) => Object.assign(p.data, d);
  return p;
}

const ev = (id) => ({ currentTarget: { dataset: { id } } });
/** 序章走完，拿到使命密钥。 */
const passPrologue = (store) => {
  for (const event of ['prologue', 'prologue', 'mission']) store.dispatch(event);
};

test('值班闭环：六份材料盖章 → 文化画像 → 行动承诺', () => {
  const { store, routes } = setup();
  const intro = page('prologue');
  intro.onShow();
  intro.next();
  intro.next();
  intro.next();
  assert.equal(store.read().prologueDone, true);

  const shift = page('shift');
  shift.onLoad();
  shift.onShow();
  assert.equal(shift.data.card.id, 'rush');
  assert.equal(shift.data.index, 1);
  assert.equal(shift.data.trust, 60);
  assert.equal(shift.data.twoStamps, true);

  shift.choose(ev('release'));
  assert.equal(shift.data.phase, 'result');
  assert.equal(shift.data.result.stamp, 'release');
  assert.equal(shift.data.result.trust, 40);
  assert.match(shift.data.result.marks, /务实 \+1/);
  shift.next();
  assert.equal(shift.data.card.id, 'assembly');

  // 剩下的五张都选第一个选项，一路盖到值班结束。
  for (let i = 0; i < 5; i += 1) {
    shift.choose(ev(shift.data.card.choices[0].id));
    assert.equal(shift.data.phase, 'result');
    shift.next();
  }
  assert.equal(store.read().decisions.length, 6);
  assert.equal(routes.at(-1), '/pages/culture/culture');

  const culture = page('culture');
  culture.onShow();
  assert.equal(culture.data.portrait.trust, store.read().trust);
  assert.equal(culture.data.portrait.ranked.length, 4);
  assert.ok(culture.data.portrait.highlights.length > 0);
  culture.choose({ currentTarget: { dataset: { value: c.actions[0] } } });
  culture.save();
  assert.equal(store.read().completed, true);

  const home = page('home');
  home.onShow();
  assert.equal(home.data.percent, 80);
  assert.equal(home.data.shiftTag, '已点亮');

  // 两个可选章节答对后到 100%，首页继续探索直接去画像。
  const mission = page('mission');
  mission.onLoad({ stage: '2' });
  mission.next();
  mission.next();
  assert.equal(mission.data.phase, 'quiz');
  mission.answer(ev('eu'));
  assert.equal(store.read().missions['2'], true);
  mission.onLoad({ stage: '3' });
  mission.answer(ev('fit'));
  assert.equal(store.read().missions['3'], true);

  home.onShow();
  assert.equal(home.data.percent, 100);
  assert.equal(home.data.active, 6);
  home.start();
  assert.equal(routes.at(-1), '/pages/culture/culture');
});

test('值班页滑动盖章：右滑放行、左滑退回，结果页不会重复盖章', () => {
  const { store } = setup();
  passPrologue(store);
  const shift = page('shift');
  shift.onShow();

  shift.next();
  assert.equal(shift.data.card.id, 'rush');
  assert.equal(store.read().decisions.length, 0);

  shift.swipeStart({ touches: [{ clientX: 300, clientY: 300 }] });
  shift.swipeEnd({ changedTouches: [{ clientX: 100, clientY: 305 }] });
  assert.equal(store.read().decisions[0].choiceId, 'return');
  assert.equal(shift.data.phase, 'result');

  shift.swipeEnd({ changedTouches: [{ clientX: 100, clientY: 300 }] });
  assert.equal(store.read().decisions.length, 1);

  shift.next();
  shift.swipeStart({ touches: [{ clientX: 100, clientY: 300 }] });
  shift.swipeEnd({ changedTouches: [{ clientX: 300, clientY: 300 }] });
  assert.equal(store.read().decisions[1].choiceId, 'observe');
  assert.equal(shift.data.phase, 'result');
  shift.swipeCancel();
  assert.equal(shift.swipeOrigin, null);
});

test('三选一的卡片只用按钮，滑动不会误盖', () => {
  const { store } = setup();
  passPrologue(store);
  const shift = page('shift');
  shift.onShow();
  for (let i = 0; i < 5; i += 1) {
    shift.choose(ev(shift.data.card.choices[0].id));
    shift.next();
  }
  // 第六张（新项目）有三个选项，没有盖章对，滑动不生效。
  assert.equal(shift.data.card.id, 'project');
  assert.equal(shift.data.twoStamps, false);
  shift.swipeStart({ touches: [{ clientX: 300, clientY: 300 }] });
  shift.swipeEnd({ changedTouches: [{ clientX: 100, clientY: 300 }] });
  assert.equal(store.read().decisions.length, 5);
  shift.choose(ev('max'));
  assert.equal(store.read().decisions.length, 6);
});

test('深链进入值班页或画像页时前置条件不足会重定向', () => {
  const { routes, store } = setup();
  page('shift').onLoad();
  assert.equal(routes.at(-1), '/pages/prologue/prologue');
  page('culture').onShow();
  assert.equal(routes.at(-1), '/pages/prologue/prologue');

  passPrologue(store);
  page('culture').onShow();
  assert.equal(routes.at(-1), '/pages/shift/shift');
});

test('存档跨模块重载恢复；写入失败提示且保留会话进度，支持重试', () => {
  const { store } = setup();
  passPrologue(store);
  store.dispatch('choose', { cardId: 'rush', choiceId: 'return' });
  delete require.cache[require.resolve('../miniprogram/utils/storage')];
  const reopened = require('../miniprogram/utils/storage');
  assert.equal(reopened.read().decisions.length, 1);
  assert.equal(reopened.read().trust, 54);

  wx.setStorageSync = () => {
    throw Error('quota');
  };
  reopened.dispatch('choose', { cardId: 'assembly', choiceId: 'refit' });
  assert.equal(reopened.read().decisions.length, 2);
  assert.match(reopened.warning(), /保存失败/);
  wx.setStorageSync = () => {};
  reopened.write(reopened.read());
  assert.equal(reopened.warning(), '');
});

test('探索档案显示信任值、印记与值班进度，清档可重来', () => {
  const { store } = setup();
  passPrologue(store);
  store.dispatch('choose', { cardId: 'rush', choiceId: 'return' });

  const progress = page('progress');
  progress.onShow();
  assert.equal(progress.data.trust, 54);
  assert.equal(progress.data.stages[1].name, '质量值班（已盖 1 / 6 份）');
  assert.equal(progress.data.stages[1].done, false);
  assert.equal(progress.data.marks.find((m) => m.name === '精进').value, 2);
  assert.match(progress.data.level.label, /尾巴|值班员|在岗人|雷/);

  // 取消不清档，确认才重来。
  wx.showModal = (options) => options.success({ confirm: false });
  progress.reset();
  assert.equal(store.read().decisions.length, 1);

  wx.showModal = (options) => options.success({ confirm: true });
  progress.reset();
  assert.equal(store.read().decisions.length, 0);
  assert.equal(store.read().prologueDone, false);
  assert.equal(progress.data.trust, 60);
  assert.equal(progress.data.percent, 0);
});
