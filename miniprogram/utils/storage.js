const state=require('./state');
const KEY='donghong.culture.mvp.v1';
let memory=null, warning='';
function read() {
  if(memory)return state.normalize(memory);
  try {memory=state.normalize(wx.getStorageSync(KEY));warning='';} catch(e){memory=state.initial();warning='无法读取本机存档，本次进度暂存于内存。';}
  return state.normalize(memory);
}
function write(s) {
  memory=state.normalize(s);memory.updatedAt=Date.now();
  try {wx.setStorageSync(KEY,memory);warning='';} catch(e){warning='本机保存失败，请释放存储空间后重试；关闭小程序可能丢失本次进度。';}
  return read();
}
function dispatch(event,payload){return write(state.advance(read(),event,payload));}
function reset(){return write(state.initial());}
module.exports={read,write,dispatch,reset,warning:()=>warning};
