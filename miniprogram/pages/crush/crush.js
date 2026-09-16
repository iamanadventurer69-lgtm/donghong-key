/**
 * 能量三消：六种能源节点，点两个相邻格子交换，三个连线即消。
 * 60 秒内尽量拿高分，连击倍数会把分数拉开。
 *
 * 判定与落牌在 utils/match3.js（纯函数、可单测），这里只管节奏与渲染。
 */
const content = require('../../data/content');
const match3 = require('../../utils/match3');
const store = require('../../utils/storage');

const SIZE = content.match3.size;
const SECONDS = content.match3.seconds;
const STEP_FLASH = 200;
const STEP_SETTLE = 120;

Page({
  data: {
    board: [],
    score: 0,
    combo: 0,
    timeLeft: SECONDS,
    selected: null,
    shake: false,
    over: false,
    resolving: false,
    hint: '点两个相邻的方块交换，三连即消'
  },
  onShow() {
    if (this.data.board.length === 0) this.restart();
  },
  onHide() {
    this.stopTimer();
  },
  onUnload() {
    this.stopTimer();
    clearTimeout(this.flashTimer);
    clearTimeout(this.settleTimer);
  },
  restart() {
    this.stopTimer();
    clearTimeout(this.flashTimer);
    clearTimeout(this.settleTimer);
    this.score = 0;
    this.board = match3.createBoard(SIZE);
    this.setData({
      board: match3.decorate(this.board),
      score: 0,
      combo: 0,
      timeLeft: SECONDS,
      selected: null,
      shake: false,
      over: false,
      resolving: false,
      hint: '点两个相邻的方块交换，三连即消'
    });
    // 开局若自带连线（极小概率），先让玩家看清棋盘再自动消。
    if (match3.findMatches(this.board).length > 0) {
      this.setData({ resolving: true });
      this.settleTimer = setTimeout(() => this.resolveCascade(this.board), STEP_SETTLE);
    }
  },
  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const timeLeft = this.data.timeLeft - 1;
      if (timeLeft <= 0) {
        this.setData({ timeLeft: 0 });
        this.end();
        return;
      }
      this.setData({ timeLeft });
    }, 1000);
  },
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },
  tap(e) {
    if (this.data.resolving || this.data.over) return;
    const cell = {
      row: Number(e.currentTarget.dataset.row),
      col: Number(e.currentTarget.dataset.col)
    };
    const selected = this.data.selected;

    if (!selected) {
      this.setData({ selected: cell });
      return;
    }
    if (selected.row === cell.row && selected.col === cell.col) {
      this.setData({ selected: null });
      return;
    }
    if (!match3.isAdjacent(selected, cell)) {
      this.setData({ selected: cell });
      return;
    }

    const swapped = match3.swapTiles(this.board, selected, cell);
    if (match3.findMatches(swapped).length === 0) {
      // 换不出连线：抖一下并退回，不扣分也不扣时间。
      this.setData({ selected: null, shake: true });
      this.shakeTimer = setTimeout(() => this.setData({ shake: false }), 260);
      return;
    }

    this.startTimer();
    this.board = swapped;
    this.setData({ board: match3.decorate(this.board), selected: null, resolving: true });
    this.resolveCascade(this.board);
  },
  /** 反复「消除 → 下落补牌」，每多一层算一次连击。 */
  resolveCascade(start) {
    let board = start;
    let combo = 0;

    const step = () => {
      const matches = match3.findMatches(board);
      if (matches.length === 0) {
        this.finishCascade(board);
        return;
      }
      combo += 1;
      this.score += match3.scoreFor(matches.length, combo);
      this.setData({ board: match3.decorate(board, matches), combo, score: this.score });

      this.flashTimer = setTimeout(() => {
        board = match3.collapse(board, matches);
        this.board = board;
        this.setData({ board: match3.decorate(board) });
        this.settleTimer = setTimeout(step, STEP_SETTLE);
      }, STEP_FLASH);
    };

    step();
  },
  finishCascade(board) {
    let next = board;
    let hint = '点两个相邻的方块交换，三连即消';
    if (!match3.hasMove(next)) {
      next = match3.createBoard(SIZE);
      hint = '没有可消的组合了，已经重新发牌';
    }
    this.board = next;
    this.setData({ board: match3.decorate(next), combo: 0, resolving: false, hint });
  },
  end() {
    this.stopTimer();
    if (this.score > 0) store.dispatch('crushResult', { score: this.score });
    this.setData({ over: true, selected: null, resolving: false });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  }
});
