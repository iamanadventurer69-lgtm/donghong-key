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
    const done = s.decisions.length;
    const total = state.CARDS.length;
    const progress = state.taskProgress(s);
    this.setData({
      s,
      percent: state.percent(s),
      active: litNodes(s),
      warning: store.warning(),
      cta: primaryLabel(s),
      shiftTag:
        s.completed || done >= total ? '已点亮' : done > 0 ? `${done} / ${total}` : '可探索',
      questTag: progress.done >= progress.total ? '已通关' : `${progress.done} / ${progress.total}`,
      questDone: progress.done,
      questTotal: progress.total
    });
  },
  start() {
    wx.navigateTo({ url: state.route(store.read()) });
  },
  openMission(e) {
    wx.navigateTo({ url: '/pages/mission/mission?stage=' + e.currentTarget.dataset.stage });
  },
  progress() {
    wx.navigateTo({ url: '/pages/progress/progress' });
  },
  quest() {
    wx.navigateTo({ url: '/pages/quest/quest' });
  }
});
