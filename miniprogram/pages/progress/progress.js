/**
 * 探索档案：四屏查看本机进度、信任值与画像、文化体系、存档操作。
 * 只读本机数据，不涉及任何身份信息。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

/** 五个进度节点，用于档案页的清单。 */
function stageList(s) {
  const done = s.decisions.length;
  const total = state.CARDS.length;
  return [
    { name: '领取使命密钥', done: s.prologueDone },
    { name: `质量值班（已盖 ${done} / ${total} 份）`, done: done >= total },
    { name: '世界之门 · 认证匹配', done: s.missions['2'] },
    { name: '客户之光 · 定制方案', done: s.missions['3'] },
    { name: '保存文化画像', done: s.completed }
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
    const portrait = state.portrait(s);
    this.setData({
      s,
      percent: state.percent(s),
      warning: store.warning(),
      updated: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '还未开始',
      stages: stageList(s),
      trust: s.trust,
      marks: state.MARKS.map((name) => ({ name, value: s.marks[name] || 0 })),
      style: portrait.style,
      level: portrait.level
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
      content: '将清除本机的值班记录、信任值与行动承诺，此操作无法撤销。',
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
