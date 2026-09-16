/**
 * 第一章「技术之芯」：七屏关卡（文化导入 → 模块认识 → 组装 → 通电实验台
 * → 精度排查 → 校准复测 → 创新挑战）。
 *
 * 页面本身不做规则判断，「这一步能不能过」由 utils/state.js 决定；
 * 这里只负责收集操作、给反馈、推进页码。
 */
const pager = require('../../utils/pager');
const content = require('../../data/content');
const store = require('../../utils/storage');

const MODULE_COUNT = content.chapter.modules.length;

/** 按存档决定重新进入时停在哪一屏。 */
function panelForStep(s) {
  if (s.step < 3) return s.step;
  if (s.step === 4) return 6;
  return s.calibrated || s.anomalyFound ? 5 : 3;
}

/** 触点落在哪个槽位里；没命中返回 undefined。 */
function hitSlot(rects, point) {
  return rects.find(
    (r) =>
      point.clientX >= r.left &&
      point.clientX <= r.right &&
      point.clientY >= r.top &&
      point.clientY <= r.bottom
  );
}

Page({
  ...pager.methods,
  data: {
    panel: 0,
    panelCount: 7,
    chapter: content.chapter,
    feedback: '',
    selected: null,
    drag: null,
    activeModule: null,
    faultSlot: null
  },
  onLoad() {
    if (!store.read().prologueDone) wx.redirectTo({ url: '/pages/prologue/prologue' });
  },
  onShow() {
    this.sync();
    this.setData({ panel: panelForStep(store.read()) });
  },
  /** 向右滑：只有当前任务做完了才前进，没做完就给出原因。 */
  nextPanel() {
    const panel = this.data.panel;
    const s = store.read();

    if (panel === 0) {
      this.start();
      return;
    }
    if (panel === 1) {
      if (s.inspected.length === MODULE_COUNT) this.assemble();
      else this.setData({ feedback: '先点击探索四个模块，再向左滑动。' });
      return;
    }
    if (panel === 2) {
      if (s.assembled.length === MODULE_COUNT) this.test();
      else this.setData({ feedback: '完成四个模块连接后才能进入测试。' });
      return;
    }
    if (panel === 3) {
      this.setData({ panel: 4, feedback: '' });
      return;
    }
    if (panel === 4) {
      if (s.anomalyFound) this.setData({ panel: 5, feedback: '' });
      else this.setData({ feedback: '先找出超出教学阈值的测试点。' });
      return;
    }
    if (panel === 5) {
      if (s.calibrated) this.innovation();
      else this.setData({ feedback: '完成问题追溯与复测后继续。' });
      return;
    }
    if (s.innovated) this.finish();
  },
  /** 向左滑：回看不撤销任何进度。 */
  prevPanel() {
    this.setData({ panel: Math.max(0, this.data.panel - 1), feedback: '', activeModule: null });
  },
  sync() {
    const s = store.read();
    this.setData({
      s,
      modules: content.chapter.modules.map((m) => ({
        ...m,
        inspected: s.inspected.includes(m.id),
        placed: s.assembled.includes(m.id)
      })),
      warning: store.warning()
    });
  },
  dispatch(event, payload) {
    store.dispatch(event, payload);
    this.sync();
  },
  start() {
    this.dispatch('start');
    this.setData({ panel: 1, feedback: '' });
  },
  inspect(e) {
    const id = e.currentTarget.dataset.id;
    this.dispatch('inspect', id);
    this.setData({ activeModule: content.chapter.modules.find((m) => m.id === id) });
  },
  assemble() {
    this.dispatch('assembleStart');
    this.setData({ panel: 2, feedback: '', activeModule: null });
  },
  /** 点选组装的第一步：选中一个模块。 */
  select(e) {
    const id = e.currentTarget.dataset.id;
    if (store.read().assembled.includes(id)) return;
    this.setData({ selected: id, feedback: '已选择模块，请点击对应功能槽位；也可以直接拖入。' });
  },
  /** 点选组装的第二步：把选中的模块放进槽位。 */
  slotTap(e) {
    if (!this.data.selected) {
      this.setData({ feedback: '先选择下方的模块，再点击功能槽位。' });
      return;
    }
    this.placeAt(this.data.selected, e.currentTarget.dataset.id);
  },
  /** 组装落点判定：放对记录进度，放错抖动并解释原因。 */
  placeAt(id, slot) {
    if (!id || store.read().assembled.includes(id)) return;

    if (id === slot) {
      this.dispatch('place', id);
      this.setData({
        selected: null,
        feedback: '连接成功。每个模块各司其职，可信数据来自完整技术链路。'
      });
      return;
    }

    this.setData({ faultSlot: slot });
    clearTimeout(this.faultTimer);
    this.faultTimer = setTimeout(() => this.setData({ faultSlot: null }), 550);
    this.dispatch('mistake');
    const target = content.chapter.modules.find((m) => m.id === slot);
    this.setData({ feedback: target ? target.failure : '请将模块放入虚线槽位。' });
  },
  dragStart(e) {
    this.swipeOrigin = null;
    const id = e.currentTarget.dataset.id;
    if (store.read().assembled.includes(id)) return;

    const touch = e.touches[0];
    this.dragOrigin = { x: touch.clientX, y: touch.clientY };
    this.dragId = id;
    this.dragMoved = false;
    this.slotRects = [];
    // 先量出四个槽位的坐标，松手时用老坐标判定，避免拖动过程中布局变化。
    this.createSelectorQuery()
      .selectAll('.slot')
      .boundingClientRect((rects) => {
        this.slotRects = rects || [];
      })
      .exec();
  },
  dragMove(e) {
    if (!this.dragId || !e.touches.length) return;

    const touch = e.touches[0];
    const moved =
      Math.abs(touch.clientX - this.dragOrigin.x) + Math.abs(touch.clientY - this.dragOrigin.y);
    if (moved < 8) return;

    this.dragMoved = true;
    this.setData({
      drag: {
        x: touch.clientX - 62,
        y: touch.clientY - 28,
        name: content.chapter.modules.find((m) => m.id === this.dragId).name
      }
    });
  },
  dragEnd(e) {
    if (!this.dragId) return;

    const id = this.dragId;
    const point = e.changedTouches[0];
    if (this.dragMoved && point) {
      const rect = hitSlot(this.slotRects, point);
      if (rect) this.placeAt(id, rect.dataset.id);
      else this.setData({ feedback: '未放入功能槽位，模块已归位。可以点击模块，再点击目标槽位。' });
    }
    this.dragCancel();
  },
  dragCancel() {
    this.dragId = null;
    this.dragMoved = false;
    this.setData({ drag: null });
  },
  test() {
    this.dispatch('testStart');
    this.setData({ panel: 3, feedback: '' });
  },
  anomaly(e) {
    const id = e.currentTarget.dataset.id;
    this.dispatch('anomaly', id);
    this.setData({
      feedback:
        id === content.chapter.anomaly
          ? '已锁定测试点 B：偏差 +2.4%，超出教学阈值 ±0.5%。请继续追溯并修复。'
          : '这个测试点在教学阈值内。比较偏差的绝对值，找到超过 0.5% 的数据。'
    });
  },
  remedy(e) {
    const item = content.chapter.remedies.find((x) => x.id === e.currentTarget.dataset.id);
    this.dispatch('calibrate', item.id);
    this.setData({ feedback: item.feedback });
  },
  innovation() {
    this.dispatch('innovationStart');
    this.setData({ panel: 6, feedback: '' });
  },
  innovate(e) {
    const item = content.chapter.innovation.find((x) => x.id === e.currentTarget.dataset.id);
    this.dispatch('innovate', item.id);
    this.setData({ feedback: item.feedback });
  },
  finish() {
    if (store.read().innovated) wx.redirectTo({ url: '/pages/culture/culture' });
  },
  home() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
  onHide() {
    clearTimeout(this.faultTimer);
    this.setData({ faultSlot: null });
    this.dragCancel();
  },
  onUnload() {
    clearTimeout(this.faultTimer);
  },
  onResize() {
    this.dragCancel();
  }
});
