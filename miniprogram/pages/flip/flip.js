/**
 * 模块配对（翻牌记忆）：八对卡片，一边是名字，一边是它的职责或解释。
 * 记步数与用时，全部配成对后写入存档并给评价。
 *
 * WXML 的表达式不支持 includes() 之类的函数调用，所以翻开 / 已配对的状态
 * 直接写在每张卡片上，用 setData 的路径写法更新单个格子。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

const PAIR_TOTAL = content.memory.length / 2;
const FLIP_BACK_DELAY = 700;
/** 「还没有翻开第一张」的标记：不能用 0，否则第一张牌在索引 0 时会被当成空。 */
const EMPTY = -1;

function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildDeck() {
  return shuffle(content.memory).map((card, index) => ({
    ...card,
    index,
    up: false,
    done: false
  }));
}

function timeText(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

Page({
  data: {
    cards: [],
    moves: 0,
    matched: 0,
    seconds: 0,
    timeText: '00:00',
    pairTotal: PAIR_TOTAL,
    won: false,
    busy: false
  },
  onShow() {
    if (this.data.cards.length === 0) this.restart();
  },
  onHide() {
    this.stopTimer();
  },
  onUnload() {
    this.stopTimer();
    clearTimeout(this.backTimer);
  },
  restart() {
    this.stopTimer();
    clearTimeout(this.backTimer);
    this.first = EMPTY;
    this.setData({
      cards: buildDeck(),
      moves: 0,
      matched: 0,
      seconds: 0,
      timeText: '00:00',
      won: false,
      busy: false
    });
  },
  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const seconds = this.data.seconds + 1;
      this.setData({ seconds, timeText: timeText(seconds) });
    }, 1000);
  },
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },
  tap(e) {
    if (this.data.busy || this.data.won) return;
    const index = Number(e.currentTarget.dataset.index);
    const card = this.data.cards[index];
    if (!card || card.up || card.done) return;

    this.startTimer();
    if (this.first === EMPTY) {
      this.first = index;
      this.setData({ [`cards[${index}].up`]: true });
      return;
    }

    const firstIndex = this.first;
    const firstCard = this.data.cards[firstIndex];
    this.first = EMPTY;
    const moves = this.data.moves + 1;
    this.setData({ moves, [`cards[${index}].up`]: true });

    if (firstCard.pair === card.pair) {
      const matched = this.data.matched + 1;
      this.setData({
        matched,
        [`cards[${firstIndex}].done`]: true,
        [`cards[${index}].done`]: true
      });
      if (matched === PAIR_TOTAL) this.win();
      return;
    }

    this.setData({ busy: true });
    this.backTimer = setTimeout(() => {
      this.setData({
        [`cards[${firstIndex}].up`]: false,
        [`cards[${index}].up`]: false,
        busy: false
      });
    }, FLIP_BACK_DELAY);
  },
  win() {
    this.stopTimer();
    store.dispatch('flipResult', { moves: this.data.moves, seconds: this.data.seconds });
    this.setData({ won: true });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  }
});
