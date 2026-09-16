/**
 * 文化跳格子：一格一个知识点，答对往前跳一格，答错退回一格，走到终点通关。
 *
 * 题目与知识点都在 content.hopGame.tiles；这里只负责推进、展示与动画。
 * 位置与对错次数写进存档，中途退出再回来会站在原来的格子上。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

const GAME = content.hopGame;
const TOTAL = GAME.tiles.length;

/** 棋盘：起点 + 12 格 + 终点。 */
function buildStones(tile, done) {
  return GAME.tiles.map((item, index) => ({
    key: item.id,
    label: index === TOTAL - 1 ? '终点' : String(index + 1),
    name: item.name,
    goal: index === TOTAL - 1,
    passed: index < tile,
    here: !done && index === tile
  }));
}

Page({
  data: {
    game: GAME,
    total: TOTAL,
    tile: 0,
    right: 0,
    wrong: 0,
    stones: buildStones(0, false),
    current: GAME.tiles[0],
    chosen: -1,
    answered: false,
    rightAnswer: false,
    feedback: '',
    done: false
  },
  onShow() {
    const hop = store.read().games.hop;
    const tile = Math.min(hop.tile, TOTAL - 1);
    this.setData({
      tile: hop.tile,
      right: hop.right,
      wrong: hop.wrong,
      done: hop.done,
      stones: buildStones(hop.tile, hop.done),
      current: GAME.tiles[tile],
      chosen: -1,
      answered: false,
      feedback: ''
    });
  },
  pick(e) {
    if (this.data.answered || this.data.done) return;
    const choice = Number(e.currentTarget.dataset.index);
    const tile = this.data.current;
    const rightAnswer = choice === tile.answer;

    store.dispatch('hopAnswer', { index: this.data.tile, choice });
    const hop = store.read().games.hop;

    this.setData({
      chosen: choice,
      answered: true,
      rightAnswer,
      feedback: rightAnswer ? `${GAME.forward} ${tile.explain}` : `${GAME.backward} ${tile.explain}`
    });
    this.next = hop;
  },
  /** 结算一次跳跃：更新位置、棋盘与对错次数。 */
  go() {
    if (!this.data.answered) return;
    const hop = this.next || store.read().games.hop;
    const tile = Math.min(hop.tile, TOTAL - 1);
    this.setData({
      tile: hop.tile,
      right: hop.right,
      wrong: hop.wrong,
      done: hop.done,
      stones: buildStones(hop.tile, hop.done),
      current: GAME.tiles[tile],
      chosen: -1,
      answered: false,
      feedback: ''
    });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  },
  finish() {
    wx.reLaunch({ url: '/pages/games/games' });
  }
});
