/**
 * 复现异常：用实时实验台把负载推到高负载区间并稳住，让偏差复现出来。
 *
 * 实验台是现成的组件（components/live-meter），它通过 loadchange 事件把
 * 当前负载与通电状态抛给本页；本页只负责判定是否达标、要不要计时。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

const GAME = content.reproGame;

Page({
  data: {
    game: GAME,
    load: 0,
    powered: false,
    hold: 0,
    done: false,
    message: '',
    targetMin: GAME.targetMin,
    holdSeconds: GAME.holdSeconds
  },
  onShow() {
    this.setData({ done: store.read().games.repro.done });
    if (this.data.done) this.stopHold();
  },
  onHide() {
    this.stopHold();
  },
  onUnload() {
    this.stopHold();
  },
  /** 组件每次调负载或通电都会走到这里。 */
  onLoadChange(e) {
    const { load, running } = e.detail;
    const hold = this.data.hold;
    this.setData({
      load,
      powered: running,
      hold: running && load >= GAME.targetMin ? hold : 0,
      message: running
        ? load >= GAME.targetMin
          ? '负载到了，稳住别动'
          : GAME.idle
        : GAME.needPower
    });

    const reached = running && load >= GAME.targetMin;
    if (reached && !this.timer) this.startHold();
    if (!reached && this.timer) this.stopHold();
  },
  startHold() {
    this.timer = setInterval(() => {
      const hold = this.data.hold + 1;
      if (hold >= GAME.holdSeconds) {
        this.succeed();
        return;
      }
      this.setData({ hold });
    }, 1000);
  },
  stopHold() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },
  succeed() {
    this.stopHold();
    store.dispatch('reproResult', { load: this.data.load });
    this.setData({ done: true, hold: GAME.holdSeconds, message: GAME.success });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  },
  finish() {
    wx.reLaunch({ url: '/pages/quest/quest' });
  }
});
