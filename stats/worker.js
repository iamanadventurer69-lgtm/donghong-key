/**
 * 东鸿密钥 · 使用统计（Cloudflare Worker + D1）
 *
 * 只记录匿名计数，不采集姓名 / 手机 / IP：
 *   - 前端生成一个随机 device id 存在浏览器 localStorage，
 *     同一个浏览器只算一个「人」，同一里程碑只算一次（MAX(...) 幂等）。
 *   - 事件白名单：start（开始探索）/ learn（学习完成）/ test（画像测试完成）/
 *     games（三个小游戏完成）/ finish（通关结算）。
 *
 * 接口：
 *   POST /hit            { device, event }  → 记一次（前端失败会本地排队补发）
 *   GET  /stats?key=KEY  → JSON 汇总（人数、完成数、完成率、漏斗、最近 14 天）
 *   GET  /               → 一个纯手写的看板页面（输入 key 后显示数字）
 *   GET  /health         → { ok: true }
 */

const EVENTS = ['start', 'learn', 'test', 'games', 'finish'];
const MAX_DEVICE_HITS = 500; // 单个设备记满就不再加，防止脚本空转把库写爆
const DAY = 86400000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra }
  });

/** 设备号：前端生成的 32 位十六进制；宽松一点，只做长度与字符校验。 */
function cleanDevice(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{8,64}$/.test(text) ? text : '';
}

async function recordHit(env, request) {
  let body;
  try {
    // 前端用 text/plain 发（简单请求，不触发预检），所以先读文本再自己解析
    const text = (await request.text()).slice(0, 500);
    body = JSON.parse(text);
  } catch (error) {
    return json({ ok: false, error: 'bad-json' }, 400, CORS);
  }
  const device = cleanDevice(body && body.device);
  const event = EVENTS.includes(body && body.event) ? body.event : '';
  if (!device || !event) return json({ ok: false, error: 'bad-payload' }, 400, CORS);

  const now = Date.now();
  const flag = (name) => (event === name ? 1 : 0);
  await env.DB.prepare(
    `INSERT INTO devices (device, first_at, last_at, hits, start, learn, test, games, finish, finish_at)
     VALUES (?1, ?2, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(device) DO UPDATE SET
       last_at = excluded.last_at,
       hits = CASE WHEN devices.hits >= ?9 THEN devices.hits ELSE devices.hits + 1 END,
       start = MAX(devices.start, excluded.start),
       learn = MAX(devices.learn, excluded.learn),
       test = MAX(devices.test, excluded.test),
       games = MAX(devices.games, excluded.games),
       finish = MAX(devices.finish, excluded.finish),
       finish_at = CASE
         WHEN devices.finish_at > 0 THEN devices.finish_at
         WHEN excluded.finish = 1 THEN excluded.last_at
         ELSE 0
       END`
  )
    .bind(
      device,
      now,
      flag('start'),
      flag('learn'),
      flag('test'),
      flag('games'),
      flag('finish'),
      event === 'finish' ? now : 0,
      MAX_DEVICE_HITS
    )
    .run();

  return json({ ok: true }, 200, CORS);
}

async function summary(env, days) {
  const totals = await env.DB.prepare(
    `SELECT
       COUNT(*) AS users,
       COALESCE(SUM(hits), 0) AS hits,
       COALESCE(SUM(start), 0) AS started,
       COALESCE(SUM(learn), 0) AS learned,
       COALESCE(SUM(test), 0) AS tested,
       COALESCE(SUM(games), 0) AS played,
       COALESCE(SUM(finish), 0) AS finished
     FROM devices`
  ).first();

  const since = Date.now() - (days - 1) * DAY;
  const daily = await env.DB.prepare(
    `SELECT
       date(first_at / 1000, 'unixepoch') AS day,
       COUNT(*) AS users,
       COALESCE(SUM(finish), 0) AS finished
     FROM devices
     WHERE first_at >= ?1
     GROUP BY day
     ORDER BY day ASC`
  )
    .bind(Date.parse(new Date(since).toISOString().slice(0, 10) + 'T00:00:00Z'))
    .all();

  const recent = await env.DB.prepare(
    `SELECT device, last_at, start, learn, test, games, finish
     FROM devices ORDER BY last_at DESC LIMIT 12`
  ).all();

  const users = totals.users || 0;
  const finished = totals.finished || 0;
  const started = totals.started || 0;
  const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    totals: {
      users,
      hits: totals.hits,
      started,
      learned: totals.learned,
      tested: totals.tested,
      played: totals.played,
      finished
    },
    rates: {
      // 完成率按「用过的人」算：来了就算分母，走完全程才算分子
      finishOfUsers: rate(finished, users),
      finishOfStarted: rate(finished, started),
      learnOfUsers: rate(totals.learned, users),
      testOfUsers: rate(totals.tested, users),
      gamesOfUsers: rate(totals.played, users)
    },
    daily: daily.results.map((row) => ({
      day: row.day,
      users: row.users,
      finished: row.finished
    })),
    recent: recent.results.map((row) => ({
      device: String(row.device).slice(0, 6) + '…',
      lastAt: row.last_at,
      finish: row.finish === 1
    }))
  };
}

const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>东鸿密钥 · 使用统计</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 28px 20px 60px; background: #f2f9ff; color: #12374f;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #6b8ea3; font-size: 13px; }
  .bar { display: flex; gap: 8px; margin: 18px 0 26px; }
  input { flex: 1; padding: 10px 12px; border: 1px solid #b9def2; border-radius: 10px; font-size: 14px; }
  button { padding: 10px 18px; border: 0; border-radius: 10px; background: #1c7fb4; color: #fff;
    font-size: 14px; font-weight: 600; cursor: pointer; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .card { background: #fff; border: 1px solid #dceffa; border-radius: 14px; padding: 14px 16px; }
  .card .lbl { font-size: 13px; color: #6b8ea3; }
  .card .val { font-size: 30px; font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; }
  .big { font-size: 40px; color: #12719f; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  .funnel { display: flex; flex-direction: column; gap: 8px; }
  .step { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .step .name { width: 96px; color: #4c7d99; }
  .step .track { flex: 1; height: 16px; background: #e6f3fb; border-radius: 8px; overflow: hidden; }
  .step .fill { height: 100%; background: linear-gradient(90deg, #7cc4e8, #1c7fb4); }
  .step .num { width: 92px; text-align: right; font-variant-numeric: tabular-nums; }
  .days { display: flex; align-items: flex-end; gap: 6px; height: 120px; margin-top: 6px; }
  .day { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
    gap: 4px; font-size: 11px; color: #6b8ea3; }
  .day .col { width: 100%; background: #8ecdf0; border-radius: 6px 6px 0 0; min-height: 2px; }
  .day .col.fin { background: #1c7fb4; }
  #msg { margin-top: 12px; font-size: 13px; color: #b45309; }
</style>
</head>
<body>
<div class="wrap">
  <h1>东鸿密钥 · 使用统计</h1>
  <div class="muted">只统计匿名设备与里程碑，不含姓名 / 手机 / IP</div>
  <div class="bar">
    <input id="key" type="password" placeholder="统计口令">
    <button id="go">查看</button>
  </div>
  <div id="msg"></div>
  <div id="out"></div>
</div>
<script>
  const out = document.getElementById('out');
  const msg = document.getElementById('msg');
  const pct = (n) => (Math.round(n * 10) / 10).toFixed(1) + '%';

  function funnel(t, users) {
    const rows = [
      ['开始探索', t.started],
      ['学习完成', t.learned],
      ['测试完成', t.tested],
      ['小游戏完成', t.played],
      ['全部通关', t.finished]
    ];
    return '<div class="funnel">' + rows.map(([name, num]) => {
      const width = users ? Math.max(2, Math.round((num / users) * 100)) : 0;
      return '<div class="step"><span class="name">' + name + '</span>' +
        '<span class="track"><span class="fill" style="width:' + width + '%"></span></span>' +
        '<span class="num">' + num + ' 人 · ' + pct(users ? (num / users) * 100 : 0) + '</span></div>';
    }).join('') + '</div>';
  }

  function days(list) {
    if (!list.length) return '<div class="muted">还没有数据</div>';
    const max = Math.max(...list.map((d) => d.users), 1);
    return '<div class="days">' + list.map((d) => {
      const h = Math.max(2, Math.round((d.users / max) * 90));
      const f = d.users ? Math.round((d.finished / d.users) * h) : 0;
      return '<div class="day"><span>' + d.users + '</span>' +
        '<span class="col" style="height:' + h + 'px"><span class="col fin" style="height:' + f + 'px;display:block"></span></span>' +
        '<span>' + d.day.slice(5) + '</span></div>';
    }).join('') + '</div>';
  }

  async function load(key) {
    msg.textContent = '';
    const res = await fetch('stats?days=14&key=' + encodeURIComponent(key));
    if (!res.ok) { msg.textContent = '口令不对，或者服务出了点问题（' + res.status + '）'; out.innerHTML = ''; return; }
    const data = await res.json();
    const t = data.totals;
    localStorage.setItem('dhk.stats.key', key);
    out.innerHTML =
      '<div class="cards">' +
        '<div class="card"><div class="lbl">使用人数</div><div class="val">' + t.users + '</div></div>' +
        '<div class="card"><div class="lbl">完成人数</div><div class="val">' + t.finished + '</div></div>' +
        '<div class="card"><div class="lbl">完成率</div><div class="val big">' + pct(data.rates.finishOfUsers) + '</div></div>' +
      '</div>' +
      '<div class="muted" style="margin-top:10px">按「开始探索的人」算完成率：' + pct(data.rates.finishOfStarted) +
        ' · 事件总数 ' + t.hits + ' · 更新于 ' + new Date(data.updatedAt).toLocaleString() + '</div>' +
      '<h2>漏斗</h2>' + funnel(t, t.users) +
      '<h2>最近 14 天新增（深色＝其中当天通关）</h2>' + days(data.daily);
  }

  document.getElementById('go').onclick = () => load(document.getElementById('key').value.trim());
  const saved = localStorage.getItem('dhk.stats.key');
  if (saved) { document.getElementById('key').value = saved; load(saved); }
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/health') return json({ ok: true, service: 'donghong-stats' });

    if (path === '/hit') {
      if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, CORS);
      try {
        return await recordHit(env, request);
      } catch (error) {
        return json({ ok: false, error: 'server' }, 500, CORS);
      }
    }

    if (path === '/stats') {
      const key = url.searchParams.get('key') || '';
      if (!env.STATS_KEY || key !== env.STATS_KEY)
        return json({ ok: false, error: 'forbidden' }, 403);
      const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 14));
      return json(await summary(env, days));
    }

    return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
