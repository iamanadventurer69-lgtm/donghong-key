/**
 * 全局状态机：存档结构、清洗与推进规则、任务清单、结算画像与通关评级。
 *
 * 设计要点：存档只记「做过什么」（值班的每次盖章、每个展区的打卡答案、
 * 每个小游戏的成绩与答题记录），信任值、价值观印记、完成状态全部由这些
 * 决定重新算出来（snapshot / tasks）。好处：
 *   1. 改数值平衡、改卡片文案都不需要迁移存档；
 *   2. 残缺或伪造的存档最多停在真正完成过的那一步；
 *   3. 结算页能直接读到玩家自己造成的剧情线与成绩明细。
 */
const content = require('../data/content');

/** 四个价值观，同时是画像的四条轴。 */
const MARKS = content.culture.values.map((v) => v.name);
/** 值班班次：当前只有第一班。 */
const SHIFT = content.shifts[0];
const CARDS = SHIFT.cards;
const TRUST_MIN = 0;
const TRUST_MAX = 100;
const QUIZ_TOTAL = content.quizBank.length;
/** 能安全读取的存档版本：更早的按规则迁移，未知版本一律当新档处理。 */
const KNOWN_VERSIONS = [1, 2, 3, 4, 5];

/** 信任值分档：结局评价与评语。 */
const TRUST_LEVELS = [
  { min: 85, label: '可靠的在岗人', comment: '你把每一次签字都当成了承诺，客户愿意把方法交给你。' },
  { min: 70, label: '称职的值班员', comment: '多数时候，你选了那条不容易但站得住的路。' },
  { min: 55, label: '合格，但留了尾巴', comment: '台账能过，现场还有几件事在等你回头处理。' },
  { min: 0, label: '账面上干净，现场有雷', comment: '你做的每一个「先发再说」，都已经在路上了。' }
];

/** 印记最高项的称号。 */
const MARK_STYLE = {
  守正: { title: '规则守护者', comment: '数据和记录在你这里没有被让步。' },
  务实: { title: '交付推动者', comment: '你盯着客户的真实问题，没有被流程本身绊住。' },
  创新: { title: '场景解法人', comment: '面对新需求，你愿意先理解，再动手。' },
  精进: { title: '持续验证者', comment: '你不太接受「看起来没问题」。' }
};

/** 通关评级：参考线上博物馆的 GRADE S / A / B。 */
const GRADES = [
  {
    code: 'S',
    color: '#e85d26',
    comment: '完美通关！把关严、答题准、手速快，你是东鸿文化探索的超级玩家。',
    test: (s) =>
      s.trust >= 85 &&
      s.games.flip.done &&
      s.games.flip.moves <= 20 &&
      s.games.quiz.score >= 80 &&
      s.games.crush.score >= 300
  },
  {
    code: 'A',
    color: '#0fb8a7',
    comment: '非常棒！全部任务完成，判断稳、节奏好，可以带新同事走一遍了。',
    test: (s) => s.trust >= 70 && s.games.quiz.score >= 60 && s.games.crush.score >= 150
  },
  {
    code: 'B',
    color: '#c49a6c',
    comment: '全部通关！有些判断还可以再想一层，回看值班记录会有收获。',
    test: () => true
  }
];

function emptyCheckins() {
  const checkins = {};
  for (const quest of content.quests) checkins[quest.id] = false;
  return checkins;
}

function initial() {
  const marks = {};
  for (const name of MARKS) marks[name] = 0;
  return {
    version: 5,
    prologue: 0,
    prologueDone: false,
    decisions: [],
    // missions 由两个章节小游戏的完成情况推导，不直接读存档。
    missions: { 2: false, 3: false },
    pledge: '',
    completed: false,
    checkins: emptyCheckins(),
    games: {
      flip: { done: false, moves: 0, seconds: 0 },
      crush: { done: false, score: 0 },
      quiz: { done: false, score: 0, results: [] },
      cert: { matched: [] },
      solution: { done: false, picks: [], perfect: false },
      repro: { done: false, load: 0 }
    },
    mistakes: 0,
    updatedAt: 0,
    // 下面三项由决定推导，normalize 每次都会重算。
    trust: SHIFT.trust,
    marks,
    flags: {}
  };
}

/** 命中 flag 时整张卡替换：让玩家自己造成的后果自己找上门。 */
function resolveCard(card, flags) {
  const merged = Object.assign({}, card);
  if (card && card.variant && flags && flags[card.variant.when])
    Object.assign(merged, card.variant);
  delete merged.variant;
  return merged;
}

/** 把一条决定套用到数值上。 */
function applyChoice(result, choice) {
  const trust = result.trust + (choice.trust || 0);
  result.trust = Math.max(TRUST_MIN, Math.min(TRUST_MAX, trust));
  for (const [name, delta] of Object.entries(choice.marks || {})) {
    if (MARKS.includes(name)) result.marks[name] += delta;
  }
  if (choice.flag) result.flags[choice.flag] = true;
}

/** 按存档重算信任值、印记与标记；存档里写别的数值没用。 */
function snapshot(s) {
  const result = { trust: SHIFT.trust, marks: {}, flags: {} };
  for (const name of MARKS) result.marks[name] = 0;

  s.decisions.forEach((decision, index) => {
    const card = resolveCard(CARDS[index], result.flags);
    const choice = card && card.choices.find((option) => option.id === decision.choiceId);
    if (choice) applyChoice(result, choice);
  });

  // 打卡答题答对后，按展区标注的价值观各记一分；第二、三章同理。
  for (const quest of content.quests) {
    if (!s.checkins[quest.id] || !quest.value) continue;
    for (const name of String(quest.value).split('·')) {
      const mark = name.trim();
      if (MARKS.includes(mark)) result.marks[mark] += 1;
    }
  }
  const chapters = [
    { done: s.missions['2'], value: content.certGame.value },
    { done: s.missions['3'], value: content.solutionGame.value }
  ];
  for (const chapter of chapters) {
    if (!chapter.done) continue;
    for (const name of String(chapter.value).split('·')) {
      const mark = name.trim();
      if (MARKS.includes(mark)) result.marks[mark] += 1;
    }
  }
  return result;
}

/** 清洗打卡记录：只认题库里的 id。 */
function normalizeCheckins(raw) {
  const checkins = emptyCheckins();
  if (!raw) return checkins;
  for (const quest of content.quests) checkins[quest.id] = raw[quest.id] === true;
  return checkins;
}

/** 清洗小游戏成绩：数值越界一律归零，避免伪造出高分。 */
function normalizeGames(raw, legacyMissions) {
  const games = initial().games;
  const source = raw || {};
  const flip = source.flip || {};
  const crush = source.crush || {};
  const quiz = source.quiz || {};

  const moves = Number.isSafeInteger(flip.moves) ? Math.max(0, Math.min(999, flip.moves)) : 0;
  const seconds = Number.isSafeInteger(flip.seconds)
    ? Math.max(0, Math.min(9999, flip.seconds))
    : 0;
  const flipDone = flip.done === true && moves > 0;
  games.flip = { done: flipDone, moves: flipDone ? moves : 0, seconds: flipDone ? seconds : 0 };

  const score = Number.isSafeInteger(crush.score) ? Math.max(0, Math.min(9999, crush.score)) : 0;
  games.crush = { done: crush.done === true && score > 0, score: crush.done === true ? score : 0 };

  const results = Array.isArray(quiz.results)
    ? quiz.results.slice(0, QUIZ_TOTAL).map((item) => item === true)
    : [];
  const correct = results.filter(Boolean).length;
  games.quiz = {
    done: quiz.done === true && results.length === QUIZ_TOTAL,
    score: Math.round((correct / QUIZ_TOTAL) * 100),
    results
  };

  // 认证配对：只保留真实存在的市场，按题目顺序排列
  const matched = Array.isArray((source.cert || {}).matched) ? source.cert.matched : [];
  const answer = content.certGame.answer;
  games.cert = {
    matched: content.certGame.markets
      .map((market) => market.id)
      .filter((id) => matched.includes(id) && id in answer)
  };

  // 方案组卡：必须凑满预算且包含必需项，否则视为没完成
  const solution = source.solution || {};
  const picks = Array.isArray(solution.picks)
    ? [
        ...new Set(
          solution.picks.filter((id) => content.solutionGame.cards.some((card) => card.id === id))
        )
      ]
    : [];
  const game = content.solutionGame;
  const valid =
    solution.done === true &&
    picks.length === game.quota &&
    game.required.every((id) => picks.includes(id));
  games.solution = {
    done: valid,
    picks: valid ? picks : [],
    perfect: valid && game.perfect.every((id) => picks.includes(id))
  };

  const repro = source.repro || {};
  const reproLoad = Number.isSafeInteger(repro.load) ? Math.max(0, Math.min(100, repro.load)) : 0;
  const reproOk = repro.done === true && reproLoad >= content.reproGame.targetMin;
  games.repro = { done: reproOk, load: reproOk ? reproLoad : 0 };

  // 旧存档（v4 及更早）把章节完成状态记在 missions 上：按「已通过」补成完整记录
  if (legacyMissions) {
    if (legacyMissions['2'] === true && games.cert.matched.length === 0) {
      games.cert.matched = content.certGame.markets.map((market) => market.id);
    }
    if (legacyMissions['3'] === true && !games.solution.done) {
      games.solution = { done: true, picks: content.solutionGame.perfect.slice(), perfect: true };
    }
  }
  return games;
}

/**
 * 清洗存档：只保留能对得上内容的数据，遇到对不上的就地截断，
 * 于是旧版本、残缺或被改过的存档最多停在真正完成过的那一步。
 */
function normalize(raw) {
  const s = initial();
  if (!raw || !KNOWN_VERSIONS.includes(raw.version)) return s;

  s.prologue = Number.isInteger(raw.prologue) ? Math.max(0, Math.min(2, raw.prologue)) : 0;
  s.prologueDone = raw.prologueDone === true;
  s.games = normalizeGames(raw.games, raw.missions);
  s.missions['2'] = s.games.cert.matched.length === content.certGame.markets.length;
  s.missions['3'] = s.games.solution.done === true;

  const submitted = Array.isArray(raw.decisions) ? raw.decisions : [];
  const flags = {};
  for (let index = 0; index < Math.min(submitted.length, CARDS.length); index += 1) {
    const decision = submitted[index];
    const card = resolveCard(CARDS[index], flags);
    const choice = decision && card.choices.find((option) => option.id === decision.choiceId);
    if (!choice || decision.cardId !== card.id) break;
    if (choice.flag) flags[choice.flag] = true;
    s.decisions.push({ cardId: card.id, choiceId: choice.id });
  }

  s.checkins = normalizeCheckins(raw.checkins);

  const settled = snapshot(s);
  s.trust = settled.trust;
  s.marks = settled.marks;
  s.flags = settled.flags;
  s.pledge = content.actions.includes(raw.pledge) ? raw.pledge : '';
  s.completed = shiftDone(s) && s.pledge !== '';
  s.mistakes = Number.isSafeInteger(raw.mistakes) ? Math.max(0, raw.mistakes) : 0;
  s.updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0;
  return s;
}

/** 值班是否已经盖完所有卡。 */
function shiftDone(s) {
  return s.decisions.length >= CARDS.length;
}

/** 当前待处理的卡；值班结束后返回 null。 */
function currentCard(s) {
  if (shiftDone(s)) return null;
  return resolveCard(CARDS[s.decisions.length], s.flags || {});
}

/** 处理一次操作；不符合前置条件的操作不会解锁任何进度。 */
function advance(state, event, payload) {
  const s = normalize(state);

  switch (event) {
    case 'prologue':
      s.prologue = Math.min(2, s.prologue + 1);
      break;
    case 'mission':
      if (s.prologue === 2) s.prologueDone = true;
      break;
    case 'choose': {
      const card = currentCard(s);
      if (!s.prologueDone || !card || !payload || payload.cardId !== card.id) break;
      const choice = card.choices.find((option) => option.id === payload.choiceId);
      if (!choice) break;
      s.decisions.push({ cardId: card.id, choiceId: choice.id });
      break;
    }
    case 'checkin': {
      const quest = content.quests.find((item) => item.id === (payload && payload.questId));
      if (!quest) break;
      if (quest.answer !== payload.choice) {
        s.mistakes += 1;
        break;
      }
      s.checkins[quest.id] = true;
      break;
    }
    case 'quizAnswer': {
      const index = payload && payload.index;
      const question = content.quizBank[index];
      if (!question || s.games.quiz.done) break;
      if (s.games.quiz.results.length !== index) break;
      s.games.quiz.results.push(payload.choice === question.ans);
      if (s.games.quiz.results.length === QUIZ_TOTAL) {
        s.games.quiz.done = true;
        s.games.quiz.score = Math.round(
          (s.games.quiz.results.filter(Boolean).length / QUIZ_TOTAL) * 100
        );
      }
      break;
    }
    case 'flipResult': {
      const moves = Number.isSafeInteger(payload && payload.moves) ? payload.moves : 0;
      const seconds = Number.isSafeInteger(payload && payload.seconds) ? payload.seconds : 0;
      if (s.games.flip.done || moves <= 0) break;
      s.games.flip = { done: true, moves: Math.min(999, moves), seconds: Math.min(9999, seconds) };
      break;
    }
    case 'crushResult': {
      const score = Number.isSafeInteger(payload && payload.score) ? payload.score : 0;
      if (score <= 0) break;
      s.games.crush = { done: true, score: Math.min(9999, score) };
      break;
    }
    case 'quizReset':
      s.games.quiz = { done: false, score: 0, results: [] };
      break;
    case 'certMatch': {
      const answer = content.certGame.answer;
      const market = payload && payload.market;
      if (!market || !(market in answer)) break;
      if (s.games.cert.matched.includes(market)) break;
      if (answer[market] !== payload.cert) {
        s.mistakes += 1;
        break;
      }
      s.games.cert.matched.push(market);
      break;
    }
    case 'reproResult': {
      const load = Number.isSafeInteger(payload && payload.load) ? payload.load : 0;
      if (s.games.repro.done || load < content.reproGame.targetMin) break;
      s.games.repro = { done: true, load: Math.min(100, load) };
      break;
    }
    case 'solution': {
      const game = content.solutionGame;
      const picks = Array.isArray(payload && payload.picks) ? [...new Set(payload.picks)] : [];
      const known = picks.filter((id) => game.cards.some((card) => card.id === id));
      const ok = known.length === game.quota && game.required.every((id) => known.includes(id));
      if (!ok) {
        s.mistakes += 1;
        break;
      }
      s.games.solution = {
        done: true,
        picks: known,
        perfect: game.perfect.every((id) => known.includes(id))
      };
      break;
    }
    case 'complete':
      if (shiftDone(s) && content.actions.includes(payload)) {
        s.pledge = payload;
        s.completed = true;
      }
      break;
    case 'mistake':
      s.mistakes += 1;
      break;
  }
  return normalize(s);
}

/** 主线进度：序章 10、第一班 60（每张卡 10）、二三章各 10、承诺 10。 */
function percent(s) {
  let value = s.prologueDone ? 10 : 0;
  value += (s.decisions.length / CARDS.length) * 60;
  value += (s.missions['2'] ? 10 : 0) + (s.missions['3'] ? 10 : 0);
  if (s.completed) value += 10;
  return Math.round(value);
}

/** 任务清单：主线、打卡与小游戏统一成一张表（供任务轨道与通关结算使用）。 */
function tasks(s) {
  const checkins = content.quests.map((quest) => ({
    id: quest.id,
    icon: quest.icon,
    name: `${quest.name}打卡`,
    done: s.checkins[quest.id] === true,
    page: '/pages/quest/quest'
  }));
  return [
    {
      id: 'prologue',
      icon: '🔑',
      name: '领取使命密钥',
      done: s.prologueDone,
      page: '/pages/prologue/prologue'
    },
    {
      id: 'shift',
      icon: '🕹️',
      name: '质量值班（六份材料）',
      done: shiftDone(s),
      page: '/pages/shift/shift'
    },
    ...checkins,
    {
      id: 'flip',
      icon: '🃏',
      name: '模块配对',
      done: s.games.flip.done,
      page: '/pages/quest/quest'
    },
    {
      id: 'crush',
      icon: '✨',
      name: '能量三消',
      done: s.games.crush.done,
      page: '/pages/quest/quest'
    },
    {
      id: 'quiz',
      icon: '📝',
      name: '知识答题',
      done: s.games.quiz.done,
      page: '/pages/quest/quest'
    },
    {
      id: 'repro',
      icon: '🎚️',
      name: '复现异常（实验台）',
      done: s.games.repro.done,
      page: '/pages/repro/repro'
    },
    {
      id: 'cert',
      icon: '🌍',
      name: '世界之门 · 认证配对',
      done: s.missions['2'],
      page: '/pages/cert/cert'
    },
    {
      id: 'solution',
      icon: '🎯',
      name: '客户之光 · 方案组卡',
      done: s.missions['3'],
      page: '/pages/solution/solution'
    },
    {
      id: 'pledge',
      icon: '🖋️',
      name: '保存文化画像',
      done: s.completed,
      page: '/pages/culture/culture'
    }
  ];
}

/** 已完成任务数 / 总任务数。 */
function taskProgress(s) {
  const list = tasks(s);
  return { done: list.filter((task) => task.done).length, total: list.length };
}

/** 是否全部通关（任务清单全部完成）。 */
function allDone(s) {
  return tasks(s).every((task) => task.done);
}

/** 通关评级。 */
function grade(s) {
  return GRADES.find((item) => item.test(s)) || GRADES[GRADES.length - 1];
}

/** 通关结算用的成绩明细。 */
function scoreboard(s) {
  return {
    trust: s.trust,
    flip: s.games.flip,
    crush: s.games.crush,
    quiz: {
      score: s.games.quiz.score,
      correct: s.games.quiz.results.filter(Boolean).length,
      total: QUIZ_TOTAL
    },
    cert: { matched: s.games.cert.matched.length, total: content.certGame.markets.length },
    solution: s.games.solution,
    repro: s.games.repro,
    grade: grade(s),
    progress: taskProgress(s)
  };
}

/** 「继续探索」应该去哪一页。 */
function route(s) {
  if (!s.prologueDone) return '/pages/prologue/prologue';
  if (!shiftDone(s)) return '/pages/shift/shift';
  return '/pages/culture/culture';
}

/** 玩家做过的、影响最大的几件事，用于画像页的「你的关键行为」。 */
function highlights(s, limit = 3) {
  const flags = {};
  const seen = [];
  s.decisions.forEach((decision, index) => {
    const card = resolveCard(CARDS[index], flags);
    const choice = card && card.choices.find((option) => option.id === decision.choiceId);
    if (!choice) return;
    if (choice.flag) flags[choice.flag] = true;
    seen.push({
      card: card.title,
      choice: choice.label.replace(/^盖章[：:]?/, ''),
      stamp: choice.stamp,
      trust: choice.trust || 0,
      result: choice.result
    });
  });
  return seen.sort((a, b) => Math.abs(b.trust) - Math.abs(a.trust)).slice(0, limit);
}

/** 结算画像：信任值分档 + 四条印记 + 主印记称号 + 关键行为。 */
function portrait(s) {
  const level = TRUST_LEVELS.find((item) => s.trust >= item.min);
  const ranked = MARKS.map((name) => ({ name, value: s.marks[name] || 0 })).sort(
    (a, b) => b.value - a.value
  );
  const top = ranked[0] && ranked[0].value > 0 ? ranked[0].name : null;
  const style = top
    ? MARK_STYLE[top]
    : { title: '印记未成形', comment: '还没有做出足够多的判断。' };
  return { trust: s.trust, level, ranked, top, style, highlights: highlights(s) };
}

module.exports = {
  initial,
  normalize,
  advance,
  percent,
  route,
  portrait,
  tasks,
  taskProgress,
  allDone,
  grade,
  scoreboard,
  currentCard,
  shiftDone,
  resolveCard,
  MARKS,
  CARDS,
  TRUST_LEVELS,
  GRADES,
  QUIZ_TOTAL
};
