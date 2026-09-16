/**
 * 小游戏区：企业文化模块完成后解锁。
 * 第一个是文化跳格子（答对前进、答错后退），其余是四个额外挑战。
 */
const store = require('../../utils/storage');
const state = require('../../utils/state');

const GAMES = [
  {
    id: 'hop',
    page: '/pages/hop/hop',
    icon: '🦘',
    name: '文化跳格子',
    hint: '答对前进一格，答错退回一格'
  },
  {
    id: 'flip',
    page: '/pages/flip/flip',
    icon: '🃏',
    name: '模块配对',
    hint: '把模块与它的职责配成对'
  },
  {
    id: 'crush',
    page: '/pages/crush/crush',
    icon: '✨',
    name: '能量三消',
    hint: '60 秒内多消几组，连击翻倍'
  },
  {
    id: 'quiz',
    page: '/pages/quiz/quiz',
    icon: '📝',
    name: '知识答题',
    hint: '十题一百分，答完给解释'
  }
];

/** 每个小游戏卡片上的成绩文案。 */
function scoreText(id, games) {
  if (id === 'hop')
    return games.hop.done
      ? `通关 · 错 ${games.hop.wrong} 次`
      : games.hop.right + games.hop.wrong > 0
        ? `第 ${games.hop.tile} 格`
        : '';
  if (id === 'flip') return games.flip.done ? `${games.flip.moves} 步` : '';
  if (id === 'crush') return games.crush.done ? `${games.crush.score} 分` : '';
  if (id === 'quiz') return games.quiz.done ? `${games.quiz.score} 分` : '';
  return '';
}

Page({
  data: {
    unlocked: false,
    progress: { done: 0, total: GAMES.length },
    games: [],
    feedback: ''
  },
  onShow() {
    const s = store.read();
    const unlocked = state.cultureDone(s);
    const games = GAMES.map((game) => ({
      ...game,
      done: this.isDone(game.id, s),
      score: scoreText(game.id, s.games)
    }));
    this.setData({
      unlocked,
      games,
      progress: { done: games.filter((game) => game.done).length, total: games.length },
      feedback: '',
      warning: store.warning()
    });
  },
  isDone(id, s) {
    if (id === 'hop') return s.games.hop.done;
    if (id === 'flip') return s.games.flip.done;
    if (id === 'crush') return s.games.crush.done;
    if (id === 'quiz') return s.games.quiz.done;
    return false;
  },
  open(e) {
    const id = e.currentTarget.dataset.id;
    const game = GAMES.find((item) => item.id === id);
    if (!game) return;
    if (!this.data.unlocked) {
      this.setData({ feedback: '先完成企业文化模块（文化介绍打卡 + 三个互动关卡），再来闯关。' });
      return;
    }
    wx.navigateTo({ url: game.page });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  },
  toModule() {
    wx.redirectTo({ url: '/pages/quest/quest' });
  }
});
