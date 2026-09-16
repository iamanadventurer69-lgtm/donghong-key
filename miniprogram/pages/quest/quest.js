/**
 * 闯关中心：任务轨道 + 展区打卡答题 + 三个小游戏入口 + 全部通关结算。
 *
 * 参考线上博物馆的做法：每个展区有一段内容，读完后「打卡答题」，答对才算完成；
 * 小游戏各自记成绩；全部任务完成时弹出结算（任务清单 + 成绩明细 + 评级）。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

const GAMES = ['flip', 'crush', 'quiz'];

/** 任务点开之后做什么：打卡答题、进小游戏，还是跳页面。 */
function kindOf(id) {
  if (content.quests.some((quest) => quest.id === id)) return 'checkin';
  if (GAMES.includes(id)) return 'game';
  return 'page';
}

/** 小游戏卡片上的成绩文案。 */
function gameScore(id, games) {
  if (id === 'flip') return games.flip.done ? `${games.flip.moves} 步` : '';
  if (id === 'crush') return games.crush.done ? `${games.crush.score} 分` : '';
  if (id === 'quiz') return games.quiz.done ? `${games.quiz.score} 分` : '';
  return '';
}

Page({
  data: {
    tasks: [],
    progress: { done: 0, total: 0 },
    percent: 0,
    grade: null,
    scoreboard: null,
    questOpen: false,
    quest: null,
    choice: -1,
    picked: false,
    right: false,
    finalOpen: false
  },
  onShow() {
    this.sync();
  },
  sync() {
    const s = store.read();
    const progress = state.taskProgress(s);
    const allDone = state.allDone(s);
    this.setData({
      tasks: state.tasks(s).map((task) => ({
        ...task,
        kind: kindOf(task.id),
        score: task.kind === 'game' ? gameScore(task.id, s.games) : ''
      })),
      progress,
      percent: state.percent(s),
      allDone,
      grade: allDone ? state.grade(s) : null,
      scoreboard: state.scoreboard(s),
      warning: store.warning()
    });
    // 首次全部通关时自动弹出结算，之后可以从「通关结算」按钮再看。
    if (allDone && !this.finalShown) {
      this.finalShown = true;
      this.setData({ finalOpen: true });
    }
  },
  /** 任务轨道上的点击：打卡 / 小游戏 / 跳页。 */
  openTask(e) {
    const id = e.currentTarget.dataset.id;
    const kind = kindOf(id);
    if (kind === 'game') {
      wx.navigateTo({ url: `/pages/${id}/${id}` });
      return;
    }
    if (kind === 'page') {
      const task = state.tasks(store.read()).find((item) => item.id === id);
      if (!task || !task.page) return;
      // 二三章入口在首页，用 reLaunch 避免在栈里叠一层首页。
      if (id === 'missions') wx.reLaunch({ url: task.page });
      else wx.navigateTo({ url: task.page });
      return;
    }
    const quest = content.quests.find((item) => item.id === id);
    this.setData({ questOpen: true, quest, choice: -1, picked: false, right: false });
  },
  pick(e) {
    if (this.data.picked) return;
    const choice = Number(e.currentTarget.dataset.index);
    const quest = this.data.quest;
    const right = choice === quest.answer;
    // 答对点亮打卡，答错由 state 记一次错（失败也留痕，但不影响继续挑战）。
    store.dispatch('checkin', { questId: quest.id, choice });
    this.setData({ choice, picked: true, right });
    this.sync();
  },
  closeQuest() {
    this.setData({ questOpen: false, quest: null });
  },
  openFinal() {
    if (!this.data.allDone) return;
    this.setData({ finalOpen: true });
  },
  closeFinal() {
    this.setData({ finalOpen: false });
  },
  restart() {
    if (this.data.picked && !this.data.right) {
      this.setData({ choice: -1, picked: false, right: false });
    }
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
