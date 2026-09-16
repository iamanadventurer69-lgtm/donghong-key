/**
 * 值班页：一屏一张事件卡，读完材料后判断（通过 / 退回），看后果，再翻下一张。
 *
 * 页面不做规则判断：能不能盖、盖了值多少，都由 utils/state.js 决定；
 * 这里只负责展示材料、收集操作、把结果讲清楚。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const state = require('../../utils/state');
const store = require('../../utils/storage');

const SHIFT = content.shifts[0];

/** 「守正 +2 · 精进 −1」这样的印记变化文案。 */
function markDelta(choice) {
  return Object.entries(choice.marks || {})
    .map(([name, value]) => `${name} ${value > 0 ? '+' : '−'}${Math.abs(value)}`)
    .join(' · ');
}

Page({
  data: {
    shift: SHIFT,
    total: state.CARDS.length,
    card: null,
    index: 0,
    trust: SHIFT.trust,
    marks: [],
    phase: 'card',
    result: null,
    twoStamps: false,
    stampRelease: '',
    stampReturn: '',
    last: false,
    rulesOpen: false,
    warning: ''
  },
  onLoad() {
    if (!store.read().prologueDone) wx.redirectTo({ url: '/pages/prologue/prologue' });
  },
  onShow() {
    this.sync();
  },
  /** 重新读存档并刷新当前卡片；值班结束就去看画像。 */
  sync() {
    const s = store.read();
    const card = state.currentCard(s);
    if (!card) {
      wx.redirectTo({ url: '/pages/culture/culture' });
      return;
    }
    const release = card.choices.find((choice) => choice.stamp === 'release');
    const back = card.choices.find((choice) => choice.stamp === 'return');
    this.setData({
      card,
      index: s.decisions.length + 1,
      last: s.decisions.length + 1 === state.CARDS.length,
      trust: s.trust,
      marks: state.MARKS.map((name) => ({ name, value: s.marks[name] || 0 })),
      phase: 'card',
      result: null,
      twoStamps: card.choices.length === 2 && Boolean(release && back),
      stampRelease: release ? release.id : '',
      stampReturn: back ? back.id : '',
      warning: store.warning()
    });
  },
  choose(e) {
    this.decide(e.currentTarget.dataset.id);
  },
  decide(choiceId) {
    if (this.data.phase !== 'card') return;
    const card = this.data.card;
    const choice = card.choices.find((item) => item.id === choiceId);
    if (!choice) return;

    const next = store.dispatch('choose', { cardId: card.id, choiceId: choice.id });
    this.setData({
      phase: 'result',
      result: {
        stamp: choice.stamp,
        label: choice.label,
        text: choice.result,
        delta: choice.trust || 0,
        trust: next.trust,
        marks: markDelta(choice)
      }
    });
  },
  next() {
    this.sync();
  },
  swipeStart(e) {
    this.swipeOrigin = e.touches && e.touches[0];
  },
  /** 右滑＝通过，左滑＝退回（内部 id 仍是 release / return，不会影响存档）。 */
  swipeEnd(e) {
    const direction = pager.direction(this.swipeOrigin, e.changedTouches && e.changedTouches[0]);
    this.swipeOrigin = null;
    if (!direction || this.data.phase !== 'card' || !this.data.twoStamps) return;
    this.decide(direction === -1 ? this.data.stampRelease : this.data.stampReturn);
  },
  swipeCancel() {
    this.swipeOrigin = null;
  },
  toggleRules() {
    this.setData({ rulesOpen: !this.data.rulesOpen });
  },
  noop() {},
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
