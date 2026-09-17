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
const questAnswer = (index) => page.evaluate((i) => window.DHKApp.content.quests[i].answer, index);

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

/* 2. 四个模块：一步一屏（介绍 → 答题 → 结果 → 下一个模块） */
for (let module = 0; module < 4; module += 1) {
  check(`第 ${module + 1} 个模块停在正确步骤`, (await text()).includes(`第 ${module + 1} / 4 步`));
  check(`第 ${module + 1} 个模块先看内容`, (await text()).includes('开始打卡答题'));
  await tap('[data-action="start-quiz"]');
  await wait(140);
  const answer = await questAnswer(module);
  await tap(`[data-action="answer"][data-index="${answer}"]`);
  await wait(180);
  const afterAnswer = await text();
  check(
    `第 ${module + 1} 个模块答对给解释`,
    afterAnswer.includes('学下一个模块') || afterAnswer.includes('完成学习，去做文化画像测试'),
    afterAnswer.replace(/\s+/g, ' ').slice(-40)
  );
  await tap('[data-action="next-step"]');
  await wait(220);
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
  await tap('[data-action="next"]');
  await wait(220);
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

/* 7. 五个小游戏 */
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
/** 按住 ms 毫秒后松手，指针停在对应选项上（指针每 240ms 扫过一项）。 */
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
  await hopPress(240 * wrong + 40);
  check(`第 ${tile + 1} 格选错停在原格`, (await save()).games.hop.tile === tile);
  check('选错后提示重新选', (await text()).includes('重新选一次'));
  await tap('[data-action="retry"]');
  await wait(160);
  // 再选对：前进一格
  await hopPress(240 * hopAnswers[tile] + 40);
  check(`第 ${tile + 1} 格选对前进一格`, (await save()).games.hop.tile === tile + 1);
  await tap('[data-action="go"]');
  await wait(180);
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

await go('#/crush');
const swapPair = await page.evaluate(() => {
  const m = window.DHKApp.match3;
  const size = window.DHKApp.content.match3.size;
  const tiles = window.DHKApp.content.match3.tiles;
  const board = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) =>
      tiles.findIndex(
        (t) =>
          t.emoji ===
          document.querySelector(`[data-row="${r}"][data-col="${c}"]`).textContent.trim()
      )
    )
  );
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0]
      ]) {
        const to = { row: r + dr, col: c + dc };
        if (to.row >= size || to.col >= size) continue;
        if (m.findMatches(m.swapTiles(board, { row: r, col: c }, to)).length) {
          return [{ row: r, col: c }, to];
        }
      }
    }
  }
  return null;
});
check('棋盘存在可消的一步', swapPair !== null);
await tap(`[data-row="${swapPair[0].row}"][data-col="${swapPair[0].col}"]`);
await tap(`[data-row="${swapPair[1].row}"][data-col="${swapPair[1].col}"]`);
await wait(700);
check('三消得分并停稳', (await page.textContent('#crush-score')) !== '0');
// 三消要等 60 秒倒计时结束才记录成绩（和小程序一致），这里就等它自然结束。
// 注意：Chromium 会把后台页的定时器降到 1 分钟一次，所以先把它切到前台。
await page.bringToFront();
const crushDeadline = Date.now() + 75000;
while (Date.now() < crushDeadline && !(await save()).games.crush.done) await wait(1000);
check('三消成绩已记录', (await save()).games.crush.done === true);

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
  '#/crush',
  '#/quiz',
  '#/final',
  '#/progress'
];
for (const target of HASHES) {
  await go(target);
  const measured = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    view: window.innerHeight,
    body: document.getElementById('app').innerText.trim().length,
    cls: document.getElementById('app').className
  }));
  check(`${target} 有内容`, measured.body > 20);
  check(
    `${target} 不溢出`,
    measured.scroll <= measured.view + 1,
    `${measured.scroll} > ${measured.view}`
  );
  check(`${target} 挂对了样式作用域`, /page-[a-z]+/.test(measured.cls), measured.cls);
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

await browser.close();
server.close();
console.log(
  `网页版端到端测试通过：${checks.length} 项断言（16 条路由、4 个小游戏、学习与测试向导全链路）`
);
