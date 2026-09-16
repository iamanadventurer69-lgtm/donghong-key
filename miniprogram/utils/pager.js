/**
 * 固定视窗的翻页手势：只认明显的横向滑动。
 *
 * 阈值同时排除点击（位移太小）、纵向滚动（纵向位移更大）和斜向手势，
 * 所以滑杆、拖拽区只要在模板上挡住事件，就不会误翻页。
 */
const MIN_DISTANCE = 55;
const RATIO = 1.5;

/** 返回 1 表示向后一屏，-1 表示向前一屏，0 表示不翻页。 */
function direction(start, end) {
  if (!start || !end) return 0;
  const dx = end.clientX - start.clientX;
  const dy = end.clientY - start.clientY;
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) <= Math.abs(dy) * RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

/** 各页面共用的翻页方法，通过 `...pager.methods` 混入 Page。 */
const methods = {
  swipeStart(e) {
    this.swipeOrigin = e.touches && e.touches[0];
  },
  swipeEnd(e) {
    const end = e.changedTouches && e.changedTouches[0];
    const d = direction(this.swipeOrigin, end);
    this.swipeOrigin = null;
    if (d > 0) this.nextPanel();
    if (d < 0) this.prevPanel();
  },
  swipeCancel() {
    this.swipeOrigin = null;
  },
  /** 页面内的交互区（拖拽、滑杆）用它顺手取消待判定的手势。 */
  holdGesture() {
    this.swipeOrigin = null;
  },
  nextPanel() {
    this.setData({ panel: Math.min(this.data.panelCount - 1, this.data.panel + 1) });
  },
  prevPanel() {
    this.setData({ panel: Math.max(0, this.data.panel - 1) });
  }
};

module.exports = { direction, methods };
