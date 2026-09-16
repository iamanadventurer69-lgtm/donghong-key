/**
 * 第二章「世界之门」：认证配对。
 * 先点一个市场，再点一张认证卡；配错会解释，配完三对通过本章。
 */
const content = require('../../data/content');
const store = require('../../utils/storage');

const GAME = content.certGame;

function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function certName(id) {
  const cert = GAME.certs.find((item) => item.id === id);
  return cert ? cert.name : '';
}

Page({
  data: {
    game: GAME,
    markets: [],
    certs: [],
    selected: '',
    feedback: '',
    shake: false,
    done: false,
    matchedCount: 0,
    total: GAME.markets.length
  },
  onLoad() {
    this.setData({ certs: shuffle(GAME.certs).map((cert) => ({ ...cert, used: false })) });
  },
  onShow() {
    this.sync();
  },
  sync() {
    const s = store.read();
    const matched = s.games.cert.matched;
    this.setData({
      markets: GAME.markets.map((market) => ({
        ...market,
        done: matched.includes(market.id),
        cert: matched.includes(market.id) ? certName(GAME.answer[market.id]) : '待匹配'
      })),
      certs: this.data.certs.map((cert) => ({
        ...cert,
        used: matched.some((market) => GAME.answer[market] === cert.id)
      })),
      done: matched.length === GAME.markets.length,
      matchedCount: matched.length
    });
  },
  tapMarket(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.done || this.data.markets.find((m) => m.id === id).done) return;
    this.setData({ selected: id, feedback: '' });
  },
  tapCert(e) {
    const cert = e.currentTarget.dataset.id;
    if (this.data.done) return;
    if (this.data.certs.find((item) => item.id === cert).used) return;
    if (!this.data.selected) {
      this.setData({ feedback: '先点左边的市场，再选认证卡。' });
      return;
    }

    const market = this.data.selected;
    store.dispatch('certMatch', { market, cert });
    const accepted = store.read().games.cert.matched.includes(market);
    if (!accepted) {
      this.setData({ feedback: GAME.wrong, shake: true });
      this.shakeTimer = setTimeout(() => this.setData({ shake: false }), 300);
      return;
    }
    this.setData({ selected: '', feedback: '' });
    this.sync();
  },
  onUnload() {
    clearTimeout(this.shakeTimer);
  },
  again() {
    this.setData({ selected: '', feedback: '' });
  },
  back() {
    wx.navigateBack({ delta: 1 });
  },
  next() {
    wx.redirectTo({ url: '/pages/solution/solution' });
  }
});
