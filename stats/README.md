# 东鸿密钥 · 使用统计（Cloudflare Worker + D1）

统计「用了多少人、多少人通关、完成率多少」，**数据全部在你自己账号里**，不接任何第三方统计。
只记匿名设备号与里程碑，不采集姓名 / 手机 / IP。

- 服务地址：`https://donghong-stats.baixin0023.workers.dev`
- 看板：直接浏览器打开上面这个地址 → 输入统计口令 → 显示人数 / 完成人数 / 完成率 / 漏斗 / 最近 14 天
- 口令：存在本机 `~/.cf-donghong-stats-key`（**不要提交进仓库**，也不要在公开地方发）

## 一、接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/hit` | body `{ device, event }`，event 只能是 `start` / `learn` / `test` / `games` / `finish` |
| GET | `/stats?key=口令&days=14` | 返回 JSON（人数、完成数、完成率、漏斗、按天新增） |
| GET | `/` | 手写看板页面 |
| GET | `/health` | `{ ok: true }` |

写入是**幂等**的：一台设备一个里程碑只算一次（`MAX(devices.x, excluded.x)`），
前端也会去重，所以重复上报不会把数字算大。单台设备最多记 500 次，防脚本空转。

## 二、数据表

```sql
devices(
  device TEXT PRIMARY KEY,   -- 前端生成的 32 位随机数（存浏览器 localStorage）
  first_at, last_at INTEGER, -- 首次 / 最近一次
  hits INTEGER,              -- 事件次数（封顶 500）
  start, learn, test, games, finish INTEGER,  -- 五个里程碑，0/1
  finish_at INTEGER          -- 首次通关时间
)
```

## 三、前端怎么接的

`web/analytics.js`（部署时随站点一起发布）：

- 首次访问生成随机设备号，存 `localStorage['donghong.device.v1']`；
- 里程碑由 `web/app.js` 每次渲染后调用 `DHKTrack.sync(存档)` 触发，**每个里程碑只发一次**；
- 发送失败（离线 / 拦截）就写进本地队列，下次打开或恢复网络时补发，**绝不影响学习**；
- 请求用 `text/plain`（简单请求，不触发 CORS 预检，`sendBeacon` 也能发）；
- `file://` 与 `localhost` 默认不上报（加 `?track=1` 才发，方便本地联调）；
- 想在自己设备上关掉：控制台执行 `localStorage.setItem('dhk.track.off','1')`；
  尊重浏览器的 Do Not Track。

## 四、重新部署 / 改动

```bash
# 首次：安装 wrangler 并登录（或直接用 API，见下）
npx wrangler@latest d1 create donghong-stats     # 拿到 database_id 填进 wrangler.toml
npx wrangler@latest d1 execute donghong-stats --remote --file=schema.sql
npx wrangler@latest secret put STATS_KEY          # 设统计口令
npx wrangler@latest deploy

# 带 token 的纯 API 部署（不需要 wrangler）
#   1) POST /accounts/<acc>/workers/scripts/donghong-stats  （multipart：metadata + worker.js）
#   2) metadata 里带 d1 绑定（DB）与 secret_text 绑定（STATS_KEY）
```

- 账号：`06caa801fa0395fc81d83db8dbc457a8`
- D1 库：`donghong-stats`
- 改完 `worker.js` 重新部署即可，D1 数据不受影响。
- 免费额度（D1）：每天 10 万行写入、500 万行读取、5 GB 存储——几百人用绰绰有余。
