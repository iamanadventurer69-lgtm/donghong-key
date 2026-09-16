/**
 * 知识答题：十题共 100 分，每题答完给解释，最后给总分与逐题回顾。
 *
 * 答题记录写进存档，所以中途退出再进来会从没答的那题继续；
 * 「重新挑战」会清空记录重来（成绩按最后一次算）。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

const BANK = content.quizBank;
const LETTERS = ['A', 'B', 'C', 'D'];

/** 每题的进度点状态：done / wrong / cur / 空。 */
function dotsOf(results, index) {
  return BANK.map((question, i) => {
    let state = '';
    if (i < results.length) state = results[i] ? 'done' : 'wrong';
    else if (i === index) state = 'cur';
    return { key: i, state };
  });
}

Page({
  data: {
    index: 0,
    total: BANK.length,
    question: BANK[0],
    letters: LETTERS,
    dots: dotsOf([], 0),
    chosen: -1,
    answered: false,
    finished: false,
    results: [],
    score: 0,
    review: []
  },
  onShow() {
    this.load(true);
  },
  /** resetQuestion 为真时把题目定位到「下一道没答的题」。 */
  load(resetQuestion) {
    const s = store.read();
    const results = s.games.quiz.results;
    const finished = results.length >= BANK.length;
    const index = Math.min(results.length, BANK.length - 1);

    if (finished) {
      this.setData({
        finished: true,
        results,
        score: s.games.quiz.score,
        dots: dotsOf(results, -1),
        review: BANK.map((question, i) => ({
          index: i + 1,
          right: results[i],
          question: question.q,
          answer: `${LETTERS[question.ans]} ${question.opts[question.ans]}`
        }))
      });
      return;
    }

    this.setData({
      finished: false,
      results,
      score: s.games.quiz.score,
      dots: dotsOf(results, resetQuestion ? index : this.data.index),
      index: resetQuestion ? index : this.data.index,
      question: resetQuestion ? BANK[index] : this.data.question,
      chosen: resetQuestion ? -1 : this.data.chosen,
      answered: resetQuestion ? false : this.data.answered
    });
  },
  pick(e) {
    if (this.data.answered) return;
    const choice = Number(e.currentTarget.dataset.index);
    store.dispatch('quizAnswer', { index: this.data.index, choice });
    this.setData({ chosen: choice, answered: true });
    this.load(false);
  },
  next() {
    const s = store.read();
    this.setData({
      index: Math.min(s.games.quiz.results.length, BANK.length - 1),
      chosen: -1,
      answered: false
    });
    this.load(true);
  },
  restart() {
    store.dispatch('quizReset');
    this.setData({ index: 0, question: BANK[0], chosen: -1, answered: false, finished: false });
    this.load(false);
  },
  back() {
    wx.navigateBack({ delta: 1 });
  }
});
