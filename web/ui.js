/**
 * 网页版外壳：与小程序共用同一套规则（DHK.bundle.js 里的 content / state / match3），
 * 这里只补浏览器需要的东西：localStorage 存档、hash 路由、模板挂载与事件委托。
 */
window.DHKApp = window.DHKApp || {};

(function (App) {
  const content = DHK.module('data/content');
  const state = DHK.module('utils/state');

  App.content = content;
  App.state = state;
  App.views = {};
  App.meta = {};

  /** 转义文案，模板里统一走它。 */
  App.esc = function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(
      /[&<>"]/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]
    );
  };

  let cleanups = [];
  const root = () => document.getElementById('app');

  /**
   * 每次 mount 都会递增 App.stamp；按下时记录当时的 stamp，
   * 如果点起（click）时 stamp 已经变了，说明这一次点击是「上一屏按下的、落在新屏同一位置」，
   * 属于重渲染后的穿透点击（真机也会出现），要忽略掉。
   */
  App.stamp = 0;
  let downStamp = -1;
  if (typeof document !== 'undefined') {
    const trackDown = () => {
      downStamp = App.stamp;
    };
    document.addEventListener('pointerdown', trackDown, true);
    document.addEventListener('mousedown', trackDown, true);
    document.addEventListener('touchstart', trackDown, true);
  }

  /** 挂载一屏：先清理上一屏的监听与定时器，再渲染并绑定。 */
  App.mount = function mount(html, bind) {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    App.stamp += 1;
    const node = root();
    node.innerHTML = html;
    if (bind) bind(node);
    node.scrollTop = 0;
    return node;
  };

  /**
   * 事件委托。注意：处理函数里如果切换了页面（重新 mount），
   * 新挂载的监听有机会拿到「同一次点击」再处理一遍（DOM 事件冒泡的经典坑），
   * 所以在事件对象上做个一次性标记，保证一次点击只被一个视图消费。
   */
  App.on = function on(target, selector, type, handler) {
    const listener = (event) => {
      if (event.dhkHandled) return;
      // 同一次点击被切换后的新视图再处理一遍：忽略（键盘触发的 click 没有 downStamp 变化）
      if (type === 'click' && event.detail > 0 && downStamp !== App.stamp) return;
      const hit = event.target.closest(selector);
      if (!hit || !target.contains(hit)) return;
      event.dhkHandled = true;
      handler(event, hit);
    };
    target.addEventListener(type, listener, type === 'touchstart' ? { passive: true } : undefined);
    cleanups.push(() => target.removeEventListener(type, listener));
    return listener;
  };

  /** 定时器登记，切屏时自动清掉（小游戏都用它，避免后台还在跑）。 */
  App.every = function every(ms, fn) {
    const id = setInterval(fn, ms);
    cleanups.push(() => clearInterval(id));
    return id;
  };
  App.after = function after(ms, fn) {
    const id = setTimeout(fn, ms);
    cleanups.push(() => clearTimeout(id));
    return id;
  };
  App.onCleanup = function onCleanup(fn) {
    cleanups.push(fn);
  };

  /**
   * 注册一屏。cssPage 指明这一屏复用哪个小程序页面的 WXSS 作用域
   * （构建时每页样式都加了 .page-xxx 前缀，所以这里必须对上）。
   */
  App.register = function register(path, view, cssPage) {
    App.views[path] = view;
    App.meta[path] = cssPage || path.replace(/^#\//, '').split('/')[0] || 'home';
  };

  /**
   * 小程序路径 → 网页路由：/pages/shift/shift → #/shift
   * 共享内核 state.route() 返回的是小程序路径，网页这边统一用它转换。
   */
  App.hashFor = function hashFor(pagePath) {
    const name = String(pagePath).split('/').filter(Boolean).pop() || 'home';
    return `#/${name}`;
  };

  App.goRoute = function goRoute(pagePath) {
    App.go(App.hashFor(pagePath));
  };

  App.go = function go(path) {
    if (location.hash === path) App.render();
    else location.hash = path;
  };

  App.back = function back() {
    if (history.length > 1) history.back();
    else App.go('#/home');
  };

  /** 宽屏（桌面）判定：pagedView 用它决定「一次显示一屏」还是「全部铺开」。 */
  App.isWide = function isWide() {
    return window.innerWidth >= 900;
  };

  App.render = function render() {
    const hash = location.hash || '#/home';
    App.prevHash = App.currentHash || '';
    App.currentHash = hash;
    const view = App.views[hash] || App.views['#/home'];
    // 外壳上挂当前页面的类名，构建出来的 CSS 就是按 .page-xxx 作用域隔开的
    const cssPage = App.meta[hash] || hash.replace(/^#\/?/, '').split('/')[0] || 'home';
    const shell = root();
    if (shell) shell.className = `app-shell viewport page page-${cssPage}`;
    view();
  };

  /** 左右滑动（翻页用）；桌面端也可以用方向键。 */
  App.swipe = function swipe(target, handlers) {
    let start = null;
    App.on(target, '.viewport', 'touchstart', (event) => {
      start = event.touches && event.touches[0];
    });
    App.on(target, '.viewport', 'touchend', (event) => {
      const end = event.changedTouches && event.changedTouches[0];
      if (!start || !end) return;
      const dx = end.clientX - start.clientX;
      const dy = end.clientY - start.clientY;
      start = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
      if (dx < 0) handlers.next && handlers.next();
      else handlers.prev && handlers.prev();
    });
    const keys = (event) => {
      if (event.key === 'ArrowRight') handlers.next && handlers.next();
      if (event.key === 'ArrowLeft') handlers.prev && handlers.prev();
    };
    document.addEventListener('keydown', keys);
    cleanups.push(() => document.removeEventListener('keydown', keys));
  };

  /** 顶部：左侧标题，右侧固定给一个「首页」按钮（其他按钮排在它后面）。 */
  App.topbar = function topbar(title, right) {
    return `
      <div class="topline">
        <span class="eyebrow">${App.esc(title)}</span>
        <div class="topline-actions">
          <button class="text-button home-button" data-action="home">⌂ 首页</button>
          ${right || ''}
        </div>
      </div>`;
  };

  /**
   * 向导页头部：第 n / N 步 + 一条进度。让「一屏只干一件事」这件事看得见。
   * steps 为 [{ id, name }]，current 为当前下标。
   */
  App.steps = function steps(title, list, current, options = {}) {
    const rail = list
      .map(
        (step, index) =>
          `<span class="step ${index < current ? 'done' : ''} ${index === current ? 'cur' : ''}">${index + 1}</span>`
      )
      .join('<span class="step-line"></span>');
    return `<div class="step-head">
      <div class="topline">
        <span class="eyebrow">${App.esc(title)}</span>
        <span class="topline-actions">
          <button class="text-button home-button" data-action="home">⌂ 首页</button>
          <span class="step-count">第 ${current + 1} / ${list.length} 步 · ${App.esc(list[current].name)}</span>
        </span>
      </div>
      <div class="step-rail">${rail}</div>
      ${options.hint ? `<div class="step-hint">${App.esc(options.hint)}</div>` : ''}
    </div>`;
  };

  /**
   * 清空记录的两段式确认：第一次点把按钮改成「确定清空」，6 秒内再点一次才真的清空。
   * 不用 window.confirm —— 浏览器弹窗在演示机/内嵌环境里常被拦或很难看。
   */
  App.askReset = function askReset(hit) {
    const label = hit.dataset.label || hit.textContent.trim();
    if (hit.dataset.armed !== '1') {
      hit.dataset.armed = '1';
      hit.textContent = hit.dataset.armedLabel || '确定清空？再点一次（6 秒内）';
      hit.classList.add('reset-armed');
      App.after(6000, () => {
        if (!hit.isConnected) return;
        delete hit.dataset.armed;
        hit.textContent = label;
        hit.classList.remove('reset-armed');
      });
      return;
    }
    DHKStore.reset();
    App.flash('记录已清空，从头开始吧。');
    App.go('#/home');
  };

  /** 一次性提示：下一次渲染时显示一次（用于「记录已清空」这类反馈）。 */
  let flashText = '';
  App.flash = function flash(text) {
    flashText = text;
  };

  /**
   * 全局兜底：任何屏上的 [data-action="home"] 都能回首页。
   * 用 capture 阶段先拿到事件，省得每个视图各自实现一遍（漏一个就点不动）。
   */
  document.addEventListener(
    'click',
    (event) => {
      const hit =
        event.target && event.target.closest && event.target.closest('[data-action="home"]');
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      if (DHKApp.go) DHKApp.go('#/home');
    },
    true
  );

  /** 存档失败提示 / 一次性提示。 */
  App.warning = function warning() {
    const text = DHKStore.warning() || flashText;
    flashText = '';
    return text ? `<div class="save-warning">${App.esc(text)}</div>` : '';
  };
})(window.DHKApp);
