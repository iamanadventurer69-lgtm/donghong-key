/**
 * 首页 / 序章的能源网络示意图（Canvas 2D）。
 *
 * 中心「DH」代表电表本体，六个节点代表不同用电场景，按进度点亮；
 * 点亮后叠加脉冲光晕与沿线流动的光点，纯粹是剧情效果，不表示章节完成度。
 */
const CANVAS_ID = '#network';
const FRAME_INTERVAL = 32; // ms，约 30fps，够用又省电
const GRID_STEP = 24;
const CENTER = { x: 0.5, y: 0.48 };

/** 六个场景节点：相对坐标 + 名称，顺序即点亮顺序。 */
/** 标签字号跟着画布尺寸走：画布小的时候字也小一点，别撑满、也别被边缘切掉。 */
function labelFont(width, height) {
  return Math.max(9, Math.min(15, Math.round(Math.min(width * 0.028, height * 0.11))));
}

/** 中间电表的半径：画布矮的时候要跟着小，否则会把上半圈的标签挤到没法放。 */
function coreRadius(width, height) {
  return Math.max(16, Math.min(30, Math.round(Math.min(width, height) * 0.15)));
}

/** 节点圆点半径。 */
function nodeRadius(width, height) {
  return Math.max(3, Math.min(5, Math.round(Math.min(width, height) * 0.017)));
}

const NODES = [
  { x: 0.17, y: 0.25, label: '光伏' },
  { x: 0.5, y: 0.15, label: '充电桩' },
  { x: 0.83, y: 0.25, label: '数据中心' },
  { x: 0.17, y: 0.72, label: '智慧工厂' },
  { x: 0.5, y: 0.82, label: '楼宇' },
  { x: 0.83, y: 0.72, label: '输配电' }
];

const LIT = '#29a8e5';
const DIM = '#bedbea';

function drawGrid(c, w, h) {
  c.strokeStyle = '#d4eaf7';
  c.lineWidth = 0.6;
  for (let x = GRID_STEP / 2; x < w; x += GRID_STEP) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  for (let y = GRID_STEP / 2; y < h; y += GRID_STEP) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
}

Component({
  properties: {
    active: {
      type: Number,
      value: 0,
      observer() {
        this.draw();
      }
    }
  },
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
    stop() {
      if (this.frame != null && this.canvas) this.canvas.cancelAnimationFrame(this.frame);
      this.frame = null;
    },
    /** 动画循环；页面隐藏或组件卸载后不再续帧。 */
    start() {
      this.stop();
      if (!this.canvas || !this.alive || !this.visible) return;

      const tick = () => {
        if (!this.alive || !this.visible) return;
        const now = Date.now();
        if (!this.lastFrame || now - this.lastFrame >= FRAME_INTERVAL) {
          this.phase = now / 1300;
          this.draw();
          this.lastFrame = now;
        }
        this.frame = this.canvas.requestAnimationFrame(tick);
      };
      tick();
    },
    /** 量出画布尺寸并按设备像素比初始化，尺寸变化后会重新调用。 */
    init() {
      this.stop();
      this.createSelectorQuery()
        .select(CANVAS_ID)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!this.alive || !res[0] || !res[0].node) return;

          const { node, width, height } = res[0];
          const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          node.width = width * info.pixelRatio;
          node.height = height * info.pixelRatio;
          this.canvas = node;
          this.w = width;
          this.h = height;
          this.ctx = node.getContext('2d');
          this.ctx.scale(info.pixelRatio, info.pixelRatio);
          this.draw();
          this.start();
        });
    },
    draw() {
      if (!this.ctx || !this.canvas) return;

      const c = this.ctx;
      const w = this.w;
      const h = this.h;
      c.clearRect(0, 0, w, h);
      drawGrid(c, w, h);
      NODES.forEach((node, i) => this.drawNode(node, i));
      this.drawCore();
    },
    /** 单个场景：连线、节点、光晕、沿线流动的光点与名称。 */
    drawNode(node, index) {
      const c = this.ctx;
      const w = this.w;
      const h = this.h;
      const x = w * node.x;
      const y = h * node.y;
      const cx = w * CENTER.x;
      const cy = h * CENTER.y;
      const lit = index < this.data.active;
      const phase = this.phase || 0;

      c.strokeStyle = lit ? LIT : '#aecfe1';
      c.lineWidth = lit ? 2 : 1;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(x, cy);
      c.lineTo(x, y);
      c.stroke();

      c.fillStyle = lit ? LIT : DIM;
      c.beginPath();
      const dot = nodeRadius(w, h);
      c.arc(x, y, dot, 0, Math.PI * 2);
      c.fill();

      if (lit) {
        const pulse = (Math.sin(phase * 3 + index) + 1) / 2;
        c.strokeStyle = 'rgba(41,168,229,' + (0.15 + pulse * 0.4) + ')';
        c.beginPath();
        c.arc(x, y, dot * 1.7 + pulse * dot * 1.9, 0, Math.PI * 2);
        c.stroke();

        // 两个光点沿折线匀速前进：先横后竖，用曼哈顿长度换算进度。
        const dx = x - cx;
        const dy = y - cy;
        const length = Math.abs(dx) + Math.abs(dy);
        for (let k = 0; k < 2; k += 1) {
          const travelled = ((phase * 0.55 + k * 0.5 + index * 0.11) % 1) * length;
          const alongX = travelled < Math.abs(dx);
          const px = alongX ? cx + Math.sign(dx) * travelled : x;
          const py = alongX ? cy : cy + Math.sign(dy) * (travelled - Math.abs(dx));
          c.fillStyle = '#168ac6';
          c.beginPath();
          c.arc(px, py, 2.5, 0, Math.PI * 2);
          c.fill();
        }
      }

      // 标签：字号随画布缩放，并夹在画布内（原来固定 10px、固定 +23px 偏移，画布一矮就被切）
      const size = labelFont(w, h);
      c.font = '600 ' + size + 'px sans-serif';
      c.textAlign = 'center';
      c.fillStyle = lit ? '#24668e' : '#6f93a9';
      c.textBaseline = 'middle';
      const half = c.measureText(node.label).width / 2;
      const minX = half + 6;
      const maxX = Math.max(minX, w - half - 6);
      const minY = size / 2 + 4;
      const maxY = Math.max(minY, h - size / 2 - 4);
      // 朝外画：上半圈的标签放节点上方，否则会顶到中间的 DH 电表；下半圈放下面。
      const gap = size * 0.9 + 7;
      const outward = y < cy ? y - gap : y + gap;
      c.fillText(
        node.label,
        Math.min(Math.max(x, minX), maxX),
        Math.min(Math.max(outward, minY), maxY)
      );
    },
    /** 中心电表：外扩的光环 + 白底圆 + DH 字样。 */
    drawCore() {
      const c = this.ctx;
      const w = this.w;
      const h = this.h;
      const cx = w * CENTER.x;
      const cy = h * CENTER.y;
      const halo = ((this.phase || 0) * 0.45) % 1;

      c.strokeStyle = 'rgba(59,175,232,' + (1 - halo) * 0.4 + ')';
      c.lineWidth = 1;
      c.beginPath();
      const radius = coreRadius(w, h);
      c.arc(cx, cy, radius * 1.1 + halo * radius * 0.8, 0, Math.PI * 2);
      c.stroke();

      c.fillStyle = '#ffffff';
      c.strokeStyle = '#3bafe8';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#238fca';
      c.font = 'bold ' + Math.max(11, Math.min(20, Math.round(radius * 0.65))) + 'px monospace';
      c.textAlign = 'center';
      c.fillText('DH', cx, cy + 6);
    }
  }
});
