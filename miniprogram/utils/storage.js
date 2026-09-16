/**
 * 本机存档：包一层 localStorage，并提供失败降级。
 *
 * 写入失败（存储满、隐私限制）时不抛错，改为在内存里保留本次会话进度，
 * 由页面读取 warning() 显示提示。
 */
const state = require('./state');

const KEY = 'donghong.culture.mvp.v1';

/** 内存副本；读过一次后就不必再碰 storage。 */
let memory = null;
/** 最近一次读写失败的提示文案，空串表示正常。 */
let warningText = '';

function read() {
  if (memory) return state.normalize(memory);
  try {
    memory = state.normalize(wx.getStorageSync(KEY));
    warningText = '';
  } catch (e) {
    memory = state.initial();
    warningText = '无法读取本机存档，本次进度暂存于内存。';
  }
  return state.normalize(memory);
}

function write(next) {
  memory = state.normalize(next);
  memory.updatedAt = Date.now();
  try {
    wx.setStorageSync(KEY, memory);
    warningText = '';
  } catch (e) {
    warningText = '本机保存失败，请释放存储空间后重试；关闭小程序可能丢失本次进度。';
  }
  return read();
}

/** 处理一次操作并立即落盘；这是页面唯一需要的写入口。 */
function dispatch(event, payload) {
  return write(state.advance(read(), event, payload));
}

function reset() {
  return write(state.initial());
}

function warning() {
  return warningText;
}

module.exports = { read, write, dispatch, reset, warning };
