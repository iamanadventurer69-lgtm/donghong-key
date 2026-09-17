const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const c = require('../miniprogram/data/content');
const state = require('../miniprogram/utils/state');

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
  p.setData = (d) => {
    for (const [key, value] of Object.entries(d)) setPath(p.data, key, value);
  };
  return p;
}

/** 模拟小程序 setData 的路径写法：cards[0].up / a.b.c。 */
function setPath(target, key, value) {
  const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (node[keys[i]] === undefined) node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 只把「企业文化模块」做满：序章 + 值班 + 四展区打卡 + 两个章节小游戏。 */
function finishCulture(store) {
  for (const event of ['prologue', 'prologue', 'mission']) store.dispatch(event);
  for (const choiceId of ['return', 'refit', 'extra', 'refuse', 'standard', 'fit']) {
    const card = state.currentCard(store.read());
    store.dispatch('choose', { cardId: card.id, choiceId });
  }
  for (const quest of c.quests)
    store.dispatch('checkin', { questId: quest.id, choice: quest.answer });
  for (const [market, cert] of Object.entries(c.certGame.answer)) {
    store.dispatch('certMatch', { market, cert });
  }
  store.dispatch('solution', { picks: c.solutionGame.perfect });
}

const tapCell = (row, col) => ({ currentTarget: { dataset: { row, col } } });

/** 把整局做满：主线、打卡、三个小游戏、二三章。 */
function finishEverything(store) {
  for (const event of ['prologue', 'prologue', 'mission']) store.dispatch(event);
  for (const choiceId of ['return', 'refit', 'extra', 'refuse', 'standard', 'fit']) {
    const card = state.currentCard(store.read());
    store.dispatch('choose', { cardId: card.id, choiceId });
  }
  store.dispatch('complete', c.actions[0]);
  for (const quest of c.quests)
    store.dispatch('checkin', { questId: quest.id, choice: quest.answer });
  store.dispatch('flipResult', { moves: 16, seconds: 60 });
  for (let step = 0; step < c.hopGame.tiles.length; step += 1) {
    const tile = store.read().games.hop.tile;
    store.dispatch('hopAnswer', { index: tile, choice: c.hopGame.tiles[tile].answer });
  }
  c.quizBank.forEach((question, index) =>
    store.dispatch('quizAnswer', { index, choice: question.ans })
  );
  for (const [market, cert] of Object.entries(c.certGame.answer)) {
    store.dispatch('certMatch', { market, cert });
  }
  store.dispatch('solution', { picks: c.solutionGame.perfect });
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
  // 领完密钥必须跳到主线第一关（历史上这里写死过一个被删掉的页面路径）
  assert.equal(routes.at(-1), '/pages/shift/shift');

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
  assert.match(home.data.cultureTag, /^\d+ \/ \d+$/);
  assert.equal(home.data.gameTag, '未解锁', '企业文化模块没做完，小游戏还没解锁');

  // 两个可选章节答对后到 100%，首页继续探索直接去画像。
  const cert = page('cert');
  cert.onLoad();
  cert.onShow();
  for (const [market, answer] of Object.entries(c.certGame.answer)) {
    cert.tapMarket({ currentTarget: { dataset: { id: market } } });
    cert.tapCert({ currentTarget: { dataset: { id: answer } } });
  }
  assert.equal(store.read().missions['2'], true);
  assert.equal(cert.data.done, true);

  const solution = page('solution');
  solution.onShow();
  c.solutionGame.perfect.forEach((id) => {
    solution.tapCard({ currentTarget: { dataset: { id } } });
  });
  solution.submit();
  assert.equal(store.read().missions['3'], true);
  assert.equal(solution.data.perfect, true);

  home.onShow();
  assert.equal(home.data.percent, 100);
  assert.equal(home.data.active, 6);
  home.start();
  assert.equal(routes.at(-1), '/pages/culture/culture');
});

test('值班页滑动判断：右滑通过、左滑退回，结果页不会重复提交', () => {
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
  assert.equal(progress.data.reward.done, 1, '只完成序章与一张材料 → 任务 1 / 11');
  assert.match(progress.data.reward.next, /接下来：/);
  assert.equal(progress.data.scores.flip, '未完成');
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
test('企业文化模块：打卡弹层先看内容再答题，答对才点亮', () => {
  const { store } = setup();
  const quest = page('quest');
  quest.onShow();
  assert.equal(quest.data.moduleDone, false);
  assert.equal(quest.data.checkins.length, c.quests.length);
  assert.equal(quest.data.gates.length, 3);

  quest.openQuest({ currentTarget: { dataset: { id: 'culture' } } });
  assert.equal(quest.data.questOpen, true);
  assert.equal(quest.data.quest.id, 'culture');

  const wrong = (quest.data.quest.answer + 1) % quest.data.quest.options.length;
  quest.pick({ currentTarget: { dataset: { index: wrong } } });
  assert.equal(quest.data.right, false);
  assert.equal(store.read().checkins.culture, false);
  assert.equal(store.read().mistakes, 1);

  quest.restart();
  quest.pick({ currentTarget: { dataset: { index: quest.data.quest.answer } } });
  assert.equal(quest.data.right, true);
  assert.equal(store.read().checkins.culture, true);
  assert.equal(store.read().marks.务实, 1, '答对文化坐标的题会给「务实」记一分');

  quest.closeQuest();
  quest.onShow();
  assert.equal(quest.data.checkins.find((item) => item.id === 'culture').done, true);
  assert.equal(quest.data.progress.done, 1);
  // 模块没做完，小游戏入口应当是锁着的
  assert.equal(quest.data.moduleDone, false);
});

test('闯关中心：全部完成后自动弹出通关结算，并给出评级与成绩明细', () => {
  const { store, routes } = setup();
  finishEverything(store);

  const quest = page('quest');
  quest.onShow();
  assert.equal(quest.data.moduleDone, true, '企业文化模块应当已完成');
  assert.equal(quest.data.allDone, true);
  assert.equal(quest.data.finalOpen, true, '全部通关时自动弹结算');
  assert.equal(quest.data.grade.code, 'S');
  assert.deepEqual(quest.data.progress, {
    done: quest.data.progress.total,
    total: quest.data.progress.total
  });
  assert.equal(quest.data.scoreboard.quiz.score, 100);
  assert.equal(quest.data.scoreboard.trust, 85);

  quest.closeFinal();
  assert.equal(quest.data.finalOpen, false);
  quest.openFinal();
  assert.equal(quest.data.finalOpen, true);
  quest.home();
  assert.equal(routes.at(-1), '/pages/home/home');
});

test('模块配对：逐步翻开八对，通关后写入成绩', () => {
  const { store } = setup();
  const flip = page('flip');
  flip.onShow();
  assert.equal(flip.data.cards.length, c.memory.length);
  assert.equal(flip.data.pairTotal, c.memory.length / 2);

  // 按 pair 分组，逐对翻开
  const groups = {};
  flip.data.cards.forEach((card, index) => {
    groups[card.pair] = groups[card.pair] || [];
    groups[card.pair].push(index);
  });
  Object.values(groups).forEach((indexes) => {
    indexes.forEach((index) => flip.tap({ currentTarget: { dataset: { index } } }));
  });

  assert.equal(flip.data.matched, flip.data.pairTotal);
  assert.equal(flip.data.won, true);
  assert.equal(store.read().games.flip.done, true);
  assert.equal(store.read().games.flip.moves, flip.data.pairTotal);

  // 重新开始：牌面全部复位，同一张牌点两次不算步数
  flip.restart();
  assert.equal(
    flip.data.cards.every((card) => !card.up && !card.done),
    true
  );
  flip.tap({ currentTarget: { dataset: { index: 0 } } });
  flip.tap({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(flip.data.moves, 0);
  flip.onUnload(); // 收掉计时器，别让测试进程挂着
});

test('知识答题：十题答完给总分与逐题回顾，可以重新挑战', () => {
  const { store } = setup();
  const quiz = page('quiz');
  quiz.onShow();

  c.quizBank.forEach((question, index) => {
    assert.equal(quiz.data.index, index, '题目按顺序出现');
    quiz.pick({ currentTarget: { dataset: { index: question.ans } } });
    assert.equal(quiz.data.answered, true);
    assert.equal(quiz.data.dots[index].state, 'done');
    quiz.next();
  });

  assert.equal(quiz.data.finished, true);
  assert.equal(quiz.data.score, 100);
  assert.equal(quiz.data.review.length, c.quizBank.length);
  assert.equal(store.read().games.quiz.done, true);

  quiz.restart();
  assert.equal(quiz.data.finished, false);
  assert.equal(quiz.data.index, 0);
  assert.equal(store.read().games.quiz.results.length, 0);
  assert.equal(store.read().games.quiz.done, false);

  // 答错一题：进度点标红，总分按比例
  quiz.pick({ currentTarget: { dataset: { index: (c.quizBank[0].ans + 1) % 4 } } });
  assert.equal(quiz.data.dots[0].state, 'wrong');
  quiz.next();
  assert.equal(quiz.data.index, 1);
});

test('认证配对：先选市场再选卡，配错会抖动并解释，配完可进下一关', () => {
  const { store, routes } = setup();
  const cert = page('cert');
  cert.onLoad();
  cert.onShow();
  assert.equal(cert.data.markets.length, c.certGame.markets.length);
  assert.equal(cert.data.certs.length, c.certGame.certs.length);

  // 没选市场就点卡
  cert.tapCert({ currentTarget: { dataset: { id: c.certGame.certs[0].id } } });
  assert.match(cert.data.feedback, /先点左边的市场/);

  // 选错卡：抖动 + 记错 + 不点亮
  const market = c.certGame.markets[0].id;
  const wrong = c.certGame.certs.find((item) => item.id !== c.certGame.answer[market]).id;
  cert.tapMarket({ currentTarget: { dataset: { id: market } } });
  cert.tapCert({ currentTarget: { dataset: { id: wrong } } });
  assert.equal(cert.data.shake, true);
  assert.match(cert.data.feedback, /另一个市场/);
  assert.equal(store.read().games.cert.matched.length, 0);
  assert.equal(store.read().mistakes, 1);
  cert.again();

  // 配对成功：市场卡片显示认证名，卡变灰
  for (const [id, answer] of Object.entries(c.certGame.answer)) {
    cert.tapMarket({ currentTarget: { dataset: { id } } });
    cert.tapCert({ currentTarget: { dataset: { id: answer } } });
  }
  assert.equal(cert.data.matchedCount, c.certGame.markets.length);
  assert.equal(cert.data.done, true);
  assert.equal(
    cert.data.markets.every((item) => item.done),
    true
  );
  assert.equal(
    cert.data.certs.every((item) => item.used),
    true
  );
  cert.next();
  assert.equal(routes.at(-1), '/pages/solution/solution');
  cert.onUnload();
});

test('方案组卡：预算限制、必需项校验与满分组反馈', () => {
  const { store, routes } = setup();
  const solution = page('solution');
  solution.onShow();

  // 超过预算被拦下
  const ids = c.solutionGame.cards.map((card) => card.id);
  ids.slice(0, 3).forEach((id) => solution.tapCard({ currentTarget: { dataset: { id } } }));
  solution.tapCard({ currentTarget: { dataset: { id: ids[3] } } });
  assert.match(solution.data.feedback, /预算只有 3 张卡/);
  assert.equal(solution.data.pickedCount, 3);

  // 张数不够不能提交
  solution.tapCard({ currentTarget: { dataset: { id: ids[0] } } });
  solution.submit();
  assert.match(solution.data.feedback, /现在选了 2 张/);

  // 缺必需项：客户打回，但不卡流程
  solution.tapCard({ currentTarget: { dataset: { id: 'report' } } });
  solution.tapCard({ currentTarget: { dataset: { id: 'ota' } } });
  solution.tapCard({ currentTarget: { dataset: { id: 'store' } } });
  solution.submit();
  assert.equal(solution.data.done, false);
  assert.match(solution.data.feedback, /解决不了他的问题/);

  // 满分组
  solution.onShow();
  c.solutionGame.perfect.forEach((id) => solution.tapCard({ currentTarget: { dataset: { id } } }));
  solution.submit();
  assert.equal(solution.data.done, true);
  assert.equal(solution.data.perfect, true);
  assert.equal(store.read().games.solution.picks.length, c.solutionGame.quota);
  solution.finish();
  assert.equal(routes.at(-1), '/pages/quest/quest');
});
