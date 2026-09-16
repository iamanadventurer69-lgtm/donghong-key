/**
 * 第一章第 4 屏的「实时实验台」：负载滑杆联动功率读数与波形。
 *
 * 波形与功率都是教学演示，和后面的精度题使用独立固定数据，两者不相关。
 * 断电时停止动画并清零读数，页面隐藏或组件卸载后也会停帧。
 */
const CANVAS_ID = '#wave';
const FRAME_INTERVAL = 32; // ms，约 30fps
/** 每个百分点负载对应的瓦数，只为了让读数看起来像真的。 */
const WATTS_PER_PERCENT = 23;
const LOAD_MIN = 20;
const LOAD_MAX = 100;

function clampLoad(value) {
  const n = Number(value) || LOAD_MIN;
  return Math.max(LOAD_MIN, Math.min(LOAD_MAX, n));
}

Component({
  properties: { calibrated: { type: Boolean, value: false } },
  data: { running: true, load: 60, power: '1380' },
  lifetimes: {
    ready() {
      this.alive = true;
      this.visible = true;
      this.init();
    },
    detached() {
      this.alive = false;
      this.stop();
      this.canvas = null;
    }
  },
  pageLifetimes: {
    show() {
      this.visible = true;
      this.start();
    },
    hide() {
      this.visible = false;
      this.stop();
    },
    resize() {
      this.init();
    }
  },
  methods: {
    /** 拖动负载：更新读数，波形由动画循环重绘。 */
    changeLoad(e) {
      const load = clampLoad(e.detail.value);
      this.setData({ load, power: this.data.running ? this.reading(load) : '0000' });
      this.draw();
    },
    toggle() {
      const running = !this.data.running;
      this.setData({ running, power: running ? this.reading(this.data.load) : '0000' });
      if (running) {
        this.start();
        return;
      }
      this.stop();
      this.draw();
    },
    /** 通电时的功率读数；断电统一显示 0000。 */
    reading(load) {
      return String(load * WATTS_PER_PERCENT);
    },
    stop() {
      if (this.frame != null && this.canvas) this.canvas.cancelAnimationFrame(this.frame);
      this.frame = null;
    },
    start() {
      this.stop();
      if (!this.canvas || !this.alive || !this.visible || !this.data.running) return;

      const tick = () => {
        if (!this.alive || !this.visible || !this.data.running) return;
        const now = Date.now();
        if (!this.last || now - this.last >= FRAME_INTERVAL) {
          this.phase = now / 350;
          this.draw();
          this.last = now;
        }
        this.frame = this.canvas.requestAnimationFrame(tick);
      };
      tick();
    },
    init() {
      this.stop();
      this.createSelectorQuery()
        .select(CANVAS_ID)
        .fields({ node: true, size: true })
        .exec((result) => {
          if (!this.alive || !result[0] || !result[0].node) return;

          const { node, width, height } = result[0];
          const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          this.canvas = node;
          this.w = width;
          this.h = height;
          node.width = width * info.pixelRatio;
          node.height = height * info.pixelRatio;
          this.ctx = node.getContext('2d');
          this.ctx.scale(info.pixelRatio, info.pixelRatio);
          this.draw();
          this.start();
        });
    },
    draw() {
      if (!this.ctx) return;

      const c = this.ctx;
      const w = this.w;
      const h = this.h;
      c.clearRect(0, 0, w, h);

      c.strokeStyle = '#deeff8';
      c.lineWidth = 1;
      for (let x = 0; x < w; x += 22) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(0, h / 2);
      c.lineTo(w, h / 2);
      c.stroke();

      c.strokeStyle = this.data.calibrated ? '#249dde' : '#66bde9';
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = h / 2 + this.waveOffset(x);
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    },
    /** 相对中线的波形偏移量；断电时是一条直线。 */
    waveOffset(x) {
      if (!this.data.running) return 0;
      const w = this.w;
      const h = this.h;
      const phase = this.phase || 0;
      return (Math.sin((x / w) * Math.PI * 5 - phase) * h * 0.38 * this.data.load) / 100;
    }
  }
});
