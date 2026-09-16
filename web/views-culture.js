/**
 * 网页版企业文化模块：企业文化（介绍+打卡+三关卡）、认证配对、预算组卡。
 * 对应小程序的 pages/quest、cert、solution。
 */
(function (App) {
  const { state, content, esc } = App;
  const store = () => window.DHKStore;

  /* ==================== 企业文化模块 ==================== */
  let questModal = null; // { quest, phase: 'intro' | 'ask' | 'result', choice, right }

  App.register('#/quest', () => {
    const s = store().read();
    const progress = state.taskProgress(s);
    const moduleDone = state.cultureDone(s);
    const allDone = state.allDone(s);
    const grade = allDone ? state.grade(s) : null;
    const board = state.scoreboard(s);

    const checkins = content.quests
      .map(
        (
          quest
        ) => `<button class="tile ${s.checkins[quest.id] ? 'done' : ''}" data-action="quest" data-id="${quest.id}">
          <span class="tile-icon">${quest.icon}</span>
          <div class="tile-main">
            <span class="tile-name">${esc(quest.name)}</span>
            <span class="tile-hint">${esc(quest.hint)}</span>
          </div>
          <span class="tile-state">${s.checkins[quest.id] ? '✓' : '打卡'}</span>
        </button>`
      )
      .join('');

    const gates = [
      {
        id: 'shift',
        icon: '🕹️',
        name: '质量值班',
        hint: `${s.decisions.length} / ${state.CARDS.length} 份材料`,
        done: state.shiftDone(s)
      },
      {
        id: 'cert',
        icon: '🌍',
        name: '认证配对',
        hint: `${s.games.cert.matched.length} / ${content.certGame.markets.length} 个市场`,
        done: s.missions['2']
      },
      {
        id: 'solution',
        icon: '🎯',
        name: '方案组卡',
        hint: s.games.solution.perfect ? '满分组' : s.games.solution.done ? '已通过' : '六选三',
        done: s.missions['3']
      }
    ]
      .map(
        (
          gate
        ) => `<button class="gate ${gate.done ? 'done' : ''}" data-action="gate" data-id="${gate.id}">
          <span class="gate-icon">${gate.icon}</span>
          <span class="gate-name">${esc(gate.name)}</span>
          <span class="gate-hint">${esc(gate.hint)}</span>
          <span class="gate-state">${gate.done ? '✓' : '›'}</span>
        </button>`
      )
      .join('');

    const modal = !questModal
      ? ''
      : (() => {
          const quest = questModal.quest;
          const options = quest.options
            .map((option, index) => {
              const letter = 'ABCD'[index];
              const cls =
                questModal.phase === 'result'
                  ? `${index === quest.answer ? 'right' : ''} ${index === questModal.choice && !questModal.right ? 'wrong' : ''}`
                  : '';
              return `<button class="option ${cls}" data-action="quest-pick" data-index="${index}"><span class="letter">${letter}</span><span>${esc(option)}</span></button>`;
            })
            .join('');

          if (questModal.phase === 'intro') {
            return `<div class="mask"><div class="sheet">
              <div class="badge">${esc(quest.badge)}</div>
              <div class="sheet-title">${esc(quest.title)}</div>
              <div class="intro">${esc(quest.intro)}</div>
              <div class="small muted">看完这段内容，回答下面的问题就算完成打卡。</div>
              <button class="primary" data-action="quest-start">开始打卡答题 →</button>
            </div></div>`;
          }
          if (questModal.phase === 'ask') {
            return `<div class="mask"><div class="sheet">
              <div class="badge">${esc(quest.badge)}</div>
              <div class="sheet-title">${esc(quest.title)}</div>
              <div class="sheet-q">${esc(quest.question)}</div>
              ${options}
            </div></div>`;
          }
          return `<div class="mask"><div class="sheet">
            <div class="badge">${esc(quest.badge)}</div>
            <div class="sheet-title">${esc(quest.title)}</div>
            ${options}
            <div class="explain ${questModal.right ? 'ok' : 'no'}">${esc(quest.explain)}</div>
            ${
              questModal.right
                ? '<button class="primary" data-action="quest-close">打卡成功，继续 →</button>'
                : '<button class="secondary" data-action="quest-retry">再试一次</button>'
            }
          </div></div>`;
        })();

    const finalModal = !allDone
      ? ''
      : `<div class="mask" id="final-mask" hidden><div class="sheet final">
          <div class="final-title">🏆 东鸿密钥 · 全部通关！</div>
          <div class="small muted">你完成了企业文化与企业探索的全部任务</div>
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
          <button class="primary" data-action="final-close">🎉 太棒了，关闭</button>
        </div></div>`;

    App.mount(
      `
      ${App.topbar(
        'CULTURE MODULE / 企业文化',
        '<button class="text-button" data-action="home">首页</button>'
      )}
      <div class="hud">
        <div class="row"><span class="label">模块进度</span><span class="hud-num">${progress.done} / ${progress.total}</span></div>
        <div class="track"><div class="track-fill" style="width:${Math.round((progress.done / progress.total) * 100)}%"></div></div>
        <div class="small muted">${moduleDone ? '✅ 模块已完成，闯关小游戏已解锁' : `主线进度 ${state.percent(s)}%`}</div>
      </div>
      <div class="section-title">① 文化介绍 · 打卡答题</div>
      <div class="quest-grid">${checkins}</div>
      <div class="section-title">② 互动关卡</div>
      <div class="gate-grid">${gates}</div>
      <div class="section-title">③ 闯关小游戏</div>
      <button class="entry ${moduleDone ? '' : 'locked'}" data-action="games">
        <span class="entry-icon">${moduleDone ? '🦘' : '🔒'}</span>
        <div class="entry-main">
          <span class="entry-name">${moduleDone ? '文化跳格子 · 五个小游戏' : '完成上面两个部分后解锁'}</span>
          <span class="entry-hint">${moduleDone ? '答对前进一格，答错退回一格' : '先把企业文化走一遍，再来闯关'}</span>
        </div>
        <span class="entry-state">${moduleDone ? '›' : ''}</span>
      </button>
      <button class="primary" data-action="final" ${allDone ? '' : 'disabled'}>${allDone ? '查看通关结算 🏆' : '全部任务完成后解锁结算'}</button>
      ${App.warning()}
      ${modal}
      ${finalModal}`,
      (root) => {
        if (allDone) root.querySelector('#final-mask').hidden = false; // 首次全部通关自动弹结算
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'home') return App.go('#/home');
          if (action === 'games') return App.go('#/games');
          if (action === 'quest') {
            const quest = content.quests.find((item) => item.id === hit.dataset.id);
            questModal = { quest, phase: 'intro', choice: -1, right: false };
            return App.render();
          }
          if (action === 'quest-start') {
            questModal.phase = 'ask';
            return App.render();
          }
          if (action === 'quest-pick') {
            const choice = Number(hit.dataset.index);
            const right = choice === questModal.quest.answer;
            store().dispatch('checkin', { questId: questModal.quest.id, choice });
            questModal = { ...questModal, phase: 'result', choice, right };
            return App.render();
          }
          if (action === 'quest-retry') {
            questModal = { ...questModal, phase: 'ask', choice: -1, right: false };
            return App.render();
          }
          if (action === 'quest-close') {
            questModal = null;
            return App.go('#/quest');
          }
          if (action === 'gate') {
            const id = hit.dataset.id;
            return App.go(id === 'shift' ? '#/shift' : id === 'cert' ? '#/cert' : '#/solution');
          }
          if (action === 'final') {
            root.querySelector('#final-mask').hidden = false;
            return;
          }
          if (action === 'final-close') {
            root.querySelector('#final-mask').hidden = true;
          }
        });
      }
    );
  });

  /* ==================== 认证配对 ==================== */
  const certGame = content.certGame;
  let certOrder = null;

  App.register('#/cert', () => {
    const s = store().read();
    const matched = s.games.cert.matched;
    if (!certOrder) {
      certOrder = certGame.certs
        .map((cert) => cert)
        .sort(() => Math.random() - 0.5)
        .map((cert) => cert.id);
    }
    const certName = (id) => (certGame.certs.find((cert) => cert.id === id) || {}).name || '';
    const done = matched.length === certGame.markets.length;
    const wrong = sessionCertWrong;

    App.mount(
      `
      ${App.topbar(
        'CHAPTER 02 / 世界之门',
        '<button class="text-button" data-action="back">返回闯关</button>'
      )}
      <div class="npc">
        <div class="npc-head">${certGame.npc.avatar}</div>
        <div class="npc-main">
          <span class="npc-name">${esc(certGame.npc.name)} · ${esc(certGame.npc.role)}</span>
          <span class="npc-text">${esc(certGame.intro)}</span>
        </div>
      </div>
      <div class="markets">
        ${certGame.markets
          .map(
            (
              market
            ) => `<div class="market ${matched.includes(market.id) ? 'done' : ''} ${certSelected === market.id ? 'sel' : ''}" data-action="market" data-id="${market.id}">
              <div class="market-main">
                <span class="market-name">${esc(market.name)}</span>
                <span class="market-hint">${esc(market.hint)}</span>
              </div>
              <span class="market-cert">${matched.includes(market.id) ? esc(certName(certGame.answer[market.id])) : '待匹配'}</span>
            </div>`
          )
          .join('')}
      </div>
      <div class="certs">
        ${certOrder
          .map((id) => {
            const cert = certGame.certs.find((item) => item.id === id);
            const used = matched.some((market) => certGame.answer[market] === id);
            return `<button class="cert ${used ? 'used' : ''}" data-action="cert" data-id="${id}">
              <span class="cert-name">${esc(cert.name)}</span>
              <span class="cert-note">${esc(cert.note)}</span>
            </button>`;
          })
          .join('')}
      </div>
      ${
        wrong
          ? `<div class="feedback">${esc(certGame.wrong)}</div>`
          : `<div class="hint">先点一个市场，再点一张认证卡 · 已配对 ${matched.length} / ${certGame.markets.length}</div>`
      }
      ${
        done
          ? `<div class="mask"><div class="sheet">
              <div class="win-title">✅ 三张卡都放对了</div>
              <div class="win-text">${esc(certGame.success)}</div>
              <div class="win-value">本次文化印记 · ${esc(certGame.value)}</div>
              <button class="primary" data-action="next-level">去下一关：客户之光 →</button>
              <button class="secondary" data-action="back">回到闯关中心</button>
            </div></div>`
          : ''
      }
      ${App.warning()}`,
      (root) => {
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'back') return App.go('#/quest');
          if (action === 'next-level') return App.go('#/solution');
          if (action === 'market') {
            const id = hit.dataset.id;
            if (store().read().games.cert.matched.includes(id)) return;
            certSelected = id;
            sessionCertWrong = false;
            return App.render();
          }
          if (action === 'cert') {
            const cert = hit.dataset.id;
            const fresh = store().read();
            if (!certSelected) {
              sessionCertWrong = '先点左边的市场，再选认证卡。';
              return App.render();
            }
            store().dispatch('certMatch', { market: certSelected, cert });
            const accepted = store().read().games.cert.matched.includes(certSelected);
            sessionCertWrong = accepted ? false : certGame.wrong;
            if (accepted) certSelected = '';
            App.render();
          }
        });
      }
    );
  });
  let certSelected = '';
  let sessionCertWrong = false;

  /* ==================== 预算组卡 ==================== */
  const solutionGame = content.solutionGame;

  App.register('#/solution', () => {
    const s = store().read();
    const saved = s.games.solution;
    if (!solutionPicks) solutionPicks = saved.picks.slice();

    const picked = (id) => solutionPicks.includes(id);
    const feedback = solutionFeedback;
    const done = saved.done;

    App.mount(
      `
      ${App.topbar(
        'CHAPTER 03 / 客户之光',
        '<button class="text-button" data-action="back">返回闯关</button>'
      )}
      <div class="npc">
        <div class="npc-head">${solutionGame.npc.avatar}</div>
        <div class="npc-main">
          <span class="npc-name">${esc(solutionGame.npc.name)} · ${esc(solutionGame.npc.role)}</span>
          <span class="npc-text">${esc(solutionGame.brief)}</span>
        </div>
      </div>
      <div class="budget">
        <span class="budget-label">预算</span>
        <span class="budget-num">${solutionPicks.length} / ${solutionGame.quota} 张</span>
      </div>
      <div class="cards">
        ${solutionGame.cards
          .map(
            (
              card
            ) => `<button class="card ${picked(card.id) ? 'picked' : ''}" data-action="pick" data-id="${card.id}">
              <span class="card-name">${picked(card.id) ? '◉' : '○'} ${esc(card.name)}</span>
              <span class="card-note">${esc(card.note)}</span>
            </button>`
          )
          .join('')}
      </div>
      ${
        feedback
          ? `<div class="feedback ${feedback.kind}">${esc(feedback.text)}</div>`
          : `<div class="hint">选 ${solutionGame.quota} 张最贴近客户需求的能力卡，不堆功能</div>`
      }
      <button class="primary" data-action="${done ? 'finish' : 'submit'}">${done ? '回到闯关中心 →' : '提交方案给客户'}</button>
      ${
        done
          ? `<div class="mask"><div class="sheet">
              <div class="win-title">${saved.perfect ? '🌟 客户非常满意' : '✅ 客户接受了方案'}</div>
              <div class="win-text">${esc(saved.perfect ? solutionGame.success : solutionGame.accepted)}</div>
              <div class="win-value">本次文化印记 · ${esc(solutionGame.value)}</div>
              <button class="primary" data-action="finish">回到闯关中心 →</button>
            </div></div>`
          : ''
      }
      ${App.warning()}`,
      (root) => {
        App.on(root, '[data-action]', 'click', (event, hit) => {
          const action = hit.dataset.action;
          if (action === 'back' || action === 'finish') return App.go('#/quest');
          if (action === 'pick') {
            const id = hit.dataset.id;
            if (store().read().games.solution.done) return;
            if (picked(id)) solutionPicks = solutionPicks.filter((item) => item !== id);
            else if (solutionPicks.length >= solutionGame.quota) {
              solutionFeedback = {
                kind: 'warn',
                text: `客户给的预算就是 ${solutionGame.quota} 张卡，先取消一张再选。`
              };
              return App.render();
            } else solutionPicks = solutionPicks.concat(id);
            solutionFeedback = null;
            return App.render();
          }
          if (action === 'submit') {
            if (solutionPicks.length !== solutionGame.quota) {
              solutionFeedback = {
                kind: 'warn',
                text: `客户给的预算就是 ${solutionGame.quota} 张卡，现在选了 ${solutionPicks.length} 张。`
              };
              return App.render();
            }
            store().dispatch('solution', { picks: solutionPicks });
            const saved = store().read().games.solution;
            if (!saved.done) {
              solutionFeedback = { kind: 'bad', text: solutionGame.rejected };
              return App.render();
            }
            solutionFeedback = null;
            return App.render();
          }
        });
      }
    );
  });
  let solutionPicks = null;
  let solutionFeedback = null;
})(window.DHKApp);
