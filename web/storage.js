/**
 * 网页版存档：和小程序同一个键、同一套清洗规则，只是把 wx.getStorageSync
 * 换成 localStorage。失败时同样降级到内存并给出提示。
 */
(function () {
  const state = DHK.module('utils/state');
  const KEY = 'donghong.culture.mvp.v1';

  let memory = null;
  let warningText = '';

  function read() {
    if (memory) return state.normalize(memory);
    try {
      const raw = localStorage.getItem(KEY);
      memory = state.normalize(raw ? JSON.parse(raw) : null);
      warningText = '';
    } catch (e) {
      memory = state.initial();
      warningText = '无法读取本机存档，本次进度只保留在内存里。';
    }
    return state.normalize(memory);
  }

  function write(next) {
    memory = state.normalize(next);
    memory.updatedAt = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(memory));
      warningText = '';
    } catch (e) {
      warningText = '本机保存失败，请检查浏览器存储权限；关闭页面可能丢失本次进度。';
    }
    return read();
  }

  function dispatch(event, payload) {
    return write(state.advance(read(), event, payload));
  }

  function reset() {
    return write(state.initial());
  }

  function warning() {
    return warningText;
  }

  window.DHKStore = { read, write, dispatch, reset, warning, KEY, state };
})();
