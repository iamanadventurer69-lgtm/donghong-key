/**
 * 网页版小游戏：小游戏区、文化跳格子、模块配对、能量三消、知识答题、复现异常。
 * 对应小程序的 pages/games、hop、flip、crush、quiz、repro。
 *
 * 高频交互（翻牌 / 三消 / 实验台）用直改 DOM + 自己的定时器，
 * 定时器在离开页面时自动停（tick 里检查当前路由），避免切屏后还在跑。
 */
(function (App) {
  const { state, content, match3, esc } = App;
  const store = () => window.DHKStore;
  const here = (hash) => location.hash === hash;
  const $ = (id) => document.getElementById(id);

  /* ==================== 小游戏区 ==================== */
  const GAME_LIST = [
    {
      id: 'hop',
      hash: '#/hop',
      icon: '🦘',
      name: '文化跳格子',
      hint: '答对前进一格，答错退回一格'
    },
    { id: 'flip', hash: '#/flip', icon: '🃏', name: '模块配对', hint: '把模块与它的职责配成对' },
    {
      id: 'crush',
      hash: '#/crush',
      icon: '✨',
      name: '能量三消',
      hint: '60 秒内多消几组，连击翻倍'
    },
    { id: 'quiz', hash: '#/quiz', icon: '📝', name: '知识答题', hint: '十题一百分，答完给解释' },
    {
      id: 'repro',
      hash: '#/repro',
      icon: '🎚️',
      name: '复现异常',
      hint: '通电后把负载推到 85% 以上并稳住'
    }
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
    if (id === 'crush') return g.crush.done ? `${g.crush.score} 分` : '';
    if (id === 'quiz') return g.quiz.done ? `${g.quiz.score} 分` : '';
    if (id === 'repro') return g.repro.done ? `${g.repro.load}%` : '';
    return '';
  }

  App.register('#/games', () => {
    const s = store().read();
    // 解锁条件：企业文化学习 + 文化画像测试全部完成
    const unlocked = App.testDone(s);
    const done = GAME_LIST.filter((game) => gameDone(game.id, s)).length;
    App.mount(
      `
      ${App.topbar(
        'CHALLENGE ZONE / 闯关小游戏',
        '<button class="text-button" data-action="back">返回首页</button>'
      )}
      <div class="hud ${unlocked ? '' : 'locked'}">
        <div class="row"><span class="label">${unlocked ? '小游戏进度' : '尚未解锁'}</span><span class="hud-num">${done} / ${GAME_LIST.length}</span></div>
        <div class="track"><div class="track-fill" style="width:${(done / GAME_LIST.length) * 100}%"></div></div>
        <div class="small muted">${unlocked ? '选一个开始，成绩都会记进探索档案' : '完成「文化画像测试」（学习 + 值班 / 认证 / 组卡）后解锁'}</div>
      </div>
      <div class="list">
        ${GAME_LIST.map((game) => {
          const finished = gameDone(game.id, s);
          return `<button class="game ${finished ? 'done' : ''}" data-action="open" data-id="${game.id}">
            <span class="game-icon">${game.icon}</span>
            <div class="game-main">
              <span class="game-name">${esc(game.name)}</span>
              <span class="game-hint">${esc(game.hint)}</span>
            </div>
            ${gameScore(game.id, s) ? `<span class="game-score">${esc(gameScore(game.id, s))}</span>` : ''}
            <span class="game-state">${finished ? '✓' : unlocked ? '›' : '🔒'}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="feedback" id="games-feedback" hidden></div>
      <div class="hint">${unlocked ? '成绩计入通关结算的 GRADE 评级' : '小游戏：跳格子 / 配对 / 三消 / 答题 / 实验台'}</div>
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
                '先完成企业文化模块（文化介绍打卡 + 三个互动关卡），再来闯关。';
              feedback.hidden = false;
              return;
            }
            const game = GAME_LIST.find((item) => item.id === hit.dataset.id);
            App.go(game.hash);
          }
        });
      }
    );
  });

  /* ==================== 文化跳格子 ==================== */
  let hopPending = null; // 已经选完但还没点「继续」的那一步

  App.register('#/hop', () => {
    const s = store().read();
    const game = content.hopGame;
    const total = game.tiles.length;
    const tile = Math.min(s.games.hop.tile, total - 1);
    const done = s.games.hop.done;
    // 刚答完还停在结果态时，展示的是「刚答的那一格」，不是新位置那一格
    const answered = Boolean(hopPending);
    const current = game.tiles[answered ? hopPending.index : tile];

    const stones = game.tiles
      .map((item, index) => {
        const passed = index < s.games.hop.tile;
        const isHere = !done && index === s.games.hop.tile;
        const goal = index === total - 1;
        return `<div class="stone ${passed ? 'passed' : ''} ${isHere ? 'here' : ''} ${goal ? 'goal' : ''}">
          <span class="stone-label">${goal ? '终点' : index + 1}</span>
          <span class="stone-name">${esc(item.name)}</span>
          ${isHere ? '<span class="hopper">🦘</span>' : ''}
        </div>`;
      })
      .join('');

    App.mount(
      `
      ${App.topbar('CULTURE HOP / 文化跳格子', '<button class="text-button" data-action="back">返回闯关</button>')}
      <div class="hud">
        <div class="hud-item"><span class="hud-val">${s.games.hop.tile}<span class="hud-sub">/${total}</span></span><span class="hud-lbl">已跳过</span></div>
        <div class="hud-item"><span class="hud-val">${s.games.hop.right}</span><span class="hud-lbl">答对</span></div>
        <div class="hud-item"><span class="hud-val">${s.games.hop.wrong}</span><span class="hud-lbl">答错</span></div>
      </div>
      <div class="stones">${stones}</div>
      <div class="panel">
        <div class="tile-head">
          <span class="tile-index">第 ${(answered ? hopPending.index : tile) + 1} 格</span>
          <span class="tile-name">${esc(current.name)}</span>
        </div>
        <div class="tile-point">${esc(current.point)}</div>
        <div class="q-text">${esc(current.question)}</div>
        <div class="q-opts">
          ${current.options
            .map((option, index) => {
              const cls = answered
                ? `${index === current.answer ? 'right' : ''} ${index === hopPending.choice && !hopPending.right ? 'wrong' : ''}`
                : '';
              return `<button class="option ${cls}" data-action="pick" data-index="${index}">${esc(option)}</button>`;
            })
            .join('')}
        </div>
        ${
          answered
            ? `<div class="feedback ${hopPending.right ? 'good' : 'bad'}">${esc(hopPending.feedback)}</div>
               <button class="primary" data-action="go">${hopPending.right ? '向前跳一格 →' : '退回一格继续 →'}</button>`
            : '<div class="hint">答对往前跳一格，答错退回一格</div>'
        }
      </div>
      ${
        done
          ? `<div class="mask"><div class="sheet">
              <div class="win-title">🏁 你走到了终点</div>
              <div class="win-text">${esc(game.finish)}</div>
              <div class="win-stats">共答对 ${s.games.hop.right} 题，答错 ${s.games.hop.wrong} 次</div>
              <div class="win-rank">${s.games.hop.wrong <= 2 ? '⭐ 一次跳过：企业文化很扎实' : s.games.hop.wrong <= 5 ? '👍 稳稳走完了全程' : '💪 走完了，回头再看看错过的格子'}</div>
              <button class="primary" data-action="finish">回到小游戏 →</button>
            </div></div>`
          : ''
      }
      ${App.warning()}`,
      (root) => {
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'back') return App.go('#/games');
          if (action === 'finish') return App.go('#/games');
          if (action === 'pick') {
            if (hopPending) return;
            const choice = Number(hit.dataset.index);
            const right = choice === current.answer;
            store().dispatch('hopAnswer', { index: s.games.hop.tile, choice });
            hopPending = {
              index: s.games.hop.tile,
              choice,
              right,
              feedback: right
                ? `${game.forward} ${current.explain}`
                : `${game.backward} ${current.explain}`
            };
            return App.render();
          }
          if (action === 'go') {
            hopPending = null;
            App.render();
          }
        });
      }
    );
  });

  /* ==================== 模块配对（翻牌） ==================== */
  const PAIR_TOTAL = content.memory.length / 2;
  let flipDeck = null;
  let flipOpen = [];
  let flipMatched = 0;
  let flipMoves = 0;
  let flipSeconds = 0;
  let flipTimer = null;
  let flipBusy = false;
  let flipWon = false;

  function flipReset() {
    flipDeck = content.memory
      .map((card) => ({ ...card, up: false, done: false }))
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
      if (node) node.textContent = timeText(flipSeconds);
    }, 1000);
  }

  function timeText(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  App.register('#/flip', () => {
    if (!flipDeck) flipReset();
    App.mount(
      `
      ${App.topbar('MEMORY / 模块配对', '<button class="text-button" data-action="back">返回闯关</button>')}
      <div class="hud">
        <div class="hud-item"><span class="hud-val" id="flip-moves">${flipMoves}</span><span class="hud-lbl">步数</span></div>
        <div class="hud-item"><span class="hud-val"><span id="flip-pairs">${flipMatched}</span><span class="hud-sub">/${PAIR_TOTAL}</span></span><span class="hud-lbl">配对</span></div>
        <div class="hud-item"><span class="hud-val" id="flip-time">${timeText(flipSeconds)}</span><span class="hud-lbl">用时</span></div>
      </div>
      <div class="grid" id="flip-grid">
        ${flipDeck
          .map(
            (
              card,
              index
            ) => `<div class="card ${card.up || card.done ? 'flipped' : ''} ${card.done ? 'matched' : ''}" data-index="${index}">
              <div class="inner">
                <div class="face front"><span class="logo">DH</span><span class="qmark">?</span></div>
                <div class="face back"><span class="emoji">${card.emoji}</span><span class="label">${esc(card.face)}</span></div>
              </div>
            </div>`
          )
          .join('')}
      </div>
      <button class="secondary" data-action="restart">🔄 重新开始</button>
      <div class="hint">翻开两张牌，把「名字」和它的「职责」配成一对 · 共 ${PAIR_TOTAL} 对</div>
      <div class="mask" id="flip-win" ${flipWon ? '' : 'hidden'}><div class="sheet">
        <div class="win-title">🎉 记忆大师！</div>
        <div class="win-text">全部配对成功：${flipMoves} 步，用时 ${timeText(flipSeconds)}</div>
        <div class="win-rank">${flipMoves <= 20 ? '⭐ 记忆大师' : flipMoves <= 28 ? '👍 很不错' : '💪 继续加油'}</div>
        <button class="primary" data-action="back">回到小游戏 →</button>
        <button class="secondary" data-action="restart">🔄 再来一局</button>
      </div></div>
      ${App.warning()}`,
      (root) => {
        const paint = () => {
          flipDeck.forEach((card, index) => {
            const node = root.querySelector(`.card[data-index="${index}"]`);
            node.classList.toggle('flipped', card.up || card.done);
            node.classList.toggle('matched', card.done);
          });
          $('flip-moves').textContent = flipMoves;
          $('flip-pairs').textContent = flipMatched;
          $('flip-time').textContent = timeText(flipSeconds);
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
          if (card.up || card.done) return;

          flipClock();
          if (flipOpen.length === 0) {
            card.up = true;
            flipOpen = [index];
            return paint();
          }

          const firstIndex = flipOpen[0];
          const first = flipDeck[firstIndex];
          card.up = true;
          flipMoves += 1;

          if (first.pair === card.pair) {
            first.done = true;
            card.done = true;
            flipMatched += 1;
            flipOpen = [];
            paint();
            if (flipMatched === PAIR_TOTAL) {
              flipWon = true;
              if (flipTimer) clearInterval(flipTimer);
              flipTimer = null;
              store().dispatch('flipResult', { moves: flipMoves, seconds: flipSeconds });
              $('flip-win').hidden = false;
              $('flip-win').querySelector('.win-text').textContent =
                `全部配对成功：${flipMoves} 步，用时 ${timeText(flipSeconds)}`;
            }
            return;
          }

          flipBusy = true;
          paint();
          App.after(700, () => {
            first.up = false;
            card.up = false;
            flipOpen = [];
            flipBusy = false;
            paint();
          });
        });
      }
    );
  });

  /* ==================== 能量三消 ==================== */
  const SIZE = content.match3.size;
  let crushBoard = null;
  let crushScore = 0;
  let crushCombo = 0;
  let crushTimeLeft = content.match3.seconds;
  let crushSelected = null;
  let crushResolving = false;
  let crushTimer = null;

  function crushReset() {
    crushBoard = match3.createBoard(SIZE);
    crushScore = 0;
    crushCombo = 0;
    crushTimeLeft = content.match3.seconds;
    crushSelected = null;
    crushResolving = false;
    if (crushTimer) clearInterval(crushTimer);
    crushTimer = null;
  }

  function crushCells() {
    return match3.decorate(crushBoard);
  }

  function crushPaint(root) {
    const html = crushCells()
      .map(
        (row) =>
          `<div class="row">${row.cells
            .map(
              (cell) =>
                `<div class="cell ${crushSelected && crushSelected.row === cell.row && crushSelected.col === cell.col ? 'sel' : ''} ${cell.clearing ? 'pop' : ''}" style="background:${cell.color}" data-row="${cell.row}" data-col="${cell.col}">${cell.emoji}</div>`
            )
            .join('')}</div>`
      )
      .join('');
    root.querySelector('#crush-board').innerHTML = html;
    root.querySelector('#crush-score').textContent = crushScore;
    root.querySelector('#crush-combo').textContent = crushCombo;
    root.querySelector('#crush-time').textContent = crushTimeLeft;
  }

  function crushStartClock(root) {
    if (crushTimer) return;
    crushTimer = setInterval(() => {
      if (!here('#/crush')) {
        clearInterval(crushTimer);
        crushTimer = null;
        return;
      }
      crushTimeLeft -= 1;
      root.querySelector('#crush-time').textContent = Math.max(0, crushTimeLeft);
      if (crushTimeLeft <= 0) {
        clearInterval(crushTimer);
        crushTimer = null;
        if (crushScore > 0) store().dispatch('crushResult', { score: crushScore });
        root.querySelector('#crush-over').hidden = false;
        root.querySelector('#crush-final').textContent = crushScore;
        root.querySelector('#crush-rank').textContent =
          crushScore >= 300 ? '⭐ 手速大师' : crushScore >= 150 ? '👍 手速不错' : '💪 再接再厉';
      }
    }, 1000);
  }

  function crushCascade(root, board, combo) {
    const matches = match3.findMatches(board);
    if (matches.length === 0) {
      let next = board;
      if (!match3.hasMove(next)) {
        next = match3.createBoard(SIZE);
        root.querySelector('#crush-hint').textContent = '没有可消的组合了，已经重新发牌';
      }
      crushBoard = next;
      crushCombo = 0;
      crushResolving = false;
      crushPaint(root);
      return;
    }
    const step = combo + 1;
    crushScore += match3.scoreFor(matches.length, step);
    crushCombo = step;
    crushBoard = board;
    // 先画出「消除中」的一帧，让 pop 动画跑起来
    crushBoard = board;
    root.querySelector('#crush-board').innerHTML = match3
      .decorate(board, matches)
      .map(
        (row) =>
          `<div class="row">${row.cells
            .map(
              (cell) =>
                `<div class="cell ${cell.clearing ? 'pop' : ''}" style="background:${cell.color}" data-row="${cell.row}" data-col="${cell.col}">${cell.emoji}</div>`
            )
            .join('')}</div>`
      )
      .join('');
    root.querySelector('#crush-score').textContent = crushScore;
    root.querySelector('#crush-combo').textContent = crushCombo;

    App.after(200, () => {
      crushCascade(root, match3.collapse(board, matches), step);
    });
  }

  App.register('#/crush', () => {
    if (!crushBoard) crushReset();
    App.mount(
      `
      ${App.topbar('ENERGY CRUSH / 能量三消', '<button class="text-button" data-action="back">返回闯关</button>')}
      <div class="hud">
        <div class="hud-item"><span class="hud-val" id="crush-time">${crushTimeLeft}</span><span class="hud-lbl">剩余时间</span></div>
        <div class="hud-item"><span class="hud-val" id="crush-score">${crushScore}</span><span class="hud-lbl">得分</span></div>
        <div class="hud-item"><span class="hud-val" id="crush-combo">${crushCombo}</span><span class="hud-lbl">连击</span></div>
      </div>
      <div class="board" id="crush-board"></div>
      <div class="hint" id="crush-hint">点两个相邻的方块交换，三连即消 · 三连 10 分，连击翻倍</div>
      <button class="secondary" data-action="restart">🔄 重新开始</button>
      <div class="mask" id="crush-over" hidden><div class="sheet">
        <div class="win-title">🎉 时间到！</div>
        <div class="win-score" id="crush-final">0</div>
        <div class="win-lbl">最终得分</div>
        <div class="win-rank" id="crush-rank"></div>
        <button class="primary" data-action="back">回到小游戏 →</button>
        <button class="secondary" data-action="restart">🔄 再来一局</button>
      </div></div>
      ${App.warning()}`,
      (root) => {
        crushPaint(root);

        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'back') return App.go('#/games');
          if (action === 'restart') {
            crushReset();
            return App.render();
          }
        });

        App.on(root, '#crush-board .cell', 'click', (event, hit) => {
          if (crushResolving || crushTimeLeft <= 0) return;
          const cell = { row: Number(hit.dataset.row), col: Number(hit.dataset.col) };
          if (!crushSelected) {
            crushSelected = cell;
            return crushPaint(root);
          }
          if (crushSelected.row === cell.row && crushSelected.col === cell.col) {
            crushSelected = null;
            return crushPaint(root);
          }
          if (!match3.isAdjacent(crushSelected, cell)) {
            crushSelected = cell;
            return crushPaint(root);
          }

          const swapped = match3.swapTiles(crushBoard, crushSelected, cell);
          if (match3.findMatches(swapped).length === 0) {
            crushSelected = null;
            crushPaint(root);
            root.querySelector('#crush-board').classList.add('shake');
            App.after(280, () => root.querySelector('#crush-board').classList.remove('shake'));
            return;
          }

          crushStartClock(root);
          crushSelected = null;
          crushResolving = true;
          crushCascade(root, swapped, 0);
        });
      }
    );
  });

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

  /* ==================== 复现异常（实验台） ==================== */
  const reproGame = content.reproGame;
  let reproHold = 0;
  let reproTimer = null;

  App.register('#/repro', () => {
    const s = store().read();
    const done = s.games.repro.done;
    App.mount(
      `
      ${App.topbar('LAB 01 / 复现异常', '<button class="text-button" data-action="back">返回闯关</button>')}
      <div class="npc">
        <div class="npc-head">${reproGame.npc.avatar}</div>
        <div class="npc-main">
          <span class="npc-name">${esc(reproGame.npc.name)} · ${esc(reproGame.npc.role)}</span>
          <span class="npc-text">${esc(reproGame.brief)}</span>
        </div>
      </div>
      <div class="hud">
        <div class="hud-item"><span class="hud-val" id="repro-load">60%</span><span class="hud-lbl">当前负载</span></div>
        <div class="hud-item"><span class="hud-val" id="repro-power">已通电</span><span class="hud-lbl">实验台</span></div>
        <div class="hud-item"><span class="hud-val" id="repro-hold">0<span class="hud-sub">/${reproGame.holdSeconds} 秒</span></span><span class="hud-lbl">高负载保持</span></div>
      </div>
      <div class="meter component-host">
        <div class="instrument">
          <div class="header"><span>实时实验台</span><span class="status" id="repro-status">● 通电中</span></div>
          <div class="readout"><span class="digits" id="repro-digits">1380</span><span> W</span><span class="mode">观察模式</span></div>
          <canvas class="wave" id="repro-wave"></canvas>
          <div class="caption">拖动负载滑杆，观察功率与波形响应</div>
          <input type="range" id="repro-slider" min="20" max="100" step="1" value="60" aria-label="演示负载" />
          <div class="header"><span id="repro-label">演示负载 60%</span><button data-action="toggle">断电 ⏻</button></div>
          <div class="note">波形与功率为交互演示；下方精度题使用独立固定数据。</div>
        </div>
      </div>
      <div class="feedback" id="repro-feedback">${done ? esc(reproGame.success) : esc(reproGame.brief)}</div>
      <div class="hint">目标：通电后把负载推到 ${reproGame.targetMin}% 以上，并保持 ${reproGame.holdSeconds} 秒</div>
      ${
        done
          ? `<div class="mask"><div class="sheet">
              <div class="win-title">✅ 偏差复现成功</div>
              <div class="win-text">${esc(reproGame.success)}</div>
              <div class="win-value">本次文化印记 · ${esc(reproGame.value)}</div>
              <button class="primary" data-action="back">回到小游戏 →</button>
            </div></div>`
          : ''
      }
      ${App.warning()}`,
      (root) => {
        const meter = App.meter({
          canvas: root.querySelector('#repro-wave'),
          calibrated: () => false,
          onChange: ({ load, running, power }) => {
            root.querySelector('#repro-load').textContent = `${load}%`;
            root.querySelector('#repro-power').textContent = running ? '已通电' : '已断电';
            root.querySelector('#repro-status').textContent = running ? '● 通电中' : '○ 已断电';
            root.querySelector('#repro-digits').textContent = power;
            root.querySelector('#repro-label').textContent = `演示负载 ${load}%`;
            root.querySelector('[data-action="toggle"]').textContent = running
              ? '断电 ⏻'
              : '通电 ⏻';
            const feedback = root.querySelector('#repro-feedback');
            if (store().read().games.repro.done) return;
            feedback.textContent = !running
              ? reproGame.needPower
              : load >= reproGame.targetMin
                ? '负载到了，稳住别动'
                : reproGame.idle;

            const reached = running && load >= reproGame.targetMin;
            if (reached && !reproTimer) {
              reproTimer = App.every(1000, () => {
                reproHold += 1;
                root.querySelector('#repro-hold').innerHTML =
                  `${reproHold}<span class="hud-sub">/${reproGame.holdSeconds} 秒</span>`;
                if (reproHold >= reproGame.holdSeconds) {
                  clearInterval(reproTimer);
                  reproTimer = null;
                  store().dispatch('reproResult', { load: meter.load });
                  feedback.textContent = reproGame.success;
                  feedback.classList.add('good');
                  App.render();
                }
              });
            } else if (!reached && reproTimer) {
              clearInterval(reproTimer);
              reproTimer = null;
              reproHold = 0;
              root.querySelector('#repro-hold').innerHTML =
                `0<span class="hud-sub">/${reproGame.holdSeconds} 秒</span>`;
            }
          }
        });

        root.querySelector('#repro-slider').addEventListener('input', (event) => {
          meter.setLoad(event.target.value);
        });
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'back') return App.go('#/games');
          if (action === 'toggle') meter.toggle();
        });
        meter.emit();
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
            <div class="final-score"><span class="final-val">${board.crush.score}</span><span class="final-lbl">三消得分</span></div>
            <div class="final-score"><span class="final-val">${board.quiz.score}</span><span class="final-lbl">答题分数</span></div>
          </div>
          <div class="final-detail">
            <div class="detail-title">成绩明细</div>
            <div class="detail-row"><span>认证配对</span><span>${board.cert.matched} / ${board.cert.total} 个市场</span></div>
            <div class="detail-row"><span>方案组卡</span><span>${board.solution.perfect ? '满分组通过' : '已通过'}</span></div>
            <div class="detail-row"><span>模块配对</span><span>${board.flip.moves} 步 / ${board.flip.seconds} 秒</span></div>
            <div class="detail-row"><span>复现异常</span><span>${board.repro.load}% 负载</span></div>
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
