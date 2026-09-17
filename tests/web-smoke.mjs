/**
 * 网页版端到端测试（Chromium）：走完「序章 → 企业文化学习（4 模块）→ 文化画像测试
 * （值班 / 认证 / 组卡 / 结算）→ 闯关小游戏 → 通关结算」的完整链路，并断言关键结果。
 *
 * 需要 Playwright（不进主依赖）：
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/web-smoke.mjs
 * 服务器故意挂在子路径 /repo/ 下，模拟 GitHub Pages 的项目站点，
 * 顺带保证网页版里的资源引用都是相对路径。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const webDir = path.join(root, 'web');
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ||
  '/Users/baixinliu/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const { chromium } = await import(playwrightPath);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const PREFIX = '/repo/';
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(PREFIX)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
    return;
  }
  const file = path.join(webDir, url.slice(PREFIX.length).replace(/^\/+/, '') || 'index.html');
  if (!file.startsWith(webDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${PREFIX}index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 736 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error.message)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

const checks = [];
const check = (label, condition, detail) => {
  checks.push({ label, ok: Boolean(condition) });
  if (!condition) throw new Error(`断言失败：${label}${detail ? ' — ' + detail : ''}`);
};

const wait = (ms = 160) => page.waitForTimeout(ms);
const go = async (hash) => {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await wait(200);
};
const hash = () => page.evaluate(() => location.hash);
const text = () => page.locator('#app').innerText();
const save = () => page.evaluate(() => window.DHKStore.read());
/** 用 DOM 原生 click，避免 Playwright 在重渲染后重新解析选择器点到别的按钮。 */
const tap = (selector) =>
  page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) throw new Error('找不到元素: ' + sel);
    node.click();
  }, selector);
const questQuestion = (module, question) =>
  page.evaluate(
    ({ module, question }) => {
      const list = window.DHKApp.content.quests[module].questions;
      return list[question].answer;
    },
    { module, question }
  );

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await wait(300);

/* 0. 子路径托管 + 首页三入口 */
check(
  '脚本与样式都从子路径加载',
  await page.evaluate(() => Boolean(window.DHKApp && window.DHKStore))
);
check('页面在子路径下', page.url().includes('/repo/'), page.url());
check('首页渲染', (await text()).includes('东鸿密钥'));
const entries = await page.evaluate(() =>
  [...document.querySelectorAll('.flow-card')].map((card) => card.innerText.replace(/\s+/g, ' '))
);
check('首页三个入口（按顺序）', entries.length === 3, entries.join(' / '));
check('测试与小游戏初始未解锁', entries[1].includes('未解锁') && entries[2].includes('未解锁'));
check(
  '首页有 hero 区块并铺满宽度',
  await page.evaluate(() => {
    const hero = document.querySelector('.home-hero');
    return Boolean(hero) && hero.getBoundingClientRect().width > 300;
  })
);

/* 1. 序章 → 直接进入企业文化学习 */
await go('#/prologue');
check('序章第一段', (await text()).includes('电在流动'));
for (let i = 0; i < 3; i += 1) {
  await tap('[data-action="mission"]');
  await wait(160);
}
check('领密钥后进入企业文化学习', (await hash()) === '#/learn', await hash());
check('使命密钥已领取', (await save()).prologueDone === true);

/* 2. 四个模块：一步一屏，每个模块把一组题（3~4 题）都答对才算学完 */
const questSizes = await page.evaluate(() =>
  window.DHKApp.content.quests.map((quest) => quest.questions.length)
);
check(
  '企业文化题库覆盖到位（每模块 ≥3 题，合计 ≥12）',
  questSizes.every((size) => size >= 3) && questSizes.reduce((a, b) => a + b, 0) >= 12,
  JSON.stringify(questSizes)
);
for (let module = 0; module < 4; module += 1) {
  const total = questSizes[module];
  check(`第 ${module + 1} 个模块停在正确步骤`, (await text()).includes(`第 ${module + 1} / 4 步`));
  check(`第 ${module + 1} 个模块先看内容`, (await text()).includes('开始答题'));
  await tap('[data-action="start-quiz"]');
  await wait(140);
  check(`第 ${module + 1} 个模块从第 1 题开始`, (await text()).includes(`第 1 / ${total} 题`));
  // 先故意答错一次：不给过，要重答
  const truth = await questQuestion(module, 0);
  const wrong = (truth + 1) % 4;
  await tap(`[data-action="answer"][data-index="${wrong}"]`);
  await wait(160);
  check(`第 ${module + 1} 个模块答错要重答`, (await text()).includes('再试一次'));
  check(
    `第 ${module + 1} 个模块答错不算打卡`,
    (await save()).checkins[['culture', 'modules', 'values', 'world'][module]] !== true
  );
  await tap('[data-action="retry"]');
  await wait(140);
  // 再逐题答对
  for (let question = 0; question < total; question += 1) {
    if (question > 0) {
      check(
        `第 ${module + 1} 个模块进入第 ${question + 1} 题`,
        (await text()).includes(`第 ${question + 1} / ${total} 题`)
      );
    }
    const answer = await questQuestion(module, question);
    await tap(`[data-action="answer"][data-index="${answer}"]`);
    await wait(170);
    const afterAnswer = await text();
    if (question < total - 1) {
      check(
        `第 ${module + 1} 个模块第 ${question + 1} 题答对可继续`,
        afterAnswer.includes('下一题')
      );
      await tap('[data-action="next-question"]');
      await wait(170);
    } else {
      check(
        `第 ${module + 1} 个模块最后一题答对可离开`,
        afterAnswer.includes('学下一个模块') || afterAnswer.includes('完成学习，去做文化画像测试'),
        afterAnswer.replace(/\s+/g, ' ').slice(-40)
      );
      check(
        `第 ${module + 1} 个模块的「下一步」按钮不用滚动就能看到`,
        await page.evaluate(() => {
          const node = document.querySelector('[data-action="next-step"]');
          const box = node.getBoundingClientRect();
          return box.bottom <= window.innerHeight + 1 && box.y >= 0;
        })
      );
      check(
        `第 ${module + 1} 个模块全部答对才打卡`,
        (await save()).checkins[['culture', 'modules', 'values', 'world'][module]] === true
      );
    }
  }
  await tap('[data-action="next-step"]');
  await wait(240);
}
check('四个模块后进入学习完成页', (await hash()) === '#/learn/done', await hash());
check('学习完成页提示开始测试', (await text()).includes('开始文化画像测试'));
const afterLearn = await save();
check('四个展区都已打卡', Object.values(afterLearn.checkins).every(Boolean));

/* 3. 文化画像测试：值班（六份材料，一份一屏） */
await tap('[data-action="to-test"]');
await wait(250);
check('进入测试第一步', (await hash()) === '#/test/shift', await hash());
check('测试页有步骤条', (await text()).includes('第 1 / 4 步'));
for (let i = 0; i < 6; i += 1) {
  const choiceId = await page.evaluate((index) => {
    const card = window.DHKApp.state.currentCard(window.DHKStore.read());
    const back = card.choices.find((choice) => choice.stamp === 'return');
    const release = card.choices.find((choice) => choice.stamp === 'release');
    const pick = index % 2 === 0 ? release || back : back || release;
    return pick ? pick.id : card.choices[0].id;
  }, i);
  await tap(`[data-action="choose"][data-id="${choiceId}"]`);
  await wait(160);
  check(`第 ${i + 1} 份材料有后果页`, (await text()).includes('客户信任'));
  // 后果页 2.6 秒后自动进入下一份：第六份结束后直接进认证配对
  if (i < 5) {
    check(
      `第 ${i + 1} 份材料能翻到下一份`,
      await page.evaluate(() => Boolean(document.querySelector('[data-action="next"]')))
    );
    await wait(2900);
    check(
      `第 ${i + 1} 份材料自动进入下一份`,
      await page.evaluate(() => Boolean(document.querySelector('[data-action="choose"]')))
    );
  } else {
    await wait(2900);
    check('第六份材料自动进入认证配对', (await hash()) === '#/test/cert', await hash());
  }
}
check('值班结束进入认证配对', (await hash()) === '#/test/cert', await hash());
check('值班六份都判过了', (await save()).decisions.length === 6);

/* 4. 认证配对 */
const certPairs = await page.evaluate(() =>
  Object.entries(window.DHKApp.content.certGame.answer).map(([market, cert]) => ({ market, cert }))
);
for (const pair of certPairs) {
  await tap(`[data-action="market"][data-id="${pair.market}"]`);
  await wait(100);
  await tap(`[data-action="cert"][data-id="${pair.cert}"]`);
  await wait(160);
}
check('认证配对全部完成', (await save()).missions['2'] === true);
check('认证页给出下一步按钮', (await text()).includes('去方案组卡'));
await tap('[data-action="next"]');
await wait(250);

/* 5. 方案组卡：先被客户打回，再给满分组 */
check('进入方案组卡', (await hash()) === '#/test/solution', await hash());
for (const id of ['store', 'report', 'ota']) await tap(`[data-action="pick"][data-id="${id}"]`);
await tap('[data-action="submit"]');
await wait(200);
check('缺必需项被客户打回', (await text()).includes('解决不了他的问题'));
for (const id of ['store', 'report', 'ota']) await tap(`[data-action="pick"][data-id="${id}"]`);
for (const id of await page.evaluate(() => window.DHKApp.content.solutionGame.perfect)) {
  await tap(`[data-action="pick"][data-id="${id}"]`);
}
await tap('[data-action="submit"]');
await wait(220);
check('满分组通过', (await save()).games.solution.perfect === true);
await tap('[data-action="to-report"]');
await wait(250);

/* 6. 画像结算 + 行动承诺 */
check('进入画像结算', (await hash()) === '#/test/report', await hash());
check('画像显示信任值与印记', (await text()).includes('客户信任'));
check('画像列出关键行为', (await text()).includes('你的关键行为'));
await tap('[data-action="pledge"]');
await wait(140);
await tap('[data-action="save"]');
await wait(300);
check('保存承诺完成测试', (await save()).completed === true);
check('测试结束进入小游戏', (await hash()) === '#/games', await hash());
check('小游戏已解锁', !(await text()).includes('尚未解锁'));

/* 7. 四个小游戏 */
await tap('[data-action="open"][data-id="hop"]');
await wait(220);
check('进入跳格子', (await hash()) === '#/hop', await hash());
check('跳格子是按压蓄力玩法', (await text()).includes('按住按钮蓄力'));
check(
  '棋子始终可见（静止时也有定位）',
  await page.evaluate(() => {
    const pawn = document.querySelector('.pawn-pos');
    const box = pawn.getBoundingClientRect();
    return box.width > 10 && box.height > 20 && box.x > -10 && box.x < window.innerWidth;
  })
);
check('有明确的蓄力按钮', (await text()).includes('按住蓄力 · 松手选中'));
/** 按住 ms 毫秒后松手，指针停在对应选项上（指针每 360ms 扫过一项）。 */
const hopPress = async (ms) => {
  const box = await page.locator('#hop-dock').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await wait(240);
};
const hopAnswers = await page.evaluate(() =>
  window.DHKApp.content.hopGame.tiles.map((t) => t.answer)
);
for (let step = 0; step < hopAnswers.length; step += 1) {
  const tile = (await save()).games.hop.tile;
  const wrong = (hopAnswers[tile] + 1) % 4;
  // 先故意选错：应停在原格并提示重选
  await hopPress(360 * wrong + 50);
  check(`第 ${tile + 1} 格选错停在原格`, (await save()).games.hop.tile === tile);
  check('选错后提示重新选', (await text()).includes('重新选一次'));
  await tap('[data-action="retry"]');
  await wait(160);
  // 再选对：前进一格
  await hopPress(360 * hopAnswers[tile] + 50);
  check(`第 ${tile + 1} 格选对前进一格`, (await save()).games.hop.tile === tile + 1);
  check('选对后没有「下一格」按钮', (await page.locator('[data-action="go"]').count()) === 0);
  await wait(1400); // 等它自己进入下一格
  check(
    `第 ${tile + 1} 格自动进入下一格`,
    tile + 1 >= hopAnswers.length || (await page.locator('#hop-dock').count()) === 1
  );
}
check('跳格子走到终点', (await save()).games.hop.done === true);

await go('#/flip');
check(
  '配对牌面全部正面朝上',
  await page.evaluate(() =>
    [...document.querySelectorAll('#flip-grid .card .label')].every(
      (node) => node.textContent.trim().length > 0
    )
  )
);
const faceLook = await page.evaluate(() => {
  const card = document.querySelector('#flip-grid .card');
  const back = card.querySelector('.face.back');
  const label = card.querySelector('.label');
  const style = getComputedStyle(back);
  const labelStyle = getComputedStyle(label);
  return {
    牌数: document.querySelectorAll('#flip-grid .card').length,
    文字: label.textContent.trim(),
    字号: parseFloat(labelStyle.fontSize),
    牌面有底有边: style.backgroundImage !== 'none' && parseFloat(style.borderTopWidth) > 0,
    被裁掉: label.scrollHeight > Math.ceil(label.getBoundingClientRect().height) + 1,
    可以点: style.pointerEvents !== 'none'
  };
});
check(
  '牌面看得清、能点',
  faceLook.牌数 === 16 &&
    faceLook.文字.length > 1 &&
    faceLook.字号 >= 12 &&
    faceLook.牌面有底有边 &&
    !faceLook.被裁掉 &&
    faceLook.可以点,
  JSON.stringify(faceLook)
);
await tap('.card[data-index="0"]');
await wait(120);
const picked = await page.evaluate(() => {
  const back = document.querySelector('.card.picked .face.back');
  if (!back) return null;
  const style = getComputedStyle(back);
  return { 边框: style.borderTopColor, 背景: style.backgroundColor, 阴影: style.boxShadow };
});
check(
  '点一张牌会高亮，看得出选中了',
  picked !== null && picked.阴影.includes('rgba'),
  JSON.stringify(picked)
);
// 已经选中了一张牌，重新发一局再正经通关
await tap('[data-action="restart"]');
await wait(250);
const pairs = await page.evaluate(() => {
  const groups = {};
  document.querySelectorAll('.card').forEach((card, index) => {
    const label = card.querySelector('.label').textContent;
    const pair = window.DHKApp.content.memory.find((m) => m.face === label).pair;
    groups[pair] = (groups[pair] || []).concat(index);
  });
  return Object.values(groups);
});
for (const group of pairs) {
  for (const index of group) {
    await tap(`.card[data-index="${index}"]`);
    await wait(60);
  }
}
await wait(400);
check('模块配对完成', (await save()).games.flip.done === true);

await go('#/quiz');
const bank = await page.evaluate(() => window.DHKApp.content.quizBank.map((q) => q.ans));
for (let i = 0; i < bank.length; i += 1) {
  await tap(`[data-action="answer"][data-index="${bank[i]}"]`);
  await wait(80);
  if (i < bank.length - 1) await tap('[data-action="next-question"]');
  await wait(80);
}
check('答题满分', (await save()).games.quiz.score === 100);

/* 8. 通关结算 */
await go('#/final');
check('进入通关结算', (await hash()) === '#/final', await hash());
const board = await page.evaluate(() => window.DHKApp.state.scoreboard(window.DHKStore.read()));
const allDone = await page.evaluate(() => window.DHKApp.state.allDone(window.DHKStore.read()));
check('全部任务完成', allDone === true, JSON.stringify(board.progress));
check('结算给出评分等级', ['S', 'A', 'B'].includes(board.grade.code), board.grade.code);
check('结算显示 GRADE', (await text()).includes('GRADE'));

/* 9. 端到端健康检查 */
check('没有控制台报错', errors.length === 0, errors.slice(0, 3).join(' / '));
const HASHES = [
  '#/home',
  '#/prologue',
  '#/learn',
  '#/learn/done',
  '#/test/shift',
  '#/test/cert',
  '#/test/solution',
  '#/test/report',
  '#/games',
  '#/hop',
  '#/flip',
  '#/quiz',
  '#/final',
  '#/progress'
];
for (const target of HASHES) {
  await go(target);
  const measured = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell') || document.getElementById('app');
    const style = getComputedStyle(shell);
    // 可见的最小字号（只看有文字的叶子节点）
    const leaves = [...shell.querySelectorAll('*')].filter((el) => {
      if (!el.textContent.trim() || el.children.length) return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    return {
      scroll: document.documentElement.scrollHeight,
      view: window.innerHeight,
      body: document.getElementById('app').innerText.trim().length,
      cls: document.getElementById('app').className,
      最小字号: leaves.length
        ? Math.min(...leaves.map((el) => parseFloat(getComputedStyle(el).fontSize)))
        : 0,
      可滚动: style.overflowY !== 'hidden' && shell.scrollHeight > shell.clientHeight + 2,
      横向溢出: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  check(`${target} 有内容`, measured.body > 20);
  // 一屏放得下最好；放不下时必须能滚动（别把内容裁掉）
  check(
    `${target} 内容不被裁掉`,
    measured.scroll <= measured.view + 1 || measured.可滚动,
    `页面高 ${measured.scroll} / 视口 ${measured.view} / 可滚动 ${measured.可滚动}`
  );
  check(`${target} 字号不小于 13px`, measured.最小字号 >= 13, `${measured.最小字号}px`);
  check(`${target} 无横向溢出`, measured.横向溢出 <= 0, String(measured.横向溢出));
  check(`${target} 挂对了样式作用域`, /page-[a-z]+/.test(measured.cls), measured.cls);
  // 上中下三种滚动位置都试：每个可见按钮至少要有一个能点中的点
  const reach = await page.evaluate(async () => {
    const shell = document.querySelector('.app-shell');
    // 弹窗打开时背景按钮被遮住是应该的：只检查弹窗里的按钮
    const mask = [...shell.querySelectorAll('.mask')].find(
      (node) => !node.hidden && getComputedStyle(node).display !== 'none'
    );
    const buttons = [...shell.querySelectorAll('button')]
      .filter((node) => {
        const style = getComputedStyle(node);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          node.getBoundingClientRect().height > 1
        );
      })
      .filter((node) => !mask || mask.contains(node));
    const clickable = new Set();
    const max = shell.scrollHeight - shell.clientHeight;
    for (const top of [0, Math.round(max / 2), max]) {
      shell.scrollTop = top;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      buttons.forEach((node) => {
        const box = node.getBoundingClientRect();
        const ys = [box.y + 4, box.y + box.height / 2, box.bottom - 4].filter(
          (y) => y > 2 && y < window.innerHeight - 2
        );
        const xs = [box.x + 6, box.x + box.width / 2, box.right - 6].filter(
          (x) => x > 2 && x < window.innerWidth - 2
        );
        ys.forEach((y) =>
          xs.forEach((x) => {
            const hit = document.elementFromPoint(x, y);
            if (hit && (hit === node || node.contains(hit))) clickable.add(node);
          })
        );
      });
    }
    shell.scrollTop = 0;
    return buttons
      .filter((node) => !clickable.has(node))
      .map(
        (node) => `${node.textContent.trim().replace(/\s+/g, ' ').slice(0, 14)}(${node.className})`
      );
  });
  check(`${target} 每个按钮都点得到`, reach.length === 0, JSON.stringify(reach));
  // 首页自己不需要「首页」按钮；其他每一屏都要能一键回去
  if (target !== '#/home') {
    check(
      `${target} 顶部有「首页」按钮`,
      await page.evaluate(() => Boolean(document.querySelector('#app [data-action="home"]')))
    );
  }
}

/* 10. 桌面端布局：铺满宽度、三块并排、首页三栏 */
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
desktop.on('pageerror', (error) => errors.push('desktop: ' + error.message));
await desktop.goto(base);
await desktop.evaluate(() => localStorage.clear());
await desktop.reload();
await desktop.waitForTimeout(400);
const layout = await desktop.evaluate(() => {
  const shell = document.getElementById('app');
  const hero = document.querySelector('.home-hero');
  const row = document.querySelector('.flow-row');
  const cols = (el) =>
    [...el.children].map((child) => Math.round(child.getBoundingClientRect().width));
  return {
    外壳: Math.round(shell.getBoundingClientRect().width),
    hero宽: Math.round(hero.getBoundingClientRect().width),
    hero各列: cols(hero),
    流程各列: cols(row),
    流程卡: document.querySelectorAll('.flow-card').length,
    横向溢出: document.documentElement.scrollWidth - window.innerWidth
  };
});
check('桌面外壳铺满宽度', layout.外壳 >= 1000, String(layout.外壳));
check('桌面 hero 铺满整宽', layout.hero宽 >= layout.外壳 - 60, JSON.stringify(layout));
check(
  '桌面 hero 三栏且没有窄条',
  layout.hero各列.length === 3 && layout.hero各列.every((w) => w >= 240),
  JSON.stringify(layout.hero各列)
);
check(
  '桌面三块内容并排且每块够宽',
  layout.流程卡 === 3 && layout.流程各列.filter((w) => w >= 200).length === 3,
  JSON.stringify(layout.流程各列)
);
check('桌面无横向溢出', layout.横向溢出 <= 0, JSON.stringify(layout));
await desktop.close();

/* 10.5 随便进一屏，点顶部「首页」都能回去 */
await go('#/test/cert');
await tap('#app [data-action="home"]');
await wait(200);
check('任何一屏点「首页」都能回到首页', (await hash()) === '#/home', await hash());

/* 11. 重新开始：两段式确认，清空后回到首页（放在最后，因为它会清档） */
await go('#/home');
const resetBtn = await page.evaluate(() => {
  const button = document.querySelector('.reset-button');
  if (!button) return null;
  const topline = button.closest('.topline');
  const pill = topline && topline.querySelector('.pill');
  const box = button.getBoundingClientRect();
  const pillBox = pill && pill.getBoundingClientRect();
  return {
    文案: button.textContent.trim(),
    在顶栏: Boolean(topline && pill),
    和称号同一行: Boolean(pillBox && Math.abs(box.y - pillBox.y) < 20),
    在称号左边: Boolean(pillBox && box.x < pillBox.x),
    高: Math.round(box.height),
    宽: Math.round(box.width)
  };
});
check(
  '「重新开始」是明显按钮且挨着「文化探索员」',
  Boolean(resetBtn) &&
    resetBtn.文案 === '重新开始' &&
    resetBtn.在顶栏 &&
    resetBtn.和称号同一行 &&
    resetBtn.在称号左边 &&
    resetBtn.高 >= 20,
  JSON.stringify(resetBtn)
);
const beforeReset = (await save()).games.hop.tile;
await tap('#app [data-action="reset"]');
await wait(150);
check(
  '第一次点只是改成确认文案',
  (await text()).includes('点这里确认清空') || (await text()).includes('确定清空？再点一次')
);
check('第一次点不会清档', (await save()).games.hop.tile === beforeReset);
await tap('#app [data-action="reset"]');
await wait(400);
const afterReset = await save();
const fresh = await page.evaluate(() =>
  window.DHKApp.state.normalize(window.DHKApp.state.initial())
);
const strip = (state) => {
  const { updatedAt, ...rest } = state;
  return rest;
};
check(
  '清空后记录与全新存档一致',
  JSON.stringify(strip(afterReset)) === JSON.stringify(strip(fresh)),
  JSON.stringify({ 现在: strip(afterReset), 全新: strip(fresh) }).slice(0, 400)
);
check(
  '清空后回到首页并给出提示',
  (await hash()) === '#/home' && (await text()).includes('记录已清空')
);

await go('#/progress');
const progressText = await text();
check(
  '档案页也能重新开始',
  progressText.includes('重新开始') || progressText.includes('清除本机存档'),
  progressText.slice(0, 80)
);

await browser.close();
server.close();
console.log(
  `网页版端到端测试通过：${checks.length} 项断言（15 条路由、3 个小游戏、学习与测试向导全链路）`
);
