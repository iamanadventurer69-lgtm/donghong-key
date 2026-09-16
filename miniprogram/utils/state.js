/**
 * 关卡状态机：进度结构、存档清洗与推进规则。
 *
 * 只有这里能决定「什么操作算数」：页面负责展示，storage 负责读写，
 * 存档是否合法、下一步该去哪一页，都由本文件统一回答。
 */
const content = require('../data/content');

/** 第一章的四个模块 id，也是装配要凑齐的全集。 */
const ids = content.chapter.modules.map((m) => m.id);

/** 全新的存档结构。 */
function initial() {
  return {
    version: 2,
    missions: { 2: false, 3: false },
    prologue: 0,
    prologueDone: false,
    step: 0,
    inspected: [],
    assembled: [],
    anomalyFound: false,
    calibrated: false,
    innovated: false,
    completed: false,
    pledge: '',
    mistakes: 0,
    updatedAt: 0
  };
}

/**
 * 把任意来源的数据洗成合法存档：缺字段补默认值，超前的进度回退，
 * 前置条件不满足的解锁状态一律撤销。损坏或旧版本的数据安全退回初始值。
 */
function normalize(raw) {
  const s = initial();
  if (!raw || (raw.version !== 1 && raw.version !== 2)) return s;

  s.missions['2'] = raw.missions && raw.missions['2'] === true;
  s.missions['3'] = raw.missions && raw.missions['3'] === true;
  s.prologue = Number.isInteger(raw.prologue) ? Math.max(0, Math.min(2, raw.prologue)) : 0;
  s.prologueDone = raw.prologueDone === true;

  s.inspected = s.prologueDone
    ? ids.filter((id) => Array.isArray(raw.inspected) && raw.inspected.includes(id))
    : [];
  s.assembled = ids.filter((id) => Array.isArray(raw.assembled) && raw.assembled.includes(id));
  if (s.inspected.length !== ids.length) s.assembled = [];

  s.anomalyFound = s.assembled.length === ids.length && raw.anomalyFound === true;
  s.calibrated = s.anomalyFound && raw.calibrated === true;
  s.innovated = s.calibrated && raw.innovated === true;
  s.completed = s.innovated && raw.completed === true;

  s.pledge = content.actions.includes(raw.pledge) ? raw.pledge : '';
  if (!s.pledge) s.completed = false;

  s.step = Number.isInteger(raw.step) ? Math.max(0, Math.min(maxReachableStep(s), raw.step)) : 0;
  s.mistakes = Number.isSafeInteger(raw.mistakes) ? Math.max(0, raw.mistakes) : 0;
  s.updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0;
  return s;
}

/** 按当前完成度，存档最多允许推进到第几步。 */
function maxReachableStep(s) {
  if (!s.prologueDone) return 0;
  if (s.inspected.length < ids.length) return 1;
  if (s.assembled.length < ids.length) return 2;
  if (!s.calibrated) return 3;
  return 4;
}

/** 处理一次有效操作；前置条件不满足时进度保持不变。 */
function advance(state, event, payload) {
  const s = normalize(state);
  const add = (key, id) => {
    if (ids.includes(id) && !s[key].includes(id)) s[key].push(id);
  };

  switch (event) {
    case 'prologue':
      s.prologue = Math.min(2, s.prologue + 1);
      break;
    case 'mission':
      if (s.prologue === 2) s.prologueDone = true;
      break;
    case 'start':
      if (s.prologueDone) s.step = Math.max(s.step, 1);
      break;
    case 'inspect':
      if (s.prologueDone && s.step >= 1) add('inspected', payload);
      break;
    case 'assembleStart':
      if (s.inspected.length === ids.length) s.step = Math.max(s.step, 2);
      break;
    case 'place':
      if (s.step >= 2 && s.inspected.length === ids.length) add('assembled', payload);
      break;
    case 'testStart':
      if (s.assembled.length === ids.length) s.step = Math.max(s.step, 3);
      break;
    case 'anomaly':
      if (s.step >= 3 && payload === content.chapter.anomaly) s.anomalyFound = true;
      else s.mistakes += 1;
      break;
    case 'calibrate':
      if (s.anomalyFound && payload === 'verify') s.calibrated = true;
      else s.mistakes += 1;
      break;
    case 'innovationStart':
      if (s.calibrated) s.step = 4;
      break;
    case 'innovate':
      if (s.step === 4 && payload === 'bidirectional') s.innovated = true;
      else s.mistakes += 1;
      break;
    case 'complete':
      if (s.innovated && content.actions.includes(payload)) {
        s.completed = true;
        s.pledge = payload;
      }
      break;
    case 'missionQuiz': {
      const [stage, result] = String(payload).split(':');
      if (content.missions[stage] && result === 'correct') s.missions[stage] = true;
      else s.mistakes += 1;
      break;
    }
    case 'mistake':
      s.mistakes += 1;
      break;
  }
  return normalize(s);
}

/** 第一阶段的进度百分比；未保存行动承诺前不会显示 100%。 */
function percent(s) {
  if (s.completed) return 100;
  if (s.innovated) return 90;
  if (s.calibrated) return 80;
  if (s.anomalyFound) return 70;
  return Math.round((s.prologueDone ? 20 : 0) + s.inspected.length * 5 + s.assembled.length * 6.25);
}

/** 按存档决定「继续探索」应该去哪一页。 */
function route(s) {
  if (!s.prologueDone) return '/pages/prologue/prologue';
  if (s.innovated) return '/pages/culture/culture';
  return '/pages/chapter/chapter';
}

module.exports = { initial, normalize, advance, percent, route };
