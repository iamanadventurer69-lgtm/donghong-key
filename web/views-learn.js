/**
 * 企业文化学习向导：四个模块一步一屏，学完一个才能点「下一个模块」。
 *
 * 设计原则（按反馈调整）：一屏只放一个模块——先看内容介绍、再答一道题，
 * 答对才算学完；四个模块全部学完进「学习完成」页，提示开始文化画像测试。
 */
(function (App) {
  const { state, content, esc } = App;
  const store = () => window.DHKStore;

  const STEPS = content.quests.map((quest) => ({ id: quest.id, name: quest.name }));

  /** 第一个没打卡的模块下标；都完成了就返回总数。 */
  function firstOpenStep(s) {
    const index = content.quests.findIndex((quest) => !s.checkins[quest.id]);
    return index === -1 ? content.quests.length : index;
  }

  /** 学习进度：已完成模块数 / 总数。 */
  function learnProgress(s) {
    const done = content.quests.filter((quest) => s.checkins[quest.id]).length;
    return { done, total: content.quests.length };
  }

  let phase = 'intro'; // intro（看内容）→ ask（答题）→ result（看解释）
  let picked = -1;
  // 当前模块下标：进入本页时定位到第一个没学完的模块，
  // 之后只在点「学下一个模块」时推进，避免答完题就被跳到下一模块。
  let index = 0;

  function renderModule(index) {
    const s = store().read();
    const quest = content.quests[index];
    const done = s.checkins[quest.id] === true;
    const next = content.quests[index + 1];
    const letters = ['A', 'B', 'C', 'D'];

    const options = quest.options
      .map((option, i) => {
        const cls =
          phase === 'result'
            ? `${i === quest.answer ? 'right' : ''} ${i === picked && i !== quest.answer ? 'wrong' : ''}`
            : '';
        return `<button class="option ${cls}" data-action="answer" data-index="${i}"><span class="letter">${letters[i]}</span><span>${esc(option)}</span></button>`;
      })
      .join('');

    const body =
      phase === 'intro'
        ? `<div class="intro">${esc(quest.intro)}</div>
           <div class="small muted">看完这段内容，回答一个问题就算学完本模块。</div>
           <button class="primary" data-action="start-quiz">开始打卡答题 →</button>`
        : phase === 'ask'
          ? `<div class="sheet-q">${esc(quest.question)}</div>${options}`
          : `${options}
             <div class="explain ${picked === quest.answer ? 'ok' : 'no'}">${esc(quest.explain)}</div>
             ${
               picked === quest.answer
                 ? `<button class="primary" data-action="next-step">${next ? `学下一个模块：${esc(next.name)} →` : '完成学习，去做文化画像测试 →'}</button>`
                 : '<button class="secondary" data-action="retry">再试一次</button>'
             }`;

    return `
      ${App.steps('企业文化 · 学习', STEPS, index, { hint: quest.hint })}
      <div class="sheet">
        <div class="badge">${esc(quest.badge)}</div>
        <div class="sheet-title">${esc(quest.title)}</div>
        <div class="sheet-from">${done ? '✓ 本模块已学完' : esc(quest.hint)}</div>
        ${body}
      </div>
      ${App.warning()}`;
  }

  App.register(
    '#/learn',
    () => {
      const s = store().read();
      // 刚进入本页（上一个路由不是这里）时，定位到第一个没学完的模块
      if (App.prevHash !== '#/learn') {
        index = firstOpenStep(s);
        phase = 'intro';
        picked = -1;
      }
      if (index >= content.quests.length) return App.go('#/learn/done');
      App.mount(renderModule(index), (root) => {
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          const current = content.quests[index];
          if (action === 'start-quiz') {
            phase = 'ask';
            return App.render();
          }
          if (action === 'answer') {
            if (phase === 'result') return;
            picked = Number(hit.dataset.index);
            store().dispatch('checkin', { questId: current.id, choice: picked });
            phase = 'result';
            return App.render();
          }
          if (action === 'retry') {
            phase = 'ask';
            picked = -1;
            return App.render();
          }
          if (action === 'next-step') {
            index += 1;
            phase = 'intro';
            picked = -1;
            return App.render();
          }
        });
      });
    },
    'quest'
  );

  App.register(
    '#/learn/done',
    () => {
      const s = store().read();
      const progress = learnProgress(s);
      const testDone = s.games.solution.done && state.shiftDone(s) && s.missions['2'];
      App.mount(
        `
        <div class="topline">
          <span class="eyebrow">企业文化 · 学习完成</span>
          <span class="step-count">${progress.done} / ${progress.total} 个模块</span>
        </div>
        <div class="sheet">
          <div class="win-title">✅ 企业文化学习完成</div>
          <div class="win-text">你已经看过四个模块：文化坐标、产品模块、价值观、走向世界，并完成了每个模块的打卡。</div>
          <div class="intro">接下来是「文化画像测试」：用刚学到的内容做判断——先当一天质量值班员，为六份材料决定通过还是退回，再完成认证配对与方案组卡。你的判断会生成一份专属文化画像。</div>
          <div class="small muted">${testDone ? '测试已经完成过了，可以再看一次画像。' : '测试包含 3 个环节，大约 3–5 分钟。'}</div>
          <button class="primary" data-action="to-test">开始文化画像测试 →</button>
          <button class="secondary" data-action="review">回看学习内容</button>
        </div>
        ${App.warning()}`,
        (root) => {
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'to-test') return App.go('#/test/shift');
            if (action === 'review') return App.go('#/learn');
            if (action === 'home') return App.go('#/home');
          });
        }
      );
    },
    'quest'
  );

  /** 其他页面用它判断「学习是否完成」，用来决定测试/小游戏是否解锁。 */
  App.learnDone = (s) => content.quests.every((quest) => s.checkins[quest.id] === true);
  App.learnProgress = learnProgress;
})(window.DHKApp);
