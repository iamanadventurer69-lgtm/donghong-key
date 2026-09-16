const { test } = require('node:test');
const assert = require('node:assert/strict');
const state = require('../miniprogram/utils/state');
const content = require('../miniprogram/data/content');
const { initial, normalize, advance, percent, route, portrait, currentCard } = state;
const CARDS = state.CARDS;

/** 走完序章，拿到使命密钥，站在第一张卡前。 */
function started() {
  let s = initial();
  for (const event of ['prologue', 'prologue', 'mission']) s = advance(s, event);
  return s;
}

/** 按顺序盖完卡；choices 长度可以少于卡数（后面的卡留在未完成状态）。 */
function play(choices) {
  let s = started();
  for (const choiceId of choices) {
    const card = currentCard(s);
    s = advance(s, 'choose', { cardId: card.id, choiceId });
  }
  return s;
}

/** 好路径：拦下超阈值批次、重装模块、补高温工况、拒绝先发、交付方法、方案对口。 */
const GOOD = ['return', 'refit', 'extra', 'refuse', 'standard', 'fit'];
/** 坏路径：一路"先发再说"。 */
const BAD = ['release', 'observe', 'process', 'allow', 'blame', 'max'];

test('完整路径：序章、六份材料盖章、二三章、行动承诺后达到 100%', () => {
  let s = play(GOOD);
  assert.equal(s.decisions.length, CARDS.length);
  assert.equal(currentCard(s), null);
  assert.equal(percent(s), 70);
  assert.equal(route(s), '/pages/culture/culture');

  s = advance(s, 'missionQuiz', '2:correct');
  s = advance(s, 'missionQuiz', '3:correct');
  assert.equal(percent(s), 90);
  assert.equal(s.completed, false);

  s = advance(s, 'complete', content.actions[0]);
  assert.equal(s.completed, true);
  assert.equal(percent(s), 100);
  assert.equal(route(s), '/pages/culture/culture');
});

test('前置条件：没说使命不能值班，没盖完不能承诺，同一张卡不能重复盖', () => {
  let s = initial();
  assert.equal(route(s), '/pages/prologue/prologue');
  s = advance(s, 'choose', { cardId: 'rush', choiceId: 'release' });
  assert.equal(s.decisions.length, 0);
  assert.equal(percent(s), 0);

  s = started();
  assert.equal(route(s), '/pages/shift/shift');
  s = advance(s, 'complete', content.actions[0]);
  assert.equal(s.completed, false);
  assert.equal(s.pledge, '');

  // 重复提交同一张卡：第一次生效，第二次被忽略。
  s = advance(s, 'choose', { cardId: 'rush', choiceId: 'return' });
  s = advance(s, 'choose', { cardId: 'rush', choiceId: 'release' });
  assert.deepEqual(s.decisions, [{ cardId: 'rush', choiceId: 'return' }]);

  // 塞一张不在卡组里的卡也不会推进。
  s = advance(s, 'choose', { cardId: 'unknown', choiceId: 'release' });
  assert.equal(s.decisions.length, 1);
});

test('信任值与印记由决定重算，且信任值有上下限', () => {
  const good = play(GOOD);
  const bad = play(BAD);
  assert.equal(good.trust, 85);
  assert.equal(bad.trust, 0); // 一路放行会把信任打到下限
  assert.deepEqual(good.marks, { 守正: 3, 务实: 3, 创新: 3, 精进: 8 });
  assert.equal(good.marks.守正 - bad.marks.守正 > 0, true);

  // 存档里写死数值也没用：读出来一定被决定重算覆盖。
  const forged = normalize({ ...play(['return']), trust: 100, marks: { 守正: 99 } });
  assert.equal(forged.trust, 54);
  assert.equal(forged.marks.守正, 0);
});

test('延迟后果：第一张放行后，第五张变成客户投诉变体', () => {
  const riskyPath = play(['release', 'observe', 'process', 'allow']);
  assert.equal(riskyPath.flags.shipRisky, true);
  const complaint = currentCard(riskyPath);
  assert.equal(complaint.id, 'callback');
  assert.equal(complaint.title, '三个月前那批表');
  assert.equal(complaint.variant, undefined);

  const safePath = play(['return', 'refit', 'extra', 'refuse']);
  assert.equal(safePath.flags.shipRisky, undefined);
  const fifth = currentCard(safePath);
  assert.equal(fifth.id, 'callback');
  assert.equal(fifth.title, '上次被你们拦下的那批');
  assert.equal(fifth.variant, undefined);

  // 变体只影响当次展示，原始数据不被改写
  assert.equal(content.shifts[0].cards[4].title, '上次被你们拦下的那批');
  assert.equal(content.shifts[0].cards[4].variant.when, 'shipRisky');
  assert.deepEqual(
    content.shifts[0].cards.map((card) => card.id),
    ['rush', 'assembly', 'manual', 'pending', 'callback', 'project']
  );
});

test('缺失、旧版本和伪造存档安全回退', () => {
  for (const input of [
    null,
    undefined,
    'broken',
    { version: 9 },
    { version: 1, step: 900, inspected: ['fake'], assembled: ['fake'], completed: true },
    { version: 2, decisions: 'nope', completed: true }
  ]) {
    const s = normalize(input);
    assert.equal(s.version, 3);
    assert.equal(s.completed, false);
    assert.equal(s.decisions.length, 0);
    assert.equal(s.trust, content.shifts[0].trust);
    assert.equal(percent(s), 0);
  }

  // 已完成的旧存档不再解锁任何进度，但序章进度保留。
  const old = normalize({ version: 2, prologue: 2, prologueDone: true, completed: true });
  assert.equal(old.prologueDone, true);
  assert.equal(old.completed, false);
  assert.equal(route(old), '/pages/shift/shift');
});

test('伪造的决定会被截断在第一个对不上的地方', () => {
  const s = normalize({
    version: 3,
    prologueDone: true,
    decisions: [
      { cardId: 'rush', choiceId: 'return' },
      { cardId: 'assembly', choiceId: 'not-a-choice' },
      { cardId: 'manual', choiceId: 'extra' }
    ]
  });
  assert.deepEqual(s.decisions, [{ cardId: 'rush', choiceId: 'return' }]);
  assert.equal(s.trust, 54);

  const tooMany = normalize({
    version: 3,
    decisions: [...GOOD, ...GOOD].map((choiceId, index) => ({
      cardId: CARDS[index % CARDS.length].id,
      choiceId
    }))
  });
  assert.equal(tooMany.decisions.length, CARDS.length);
});

test('每个进度检查点恢复后的下一步保持可达', () => {
  let s = started();
  let previous = percent(s);
  const steps = [
    ...GOOD.map((id) => ['choose', id]),
    ['missionQuiz', '2:correct'],
    ['missionQuiz', '3:correct'],
    ['complete', content.actions[1]]
  ];
  for (const [event, payload] of steps) {
    const card = currentCard(s);
    const args = event === 'choose' ? { cardId: card.id, choiceId: payload } : payload;
    s = normalize(JSON.parse(JSON.stringify(advance(s, event, args))));
    assert.ok(percent(s) >= previous);
    previous = percent(s);
  }
  assert.equal(s.completed, true);
  assert.equal(percent(s), 100);
});

test('第二、三章的答题独立保存，并给对应价值观记一分', () => {
  let s = started();
  s = advance(s, 'missionQuiz', '2:wrong');
  assert.equal(s.missions['2'], false);
  assert.equal(s.mistakes, 1);
  assert.equal(s.marks.守正, 0);

  s = advance(s, 'missionQuiz', '2:correct');
  assert.equal(s.missions['2'], true);
  assert.equal(s.marks.守正, 1);
  assert.equal(s.marks.精进, 1);
  assert.equal(s.marks.创新, 0);

  s = advance(s, 'missionQuiz', '3:correct');
  assert.deepEqual(s.missions, { 2: true, 3: true });
  assert.equal(s.marks.务实, 1);
  assert.equal(s.marks.创新, 1);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))).marks, s.marks);
});

test('结算画像给出分档、主印记与关键行为', () => {
  const good = portrait(play(GOOD));
  assert.equal(good.trust, 85);
  assert.equal(good.level.label, '可靠的在岗人');
  assert.equal(good.top, '精进');
  assert.equal(good.style.title, '持续验证者');
  assert.equal(good.highlights.length, 3);
  // 影响最大的三条排在前面
  assert.deepEqual(
    good.highlights.map((item) => Math.abs(item.trust)),
    [...good.highlights.map((item) => Math.abs(item.trust))].sort((a, b) => b - a)
  );

  const bad = portrait(play(BAD));
  assert.equal(bad.level.label, '账面上干净，现场有雷');
  assert.ok(bad.ranked.find((item) => item.name === '守正').value < 0);

  const empty = portrait(normalize({ version: 3 }));
  assert.equal(empty.top, null);
  assert.equal(empty.highlights.length, 0);
});
