/**
 * 网页版小游戏：小游戏区、文化跳格子（按压蓄力选答案）、模块配对（牌面正面朝上）、
 * 知识答题，以及通关结算。对应小程序的 pages/games、hop、flip、quiz。
 *
 * 高频交互（三消 / 蓄力指针）用直改 DOM + 自己的定时器；定时器在离开页面时自停
 * （tick 里检查当前路由），避免切屏后还在跑。
 */
(function (App) {
  const { state, content, esc } = App;
  const store = () => window.DHKStore;
  const here = (hash) => location.hash === hash;
  const $ = (id) => document.getElementById(id);

  const GAME_LIST = [
    {
      id: 'hop',
      hash: '#/hop',
      icon: '🦘',
      name: '文化跳格子',
      hint: '按住蓄力，指针停在哪就选哪'
    },
    {
      id: 'flip',
      hash: '#/flip',
      icon: '🃏',
      name: '模块配对',
      hint: '牌都正面朝上，直接点两张配对'
    },
    { id: 'quiz', hash: '#/quiz', icon: '📝', name: '知识答题', hint: '十题一百分，答完给解释' }
  ];

  function gameDone(id, s) {
    if (id === 'hop') return s.games.hop.done;
    return s.games[id].done;
  }

  function gameScore(id, s) {
    const g = s.games;
    if (id === 'hop')
      return g.hop.done
        ? `通关 · 错 ${g.hop.wrong} 次`
        : g.hop.right + g.hop.wrong
          ? `第 ${g.hop.tile} 格`
          : '';
    if (id === 'flip') return g.flip.done ? `${g.flip.moves} 步` : '';
    if (id === 'quiz') return g.quiz.done ? `${g.quiz.score} 分` : '';
    return '';
  }

  /* ==================== 小游戏区 ==================== */
  App.register(
    '#/games',
    () => {
      const s = store().read();
      // 解锁条件：企业文化学习 + 文化画像测试全部完成
      const unlocked = App.testDone(s);
      const done = GAME_LIST.filter((game) => gameDone(game.id, s)).length;

      App.mount(
        `
        ${App.topbar('CHALLENGE ZONE / 闯关小游戏', '<button class="text-button" data-action="back">返回首页</button>')}
        <div class="hud ${unlocked ? '' : 'locked'}">
          <div class="row"><span class="label">${unlocked ? '小游戏进度' : '尚未解锁'}</span><span class="hud-num">${done} / ${GAME_LIST.length}</span></div>
          <div class="track"><div class="track-fill" style="width:${(done / GAME_LIST.length) * 100}%"></div></div>
          <div class="small muted">${unlocked ? '选一个开始，成绩都会记进探索档案' : '完成「文化画像测试」（学习 + 值班 / 认证 / 组卡）后解锁'}</div>
        </div>
        <div class="list">
          ${GAME_LIST.map((game) => {
            const finished = gameDone(game.id, s);
            const score = gameScore(game.id, s);
            return `<button class="game ${finished ? 'done' : ''}" data-action="open" data-id="${game.id}">
              <span class="game-icon">${game.icon}</span>
              <div class="game-main">
                <span class="game-name">${esc(game.name)}</span>
                <span class="game-hint">${esc(game.hint)}</span>
              </div>
              ${score ? `<span class="game-score">${esc(score)}</span>` : ''}
              <span class="game-state">${finished ? '✓' : unlocked ? '›' : '🔒'}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="feedback" id="games-feedback" hidden></div>
        <div class="hint">${unlocked ? '成绩计入通关结算的 GRADE 评级' : '小游戏：跳格子 / 配对 / 三消 / 答题'}</div>
        ${unlocked ? '<button class="secondary" data-action="to-final">查看通关结算 →</button>' : '<button class="secondary" data-action="to-test">← 先去完成文化画像测试</button>'}
        ${App.warning()}`,
        (root) => {
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'back') return App.go('#/home');
            if (action === 'to-test')
              return App.go(`#/test/${App.TEST_STEPS[App.testStep(store().read())].id}`);
            if (action === 'to-final') return App.go('#/final');
            if (action === 'open') {
              if (!unlocked) {
                const feedback = root.querySelector('#games-feedback');
                feedback.textContent =
                  '先完成文化画像测试（学习 + 值班 / 认证 / 组卡），再来闯关。';
                feedback.hidden = false;
                return;
              }
              const game = GAME_LIST.find((item) => item.id === hit.dataset.id);
              App.go(game.hash);
            }
          });
        }
      );
    },
    'games'
  );

  /* ==================== 文化跳格子：跳一跳式场景 + 按压蓄力选答案 ==================== */
  const HOP = content.hopGame;
  const HOP_TOTAL = HOP.tiles.length;
  /** 指针扫过一项所需时间（毫秒）：按住越久走得越远。 */
  const HOP_STEP_MS = 360;
  /**
   * 等距场景：viewBox 直接用容器的像素尺寸（1:1 映射），平台大小与间距按宽度换算，
   * 当前平台永远放在容器中央稍偏下——这样窄屏手机也不会把棋子挤出可视区。
   */
  function hopLayout(stage) {
    const w = Math.max(240, Math.round(stage.clientWidth || 414));
    const h = Math.max(320, Math.round(stage.clientHeight || 620));
    const half = Math.max(42, Math.min(96, Math.round(w * 0.13)));
    return {
      w,
      h,
      half,
      thick: Math.round(half * 0.62),
      dx: Math.round(half * 2.55),
      dy: -Math.round(half * 1.05),
      // 当前平台放在可视区中央偏上一点：上面有问题卡、下面有工作栏
      base: { x: w / 2, y: h * 0.52 }
    };
  }

  let hopPointer = 0;
  let hopCharging = false;
  let hopRaf = null;
  let hopStartedAt = 0;
  let hopResult = null;
  let hopLastTile = -1; // 上一帧站着的格子，用来算出「从哪跳过来」
  let hopCharge = 0; // 本次按压的蓄力值 0~1（最长按 900ms 算满）
  let hopAnim = ''; // '' 静止 / 'jump' 起跳落地 / 'bump' 没跳过去的抖动
  const HOP_CHARGE_MS = 1600; // 蓄力更慢：蹲到位要 1.6 秒

  /** 第 index 格相对当前格 tile 的场景坐标（当前格永远在同一个位置）。 */
  function hopCenter(index, tile, layout) {
    const step = index - tile;
    const shuffle = (index % 2 === 0 ? -1 : 1) * Math.round(layout.half * 0.2); // 左右轻微错开
    return {
      x: layout.base.x + step * layout.dx,
      y: layout.base.y + step * layout.dy + shuffle
    };
  }

  /** 一块等距平台（顶面菱形 + 两个侧面），三种造型轮着来。 */
  function hopPlatform(index, tile, layout) {
    const { x, y } = hopCenter(index, tile, layout);
    const half = layout.half;
    const quarter = Math.round(half * 0.5);
    const thick = layout.thick;
    const lit = index === tile;
    const past = index < tile;
    const topFill = lit ? '#fbfcfe' : past ? '#e7e9ec' : '#f3f5f7';
    const sideA = lit ? '#93a9bd' : past ? '#9aa0a6' : '#a4aab1';
    const sideB = lit ? '#b7cad9' : past ? '#bcc1c6' : '#c3c7cc';
    const kind = index % 3;

    const top = `M ${x} ${y - quarter} L ${x + half} ${y} L ${x} ${y + quarter} L ${x - half} ${y} Z`;
    const left = `M ${x - half} ${y} L ${x} ${y + quarter} L ${x} ${y + quarter + thick} L ${x - half} ${y + thick} Z`;
    const right = `M ${x + half} ${y} L ${x} ${y + quarter} L ${x} ${y + quarter + thick} L ${x + half} ${y + thick} Z`;

    const shadow = `<ellipse cx="${x + 26}" cy="${y + quarter + thick + 10}" rx="${half * 0.95}" ry="${quarter * 0.72}" fill="#3d4a57" opacity="${lit ? 0.16 : 0.1}"/>`;
    const number = `<text x="${x}" y="${y + Math.round(half * 0.12)}" text-anchor="middle" font-family="Menlo, monospace" font-size="${Math.round(half * 0.36)}" font-weight="700" fill="${lit ? '#7d8b99' : '#a7aeb6'}">${index + 1}</text>`;

    const wrap = (inner) => `${shadow}<g class="hop-plat ${lit ? 'current' : ''}">${inner}</g>`;

    if (kind === 1) {
      // 圆柱：椭圆顶 + 弧底筒身
      const body = `M ${x - half} ${y} L ${x - half} ${y + thick} A ${half} ${quarter} 0 0 0 ${x + half} ${y + thick} L ${x + half} ${y} Z`;
      return wrap(`<path d="${body}" fill="${sideA}"/>
        <ellipse cx="${x}" cy="${y}" rx="${half}" ry="${quarter}" fill="${topFill}"/>
        <ellipse cx="${x}" cy="${y}" rx="${half * 0.66}" ry="${quarter * 0.62}" fill="none" stroke="#d8dde2" stroke-width="${Math.max(3, Math.round(half * 0.08))}"/>
        ${number}`);
    }

    if (kind === 2) {
      // 条纹方台：侧面加两层浅色条
      const stripes = [0.34, 0.62]
        .map(
          (f) =>
            `<path d="M ${x - half} ${y + thick * f} L ${x} ${y + quarter + thick * f} L ${x + half} ${y + thick * f} L ${x} ${y + quarter + thick * f + 8} Z" fill="#ffffff" opacity="0.35"/>`
        )
        .join('');
      return wrap(`<path d="${left}" fill="${sideA}"/>
        <path d="${right}" fill="${sideB}"/>
        ${stripes}
        <path d="${top}" fill="${topFill}"/>
        ${number}`);
    }

    return wrap(`<path d="${left}" fill="${sideA}"/>
      <path d="${right}" fill="${sideB}"/>
      <path d="${top}" fill="${topFill}"/>
      <path d="${top}" fill="none" stroke="#e2e6ea" stroke-width="1.5"/>
      ${number}`);
  }

  /**
   * 棋子：外层 .pawn-pos 负责位置与跳跃位移，内层 .pawn-body 负责蓄力下蹲与落地压扁
   * （两个变换分开，才不会互相覆盖）。charge 是松手时的蓄力值 0~1，决定跳多高。
   */
  function hopPawn(tile, anim, charge, landing, layout) {
    const { x, y } = hopCenter(tile, tile, layout);
    // 注意：位置必须写成基础 transform（--tx/--ty），否则静止时棋子会跑到 SVG 原点
    const from =
      hopLastTile >= 0 && hopLastTile !== tile ? hopCenter(hopLastTile, tile, layout) : null;
    const lift = layout.h * 0.18 + charge * layout.h * 0.14; // 蓄力越久，抛物线顶点越高
    const style = from
      ? `--fx:${from.x}px;--fy:${from.y}px;--mx:${(from.x + x) / 2}px;--my:${(from.y + y) / 2 - lift}px;--tx:${x}px;--ty:${y}px;`
      : `--tx:${x}px;--ty:${y}px;`;
    return `<g class="pawn-pos ${anim}" style="${style}">
      <g class="pawn-body ${anim === 'jump' ? 'takeoff' : ''} ${landing}" style="--charge:0">
        <ellipse cx="2" cy="4" rx="19" ry="7" fill="#39424d" opacity="0.18"/>
        <path d="M -12 0 C -15 -30 -7 -41 0 -43 C 7 -41 15 -30 12 0 Z" fill="#3b3a5c"/>
        <path d="M -12 0 C -15 -30 -7 -41 0 -43 L 0 0 Z" fill="#2f2e4a" opacity="0.55"/>
        <circle cx="0" cy="-53" r="10" fill="#2f2e4a"/>
        <circle cx="-3.5" cy="-56" r="3" fill="#6a6a9a" opacity="0.8"/>
      </g>
    </g>`;
  }

  /** 整块场景：地面渐变 + 平台 + 棋子。 */
  function hopBoardSvg(tile, anim, charge, landing, layout) {
    const from = Math.max(0, tile - 1);
    const to = Math.min(HOP_TOTAL - 1, tile + 3);
    const platforms = [];
    for (let index = from; index <= to; index += 1)
      platforms.push(hopPlatform(index, tile, layout));
    return `<svg class="hop-board" viewBox="0 0 ${layout.w} ${layout.h}" aria-label="跳格子场景">
      <defs>
        <linearGradient id="hop-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#dde1e6"/>
          <stop offset="55%" stop-color="#eceef1"/>
          <stop offset="100%" stop-color="#f5f6f8"/>
        </linearGradient>
      </defs>
      <rect width="${layout.w}" height="${layout.h}" fill="url(#hop-ground)"/>
      ${platforms.join('')}
      ${hopPawn(tile, anim, charge, landing, layout)}
    </svg>`;
  }

  /** 三角波：0 → n-1 → 0 往返，按压时间变成指针位置。 */
  function hopWave(elapsed, count) {
    const span = count - 1;
    if (span <= 0) return 0;
    const period = 2 * span;
    const pos = (((elapsed / HOP_STEP_MS) % period) + period) % period;
    return pos <= span ? pos : period - pos;
  }

  App.register(
    '#/hop',
    () => {
      // 先按容器实际尺寸算场景参数：viewBox 与像素 1:1，任何屏幕都能看到棋子和平台
      const layout = hopLayout(document.getElementById('app'));
      const s = store().read();
      const hop = s.games.hop;
      const tile = Math.min(hop.tile, HOP_TOTAL - 1);
      const current = HOP.tiles[tile];
      const done = hop.done;
      // 刚进入本页：把棋子直接放在当前格，不做跳跃动画
      const entering = App.prevHash !== '#/hop';
      if (entering) {
        hopResult = null;
        hopLastTile = tile;
      }
      if (entering) hopAnim = '';
      const anim = hopAnim;
      // 跳跃落地后压一下，再回弹
      const landing = anim === 'jump' ? 'land' : '';

      const rows = current.options
        .map((option, index) => {
          let cls = '';
          if (hopResult && index === hopResult.index) cls = hopResult.right ? 'right' : 'wrong';
          else if (!hopResult && hopCharging && Math.round(hopPointer) === index) cls = 'focus';
          return `<div class="hop-row ${cls}" data-row="${index}"><span class="letter">${'ABCD'[index]}</span><span>${esc(option)}</span></div>`;
        })
        .join('');

      App.mount(
        `
        <div class="hop-stage">
          ${hopBoardSvg(tile, anim, hopCharge, landing, layout)}
          <div class="hop-score">${hop.tile}<small>/ ${HOP_TOTAL} 格</small></div>
          <div class="topline">
            <button class="text-button" data-action="back">返回闯关</button>
          </div>
          <div class="hop-problem">
            <div class="hop-tile-head">
              <span class="hop-tile-index">第 ${tile + 1} 格 · 答对 ${hop.right} · 答错 ${hop.wrong}</span>
            </div>
            <div class="hop-point">${esc(current.point)}</div>
            <div class="hop-question">${esc(current.question)}</div>
          </div>
          ${
            hopResult
              ? `<div class="hop-feedback ${hopResult.right ? 'good' : 'bad'}">${esc(hopResult.text)}${
                  hopResult.right ? '<span class="hop-auto">正在进入下一格…</span>' : ''
                }</div>
                 ${
                   hopResult.right
                     ? ''
                     : '<div class="hop-actions"><button class="primary" data-action="retry">重新选一次</button></div>'
                 }`
              : `<div class="hop-dock" id="hop-dock">
                   <div class="hop-pointer" id="hop-pointer"></div>
                   <div class="hop-rows" id="hop-rows">${rows}</div>
                   <button class="hop-charge" id="hop-charge">按住蓄力 · 松手选中</button>
                 </div>
                 <div class="hop-press-hint">按住按钮蓄力时棋子会下蹲 · 指针上下移动 · 松手即选中</div>`
          }
          ${
            done && !hopResult
              ? `<div class="mask"><div class="sheet">
                  <div class="win-title">🏁 你走到了终点</div>
                  <div class="win-text">${esc(HOP.finish)}</div>
                  <div class="win-stats">共答对 ${hop.right} 题，答错 ${hop.wrong} 次</div>
                  <div class="win-rank">${hop.wrong <= 2 ? '⭐ 几乎没失手' : hop.wrong <= 6 ? '👍 稳稳走完了全程' : '💪 走完了，回头再看错过的格子'}</div>
                  <button class="primary" data-action="back">回到小游戏 →</button>
                </div></div>`
              : ''
          }
        </div>
        ${App.warning()}`,
        (root) => {
          const dock = root.querySelector('#hop-dock');
          const pointerNode = root.querySelector('#hop-pointer');

          const rowsBox = root.querySelector('#hop-rows');

          const paintPointer = () => {
            if (!dock || !pointerNode || !rowsBox) return;
            const rowNodes = rowsBox.querySelectorAll('.hop-row');
            if (rowNodes.length === 0) return;
            const rowHeight = rowsBox.clientHeight / rowNodes.length;
            const index = Math.round(hopPointer);
            pointerNode.style.height = `${rowHeight - 8}px`;
            pointerNode.style.top = `${rowsBox.offsetTop + index * rowHeight + 4}px`;
            rowNodes.forEach((row, i) => row.classList.toggle('focus', i === index));
          };

          const pawnBody = root.querySelector('.pawn-body');
          const currentPlat = root.querySelector('.hop-plat.current');
          // 平台下压时顶面会下沉，棋子要跟着沉这么多
          const platformSink = layout.half * 0.5 + layout.thick;

          const stopCharging = () => {
            if (hopRaf != null) cancelAnimationFrame(hopRaf);
            hopRaf = null;
            hopCharging = false;
            if (dock) dock.classList.remove('charging');
            if (pawnBody) pawnBody.classList.remove('charging');
          };

          const tick = () => {
            hopRaf = requestAnimationFrame(tick);
            const held = performance.now() - hopStartedAt;
            hopPointer = hopWave(held, current.options.length);
            hopCharge = Math.min(1, held / HOP_CHARGE_MS);
            // 按住不放：棋子下蹲，脚下的平台同步下压，棋子随平台一起沉下去
            if (pawnBody) {
              pawnBody.style.setProperty('--charge', hopCharge.toFixed(2));
              pawnBody.style.setProperty(
                '--drop',
                (hopCharge * platformSink * 0.3).toFixed(1) + 'px'
              );
            }
            if (currentPlat) currentPlat.style.setProperty('--charge', hopCharge.toFixed(2));
            paintPointer();
          };

          const begin = () => {
            if (hopResult || done || !dock) return;
            hopCharging = true;
            hopStartedAt = performance.now();
            hopPointer = 0;
            hopCharge = 0;
            dock.classList.add('charging');
            if (pawnBody) {
              pawnBody.classList.add('charging');
              pawnBody.style.setProperty('--charge', '0');
              pawnBody.style.setProperty('--drop', '0px');
            }
            if (currentPlat) currentPlat.style.setProperty('--charge', '0');
            paintPointer();
            if (hopRaf == null) hopRaf = requestAnimationFrame(tick);
          };

          const release = () => {
            if (!hopCharging) return;
            hopCharge = Math.min(1, (performance.now() - hopStartedAt) / HOP_CHARGE_MS);
            stopCharging();
            const index = Math.max(0, Math.min(current.options.length - 1, Math.round(hopPointer)));
            const right = index === current.answer;
            hopLastTile = hop.tile;
            store().dispatch('hopAnswer', { index: hop.tile, choice: index });
            hopAnim = right ? 'jump' : 'bump';
            hopResult = right
              ? { right: true, index, text: `${HOP.forward} ${current.explain}` }
              : { right: false, index, text: HOP.wrong };
            App.render();
            if (right) {
              // 跳过去了：看一眼解释就自动进入下一格（不用再点按钮）
              App.after(1200, () => {
                hopResult = null;
                hopAnim = '';
                hopLastTile = Math.min(store().read().games.hop.tile, HOP_TOTAL - 1);
                if (store().read().games.hop.done) App.go('#/games');
                else App.render();
              });
            }
          };

          // 按住「蓄力按钮」或工作栏任意位置都能蓄力
          for (const target of [dock, root.querySelector('#hop-charge')]) {
            if (!target) continue;
            for (const [down, up] of [
              ['pointerdown', 'pointerup'],
              ['touchstart', 'touchend'],
              ['mousedown', 'mouseup']
            ]) {
              target.addEventListener(down, (event) => {
                event.preventDefault();
                begin();
              });
              target.addEventListener(up, (event) => {
                event.preventDefault();
                release();
              });
            }
            target.addEventListener('pointercancel', () => {
              stopCharging();
              App.render();
            });
          }
          paintPointer();

          App.onCleanup(stopCharging);

          // 窗口尺寸变化时重新排一遍场景
          const onResize = () => App.render();
          window.addEventListener('resize', onResize);
          App.onCleanup(() => window.removeEventListener('resize', onResize));

          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'back') {
              hopResult = null;
              return App.go('#/games');
            }
            if (action === 'retry') {
              hopResult = null;
              hopAnim = '';
              hopLastTile = Math.min(store().read().games.hop.tile, HOP_TOTAL - 1);
              return App.render();
            }
            if (action === 'go') {
              hopResult = null;
              hopAnim = '';
              // 已经跳过来了，重置起点，避免再播一次跳跃动画
              hopLastTile = Math.min(store().read().games.hop.tile, HOP_TOTAL - 1);
              if (store().read().games.hop.done) return App.go('#/games');
              return App.render();
            }
          });
        }
      );
    },
    'hop'
  );

  /* ==================== 模块配对：牌面全部正面朝上，直接点两张配对 ==================== */
  const FLIP_PAIRS = content.memory.length / 2;
  let flipDeck = null;
  let flipOpen = [];
  let flipMatched = 0;
  let flipMoves = 0;
  let flipSeconds = 0;
  let flipTimer = null;
  let flipBusy = false;
  let flipWon = false;

  function flipTimeText(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function flipReset() {
    flipDeck = content.memory
      .map((card) => ({ ...card, done: false, bad: false }))
      .sort(() => Math.random() - 0.5);
    flipOpen = [];
    flipMatched = 0;
    flipMoves = 0;
    flipSeconds = 0;
    flipBusy = false;
    flipWon = false;
    if (flipTimer) clearInterval(flipTimer);
    flipTimer = null;
  }

  function flipClock() {
    if (flipTimer) return;
    flipTimer = setInterval(() => {
      if (!here('#/flip')) {
        clearInterval(flipTimer);
        flipTimer = null;
        return;
      }
      flipSeconds += 1;
      const node = $('flip-time');
      if (node) node.textContent = flipTimeText(flipSeconds);
    }, 1000);
  }

  App.register(
    '#/flip',
    () => {
      if (!flipDeck) flipReset();
      App.mount(
        `
        ${App.topbar('MEMORY / 模块配对', '<button class="text-button" data-action="back">返回闯关</button>')}
        <div class="hud">
          <div class="hud-item"><span class="hud-val" id="flip-moves">${flipMoves}</span><span class="hud-lbl">步数</span></div>
          <div class="hud-item"><span class="hud-val"><span id="flip-pairs">${flipMatched}</span><span class="hud-sub">/${FLIP_PAIRS}</span></span><span class="hud-lbl">配对</span></div>
          <div class="hud-item"><span class="hud-val" id="flip-time">${flipTimeText(flipSeconds)}</span><span class="hud-lbl">用时</span></div>
        </div>
        <div class="grid" id="flip-grid">
          ${flipDeck
            .map(
              (
                card,
                index
              ) => `<div class="card ${card.done ? 'matched' : ''} ${card.bad ? 'bad' : ''} ${flipOpen.includes(index) ? 'picked' : ''}" data-index="${index}">
                <span class="emoji">${card.emoji}</span>
                <span class="label">${esc(card.face)}</span>
              </div>`
            )
            .join('')}
        </div>
        <button class="secondary" data-action="restart">🔄 重新开始</button>
        <div class="hint">牌面都是正面：点两张能配成对的（名字 ↔ 职责） · 共 ${FLIP_PAIRS} 对</div>
        <div class="mask" id="flip-win" ${flipWon ? '' : 'hidden'}><div class="sheet">
          <div class="win-title">🎉 全部配对成功！</div>
          <div class="win-text">用时 ${flipTimeText(flipSeconds)}，共 ${flipMoves} 步</div>
          <div class="win-rank">${flipMoves <= FLIP_PAIRS + 4 ? '⭐ 一眼看穿' : '👍 稳稳配对'}</div>
          <button class="primary" data-action="back">回到小游戏 →</button>
          <button class="secondary" data-action="restart">🔄 再来一局</button>
        </div></div>
        ${App.warning()}`,
        (root) => {
          const paint = () => {
            flipDeck.forEach((card, index) => {
              const node = root.querySelector(`.card[data-index="${index}"]`);
              node.classList.toggle('matched', card.done);
              node.classList.toggle('bad', card.bad);
              node.classList.toggle('picked', flipOpen.includes(index));
            });
            $('flip-moves').textContent = flipMoves;
            $('flip-pairs').textContent = flipMatched;
            $('flip-time').textContent = flipTimeText(flipSeconds);
          };

          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'back') return App.go('#/games');
            if (action === 'restart') {
              flipReset();
              return App.render();
            }
          });

          App.on(root, '.card', 'click', (event, hit) => {
            if (flipBusy || flipWon) return;
            const index = Number(hit.dataset.index);
            const card = flipDeck[index];
            if (card.done || flipOpen.includes(index)) return;

            flipClock();
            if (flipOpen.length === 0) {
              flipOpen = [index];
              return paint();
            }

            const firstIndex = flipOpen[0];
            const first = flipDeck[firstIndex];
            flipMoves += 1;
            if (first.pair === card.pair) {
              first.done = true;
              card.done = true;
              flipMatched += 1;
              flipOpen = [];
              paint();
              if (flipMatched === FLIP_PAIRS) {
                flipWon = true;
                if (flipTimer) clearInterval(flipTimer);
                flipTimer = null;
                store().dispatch('flipResult', { moves: flipMoves, seconds: flipSeconds });
                $('flip-win').hidden = false;
                $('flip-win').querySelector('.win-text').textContent =
                  `用时 ${flipTimeText(flipSeconds)}，共 ${flipMoves} 步`;
              }
              return;
            }

            card.bad = true;
            first.bad = true;
            flipOpen = [];
            flipBusy = true;
            paint();
            App.after(420, () => {
              card.bad = false;
              first.bad = false;
              flipBusy = false;
              paint();
            });
          });
        }
      );
    },
    'flip'
  );

  /* ==================== 知识答题 ==================== */
  const BANK = content.quizBank;
  let quizChosen = -1;
  let quizAnswered = false;

  App.register('#/quiz', () => {
    const s = store().read();
    const results = s.games.quiz.results;
    const finished = results.length >= BANK.length;
    const index = Math.min(results.length, BANK.length - 1);
    const question = BANK[index];
    const letters = ['A', 'B', 'C', 'D'];

    const dots = BANK.map((_, i) => {
      let state_ = '';
      if (i < results.length) state_ = results[i] ? 'done' : 'wrong';
      else if (i === index) state_ = 'cur';
      return `<div class="dot ${state_}"></div>`;
    }).join('');

    const review = finished
      ? `<div class="review">
          <div class="review-title">逐题回顾</div>
          ${BANK.map(
            (item, i) =>
              `<div class="review-item">
                <span class="mark">${results[i] ? '✅' : '❌'}</span>
                <div class="review-main">
                  <span class="review-q">${i + 1}. ${esc(item.q)}</span>
                  <span class="review-a">正确答案：${letters[item.ans]} ${esc(item.opts[item.ans])}</span>
                </div>
              </div>`
          ).join('')}
        </div>`
      : '';

    App.mount(
      `
      ${App.topbar('QUIZ / 知识答题', '<button class="text-button" data-action="back">返回闯关</button>')}
      ${
        finished
          ? `<div class="result">
              <div class="result-title">🏆 答题完成！</div>
              <div class="result-score">${s.games.quiz.score}</div>
              <div class="result-lbl">总分（满分 100）</div>
              <div class="result-rank">${s.games.quiz.score >= 80 ? '⭐ 文化通' : s.games.quiz.score >= 60 ? '👍 不错' : '💪 再来一遍会更熟'}</div>
            </div>
            ${review}
            <button class="secondary" data-action="restart">🔄 重新挑战</button>
            <button class="primary" data-action="back">回到小游戏 →</button>`
          : `<div class="dots">${dots}</div>
            <div class="card">
              <div class="q-num">第 ${index + 1} / ${BANK.length} 题</div>
              <div class="q-text">${esc(question.q)}</div>
              <div class="q-opts">
                ${question.opts
                  .map((option, i) => {
                    const cls = quizAnswered
                      ? `${i === question.ans ? 'right' : ''} ${i === quizChosen && quizChosen !== question.ans ? 'wrong' : ''}`
                      : '';
                    return `<button class="option ${cls}" data-action="answer" data-index="${i}"><span class="letter">${letters[i]}</span><span>${esc(option)}</span></button>`;
                  })
                  .join('')}
              </div>
              ${
                quizAnswered
                  ? `<div class="explain ${quizChosen === question.ans ? 'ok' : 'no'}">${esc(question.explain)}</div>`
                  : ''
              }
            </div>
            ${
              quizAnswered
                ? `<button class="primary" data-action="next-question">${index + 1 === BANK.length ? '查看成绩 →' : '下一题 →'}</button>`
                : '<div class="hint">答完每题都会给出解释，答错也会说明原因</div>'
            }`
      }
      ${App.warning()}`,
      (root) => {
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'back') return App.go('#/games');
          if (action === 'restart') {
            store().dispatch('quizReset');
            quizChosen = -1;
            quizAnswered = false;
            return App.render();
          }
          if (action === 'answer') {
            if (quizAnswered) return;
            quizChosen = Number(hit.dataset.index);
            quizAnswered = true;
            store().dispatch('quizAnswer', { index, choice: quizChosen });
            return App.render();
          }
          if (action === 'next-question') {
            quizChosen = -1;
            quizAnswered = false;
            App.render();
          }
        });
      }
    );
  });

  /* ==================== 通关结算 ==================== */
  App.register(
    '#/final',
    () => {
      const s = store().read();
      if (!state.allDone(s)) return App.go(App.nextAction(s).hash);
      const board = state.scoreboard(s);
      const grade = board.grade;
      App.mount(
        `
        <div class="topline">
          <span class="eyebrow">FINAL REPORT / 通关结算</span>
          <button class="text-button" data-action="home">首页</button>
        </div>
        <div class="sheet final">
          <div class="final-title">🏆 东鸿密钥 · 全部通关！</div>
          <div class="small muted">企业文化、文化画像测试与闯关小游戏都已完成</div>
          <div class="final-tasks">${board.tasks
            .map(
              (task) =>
                `<div class="final-task"><span>${task.icon} ${esc(task.name)}</span><span class="final-state">${task.done ? '✅' : '⬜'}</span></div>`
            )
            .join('')}</div>
          <div class="final-scores">
            <div class="final-score"><span class="final-val">${board.trust}</span><span class="final-lbl">客户信任</span></div>
            <div class="final-score"><span class="final-val">${board.hop.wrong}</span><span class="final-lbl">跳格子失误</span></div>
            <div class="final-score"><span class="final-val">${board.quiz.score}</span><span class="final-lbl">答题分数</span></div>
          </div>
          <div class="final-detail">
            <div class="detail-title">成绩明细</div>
            <div class="detail-row"><span>认证配对</span><span>${board.cert.matched} / ${board.cert.total} 个市场</span></div>
            <div class="detail-row"><span>方案组卡</span><span>${board.solution.perfect ? '满分组通过' : '已通过'}</span></div>
            <div class="detail-row"><span>模块配对</span><span>${board.flip.moves} 步 / ${board.flip.seconds} 秒</span></div>
            <div class="detail-row"><span>知识答题</span><span>${board.quiz.correct} / ${board.quiz.total} 题正确</span></div>
          </div>
          <div class="grade" style="background:${grade.color}">GRADE ${grade.code}</div>
          <div class="small muted final-msg">${esc(grade.comment)}</div>
          <button class="primary" data-action="games">回到小游戏</button>
          <button class="secondary" data-action="progress">查看探索档案</button>
        </div>
        ${App.warning()}`,
        (root) => {
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'home') return App.go('#/home');
            if (action === 'games') return App.go('#/games');
            if (action === 'progress') return App.go('#/progress');
          });
        }
      );
    },
    'quest'
  );
})(window.DHKApp);
