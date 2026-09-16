const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initial,normalize,advance,percent,route}=require('../miniprogram/utils/state');
const content=require('../miniprogram/data/content');
function mission(){let s=initial();for(const e of ['prologue','prologue','mission','start'])s=advance(s,e);return s;}
function assembled(){let s=mission();for(const m of content.chapter.modules)s=advance(s,'inspect',m.id);s=advance(s,'assembleStart');for(const m of content.chapter.modules)s=advance(s,'place',m.id);return advance(s,'testStart');}
test('完整路径：文化导入、拆解、组装、排障、创新、承诺后达到 100%',()=>{
 let s=assembled();assert.equal(s.step,3);s=advance(s,'anomaly','b');s=advance(s,'calibrate','verify');s=advance(s,'innovationStart');s=advance(s,'innovate','bidirectional');assert.equal(percent(s),90);assert.equal(s.completed,false);s=advance(s,'complete',content.actions[0]);assert.equal(s.completed,true);assert.equal(percent(s),100);assert.equal(route(s),'/pages/culture/culture');
});
test('不能跳过使命、模块认识、复测或行动承诺',()=>{
 let s=initial();for(const e of ['mission','start','assembleStart','testStart','innovationStart','complete'])s=advance(s,e);assert.equal(s.step,0);assert.equal(s.completed,false);
 s=mission();s=advance(s,'assembleStart');assert.equal(s.step,1);s=advance(s,'place','meter');assert.equal(s.assembled.length,0);
 s=assembled();s=advance(s,'calibrate','verify');assert.equal(s.calibrated,false);s=advance(s,'innovationStart');assert.equal(s.step,3);
});
test('错误判断不解锁后续，正确选择可恢复',()=>{
 let s=assembled();s=advance(s,'anomaly','a');assert.equal(s.anomalyFound,false);assert.equal(s.mistakes,1);s=advance(s,'anomaly','b');s=advance(s,'calibrate','display');assert.equal(s.calibrated,false);s=advance(s,'calibrate','verify');assert.equal(s.calibrated,true);
});
test('重复点选不累计模块；存档序列化后保留中途进度',()=>{
 let s=mission();s=advance(s,'inspect','meter');s=advance(s,'inspect','meter');assert.deepEqual(s.inspected,['meter']);assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))),s);
 s=assembled();assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))),s);
});
test('缺失、旧版本和畸形存档安全回退',()=>{
 for(const input of [null,undefined,'broken',{version:9},{version:1,step:900,inspected:['fake'],assembled:['fake'],completed:true}]){const s=normalize(input);assert.equal(s.completed,false);assert.equal(s.step,0);assert.equal(s.assembled.length,0);}
});
test('每个进度检查点恢复后的下一步保持可达',()=>{
 let s=initial();const events=[['prologue'],['prologue'],['mission'],['start'],...content.chapter.modules.map(m=>['inspect',m.id]),['assembleStart'],...content.chapter.modules.map(m=>['place',m.id]),['testStart'],['anomaly','b'],['calibrate','verify'],['innovationStart'],['innovate','bidirectional'],['complete',content.actions[1]]];
 let previous=0;for(const [e,p] of events){s=normalize(JSON.parse(JSON.stringify(advance(s,e,p))));assert.ok(percent(s)>=previous);previous=percent(s);}assert.equal(s.completed,true);
});
test('第二、第三阶段的答题独立保存，错误答案不会点亮关卡',()=>{
 let s=initial();s=advance(s,'missionQuiz','2:wrong');assert.equal(s.missions['2'],false);assert.equal(s.mistakes,1);
 s=advance(s,'missionQuiz','2:correct');assert.equal(s.missions['2'],true);assert.equal(s.missions['3'],false);
 s=advance(s,'missionQuiz','3:correct');assert.equal(s.missions['3'],true);
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))).missions,{'2':true,'3':true});
});
