/**
 * 网页版核心页面：首页、序章、质量值班、文化画像、探索档案。
 * 与小程序的 pages/home、prologue、shift、culture、progress 一一对应。
 *
 * 分页页面统一走 pagedView：状态放在闭包里，翻页 / 滑动只重渲染当前屏；
 * 小游戏那种高频交互不走这里（见 views-games.js 的直改 DOM 写法）。
 */
(function (App) {
  const { state, content, esc } = App;
  const store = () => window.DHKStore;

  /** 分页控件（对应小程序里的 .pager）。 */
  App.pager = function pager(panel, count, label) {
    const dots = Array.from(
      { length: count },
      (_, i) => `<span class="dot ${i === panel ? 'active' : ''}"></span>`
    ).join('');
    return `<div class="pager">
      <button class="nav-arrow" data-action="prev" ${panel === 0 ? 'disabled' : ''}>‹</button>
      <div class="pager-center">
        <div class="dots">${dots}</div>
        <span>${label || '左右滑动翻页'} · ${panel + 1} / ${count}</span>
      </div>
      <button class="nav-arrow" data-action="next" ${panel === count - 1 ? 'disabled' : ''}>›</button>
    </div>`;
  };

  /**
   * 分页视图。
   * config: { count, render(panel), initial?(), onPanel?(next), mount?(root, panel), action?(action, hit, api) }
   * api: { go(next), reset(), render() }
   */
  function pagedView(name, config) {
    let panel = 0;
    const go = (next) => {
      console.log(
        'TRACE go ' +
          name +
          ' -> ' +
          next +
          ' :: ' +
          new Error().stack.split('\n').slice(1, 5).join(' | ')
      );
      const clamped = Math.max(0, Math.min(config.count - 1, next));
      if (clamped === panel) return;
      panel = clamped;
      if (config.onPanel) config.onPanel(panel);
      App.render();
    };
    App.register(name, () => {
      if (config.initial) panel = Math.max(0, Math.min(config.count - 1, config.initial()));
      const html = config.render(panel, { go });
      if (!html) return;
      App.mount(html, (root) => {
        App.swipe(root, { next: () => go(panel + 1), prev: () => go(panel - 1) });
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'next') {
            return go(panel + 1);
          }
          if (action === 'prev') return go(panel - 1);
          if (config.action)
            config.action(action, hit, { go, panel, rerender: () => App.render() });
        });
        if (config.mount) config.mount(root, panel);
      });
    });
    return { go, reset: () => (panel = 0) };
  }

  /* ==================== 首页 ==================== */
  pagedView('#/home', {
    count: 3,
    render(panel) {
      const s = store().read();
      const percent = state.percent(s);
      const progress = state.taskProgress(s);
      const cultureDone = state.cultureDone(s);
      const ids = ['hop', 'flip', 'crush', 'quiz', 'repro'];
      const finished = ids.filter((id) => (id === 'hop' ? s.games.hop.done : s.games[id].done));
      const cta = s.completed ? '回顾我的文化画像' : s.updatedAt ? '继续探索' : '开启文化探索';
      const head = `<div class="topline"><span class="eyebrow">EASTRON / CULTURE QUEST</span><span class="pill">文化探索员</span></div>`;

      if (panel === 1) {
        return `${head}${App.warning()}
          <div class="panel">
            <div class="title">一段旅程，<div>两个入口。</div></div>
            <button class="card chapter-card stage-button" data-action="culture">
              <div class="chapter-head">
                <span class="number">01</span><span class="section-title">企业文化</span>
                <span class="tag">${cultureDone ? '已完成' : `${progress.done} / ${progress.total}`}</span>
              </div>
              <div class="muted">文化介绍 · 打卡答题 · 三个互动关卡</div>
              <div class="small muted">愿景使命 · 产品模块 · 价值观 · 走向世界</div>
            </button>
            <button class="card chapter-card stage-button" data-action="games">
              <div class="chapter-head">
                <span class="number">02</span><span class="section-title">闯关小游戏</span>
                <span class="tag">${cultureDone ? `${finished.length} / ${ids.length}` : '未解锁'}</span>
              </div>
              <div class="muted">跳格子 · 配对 · 三消 · 答题 · 实验台</div>
              <div class="small muted">${cultureDone ? '成绩计入通关结算' : '先完成企业文化模块'}</div>
            </button>
          </div>
          ${App.pager(1, 3)}`;
      }

      if (panel === 2) {
        return `${head}${App.warning()}
          <div class="panel">
            <div class="title">我们的方向</div>
            <div class="card">
              <div class="label">愿景</div><div class="quote">${esc(content.culture.vision)}</div>
              <div class="line"></div>
              <div class="label">理念</div><div class="quote">${esc(content.culture.belief)}</div>
            </div>
            <div class="values">${content.culture.values.map((v) => `<span>${esc(v.name)}</span>`).join('')}</div>
            <div class="card">
              <div class="row"><span>第一阶段进度</span><span>${percent}%</span></div>
              <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
              <div class="small muted">${esc(content.company)}</div>
            </div>
            <button class="primary" data-action="progress">查看探索档案</button>
          </div>
          ${App.pager(2, 3)}`;
      }

      return `${head}${App.warning()}
        <div class="panel">
          <div>
            <div class="subtitle">每一度电背后，都有一个答案。</div>
            <div class="hero-title">东鸿密钥<span>·</span></div>
            <div class="hero-sub">点亮每一度电</div>
          </div>
          <div class="network-space"><canvas id="hero-network"></canvas></div>
          <div class="culture"><div class="label">我们的使命</div><div class="quote">${esc(content.culture.mission)}</div></div>
          <button class="primary" data-action="start">${cta} ↗</button>
        </div>
        ${App.pager(0, 3)}`;
    },
    mount(root, panel) {
      if (panel !== 0) return;
      const s = store().read();
      App.network(document.getElementById('hero-network'), () =>
        s.prologueDone ? Math.min(6, 2 + s.decisions.length) : 0
      );
    },
    action(action) {
      const s = store().read();
      if (action === 'start') return App.goRoute(state.route(s));
      if (action === 'culture') return App.go('#/quest');
      if (action === 'games') return App.go('#/games');
      if (action === 'progress') return App.go('#/progress');
    }
  });

  /* ==================== 序章 ==================== */
  pagedView('#/prologue', {
    count: 3,
    initial: () => store().read().prologue,
    onPanel: (panel) => store().write({ ...store().read(), prologue: panel }),
    render(panel) {
      const scene = content.prologue[panel];
      return `
        <div class="topline"><span class="eyebrow">PROLOGUE / 一度电的旅程</span></div>
        ${App.warning()}
        <div class="panel">
          <div>
            <div class="label">${esc(scene.tag)}</div>
            <div class="title scene-title">${esc(scene.title)}</div>
          </div>
          <div class="network-space"><canvas id="prologue-network"></canvas></div>
          <div class="narration">${esc(scene.text)}</div>
          <div class="culture"><div class="label">这是东鸿的使命</div><div class="quote">${esc(content.culture.mission)}</div></div>
          <button class="primary" data-action="mission">${panel === 2 ? '领取使命密钥，进入第一章' : '追踪下一段能量 →'}</button>
        </div>
        ${App.pager(panel, 3)}`;
    },
    mount(root, panel) {
      App.network(document.getElementById('prologue-network'), () => content.prologue[panel].nodes);
    },
    action(action, hit, api) {
      if (action !== 'mission') return;
      // 前两屏是「追踪下一段能量」，最后一屏才真的领密钥
      if (api.panel < 2) return api.go(api.panel + 1);
      store().dispatch('mission');
      App.goRoute(state.route(store().read()));
    }
  });

  /* ==================== 质量值班 ==================== */
  let shiftResult = null;

  function markDelta(choice) {
    return Object.entries(choice.marks || {})
      .map(([name, value]) => `${name} ${value > 0 ? '+' : '−'}${Math.abs(value)}`)
      .join(' · ');
  }

  App.register('#/shift', () => {
    const s = store().read();
    if (!s.prologueDone) return App.go('#/prologue');
    const card = state.currentCard(s);
    // 刚判断完最后一张时还没有下一张卡，但结果页要先给玩家看完，点「下一份」再跳走
    if (!card && !shiftResult) return App.go('#/culture');

    const release = card && card.choices.find((choice) => choice.stamp === 'release');
    const back = card && card.choices.find((choice) => choice.stamp === 'return');
    const twoStamps = Boolean(card) && card.choices.length === 2 && Boolean(release && back);
    const total = state.CARDS.length;
    const index = Math.min(s.decisions.length + (shiftResult ? 0 : 1), total);
    const last = s.decisions.length >= total;
    const delta = (value) =>
      `<span class="delta-num ${value < 0 ? 'minus' : 'plus'}">${value > 0 ? '+' : ''}${value}</span>`;

    App.mount(
      `
      ${App.topbar(
        'SHIFT 01 / 质量值班',
        '<button class="text-button" data-action="rules">规则</button><button class="text-button" data-action="home">首页</button>'
      )}
      <div class="hud">
        <div class="row"><span class="label">客户信任</span><span class="trust-num">${s.trust}</span></div>
        <div class="trust-track"><div class="trust-fill" style="width:${s.trust}%"></div></div>
        <div class="marks">${state.MARKS.map((name) => {
          const value = s.marks[name] || 0;
          return `<span class="mark ${value > 0 ? 'good' : ''} ${value < 0 ? 'bad' : ''}">${name} ${value > 0 ? '+' : ''}${value}</span>`;
        }).join('')}</div>
      </div>
      ${
        shiftResult
          ? `<div class="sheet">
              <div class="stamp ${shiftResult.stamp}">${shiftResult.stamp === 'release' ? '通过' : '退回'}</div>
              <div class="sheet-title">${esc(shiftResult.label)}</div>
              <div class="delta"><span class="small muted">客户信任</span>${delta(shiftResult.delta)}<span class="small muted">→ ${shiftResult.trust}</span></div>
              <div class="sheet-body">${esc(shiftResult.text)}</div>
              ${shiftResult.marks ? `<div class="mark-delta">印记变化 ${esc(shiftResult.marks)}</div>` : ''}
            </div>`
          : `<div class="sheet">
              <div class="sheet-head">
                <span class="sheet-tag">${esc(card.tag)}</span>
                <span class="sheet-index">第 ${index} / ${total} 份</span>
              </div>
              <div class="sheet-title">${esc(card.title)}</div>
              <div class="sheet-from">${esc(card.from)}</div>
              <div class="sheet-body">${esc(card.body)}</div>
              <div class="docs">${card.docs
                .map(
                  (doc) =>
                    `<div class="doc"><span class="doc-label">${esc(doc.label)}</span><span class="doc-text">${esc(doc.text)}</span></div>`
                )
                .join('')}</div>
            </div>`
      }
      ${
        shiftResult
          ? `<button class="primary" data-action="next">${last ? '结束值班，看文化画像' : '下一份 →'}</button>`
          : `<div class="actions">${
              twoStamps
                ? `<button class="stamp-button release" data-action="choose" data-id="${release.id}">通过</button>
                   <button class="stamp-button back" data-action="choose" data-id="${back.id}">退回</button>`
                : card.choices
                    .map(
                      (choice) =>
                        `<button class="option" data-action="choose" data-id="${choice.id}">${esc(choice.label)}</button>`
                    )
                    .join('')
            }</div>`
      }
      <div class="hint">${shiftResult ? '判断已记录，后果会自己找上门' : '右滑通过 · 左滑退回 · 也可以点按钮'}</div>
      <div class="rules-mask" id="rules-mask" hidden>
        <div class="rules">
          <div class="label">质量值班规则</div>
          ${content.shifts[0].rules.map((rule) => `<div class="rule">· ${esc(rule)}</div>`).join('')}
          <button class="secondary" data-action="rules-close">知道了</button>
        </div>
      </div>
      ${App.warning()}`,
      (root) => {
        const decide = (choiceId) => {
          const fresh = store().read();
          const current = state.currentCard(fresh);
          const choice = current && current.choices.find((item) => item.id === choiceId);
          if (!choice) return;
          const next = store().dispatch('choose', { cardId: current.id, choiceId: choice.id });
          shiftResult = {
            stamp: choice.stamp,
            label: choice.label,
            text: choice.result,
            delta: choice.trust || 0,
            trust: next.trust,
            marks: markDelta(choice)
          };
          App.render();
        };

        App.swipe(root, {
          next: () => !shiftResult && twoStamps && decide(release.id),
          prev: () => !shiftResult && twoStamps && decide(back.id)
        });
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'choose') return decide(hit.dataset.id);
          if (action === 'next') {
            shiftResult = null;
            App.render();
            return;
          }
          if (action === 'rules') return (root.querySelector('#rules-mask').hidden = false);
          if (action === 'rules-close') return (root.querySelector('#rules-mask').hidden = true);
          if (action === 'home') return App.go('#/home');
        });
      }
    );
  });

  /* ==================== 文化画像 ==================== */
  pagedView('#/culture', {
    count: 3,
    render(panel) {
      const s = store().read();
      if (!state.shiftDone(s)) {
        queueMicrotask(() => App.goRoute(state.route(s)));
        return '';
      }
      const portrait = state.portrait(s);
      const head = App.topbar('SHIFT REPORT / 值班结算');
      const markRows = portrait.ranked
        .map(
          (item) => `<div class="mark-row">
            <span class="mark-name">${item.name}</span>
            <div class="mark-track"><div class="mark-fill ${item.value < 0 ? 'bad' : ''}" style="width:${Math.min(100, Math.abs(item.value) * 20)}%"></div></div>
            <span class="mark-val ${item.value < 0 ? 'bad' : ''}">${item.value > 0 ? '+' : ''}${item.value}</span>
          </div>`
        )
        .join('');

      if (panel === 1) {
        return `${head}${App.warning()}
          <div class="panel">
            <div class="title">你的文化画像</div>
            <div class="card"><div class="label">印记构成</div>${markRows}</div>
            <div class="culture">
              <div class="label">最高印记 · ${portrait.top || '尚无'}</div>
              <div class="quote">${esc(portrait.style.title)}</div>
            </div>
            <div class="muted small">${esc(portrait.style.comment)}</div>
            <div class="card highlights">
              <div class="label">你的关键行为</div>
              ${portrait.highlights
                .map(
                  (item) =>
                    `<div class="highlight"><span class="highlight-title">${esc(item.card)}</span><span class="highlight-choice">${esc(item.choice)}</span></div>`
                )
                .join('')}
            </div>
            <button class="primary" data-action="next">选择我的行动承诺 →</button>
          </div>
          ${App.pager(1, 3)}`;
      }

      if (panel === 2) {
        return `${head}${App.warning()}
          <div class="panel">
            <div class="title">把文化带回工作</div>
            <div class="subtitle">选一项行动，保存你的文化画像。</div>
            <div>${content.actions
              .map(
                (action) =>
                  `<button class="option ${s.pledge === action ? 'selected' : ''}" data-action="pledge" data-value="${esc(action)}">${s.pledge === action ? '◉' : '○'} ${esc(action)}</button>`
              )
              .join('')}</div>
            ${s.completed ? '<div class="small success">✓ 全部完成：序章、质量值班、文化画像已记录。</div>' : ''}
            <button class="primary" data-action="save" ${s.pledge ? '' : 'disabled'}>${s.completed ? '更新行动承诺' : '保存承诺，完成探索'}</button>
            <div class="row">
              <button class="text-button" data-action="progress">探索档案</button>
              <button class="text-button" data-action="home">返回首页</button>
            </div>
          </div>
          ${App.pager(2, 3)}`;
      }

      return `${head}${App.warning()}
        <div class="panel">
          <div class="seal"><div class="seal-core">${portrait.trust}</div></div>
          <div class="title center">${esc(portrait.level.label)}</div>
          <div class="subtitle center">${esc(portrait.level.comment)}</div>
          <div class="card">
            <div class="row"><span class="label">客户信任</span><span class="trust-num">${portrait.trust} / 100</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${portrait.trust}%"></div></div>
            <div class="small muted">信任值由你今天每一次判断累积而成，不会被人工修正。</div>
          </div>
          <button class="primary" data-action="next">看我的文化画像 →</button>
        </div>
        ${App.pager(0, 3)}`;
    },
    action(action, hit, api) {
      const s = store().read();
      if (action === 'pledge') {
        store().write({ ...s, pledge: hit.dataset.value });
        return api.rerender();
      }
      if (action === 'save') return void (store().dispatch('complete', s.pledge), api.rerender());
      if (action === 'progress') return App.go('#/progress');
      if (action === 'home') return App.go('#/home');
    }
  });

  /* ==================== 探索档案 ==================== */
  pagedView('#/progress', {
    count: 4,
    render(panel) {
      const s = store().read();
      const portrait = state.portrait(s);
      const progress = state.taskProgress(s);
      const nextTask = state.tasks(s).find((task) => !task.done);
      const percent = state.percent(s);
      const head = App.topbar('EXPLORER ARCHIVE / 探索档案');
      const marks = state.MARKS.map((name) => {
        const value = s.marks[name] || 0;
        return `<span class="mark ${value > 0 ? 'good' : ''} ${value < 0 ? 'bad' : ''}">${name} ${value > 0 ? '+' : ''}${value}</span>`;
      }).join('');
      const scores = {
        hop: s.games.hop.done ? `通关 · 错 ${s.games.hop.wrong} 次` : '未完成',
        flip: s.games.flip.done
          ? `${s.games.flip.moves} 步 / ${s.games.flip.seconds} 秒`
          : '未完成',
        crush: s.games.crush.done ? `${s.games.crush.score} 分` : '未完成',
        quiz: s.games.quiz.done
          ? `${s.games.quiz.score} 分`
          : s.games.quiz.results.length
            ? `进行中 ${s.games.quiz.results.length} 题`
            : '未完成',
        repro: s.games.repro.done ? `${s.games.repro.load}%` : '未完成'
      };

      if (panel === 1) {
        return `${head}
          <div class="panel">
            <div class="title">东鸿文化坐标</div>
            <div class="card">
              <div class="label">愿景</div><div class="quote">${esc(content.culture.vision)}</div>
              <div class="line"></div>
              <div class="label">使命</div><div class="quote">${esc(content.culture.mission)}</div>
              <div class="line"></div>
              <div class="label">理念</div><div class="quote">${esc(content.culture.belief)}</div>
            </div>
            <div class="card">
              <div class="label">发展导向</div>
              ${content.culture.directions.map((item) => `<div class="direction">${esc(item)}</div>`).join('')}
            </div>
          </div>
          ${App.pager(1, 4)}`;
      }

      if (panel === 2) {
        return `${head}
          <div class="panel">
            <div class="title">价值观，是行动。</div>
            ${content.culture.values
              .map(
                (value) =>
                  `<div class="card"><div class="tag">${esc(value.name)}</div><div class="muted">${esc(value.text)}</div></div>`
              )
              .join('')}
          </div>
          ${App.pager(2, 4)}`;
      }

      if (panel === 3) {
        return `${head}
          <div class="panel">
            <div class="title">我的行动与存档</div>
            <div class="culture">
              <div class="label">我的行动承诺</div>
              <div class="quote">${esc(s.pledge || '完成第一章后，记录你的行动承诺。')}</div>
            </div>
            <div class="card">
              <div class="label">各局成绩</div>
              <div class="row small"><span>文化跳格子</span><span>${scores.hop}</span></div>
              <div class="row small"><span>模块配对</span><span>${scores.flip}</span></div>
              <div class="row small"><span>能量三消</span><span>${scores.crush}</span></div>
              <div class="row small"><span>知识答题</span><span>${scores.quiz}</span></div>
              <div class="row small"><span>复现异常</span><span>${scores.repro}</span></div>
              <div class="row small"><span>客户信任</span><span>${s.trust} / 100</span></div>
            </div>
            <div class="card">进度只保存在当前浏览器。清除缓存或换设备后无法恢复。<div class="line"></div><div class="muted">本原型不采集员工身份信息。</div></div>
            <button class="secondary" data-action="reset">清除本机存档，重新探索</button>
            <button class="primary" data-action="home">返回首页</button>
          </div>
          ${App.pager(3, 4)}`;
      }

      return `${head}${App.warning()}
        <div class="panel">
          <div class="title">每一步，都留下印记。</div>
          <div class="card">
            <div class="row"><span>探索进度</span><span class="number">${percent}%</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
            <div class="small muted">最近保存：${esc(s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '还未开始')}</div>
          </div>
          <div class="card">
            <div class="row"><span>客户信任</span><span class="trust-num">${s.trust} / 100 · ${esc(portrait.level.label)}</span></div>
            <div class="marks">${marks}</div>
          </div>
          <div class="card">
            <div class="row"><span>任务进度</span><span class="trust-num">${progress.done} / ${progress.total}</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((progress.done / progress.total) * 100)}%"></div></div>
            <div class="small muted">${nextTask ? '接下来：' + esc(nextTask.name) : '全部任务已完成 🏆'}</div>
          </div>
          <button class="primary" data-action="resume">${s.completed ? '回顾我的文化画像' : '继续上次探索 →'}</button>
        </div>
        ${App.pager(0, 4)}`;
    },
    action(action) {
      const s = store().read();
      if (action === 'resume') return App.goRoute(state.route(s));
      if (action === 'home') return App.go('#/home');
      if (action === 'reset' && window.confirm('清除本机存档、重新开始探索？此操作无法撤销。')) {
        store().reset();
        App.render();
      }
    }
  });
})(window.DHKApp);
