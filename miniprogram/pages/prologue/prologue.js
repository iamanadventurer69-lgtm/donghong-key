/**
 * 序章：三段能源故事，最后一屏领取使命密钥并进入第一章。
 * 翻页会记住当前故事位置（其他页面的普通介绍页不需要）。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');

Page({
  ...pager.methods,
  data: {
    panel: 0,
    panelCount: 3,
    culture: content.culture
  },
  onShow() {
    this.sync();
  },
  sync() {
    const s = store.read();
    this.setData({
      s,
      panel: s.prologue,
      scene: content.prologue[s.prologue],
      warning: store.warning()
    });
  },
  /** 向左滑是回看，因此只回退页码，不动已经领取的密钥。 */
  prevPanel() {
    const s = store.read();
    if (s.prologue > 0) {
      store.write({ ...s, prologue: s.prologue - 1 });
      this.sync();
    }
  },
  /** 向右滑只在未领取密钥时推进故事；最后一屏交给按钮。 */
  nextPanel() {
    if (this.data.panel < 2) this.next();
  },
  next() {
    const s = store.read();
    if (s.prologue < 2) {
      store.dispatch('prologue');
      this.sync();
      return;
    }
    store.dispatch('mission');
    wx.redirectTo({ url: '/pages/chapter/chapter' });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
