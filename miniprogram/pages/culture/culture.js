/**
 * 文化印记：回顾行为与文化的对应关系，选一项行动承诺保存，第一章到此完成。
 * 未保存承诺前不显示 100%。
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
    selected: ''
  },
  onShow() {
    const s = store.read();
    // 条件不足时（例如清档后直接进来）回到该去的地方。
    if (!s.innovated) {
      wx.redirectTo({ url: state.route(s) });
      return;
    }
    this.setData({ s, selected: s.pledge, warning: store.warning() });
  },
  choose(e) {
    this.setData({ selected: e.currentTarget.dataset.value });
  },
  save() {
    if (!this.data.selected) return;
    const s = store.dispatch('complete', this.data.selected);
    const warning = store.warning();
    this.setData({ s, warning });
    if (!warning) wx.showToast({ title: '文化印记已保存', icon: 'success' });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
  progress() {
    wx.redirectTo({ url: '/pages/progress/progress' });
  }
});
