/**
 * 使用统计埋点（匿名，可离线）
 *
 * 只做三件事：
 *   1. 给这台浏览器生成一个随机 device id（存在 localStorage，不含任何身份信息）；
 *   2. 里程碑事件（start / learn / test / games / finish）每个只上报一次；
 *   3. 发送失败就存在本地队列里，下次打开页面补发——统计不稳定绝不阻塞使用。
 *
 * 数据落在自己账号里的 Cloudflare Worker + D1（见项目 stats/ 目录），
 * 不接任何第三方统计。想在自己设备上关掉：localStorage 里设 dhk.track.off = '1'。
 */
(function () {
  const ENDPOINT = 'https://donghong-stats.baixin0023.workers.dev/hit';
  const DEVICE_KEY = 'donghong.device.v1';
  const SENT_KEY = 'donghong.track.sent.v1';
  const QUEUE_KEY = 'donghong.track.queue.v1';
  const OPT_OUT_KEY = 'dhk.track.off';
  const EVENTS = ['start', 'learn', 'test', 'games', 'finish'];

  /** 本地文件调试（file:// 或 localhost）默认不发，加 ?track=1 才发，免得测试把线上数字打乱。 */
  function optedOut() {
    try {
      if (localStorage.getItem(OPT_OUT_KEY) === '1') return true;
      if (navigator.doNotTrack === '1') return true;
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
      const forced = new URLSearchParams(location.search).get('track') === '1';
      return local && !forced;
    } catch (error) {
      return true;
    }
  }

  function deviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
        const bytes = new Uint8Array(16);
        (window.crypto || window.msCrypto).getRandomValues(bytes);
        id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch (error) {
      return '';
    }
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : fallback;
      return value && typeof value === 'object' ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* 存不下就算了，不能影响使用 */
    }
  }

  function post(payload) {
    const body = JSON.stringify(payload);
    // 用 text/plain 而不是 application/json：这是「简单请求」，不触发 CORS 预检，
    // 服务端照样 JSON.parse，sendBeacon 也能正常发出去（application/json 的 beacon 会被浏览器丢掉）。
    if (navigator.sendBeacon) {
      try {
        if (
          navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }))
        ) {
          return Promise.resolve(true);
        }
      } catch (error) {
        /* 退回 fetch */
      }
    }
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      keepalive: true,
      mode: 'cors'
    })
      .then((res) => res.ok)
      .catch(() => false);
  }

  let flushing = null;

  /** 把队列里的（含刚加进去的）都试着发一遍，发成功的删掉。并发调用合并成一次。 */
  function flush() {
    if (flushing) return flushing;
    flushing = runFlush().then((count) => {
      flushing = null;
      return count;
    });
    return flushing;
  }

  function runFlush() {
    if (optedOut()) return Promise.resolve(0);
    const device = deviceId();
    if (!device) return Promise.resolve(0);
    const queue = readJSON(QUEUE_KEY, {});
    const events = Object.keys(queue).filter((event) => EVENTS.includes(event));
    if (events.length === 0) return Promise.resolve(0);
    return events
      .reduce(
        (chain, event) =>
          chain.then((sent) =>
            post({ device, event }).then((ok) => {
              if (ok) {
                delete queue[event];
                writeJSON(QUEUE_KEY, queue);
                return sent + 1;
              }
              return sent;
            })
          ),
        Promise.resolve(0)
      )
      .catch(() => 0);
  }

  /**
   * 上报一个里程碑。同一台设备同一事件只发一次（localStorage 里记着），
   * 失败会留在队列里，下次打开页面补发。
   */
  function send(event) {
    if (!EVENTS.includes(event) || optedOut()) return false;
    const sent = readJSON(SENT_KEY, {});
    if (sent[event]) return false;
    sent[event] = Date.now();
    writeJSON(SENT_KEY, sent);
    const queue = readJSON(QUEUE_KEY, {});
    queue[event] = Date.now();
    writeJSON(QUEUE_KEY, queue);
    flush();
    return true;
  }

  /** 根据存档推断该报哪些里程碑；每个只报一次，重复调用无副作用。 */
  function sync(state) {
    if (!state) return;
    try {
      if (state.prologueDone) send('start');
      if (window.DHKApp && window.DHKApp.learnDone && window.DHKApp.learnDone(state)) send('learn');
      const games = state.games || {};
      const allGames =
        games.hop &&
        games.hop.done &&
        games.flip &&
        games.flip.done &&
        games.quiz &&
        games.quiz.done;
      if (allGames) send('games');
      if (window.DHKApp && window.DHKApp.testDone && window.DHKApp.testDone(state)) send('test');
      if (window.DHKStore && window.DHKStore.state) {
        if (window.DHKStore.state.allDone(state)) send('finish');
      }
    } catch (error) {
      /* 统计永远不该影响使用 */
    }
  }

  window.DHKTrack = { send, sync, flush, deviceId, endpoint: ENDPOINT };

  // 打开页面、重新联网时补发之前没发成功的
  window.addEventListener('online', () => flush());
  window.addEventListener('pagehide', () => flush());
  if (document.readyState === 'complete') flush();
  else window.addEventListener('load', () => flush());
})();
