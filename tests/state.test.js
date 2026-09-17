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

/** 走完两个章节小游戏：认证全配对 + 满分组方案。 */
function finishChapters(s) {
  let next = s;
  for (const [market, cert] of Object.entries(content.certGame.answer)) {
    next = advance(next, 'certMatch', { market, cert });
  }
  return advance(next, 'solution', { picks: content.solutionGame.perfect });
}

/** 两个章节小游戏对应的进度事件，供「每一步都可达」的用例使用。 */
function chapterSteps() {
  return [
    ...Object.entries(content.certGame.answer).map(([market, cert]) => [
      'certMatch',
      { market, cert }
    ]),
    ['solution', { picks: content.solutionGame.perfect }]
  ];
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

  s = finishChapters(s);
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
    assert.equal(s.version, 5);
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
    ...chapterSteps(),
    ['complete', content.actions[1]]
  ];
  for (const [event, payload] of steps) {
    const card = currentCard(s);
    let args = payload;
    if (event === 'choose') args = { cardId: card.id, choiceId: payload };
    if (event === 'complete') args = content.actions[1];
    s = normalize(JSON.parse(JSON.stringify(advance(s, event, args))));
    assert.ok(percent(s) >= previous);
    previous = percent(s);
  }
  assert.equal(s.completed, true);
  assert.equal(percent(s), 100);
});

test('第二章认证配对：错配记错并解释，配满三对才通关', () => {
  let s = started();
  const answer = content.certGame.answer;
  const [firstMarket] = Object.keys(answer);
  const wrongCert = content.certGame.certs.find((cert) => cert.id !== answer[firstMarket]).id;

  s = advance(s, 'certMatch', { market: firstMarket, cert: wrongCert });
  assert.equal(s.missions['2'], false);
  assert.equal(s.mistakes, 1);
  assert.equal(s.games.cert.matched.length, 0);

  s = advance(s, 'certMatch', { market: firstMarket, cert: answer[firstMarket] });
  assert.deepEqual(s.games.cert.matched, [firstMarket]);
  assert.equal(s.missions['2'], false, '配对一个市场还不算通关');

  // 同一个市场重复提交不再计数
  s = advance(s, 'certMatch', { market: firstMarket, cert: answer[firstMarket] });
  assert.equal(s.mistakes, 1);

  for (const market of Object.keys(answer)) {
    s = advance(s, 'certMatch', { market, cert: answer[market] });
  }
  assert.equal(s.missions['2'], true);
  assert.equal(s.marks.守正, 1);
  assert.equal(s.marks.精进, 1);
  assert.equal(s.marks.创新, 0);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))).missions, s.missions);
});

test('第三章方案组卡：缺必需项被客户打回，满分组才拿满印记', () => {
  let s = started();
  s = advance(s, 'solution', { picks: ['loops', 'report', 'ota'] });
  assert.equal(s.games.solution.done, false, '不看回路和告警的方案不成立');
  assert.equal(s.mistakes, 1);

  s = advance(s, 'solution', { picks: ['loops', 'alarm'] });
  assert.equal(s.games.solution.done, false, '必须凑满预算三张');

  // 可行解：回路 + 告警 + 任意一张
  s = advance(s, 'solution', { picks: ['loops', 'alarm', 'report'] });
  assert.equal(s.games.solution.done, true);
  assert.equal(s.games.solution.perfect, false);
  assert.equal(s.missions['3'], true);
  assert.equal(s.marks.务实, 1);
  assert.equal(s.marks.创新, 1, '章节印章只看是否通关');

  // 重开一次：满分组
  let full = started();
  full = advance(full, 'solution', { picks: content.solutionGame.perfect });
  assert.equal(full.games.solution.perfect, true);
  assert.deepEqual(full.games.solution.picks, content.solutionGame.perfect);

  // 伪造的卡 id 会被忽略
  const forged = normalize({
    version: 5,
    games: { solution: { done: true, picks: ['loops', 'alarm', 'hacked'], perfect: true } }
  });
  assert.equal(forged.games.solution.done, false);
});

test('旧存档（v4）的章节进度会迁移成小游戏记录', () => {
  const migrated = normalize({ version: 4, prologueDone: true, missions: { 2: true, 3: true } });
  assert.deepEqual(migrated.missions, { 2: true, 3: true });
  assert.equal(migrated.games.cert.matched.length, content.certGame.markets.length);
  assert.equal(migrated.games.solution.perfect, true);
  assert.equal(migrated.marks.守正, 1);
  assert.equal(migrated.marks.创新, 1);
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

test('打卡答题：答对才点亮，答错只计错并给解释', () => {
  let s = started();
  const quest = content.quests[0];
  const wrong = (quest.answer + 1) % quest.options.length;

  s = advance(s, 'checkin', { questId: quest.id, choice: wrong });
  assert.equal(s.checkins[quest.id], false);
  assert.equal(s.mistakes, 1);

  s = advance(s, 'checkin', { questId: quest.id, choice: quest.answer });
  assert.equal(s.checkins[quest.id], true);
  // culture 展区对应「务实」印记
  assert.equal(s.marks.务实, 1);
  assert.equal(s.mistakes, 1);

  s = advance(s, 'checkin', { questId: 'not-a-quest', choice: 0 });
  assert.equal(Object.keys(s.checkins).length, content.quests.length);
});

test('小游戏成绩：配对、三消、答题各自记分，答题可以重来', () => {
  let s = started();
  assert.deepEqual(s.games, {
    flip: { done: false, moves: 0, seconds: 0 },
    quiz: { done: false, score: 0, results: [] },
    cert: { matched: [] },
    solution: { done: false, picks: [], perfect: false },
    hop: { done: false, tile: 0, right: 0, wrong: 0 }
  });

  s = advance(s, 'flipResult', { moves: 14, seconds: 75 });
  assert.deepEqual(s.games.flip, { done: true, moves: 14, seconds: 75 });

  // 答题：必须按顺序提交，乱序被忽略
  s = advance(s, 'quizAnswer', { index: 1, choice: 0 });
  assert.equal(s.games.quiz.results.length, 0);
  content.quizBank.forEach((question, index) => {
    s = advance(s, 'quizAnswer', { index, choice: question.ans });
  });
  assert.equal(s.games.quiz.done, true);
  assert.equal(s.games.quiz.score, 100);
  assert.equal(s.games.quiz.results.length, content.quizBank.length);

  s = advance(s, 'quizReset');
  assert.deepEqual(s.games.quiz, { done: false, score: 0, results: [] });

  // 只答对一半就是 50 分
  content.quizBank.forEach((question, index) => {
    const choice = index % 2 === 0 ? question.ans : (question.ans + 1) % question.opts.length;
    s = advance(s, 'quizAnswer', { index, choice });
  });
  assert.equal(s.games.quiz.score, 50);
});

test('伪造的小游戏成绩会被清洗', () => {
  const fake = normalize({
    version: 4,
    games: {
      flip: { done: true, moves: 99999, seconds: -5 },
      quiz: { done: true, results: [true, true] }
    }
  });
  assert.equal(fake.games.flip.moves, 999);
  assert.equal(fake.games.flip.seconds, 0);
  assert.equal(fake.games.quiz.done, false, '答题记录不完整就不算完成');
  assert.equal(fake.games.quiz.score, 20, '分数按已记录的题重算（2 / 10 题）');
});

test('任务清单、进度与全部通关判定', () => {
  let s = normalize({ version: 4 });
  const empty = state.taskProgress(s);
  assert.equal(empty.done, 0, '全新存档一项都没完成');
  assert.equal(empty.total, state.tasks(s).length);
  assert.equal(state.allDone(s), false);
  assert.equal(state.taskProgress(s).done < state.taskProgress(s).total, true);
  assert.equal(
    state.tasks(s).some((task) => task.id === 'quiz' && !task.done),
    true
  );

  s = play(GOOD);
  s = advance(s, 'complete', content.actions[0]);
  for (const quest of content.quests)
    s = advance(s, 'checkin', { questId: quest.id, choice: quest.answer });
  s = advance(s, 'flipResult', { moves: 16, seconds: 60 });
  content.quizBank.forEach((question, index) => {
    s = advance(s, 'quizAnswer', { index, choice: question.ans });
  });
  s = finishChapters(s);
  for (let step = 0; step < content.hopGame.tiles.length; step += 1) {
    const tile = s.games.hop.tile;
    s = advance(s, 'hopAnswer', { index: tile, choice: content.hopGame.tiles[tile].answer });
  }

  assert.equal(state.allDone(s), true);
  assert.deepEqual(state.taskProgress(s), {
    done: state.taskProgress(s).total,
    total: state.taskProgress(s).total
  });

  const board = state.scoreboard(s);
  assert.equal(board.trust, 85);
  assert.equal(board.quiz.score, 100);
  assert.equal(board.flip.moves, 16);
  assert.equal(board.grade.code, 'S', '信任 85 + 答题满分 + 配对 16 步');

  // 全部通关后存档仍然可以安全序列化回来
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))), s);
});

test('通关评级按成绩分档', () => {
  const base = () => {
    const s = normalize({ version: 4 });
    s.games = {
      flip: { done: true, moves: 24, seconds: 90 },
      quiz: { done: true, score: 70, results: content.quizBank.map(() => true) }
    };
    s.trust = 75;
    return s;
  };
  assert.equal(state.grade(base()).code, 'A');

  const weak = base();
  weak.trust = 40;
  weak.games.quiz.score = 30;
  assert.equal(state.grade(weak).code, 'B');

  const perfect = base();
  perfect.trust = 90;
  perfect.games.flip.moves = 12;
  perfect.games.quiz.score = 90;
  assert.equal(state.grade(perfect).code, 'S');
  assert.ok(state.grade(perfect).comment.length > 0);
});

test('文化跳格子：答对前进一格，答错停在原格重选', () => {
  const tiles = content.hopGame.tiles;
  let s = started();
  assert.deepEqual(s.games.hop, { done: false, tile: 0, right: 0, wrong: 0 });

  // 乱序提交被忽略
  s = advance(s, 'hopAnswer', { index: 3, choice: tiles[3].answer });
  assert.equal(s.games.hop.tile, 0);

  s = advance(s, 'hopAnswer', { index: 0, choice: tiles[0].answer });
  assert.deepEqual(s.games.hop, { done: false, tile: 1, right: 1, wrong: 0 });

  // 答错：停在原格，只记错，等玩家重选
  s = advance(s, 'hopAnswer', {
    index: 1,
    choice: (tiles[1].answer + 1) % tiles[1].options.length
  });
  assert.equal(s.games.hop.tile, 1, '答错停在原格');
  assert.equal(s.games.hop.wrong, 1);
  assert.equal(s.games.hop.right, 1);
  assert.equal(s.mistakes, 1, '答错也记一次错');

  // 同一格重新选对：前进一格
  s = advance(s, 'hopAnswer', { index: 1, choice: tiles[1].answer });
  assert.equal(s.games.hop.tile, 2);
  assert.equal(s.games.hop.right, 2);

  // 一路答对走到终点
  let run = started();
  for (let step = 0; step < tiles.length; step += 1) {
    const tile = run.games.hop.tile;
    run = advance(run, 'hopAnswer', { index: tile, choice: tiles[tile].answer });
  }
  assert.equal(run.games.hop.tile, tiles.length);
  assert.equal(run.games.hop.done, true);
  assert.equal(run.games.hop.right, tiles.length);
  // 通关后再提交不会继续加
  run = advance(run, 'hopAnswer', { index: 11, choice: 0 });
  assert.equal(run.games.hop.right, tiles.length);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(run))).games.hop, run.games.hop);
});

test('伪造的跳格子记录会被夹回合法范围', () => {
  const forged = normalize({ version: 5, games: { hop: { tile: 99, right: -3, wrong: 1000 } } });
  assert.equal(forged.games.hop.tile, content.hopGame.tiles.length);
  assert.equal(forged.games.hop.right, 0);
  assert.equal(forged.games.hop.wrong, 999);
  assert.equal(forged.games.hop.done, true, '位置在终点就算通关');

  const midway = normalize({ version: 5, games: { hop: { tile: 4, right: 5, wrong: 1 } } });
  assert.equal(midway.games.hop.done, false);
  assert.equal(midway.games.hop.tile, 4);
});

test('企业文化模块完成度决定小游戏是否解锁', () => {
  let s = started();
  assert.equal(state.cultureDone(s), false, '刚说完使命，模块还没开始');

  s = play(GOOD);
  s = advance(s, 'complete', content.actions[0]);
  for (const quest of content.quests)
    s = advance(s, 'checkin', { questId: quest.id, choice: quest.answer });
  assert.equal(state.cultureDone(s), false, '还差两个章节互动关卡');

  s = finishChapters(s);
  assert.equal(state.cultureDone(s), true);
  assert.equal(state.allDone(s), false, '小游戏还没做，不算全部通关');

  const task = state.tasks(s).find((item) => item.id === 'hop');
  assert.equal(task.page, '/pages/hop/hop');
  assert.equal(task.done, false);
});
