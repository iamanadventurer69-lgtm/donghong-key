/**
 * 探索档案：四屏查看本机进度、文化体系、价值观与存档操作。
 * 只读本机数据，不涉及任何身份信息。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

/** 六个进度节点的完成状态，用于档案页的清单。 */
function stageList(s) {
  return [
    { name: '领取使命密钥', done: s.prologueDone },
    { name: '认识产品模块', done: s.inspected.length === 4 },
    { name: '重建技术链路', done: s.assembled.length === 4 },
    { name: '追溯异常并复测', done: s.calibrated },
    { name: '验证创新方案', done: s.innovated },
    { name: '保存文化印记', done: s.completed }
  ];
}

Page({
  ...pager.methods,
  data: {
    panel: 0,
    panelCount: 4,
    culture: content.culture
  },
  onShow() {
    this.sync();
  },
  sync() {
    const s = store.read();
    this.setData({
      s,
      percent: state.percent(s),
      warning: store.warning(),
      updated: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '还未开始',
      stages: stageList(s)
    });
  },
  resume() {
    wx.navigateTo({ url: state.route(store.read()) });
  },
  /** 保存失败后重试：把内存里的进度再写一次本机存储。 */
  retry() {
    store.write(store.read());
    this.sync();
  },
  reset() {
    wx.showModal({
      title: '重新开启探索？',
      content: '将清除本机的章节进度与行动承诺，此操作无法撤销。',
      confirmText: '重新开始',
      confirmColor: '#249fdc',
      success: (r) => {
        if (!r.confirm) return;
        store.reset();
        this.sync();
      }
    });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
