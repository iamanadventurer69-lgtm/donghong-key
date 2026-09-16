/**
 * 第三章「客户之光」：预算内组方案。
 * 六张能力卡里挑三张，缺必需项会被客户打回，凑齐必需项才算过关；
 * 再加上电能质量才是满分组。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

const GAME = content.solutionGame;

Page({
  data: {
    game: GAME,
    cards: [],
    pickedCount: 0,
    feedback: '',
    feedbackKind: '',
    done: false,
    perfect: false,
    quota: GAME.quota
  },
  onShow() {
    const s = store.read();
    const saved = s.games.solution;
    this.setData({
      cards: GAME.cards.map((card) => ({ ...card, picked: saved.picks.includes(card.id) })),
      pickedCount: saved.picks.length,
      done: saved.done,
      perfect: saved.perfect,
      feedback: '',
      feedbackKind: ''
    });
  },
  tapCard(e) {
    if (this.data.done) return;
    const id = e.currentTarget.dataset.id;
    const cards = this.data.cards.map((card) => ({ ...card }));
    const target = cards.find((card) => card.id === id);
    if (!target) return;

    if (!target.picked && this.data.pickedCount >= this.data.quota) {
      this.setData({
        feedback: `预算只有 ${this.data.quota} 张卡，先取消一张再选。`,
        feedbackKind: 'warn'
      });
      return;
    }
    target.picked = !target.picked;
    this.setData({
      cards,
      pickedCount: cards.filter((card) => card.picked).length,
      feedback: '',
      feedbackKind: ''
    });
  },
  submit() {
    if (this.data.done) return;
    const picks = this.data.cards.filter((card) => card.picked).map((card) => card.id);
    if (picks.length !== this.data.quota) {
      this.setData({
        feedback: `客户给的预算就是 ${this.data.quota} 张卡，现在选了 ${picks.length} 张。`,
        feedbackKind: 'warn'
      });
      return;
    }

    store.dispatch('solution', { picks });
    const saved = store.read().games.solution;
    if (!saved.done) {
      this.setData({ feedback: GAME.rejected, feedbackKind: 'bad' });
      return;
    }
    this.setData({
      done: true,
      perfect: saved.perfect,
      feedback: saved.perfect ? GAME.success : GAME.accepted,
      feedbackKind: saved.perfect ? 'good' : 'warn'
    });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  },
  finish() {
    wx.reLaunch({ url: '/pages/quest/quest' });
  }
});
