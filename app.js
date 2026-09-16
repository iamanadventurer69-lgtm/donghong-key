/**
 * 网页版启动：hash 路由 + 首次渲染。
 * 各页面在 views-core.js / views-culture.js / views-games.js 里注册到 DHKApp.views。
 */
(function (App) {
  function boot() {
    if (!location.hash) location.hash = '#/home';
    window.addEventListener('hashchange', () => App.render());
    App.render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DHKApp);
