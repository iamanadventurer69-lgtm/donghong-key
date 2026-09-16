/**
 * 文化画像：值班结束后结算。
 * 三屏：信任值结算 → 印记画像与关键行为 → 行动承诺（保存后整局完成）。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

Page({
  ...pager.methods,
  data: {
    panel: 0,
    panelCount: 3,
    culture: content.culture,
    actions: content.actions,
    selected: '',
    portrait: null
  },
  onShow() {
    const s = store.read();
    // 值班还没结束就回到该去的地方（例如清档后深链进来）。
    if (!state.shiftDone(s)) {
      wx.redirectTo({ url: state.route(s) });
      return;
    }
    this.sync();
  },
  sync() {
    const s = store.read();
    const portrait = state.portrait(s);
    this.setData({
      s,
      selected: s.pledge,
      warning: store.warning(),
      portrait: {
        ...portrait,
        ranked: portrait.ranked.map((item) => ({
          ...item,
          width: Math.min(100, Math.abs(item.value) * 20),
          negative: item.value < 0
        }))
      }
    });
  },
  choose(e) {
    this.setData({ selected: e.currentTarget.dataset.value });
  },
  save() {
    if (!this.data.selected) return;
    const s = store.dispatch('complete', this.data.selected);
    const warning = store.warning();
    this.setData({ s, warning });
    if (!warning) wx.showToast({ title: '文化画像已保存', icon: 'success' });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
  progress() {
    wx.redirectTo({ url: '/pages/progress/progress' });
  }
});
