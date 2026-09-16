/**
 * 网页版核心页面：首页、序章、探索档案。
 * 学习向导在 views-learn.js，画像测试在 views-test.js，小游戏在 views-games.js。
 *
 * 整体节奏：序章 → 企业文化学习（4 个模块）→ 文化画像测试（值班/认证/组卡 + 结算）
 * → 闯关小游戏 → 通关结算，一步一屏。
 */
(function (App) {
  const { state, content, esc } = App;
  const store = () => window.DHKStore;

  /** 分页控件（首页 / 序章 / 档案这类多屏页面用）。 */
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
   * 分页视图。config: { count, render(panel, {wide}), initial?, onPanel?, mount?, action?, wideAll? }
   * 桌面（≥900px，且 wideAll !== false）会把所有屏并排铺开，省掉翻页。
   */
  function pagedView(name, config) {
    let panel = 0;
    const go = (next) => {
      const clamped = Math.max(0, Math.min(config.count - 1, next));
      if (clamped === panel) return;
      panel = clamped;
      if (config.onPanel) config.onPanel(panel);
      App.render();
    };
    App.register(
      name,
      () => {
        if (config.initial) panel = Math.max(0, Math.min(config.count - 1, config.initial()));
        const wide = App.isWide() && config.wideAll !== false;
        const indexes = wide ? Array.from({ length: config.count }, (_, i) => i) : [panel];
        const panels = indexes.map((i) => config.render(i, { go, wide })).filter(Boolean);
        if (panels.length === 0) return;
        const html = panels.join('\n') + (wide ? '' : App.pager(panel, config.count, config.label));
        App.mount(html, (root) => {
          App.swipe(root, { next: () => go(panel + 1), prev: () => go(panel - 1) });
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'next') return go(panel + 1);
            if (action === 'prev') return go(panel - 1);
            if (config.action)
              config.action(action, hit, { go, panel, rerender: () => App.render() });
          });
          if (config.mount) config.mount(root, panel);
        });
      },
      config.cssPage
    );
  }

  App.pagedView = pagedView;

  /** 下一步该去哪：进入游戏时按「序章 → 学习 → 测试 → 小游戏 → 结算」推导。 */
  App.nextAction = function nextAction(s) {
    if (!s.prologueDone) return { hash: '#/prologue', label: '开启文化探索' };
    if (!App.learnDone(s)) return { hash: '#/learn', label: '继续学习企业文化' };
    if (!App.testDone(s)) {
      return { hash: `#/test/${App.TEST_STEPS[App.testStep(s)].id}`, label: '继续文化画像测试' };
    }
    if (!state.allDone(s)) return { hash: '#/games', label: '去闯关小游戏' };
    return { hash: '#/final', label: '查看通关结算 🏆' };
  };

  /** 三个入口的解锁与进度状态。 */
  function entryState(s) {
    const learn = App.learnProgress(s);
    const learnDone = App.learnDone(s);
    const testDone = App.testDone(s);
    const games = ['hop', 'flip', 'crush', 'quiz', 'repro'].filter((id) =>
      id === 'hop' ? s.games.hop.done : s.games[id].done
    ).length;
    return {
      learn: { done: learnDone, tag: learnDone ? '已学完' : `${learn.done} / ${learn.total}` },
      test: {
        done: testDone,
        locked: !learnDone,
        tag: !learnDone ? '未解锁' : testDone ? '已完成' : `进行到第 ${App.testStep(s) + 1} 步`
      },
      games: {
        done: state.allDone(s),
        locked: !testDone,
        tag: !testDone ? '未解锁' : `${games} / 5`
      }
    };
  }

  /* ==================== 首页 ==================== */
  pagedView('#/home', {
    cssPage: 'home',
    count: 3,
    render(panel, options = {}) {
      const s = store().read();
      const percent = state.percent(s);
      const entries = entryState(s);
      const next = App.nextAction(s);
      const first = !options.wide || panel === 0;
      const head = first
        ? '<div class="topline"><span class="eyebrow">EASTRON / CULTURE QUEST</span><span class="pill">文化探索员</span></div>'
        : '';
      const warn = first ? App.warning() : '';

      if (panel === 1) {
        return `${head}${warn}
          <div class="panel">
            <div class="title">三个步骤，<div>一步一步来。</div></div>
            <button class="card chapter-card stage-button" data-action="learn">
              <div class="chapter-head">
                <span class="number">01</span><span class="section-title">企业文化</span>
                <span class="tag">${entries.learn.tag}</span>
              </div>
              <div class="muted">学习四个模块：文化坐标 · 产品模块 · 价值观 · 走向世界</div>
              <div class="small muted">先学清楚，再去做判断</div>
            </button>
            <button class="card chapter-card stage-button" data-action="test">
              <div class="chapter-head">
                <span class="number">02</span><span class="section-title">文化画像测试</span>
                <span class="tag">${entries.test.tag}</span>
              </div>
              <div class="muted">质量值班 · 认证配对 · 方案组卡</div>
              <div class="small muted">${entries.test.locked ? '学完企业文化后解锁' : '用学到的内容做判断，生成你的画像'}</div>
            </button>
            <button class="card chapter-card stage-button" data-action="games">
              <div class="chapter-head">
                <span class="number">03</span><span class="section-title">闯关小游戏</span>
                <span class="tag">${entries.games.tag}</span>
              </div>
              <div class="muted">跳格子 · 配对 · 三消 · 答题 · 实验台</div>
              <div class="small muted">${entries.games.locked ? '完成画像测试后解锁' : '成绩计入通关结算'}</div>
            </button>
          </div>`;
      }

      if (panel === 2) {
        return `${head}${warn}
          <div class="panel">
            <div class="title">我们的方向</div>
            <div class="card">
              <div class="label">愿景</div><div class="quote">${esc(content.culture.vision)}</div>
              <div class="line"></div>
              <div class="label">理念</div><div class="quote">${esc(content.culture.belief)}</div>
            </div>
            <div class="values">${content.culture.values.map((v) => `<span>${esc(v.name)}</span>`).join('')}</div>
            <div class="card">
              <div class="row"><span>探索进度</span><span>${percent}%</span></div>
              <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
              <div class="small muted">${esc(content.company)}</div>
            </div>
            <button class="primary" data-action="progress">查看探索档案</button>
          </div>`;
      }

      return `${head}${warn}
        <div class="panel">
          <div>
            <div class="subtitle">每一度电背后，都有一个答案。</div>
            <div class="hero-title">东鸿密钥<span>·</span></div>
            <div class="hero-sub">点亮每一度电</div>
          </div>
          <div class="network-space"><canvas id="hero-network"></canvas></div>
          <div class="culture"><div class="label">我们的使命</div><div class="quote">${esc(content.culture.mission)}</div></div>
          <button class="primary" data-action="next-step">${next.label} ↗</button>
        </div>`;
    },
    mount(root, panel) {
      if (panel !== 0) return;
      const s = store().read();
      App.network(document.getElementById('hero-network'), () =>
        s.prologueDone ? Math.min(6, 2 + s.decisions.length) : 0
      );
    },
    action(action, hit, api) {
      const s = store().read();
      if (action === 'next-step') return App.go(App.nextAction(s).hash);
      if (action === 'learn') return App.go(App.learnDone(s) ? '#/learn/done' : '#/learn');
      if (action === 'test') {
        if (!App.learnDone(s)) return App.go('#/learn');
        return App.go(`#/test/${App.TEST_STEPS[App.testStep(s)].id}`);
      }
      if (action === 'games') return App.go('#/games');
      if (action === 'progress') return App.go('#/progress');
    }
  });

  /* ==================== 序章 ==================== */
  pagedView('#/prologue', {
    cssPage: 'prologue',
    count: 3,
    wideAll: false, // 故事按顺序讲，宽屏也一屏一屏翻
    initial: () => store().read().prologue,
    onPanel: (panel) => store().write({ ...store().read(), prologue: panel }),
    render(panel, options = {}) {
      const scene = content.prologue[panel];
      const first = !options.wide || panel === 0;
      return `
        ${first ? '<div class="topline"><span class="eyebrow">PROLOGUE / 一度电的旅程</span></div>' : ''}
        ${first ? App.warning() : ''}
        <div class="panel">
          <div>
            <div class="label">${esc(scene.tag)}</div>
            <div class="title scene-title">${esc(scene.title)}</div>
          </div>
          <div class="network-space"><canvas id="prologue-network"></canvas></div>
          <div class="narration">${esc(scene.text)}</div>
          <div class="culture"><div class="label">这是东鸿的使命</div><div class="quote">${esc(content.culture.mission)}</div></div>
          <button class="primary" data-action="mission">${panel === 2 ? '领取使命密钥，开始学习企业文化' : '追踪下一段能量 →'}</button>
        </div>`;
    },
    mount(root, panel) {
      App.network(document.getElementById('prologue-network'), () => content.prologue[panel].nodes);
    },
    action(action, hit, api) {
      if (action !== 'mission') return;
      if (api.panel < 2) return api.go(api.panel + 1);
      store().dispatch('mission');
      App.go('#/learn');
    }
  });

  /* ==================== 探索档案 ==================== */
  pagedView('#/progress', {
    cssPage: 'progress',
    count: 4,
    render(panel, options = {}) {
      const s = store().read();
      const first = !options.wide || panel === 0;
      const portrait = state.portrait(s);
      const progress = state.taskProgress(s);
      const nextTask = state.tasks(s).find((task) => !task.done);
      const percent = state.percent(s);
      const head = first ? App.topbar('EXPLORER ARCHIVE / 探索档案') : '';
      const marks = state.MARKS.map((name) => {
        const value = s.marks[name] || 0;
        return `<span class="mark ${value > 0 ? 'good' : ''} ${value < 0 ? 'bad' : ''}">${name} ${value > 0 ? '+' : ''}${value}</span>`;
      }).join('');
      const learn = App.learnProgress(s);
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
          </div>`;
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
          </div>`;
      }

      if (panel === 3) {
        return `${head}
          <div class="panel">
            <div class="title">我的行动与存档</div>
            <div class="culture">
              <div class="label">我的行动承诺</div>
              <div class="quote">${esc(s.pledge || '完成文化画像测试后，这里会记录你的行动承诺。')}</div>
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
          </div>`;
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
            <div class="row"><span>企业文化学习</span><span class="trust-num">${learn.done} / ${learn.total} 个模块</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((learn.done / learn.total) * 100)}%"></div></div>
            <div class="row small"><span>全部任务</span><span>${progress.done} / ${progress.total}</span></div>
            <div class="small muted">${nextTask ? '接下来：' + esc(nextTask.name) : '全部任务已完成 🏆'}</div>
          </div>
          <button class="primary" data-action="resume">${App.nextAction(s).label} →</button>
        </div>`;
    },
    action(action) {
      const s = store().read();
      if (action === 'resume') return App.go(App.nextAction(s).hash);
      if (action === 'home') return App.go('#/home');
      if (action === 'reset' && window.confirm('清除本机存档、重新开始探索？此操作无法撤销。')) {
        store().reset();
        App.render();
      }
    }
  });
})(window.DHKApp);
