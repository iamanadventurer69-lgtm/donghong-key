/**
 * 首页：三屏固定视窗（使命 / 三种能力 / 方向与进度）。
 * Canvas 能量网络随进度点亮，主按钮按存档决定去序章、去值班还是看画像。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

/** 首页 Canvas 点亮的节点数：序章后 2 个，之后每盖一张卡加 1 个。 */
function litNodes(s) {
  if (!s.prologueDone) return 0;
  return Math.min(6, 2 + s.decisions.length);
}

const GAMES = ['hop', 'flip', 'crush', 'quiz', 'repro'];

/** 主按钮文案。 */
function primaryLabel(s) {
  if (s.completed) return '回顾我的文化画像';
  if (s.updatedAt) return '继续探索';
  return '开启文化探索';
}

Page({
  ...pager.methods,
  data: {
    panel: 0,
    panelCount: 3,
    culture: content.culture,
    company: content.company
  },
  onShow() {
    const s = store.read();
    const progress = state.taskProgress(s);
    const culture = state.cultureDone(s);
    const finished = GAMES.filter((id) => (id === 'hop' ? s.games.hop.done : s.games[id].done));
    this.setData({
      s,
      percent: state.percent(s),
      active: litNodes(s),
      warning: store.warning(),
      cta: primaryLabel(s),
      cultureTag: culture ? '已完成' : `${progress.done} / ${progress.total}`,
      gameTag: culture ? `${finished.length} / ${GAMES.length}` : '未解锁',
      gameHint: culture ? '成绩计入通关结算' : '先完成企业文化模块'
    });
  },
  /** 主线：序章 → 质量值班 → 文化画像。 */
  start() {
    wx.navigateTo({ url: state.route(store.read()) });
  },
  /** 企业文化模块：介绍打卡 + 三个互动关卡。 */
  culture() {
    wx.navigateTo({ url: '/pages/quest/quest' });
  },
  /** 闯关小游戏：企业文化模块完成后解锁。 */
  games() {
    wx.navigateTo({ url: '/pages/games/games' });
  },
  progress() {
    wx.navigateTo({ url: '/pages/progress/progress' });
  }
});
