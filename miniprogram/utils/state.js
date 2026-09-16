const content = require('../data/content');
const ids = content.chapter.modules.map(m => m.id);
function initial() { return {version:2,missions:{'2':false,'3':false},prologue:0,prologueDone:false,step:0,inspected:[],assembled:[],anomalyFound:false,calibrated:false,innovated:false,completed:false,pledge:'',mistakes:0,updatedAt:0}; }
function normalize(raw) {
  const s=initial(); if(!raw || (raw.version!==1 && raw.version!==2)) return s;
  s.missions['2']=raw.missions && raw.missions['2']===true;
  s.missions['3']=raw.missions && raw.missions['3']===true;
  s.prologue=Number.isInteger(raw.prologue)?Math.max(0,Math.min(2,raw.prologue)):0;
  s.prologueDone=raw.prologueDone===true;
  s.inspected=s.prologueDone?ids.filter(id=>Array.isArray(raw.inspected)&&raw.inspected.includes(id)):[];
  s.assembled=ids.filter(id=>Array.isArray(raw.assembled)&&raw.assembled.includes(id));
  if(s.inspected.length!==ids.length) s.assembled=[];
  s.anomalyFound=s.assembled.length===ids.length && raw.anomalyFound===true;
  s.calibrated=s.anomalyFound && raw.calibrated===true;
  s.innovated=s.calibrated && raw.innovated===true;
  s.completed=s.innovated && raw.completed===true;
  s.pledge=content.actions.includes(raw.pledge)?raw.pledge:'';
  if(!s.pledge) s.completed=false;
  const maxStep=!s.prologueDone?0:s.inspected.length<ids.length?1:s.assembled.length<ids.length?2:!s.calibrated?3:4;
  s.step=Number.isInteger(raw.step)?Math.max(0,Math.min(maxStep,raw.step)):0;
  s.mistakes=Number.isSafeInteger(raw.mistakes)?Math.max(0,raw.mistakes):0;
  s.updatedAt=Number.isFinite(raw.updatedAt)?raw.updatedAt:0;
  return s;
}
function advance(state,event,payload) {
  const s=normalize(state); const add=(key,id)=>{if(ids.includes(id)&&!s[key].includes(id))s[key].push(id);};
  switch(event) {
    case 'prologue': s.prologue=Math.min(2,s.prologue+1); break;
    case 'mission': if(s.prologue===2)s.prologueDone=true; break;
    case 'start': if(s.prologueDone)s.step=Math.max(s.step,1); break;
    case 'inspect': if(s.prologueDone&&s.step>=1)add('inspected',payload); break;
    case 'assembleStart': if(s.inspected.length===ids.length)s.step=Math.max(s.step,2); break;
    case 'place': if(s.step>=2 && s.inspected.length===ids.length)add('assembled',payload); break;
    case 'testStart': if(s.assembled.length===ids.length)s.step=Math.max(s.step,3); break;
    case 'anomaly': if(s.step>=3 && payload===content.chapter.anomaly)s.anomalyFound=true; else s.mistakes++; break;
    case 'calibrate': if(s.anomalyFound&&payload==='verify')s.calibrated=true; else s.mistakes++; break;
    case 'innovationStart': if(s.calibrated)s.step=4; break;
    case 'innovate': if(s.step===4&&payload==='bidirectional')s.innovated=true; else s.mistakes++; break;
    case 'complete': if(s.innovated&&content.actions.includes(payload)){s.completed=true;s.pledge=payload;} break;
    case 'missionQuiz': {const [stage,result]=String(payload).split(':');if(content.missions[stage] && result==='correct')s.missions[stage]=true; else s.mistakes++;break;}
    case 'mistake':s.mistakes++;break;
  }
  return normalize(s);
}
function percent(s) { if(s.completed)return 100; if(s.innovated)return 90; if(s.calibrated)return 80; if(s.anomalyFound)return 70; return Math.round((s.prologueDone?20:0)+s.inspected.length*5+s.assembled.length*6.25); }
function route(s) {return !s.prologueDone?'/pages/prologue/prologue':s.innovated?'/pages/culture/culture':'/pages/chapter/chapter';}
module.exports={initial,normalize,advance,percent,route};
