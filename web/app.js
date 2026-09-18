/**
 * 网页版启动：hash 路由 + 首次渲染。
 * 各页面在 views-core.js / views-culture.js / views-games.js 里注册到 DHKApp.views。
 */
(function (App) {
  /** 每次渲染后对一下存档：把「开始 / 学完 / 小游戏 / 测试 / 通关」这些里程碑报一次。 */
  function track() {
    if (!window.DHKTrack || !window.DHKStore) return;
    try {
      window.DHKTrack.sync(window.DHKStore.read());
    } catch (error) {
      /* 统计不该影响使用 */
    }
  }

  const render = App.render;
  App.render = function renderAndTrack() {
    const result = render.apply(this, arguments);
    track();
    return result;
  };

  function boot() {
    if (!location.hash) location.hash = '#/home';
    window.addEventListener('hashchange', () => App.render());
    App.render();
    track();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DHKApp);
