/**
 * 企业文化模块：文化介绍 + 展区打卡答题 + 三个互动关卡。
 *
 * 这一页是企业文化的入口：先把内容讲清楚（打卡弹层里先看介绍再答题），
 * 再做三个互动关卡（质量值班 / 认证配对 / 方案组卡）；
 * 全部完成后解锁闯关小游戏，全部任务完成时弹出通关结算。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');
const state = require('../../utils/state');

Page({
  data: {
    culture: content.culture,
    shift: content.shifts[0],
    cert: content.certGame,
    solution: content.solutionGame,
    checkins: [],
    gates: [],
    progress: { done: 0, total: 0 },
    moduleDone: false,
    allDone: false,
    percent: 0,
    grade: null,
    scoreboard: null,
    questOpen: false,
    quest: null,
    // intro → ask → result：先看内容介绍，再答题，最后看解释
    questPhase: 'intro',
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
    const moduleDone = state.cultureDone(s);
    const allDone = state.allDone(s);
    this.setData({
      checkins: content.quests.map((quest) => ({
        id: quest.id,
        icon: quest.icon,
        name: quest.name,
        hint: quest.hint,
        done: s.checkins[quest.id] === true
      })),
      gates: [
        {
          id: 'shift',
          icon: '🕹️',
          name: '质量值班',
          hint: `${s.decisions.length} / ${state.CARDS.length} 份材料`,
          done: state.shiftDone(s)
        },
        {
          id: 'cert',
          icon: '🌍',
          name: '认证配对',
          hint: `${s.games.cert.matched.length} / ${content.certGame.markets.length} 个市场`,
          done: s.missions['2']
        },
        {
          id: 'solution',
          icon: '🎯',
          name: '方案组卡',
          hint: s.games.solution.perfect ? '满分组' : s.games.solution.done ? '已通过' : '六选三',
          done: s.missions['3']
        }
      ],
      progress,
      moduleDone,
      allDone,
      percent: state.percent(s),
      grade: allDone ? state.grade(s) : null,
      scoreboard: state.scoreboard(s),
      warning: store.warning()
    });
    if (allDone && !this.finalShown) {
      this.finalShown = true;
      this.setData({ finalOpen: true });
    }
  },
  /** 打卡：先看内容介绍，再答题。 */
  openQuest(e) {
    const quest = content.quests.find((item) => item.id === e.currentTarget.dataset.id);
    if (!quest) return;
    this.setData({
      questOpen: true,
      quest,
      questPhase: 'intro',
      choice: -1,
      picked: false,
      right: false
    });
  },
  startQuest() {
    this.setData({ questPhase: 'ask' });
  },
  pick(e) {
    if (this.data.picked) return;
    const choice = Number(e.currentTarget.dataset.index);
    const quest = this.data.quest;
    const right = choice === quest.answer;
    // 答对由 state 点亮打卡，答错由 state 记一次错。
    store.dispatch('checkin', { questId: quest.id, choice });
    this.setData({ choice, picked: true, right, questPhase: 'result' });
    this.sync();
  },
  closeQuest() {
    this.setData({ questOpen: false, quest: null });
  },
  restart() {
    if (this.data.picked && !this.data.right) {
      this.setData({ choice: -1, picked: false, right: false, questPhase: 'ask' });
    }
  },
  /** 三个互动关卡。 */
  openGate(e) {
    const id = e.currentTarget.dataset.id;
    const page =
      id === 'shift'
        ? '/pages/shift/shift'
        : id === 'cert'
          ? '/pages/cert/cert'
          : '/pages/solution/solution';
    wx.navigateTo({ url: page });
  },
  toGames() {
    if (!this.data.moduleDone) return;
    wx.navigateTo({ url: '/pages/games/games' });
  },
  openFinal() {
    if (this.data.allDone) this.setData({ finalOpen: true });
  },
  closeFinal() {
    this.setData({ finalOpen: false });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
