/**
 * 文化画像测试：学习完成后的三个判断环节，一步一屏。
 *
 *   ① 质量值班：六份材料，一份一屏，判断通过 / 退回（信任值与印记实时变化）
 *   ② 认证配对：把三张认证卡配到对应市场
 *   ③ 方案组卡：预算三张卡，缺必需项会被客户打回
 *   ④ 画像结算：信任值分档 + 四项印记 + 关键行为 + 行动承诺
 *
 * 权限：进入测试要求四个学习模块都打卡完毕；结算要求三个环节都完成。
 */
(function (App) {
  const { state, content, esc } = App;
  const store = () => window.DHKStore;

  const SHIFT_STEPS = [
    { id: 'shift', name: '质量值班' },
    { id: 'cert', name: '认证配对' },
    { id: 'solution', name: '方案组卡' },
    { id: 'report', name: '文化画像' }
  ];

  /** 本轮测试走到哪一步：质量值班 → 认证配对 → 方案组卡 → 画像。 */
  function testStep(s) {
    if (!state.shiftDone(s)) return 0;
    if (!s.missions['2']) return 1;
    if (!s.missions['3']) return 2;
    return 3;
  }

  function guardTest() {
    const s = store().read();
    if (!App.learnDone(s)) {
      App.go('#/learn');
      return null;
    }
    return s;
  }

  function markDelta(choice) {
    return Object.entries(choice.marks || {})
      .map(([name, value]) => `${name} ${value > 0 ? '+' : '−'}${Math.abs(value)}`)
      .join(' · ');
  }

  /** 测试阶段各自的小标题（顶部步骤条用）。 */
  function header(step, hint) {
    return App.steps('文化画像测试', SHIFT_STEPS, step, { hint });
  }

  /* ==================== ① 质量值班 ==================== */
  let shiftResult = null;

  App.register(
    '#/test/shift',
    () => {
      const s = guardTest();
      if (!s) return;
      if (App.prevHash !== '#/test/shift') shiftResult = null;
      const card = state.currentCard(s);
      if (!card && !shiftResult) return App.go('#/test/cert');

      const release = card && card.choices.find((choice) => choice.stamp === 'release');
      const back = card && card.choices.find((choice) => choice.stamp === 'return');
      const twoStamps = Boolean(card) && card.choices.length === 2 && Boolean(release && back);
      const total = state.CARDS.length;
      const index = Math.min(s.decisions.length + (shiftResult ? 0 : 1), total);

      App.mount(
        `
        ${header(0, `第 ${index} / ${total} 份材料：读完材料后点「通过」或「退回」`)}
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
                <div class="delta">
                  <span class="small muted">客户信任</span>
                  <span class="delta-num ${shiftResult.delta < 0 ? 'minus' : 'plus'}">${shiftResult.delta > 0 ? '+' : ''}${shiftResult.delta}</span>
                  <span class="small muted">→ ${shiftResult.trust}</span>
                </div>
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
            ? `<div class="shift-auto small muted">${index >= total ? '值班结束，正在进入认证配对…' : '正在翻开下一份材料…'}</div>
               <button class="primary" data-action="next">${index >= total ? '结束值班，去认证配对 →' : '下一份材料 →'}</button>`
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
        <button class="text-button" data-action="rules">📖 看值班规则</button>
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
            // 看完后果自动进入下一份，不用再点按钮（想快点就点按钮）
            App.after(2600, () => {
              if (!shiftResult || !/^#\/test\/shift/.test(window.location.hash)) return;
              shiftResult = null;
              if (state.shiftDone(store().read())) return App.go('#/test/cert');
              App.render();
            });
          };
          App.swipe(root, {
            next: () => !shiftResult && twoStamps && decide(release.id),
            prev: () => !shiftResult && twoStamps && decide(back.id)
          });
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'choose') return decide(hit.dataset.id);
            if (action === 'next') {
              // 一份材料的后果看完，继续下一份；六份都判完才进下一环节
              shiftResult = null;
              if (state.shiftDone(store().read())) return App.go('#/test/cert');
              return App.render();
            }
            if (action === 'rules') return (root.querySelector('#rules-mask').hidden = false);
            if (action === 'rules-close') return (root.querySelector('#rules-mask').hidden = true);
          });
        }
      );
    },
    'shift'
  );

  /* ==================== ② 认证配对 ==================== */
  const certGame = content.certGame;
  let certOrder = null;
  let certSelected = '';
  let certWrong = false;

  App.register(
    '#/test/cert',
    () => {
      const s = guardTest();
      if (!s) return;
      // 刚做完时留在本页显示成功提示，重新进入这一步才自动跳到下一步
      if (s.missions['2'] && App.prevHash !== '#/test/cert') return App.go('#/test/solution');
      if (App.prevHash !== '#/test/cert') {
        certOrder = null;
        certSelected = '';
        certWrong = false;
      }
      const matched = s.games.cert.matched;
      if (!certOrder) {
        certOrder = certGame.certs
          .slice()
          .sort(() => Math.random() - 0.5)
          .map((cert) => cert.id);
      }
      const certName = (id) => (certGame.certs.find((cert) => cert.id === id) || {}).name || '';
      const done = matched.length === certGame.markets.length;

      App.mount(
        `
        ${header(1, `还剩 ${certGame.markets.length - matched.length} 个市场没配对：先点市场，再点认证卡`)}
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
          certWrong
            ? `<div class="feedback">${esc(certGame.wrong)}</div>`
            : `<div class="hint">已配对 ${matched.length} / ${certGame.markets.length} 个市场</div>`
        }
        ${
          done
            ? `<button class="primary" data-action="next">三张卡都放对了，去方案组卡 →</button>`
            : ''
        }
        ${App.warning()}`,
        (root) => {
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'next') return App.go('#/test/solution');
            if (action === 'market') {
              const id = hit.dataset.id;
              if (store().read().games.cert.matched.includes(id)) return;
              certSelected = id;
              certWrong = false;
              return App.render();
            }
            if (action === 'cert') {
              const cert = hit.dataset.id;
              if (!certSelected) {
                certWrong = '先点左边的市场，再选认证卡。';
                return App.render();
              }
              store().dispatch('certMatch', { market: certSelected, cert: cert });
              const accepted = store().read().games.cert.matched.includes(certSelected);
              certWrong = accepted ? false : certGame.wrong;
              if (accepted) certSelected = '';
              App.render();
            }
          });
        }
      );
    },
    'cert'
  );

  /* ==================== ③ 方案组卡 ==================== */
  const solutionGame = content.solutionGame;
  let solutionPicks = null;
  let solutionFeedback = null;

  App.register(
    '#/test/solution',
    () => {
      const s = guardTest();
      if (!s) return;
      if (s.missions['3'] && App.prevHash !== '#/test/solution') return App.go('#/test/report');
      if (App.prevHash !== '#/test/solution') solutionFeedback = null;
      if (!solutionPicks) solutionPicks = s.games.solution.picks.slice();
      const picked = (id) => solutionPicks.includes(id);

      App.mount(
        `
        ${header(2, `预算 ${solutionGame.quota} 张能力卡：选最贴近客户需求的三张`)}
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
          s.missions['3']
            ? `<div class="feedback ${s.games.solution.perfect ? 'good' : 'warn'}">${esc(
                s.games.solution.perfect ? solutionGame.success : solutionGame.accepted
              )}</div>`
            : solutionFeedback
              ? `<div class="feedback ${solutionFeedback.kind}">${esc(solutionFeedback.text)}</div>`
              : `<div class="hint">选中 ${solutionGame.quota} 张后提交给客户</div>`
        }
        ${
          s.missions['3']
            ? '<button class="primary" data-action="to-report">去看我的文化画像 →</button>'
            : '<button class="primary" data-action="submit">提交方案给客户</button>'
        }
        ${App.warning()}`,
        (root) => {
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'pick') {
              const id = hit.dataset.id;
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
            if (action === 'to-report') return App.go('#/test/report');
            if (action === 'submit') {
              if (solutionPicks.length !== solutionGame.quota) {
                solutionFeedback = {
                  kind: 'warn',
                  text: `预算就是 ${solutionGame.quota} 张卡，现在选了 ${solutionPicks.length} 张。`
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
    },
    'solution'
  );

  /* ==================== ④ 文化画像结算 ==================== */
  App.register(
    '#/test/report',
    () => {
      const s = guardTest();
      if (!s) return;
      if (testStep(s) < 3) return App.go('#/test/shift');
      const portrait = state.portrait(s);
      const step = testStep(s);

      App.mount(
        `
        ${header(3, '你的判断已经生成画像：选一项行动承诺，完成测试')}
        <div class="seal"><div class="seal-core">${portrait.trust}</div></div>
        <div class="title center">${esc(portrait.level.label)}</div>
        <div class="subtitle center">${esc(portrait.level.comment)}</div>
        <div class="card">
          <div class="row"><span class="label">客户信任</span><span class="trust-num">${portrait.trust} / 100</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${portrait.trust}%"></div></div>
          <div class="small muted">信任值由你每一次判断累积而成，不会被人工修正。</div>
        </div>
        <div class="card">
          <div class="label">印记构成</div>
          ${portrait.ranked
            .map(
              (item) => `<div class="mark-row">
                <span class="mark-name">${item.name}</span>
                <div class="mark-track"><div class="mark-fill ${item.value < 0 ? 'bad' : ''}" style="width:${Math.min(100, Math.abs(item.value) * 20)}%"></div></div>
                <span class="mark-val ${item.value < 0 ? 'bad' : ''}">${item.value > 0 ? '+' : ''}${item.value}</span>
              </div>`
            )
            .join('')}
        </div>
        <div class="culture">
          <div class="label">最高印记 · ${portrait.top || '尚无'}</div>
          <div class="quote">${esc(portrait.style.title)}</div>
        </div>
        <div class="card highlights">
          <div class="label">你的关键行为</div>
          ${portrait.highlights
            .map(
              (item) =>
                `<div class="highlight"><span class="highlight-title">${esc(item.card)}</span><span class="highlight-choice">${esc(item.choice)}</span></div>`
            )
            .join('')}
        </div>
        <div class="card">
          <div class="label">选一项行动承诺</div>
          ${content.actions
            .map(
              (action) =>
                `<button class="option ${s.pledge === action ? 'selected' : ''}" data-action="pledge" data-value="${esc(action)}">${s.pledge === action ? '◉' : '○'} ${esc(action)}</button>`
            )
            .join('')}
        </div>
        ${s.completed ? '<div class="small success">✓ 测试已完成，可以开始闯关小游戏了。</div>' : ''}
        <button class="primary" data-action="save" ${s.pledge ? '' : 'disabled'}>${s.completed ? '保存并去玩小游戏 →' : '保存承诺，完成测试'}</button>
        <button class="secondary" data-action="review">回看我的判断（重新值班）</button>
        ${App.warning()}`,
        (root) => {
          App.on(root, '[data-action]', 'click', (event, hit) => {
            const action = hit.dataset.action;
            if (action === 'pledge') {
              store().write({ ...store().read(), pledge: hit.dataset.value });
              return App.render();
            }
            if (action === 'save') {
              const fresh = store().read();
              store().dispatch('complete', fresh.pledge);
              return App.go('#/games');
            }
            if (action === 'review') return App.go('#/test/shift');
          });
        }
      );
    },
    'culture'
  );

  /** 测试是否完成（三个环节 + 承诺）——小游戏解锁条件。 */
  App.testDone = (s) =>
    state.allDone(s) || (s.missions['2'] && s.missions['3'] && state.shiftDone(s) && s.completed);
  App.testStep = testStep;
  App.TEST_STEPS = SHIFT_STEPS;
})(window.DHKApp);
