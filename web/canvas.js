/**
 * 两处 Canvas 效果的网页版实现（对应小程序的 energy-network 与 live-meter 组件），
 * 绘制逻辑与小程序保持一致，只是把组件生命周期换成 start / stop。
 */
(function (App) {
  /* ============ 能源网络（首页、序章） ============ */
  const GRID_STEP = 24;
  const CENTER = { x: 0.5, y: 0.48 };
  const LIT = '#29a8e5';
  const DIM = '#bedbea';
  const NODES = [
    { x: 0.17, y: 0.25, label: '光伏' },
    { x: 0.5, y: 0.15, label: '充电桩' },
    { x: 0.83, y: 0.25, label: '数据中心' },
    { x: 0.17, y: 0.72, label: '智慧工厂' },
    { x: 0.5, y: 0.82, label: '楼宇' },
    { x: 0.83, y: 0.72, label: '输配电' }
  ];

  /** 标签字号跟着画布尺寸走：画布小的时候字也小一点，别撑满、也别被边缘切掉。 */
  function labelFont(width, height) {
    return Math.max(9, Math.min(15, Math.round(Math.min(width * 0.028, height * 0.11))));
  }

  App.network = function network(canvas, getActive) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let phase = 0;
    let raf = null;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function grid() {
      ctx.strokeStyle = '#d4eaf7';
      ctx.lineWidth = 0.6;
      for (let x = GRID_STEP / 2; x < width; x += GRID_STEP) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = GRID_STEP / 2; y < height; y += GRID_STEP) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    function drawNode(node, index, active) {
      const x = width * node.x;
      const y = height * node.y;
      const cx = width * CENTER.x;
      const cy = height * CENTER.y;
      const lit = index < active;

      ctx.strokeStyle = lit ? LIT : '#aecfe1';
      ctx.lineWidth = lit ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = lit ? LIT : DIM;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      if (lit) {
        const pulse = (Math.sin(phase * 3 + index) + 1) / 2;
        ctx.strokeStyle = 'rgba(41,168,229,' + (0.15 + pulse * 0.4) + ')';
        ctx.beginPath();
        ctx.arc(x, y, 8 + pulse * 9, 0, Math.PI * 2);
        ctx.stroke();

        const dx = x - cx;
        const dy = y - cy;
        const length = Math.abs(dx) + Math.abs(dy);
        for (let k = 0; k < 2; k += 1) {
          const travelled = ((phase * 0.55 + k * 0.5 + index * 0.11) % 1) * length;
          const alongX = travelled < Math.abs(dx);
          const px = alongX ? cx + Math.sign(dx) * travelled : x;
          const py = alongX ? cy : cy + Math.sign(dy) * (travelled - Math.abs(dx));
          ctx.fillStyle = '#168ac6';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 标签：字号随画布缩放，并夹在画布内——原来固定 10px、固定 +23px 偏移，
      // 画布一矮（手机/窄栏）就会被上下边缘切掉半个字。
      const size = labelFont(width, height);
      ctx.font = `600 ${size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = lit ? '#24668e' : '#6f93a9';
      const half = ctx.measureText(node.label).width / 2;
      const minX = half + 6;
      const maxX = Math.max(minX, width - half - 6);
      const minY = size / 2 + 4;
      const maxY = Math.max(minY, height - size / 2 - 4);
      ctx.fillText(
        node.label,
        Math.min(Math.max(x, minX), maxX),
        Math.min(Math.max(y + 20, minY), maxY)
      );
    }

    function drawCore() {
      const cx = width * CENTER.x;
      const cy = height * CENTER.y;
      const halo = (phase * 0.45) % 1;

      ctx.strokeStyle = 'rgba(59,175,232,' + (1 - halo) * 0.4 + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 33 + halo * 23, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3bafe8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const coreSize = Math.max(12, Math.min(22, Math.round(Math.min(width, height) * 0.05)));
      ctx.fillStyle = '#238fca';
      ctx.font = `bold ${coreSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DH', cx, cy);
    }

    function draw() {
      if (!width || !height) resize();
      const active = getActive();
      ctx.clearRect(0, 0, width, height);
      grid();
      NODES.forEach((node, index) => drawNode(node, index, active));
      drawCore();
    }

    let last = 0;
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (now - last < 32) return;
      last = now;
      phase = now / 1300;
      draw();
    }

    function start() {
      if (raf == null) raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
    }

    resize();
    draw();
    if (!canvas.dataset.staticOnly) start();
    window.addEventListener('resize', () => {
      resize();
      draw();
    });
    App.onCleanup(stop);
    return { start, stop, resize, draw };
  };
})(window.DHKApp);
