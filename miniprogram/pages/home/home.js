/**
 * 首页：三屏固定视窗（使命 / 三种能力 / 方向与进度）。
 * Canvas 能量网络随进度点亮，点「开启文化探索」按存档决定去序章还是继续。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

/** 首页 Canvas 上点亮的节点数。 */
function litNodes(s) {
  if (s.completed) return 6;
  if (s.prologueDone) return 2;
  return 0;
}

/** 主按钮文案随进度变化。 */
function primaryLabel(s) {
  if (s.completed) return '回顾我的文化印记';
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
    this.setData({
      s,
      percent: state.percent(s),
      active: litNodes(s),
      warning: store.warning(),
      cta: primaryLabel(s)
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
  }
});
