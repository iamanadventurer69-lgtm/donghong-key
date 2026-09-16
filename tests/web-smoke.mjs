/**
 * 网页版端到端测试（Chromium）：打开 web/index.html，走完整流程并断言关键结果。
 *
 * 需要 Playwright（不进主依赖）：
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/web-smoke.mjs
 * 另外会把 index.html 的 file:// 换成 http://，用仓库自带的静态服务跑，
 * 这样和真实部署更接近（file:// 下 localStorage 的行为略有差异）。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';

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

const server = http.createServer((req, res) => {
  const file = path.join(
    webDir,
    decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'
  );
  if (!file.startsWith(webDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 736 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error.message)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

const checks = [];
const check = (label, condition, detail) => {
  checks.push({ label, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`断言失败：${label}${detail ? ' — ' + detail : ''}`);
};

const wait = (ms = 160) => page.waitForTimeout(ms);
const go = async (hash) => {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await wait();
};
const text = () => page.locator('#app').innerText();
/** 用 DOM 原生 click：避免 Playwright 在重渲染后把选择器重新解析到别的按钮上。 */
const tap = (selector) =>
  page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) throw new Error('找不到元素: ' + sel);
    node.click();
  }, selector);
const save = () => page.evaluate(() => window.DHKStore.read());
const tileAnswer = (index) =>
  page.evaluate((i) => window.DHKApp.content.hopGame.tiles[i].answer, index);

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await wait(250);

/* 1. 首页三屏 */
check('首页渲染', (await text()).includes('东鸿密钥'));
await tap('[data-action="next"]');
check('首页第二屏两个入口', (await text()).includes('闯关小游戏'));
await tap('[data-action="next"]');
check(
  '首页第三屏有进度',
  (await text()).includes('探索进度') || (await text()).includes('第一阶段进度')
);

/* 2. 序章 → 领密钥 → 质量值班 */
await go('#/prologue');
check('序章第一段', (await text()).includes('电在流动'));
for (let i = 0; i < 3; i += 1) {
  await tap('[data-action="mission"]');
  await wait(120);
}
check('序章后进入值班', page.url().includes('#/shift'), page.url());
check('使命密钥已领取', (await save()).prologueDone === true);

/* 3. 六份材料：三张通过、三张退回，走完值班 */
for (let i = 0; i < 6; i += 1) {
  // 每张卡的选项不同（有的两张章、有的三选一），按存档算出「这一张该点哪一个」
  const choiceId = await page.evaluate((index) => {
    const card = window.DHKApp.state.currentCard(window.DHKStore.read());
    const back = card.choices.find((choice) => choice.stamp === 'return');
    const release = card.choices.find((choice) => choice.stamp === 'release');
    const pick = index % 2 === 0 ? release || back : back || release;
    return pick ? pick.id : card.choices[0].id;
  }, i);
  await tap(`[data-action="choose"][data-id="${choiceId}"]`);
  await wait(120);
  await tap('[data-action="next"]');
  await wait(120);
}
const afterShift = await save();
check(
  '值班六份全部判断完',
  afterShift.decisions.length === 6,
  JSON.stringify(afterShift.decisions.length)
);
check('信任值被改写', afterShift.trust !== 60, String(afterShift.trust));
check('值班结束跳文化画像', page.url().includes('#/culture'), page.url());

/* 4. 文化画像：三屏 + 承诺 */
check('画像显示信任分档', (await text()).includes('客户信任'));
await tap('[data-action="next"]');
check('画像显示印记与关键行为', (await text()).includes('印记构成'));
await tap('[data-action="next"]');
await tap('[data-action="pledge"]');
await tap('[data-action="save"]');
await wait(200);
check('行动承诺已保存', (await save()).completed === true);

/* 5. 企业文化模块：四个展区打卡 + 三个关卡入口 */
await go('#/quest');
check('模块页有四个展区', (await text()).includes('文化坐标'));
await tap('[data-action="quest"]');
check('弹层先看内容介绍', (await text()).includes('愿景'));
await tap('[data-action="quest-start"]');
const questAnswer = await page.evaluate(() => window.DHKApp.content.quests[0].answer);
await tap(`[data-action="quest-pick"][data-index="${questAnswer}"]`);
check('打卡答对给解释', (await text()).includes('经营理念'));
await tap('[data-action="quest-close"]');
check('打卡写进存档', (await save()).checkins.culture === true);

// 剩下三个展区：介绍 → 答题 → 关闭，全部答对
const restQuests = await page.evaluate(() =>
  window.DHKApp.content.quests.slice(1).map((quest) => ({ id: quest.id, answer: quest.answer }))
);
for (const quest of restQuests) {
  await tap(`[data-action="quest"][data-id="${quest.id}"]`);
  await tap('[data-action="quest-start"]');
  await tap(`[data-action="quest-pick"][data-index="${quest.answer}"]`);
  await tap('[data-action="quest-close"]');
  await wait(80);
}
check('四个展区全部打卡', Object.values((await save()).checkins).every(Boolean));

/* 6. 认证配对 */
await go('#/cert');
const certPairs = await page.evaluate(() =>
  Object.entries(window.DHKApp.content.certGame.answer).map(([market, cert]) => ({ market, cert }))
);
for (const pair of certPairs) {
  await tap(`[data-action="market"][data-id="${pair.market}"]`);
  await tap(`[data-action="cert"][data-id="${pair.cert}"]`);
  await wait(120);
}
check('认证配对通关', (await save()).missions['2'] === true);

/* 7. 方案组卡：先给一个被打回的方案，再给满分组 */
await go('#/solution');
const perfect = await page.evaluate(() => window.DHKApp.content.solutionGame.perfect);
for (const id of ['store', 'report', 'ota']) await tap(`[data-action="pick"][data-id="${id}"]`);
await tap('[data-action="submit"]');
check('缺必需项被客户打回', (await text()).includes('解决不了他的问题'));
for (const id of ['store', 'report', 'ota']) await tap(`[data-action="pick"][data-id="${id}"]`);
for (const id of perfect) await tap(`[data-action="pick"][data-id="${id}"]`);
await tap('[data-action="submit"]');
await wait(200);
check('满分组通过', (await save()).games.solution.perfect === true);

/* 8. 小游戏区：模块完成后应解锁 */
await go('#/games');
check('模块完成后小游戏解锁', !(await text()).includes('尚未解锁'));
await tap('[data-action="open"][data-id="hop"]');
check('进入跳格子', page.url().includes('#/hop'));

/* 9. 跳格子：答对前进、答错后退 */
const first = await tileAnswer(0);
await tap(`[data-action="pick"][data-index="${first}"]`);
await tap('[data-action="go"]');
check('答对前进一格', (await save()).games.hop.tile === 1);
const secondWrong = ((await tileAnswer(1)) + 1) % 4;
await tap(`[data-action="pick"][data-index="${secondWrong}"]`);
await tap('[data-action="go"]');
check('答错退回一格', (await save()).games.hop.tile === 0);
for (let step = 0; step < 12; step += 1) {
  const tile = (await save()).games.hop.tile;
  const answer = await tileAnswer(tile);
  await tap(`[data-action="pick"][data-index="${answer}"]`);
  await tap('[data-action="go"]');
  await wait(80);
}
check('跳格子走到终点', (await save()).games.hop.done === true);

/* 10. 模块配对：翻完八对 */
await go('#/flip');
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
check('配对全部完成', (await save()).games.flip.done === true);

/* 11. 三消：找一对可消的相邻格 */
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
// 三消要等 60 秒倒计时结束才记录成绩（和小程序一致），这里就等它自然结束
const crushDeadline = Date.now() + 70000;
while (Date.now() < crushDeadline && !(await save()).games.crush.done) await wait(1000);
check('三消成绩已记录', (await save()).games.crush.done === true);

/* 12. 知识答题：十题全对 */
await go('#/quiz');
const bank = await page.evaluate(() => window.DHKApp.content.quizBank.map((q) => q.ans));
for (let i = 0; i < bank.length; i += 1) {
  await tap(`[data-action="answer"][data-index="${bank[i]}"]`);
  await wait(80);
  // 最后一题答完直接出成绩，没有再点「下一题」的按钮
  if (i < bank.length - 1) await tap('[data-action="next-question"]');
  await wait(80);
}
check('答题满分', (await save()).games.quiz.score === 100);

/* 13. 复现异常：通电推到 92% 保持 3 秒 */
await go('#/repro');
await page.evaluate(() => {
  const slider = document.getElementById('repro-slider');
  slider.value = '92';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(3400);
check('复现异常通关', (await save()).games.repro.done === true);

/* 14. 全部通关结算 + GRADE */
await go('#/quest');
const board = await page.evaluate(() => window.DHKApp.state.scoreboard(window.DHKStore.read()));
const allDone = await page.evaluate(() => window.DHKApp.state.allDone(window.DHKStore.read()));
check('全部任务完成', allDone === true, JSON.stringify(board.progress));
check('结算给出评分等级', ['S', 'A', 'B'].includes(board.grade.code), board.grade.code);
check('结算弹层可见', await page.locator('#final-mask').isVisible());
check('结算显示 GRADE', (await text()).includes('GRADE'));
await tap('[data-action="final-close"]');

/* 15. 端到端健康检查 */
check('没有控制台报错', errors.length === 0, errors.slice(0, 3).join(' / '));
for (const hash of [
  '#/home',
  '#/prologue',
  '#/shift',
  '#/quest',
  '#/cert',
  '#/solution',
  '#/games',
  '#/hop',
  '#/flip',
  '#/crush',
  '#/quiz',
  '#/repro',
  '#/culture',
  '#/progress'
]) {
  await go(hash);
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    view: window.innerHeight,
    body: document.getElementById('app').innerText.trim().length
  }));
  check(`${hash} 有内容`, width.body > 20);
  check(`${hash} 不溢出`, width.scroll <= width.view + 1, `${width.scroll} > ${width.view}`);
}

await browser.close();
server.close();
console.log(`网页版端到端测试通过：${checks.length} 项断言（14 个页面、5 个小游戏、完整通关链路）`);
