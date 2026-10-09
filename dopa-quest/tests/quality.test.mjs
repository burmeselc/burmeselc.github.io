import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const source=read('game.js');
const shan=[...JSON.parse(read('data/shan-1.json')),...JSON.parse(read('data/shan-2.json'))];
const burmese=JSON.parse(read('data/burmese.json'));
const data={shan,burmese};
function slice(a,b){
  const i=source.indexOf('function '+a+'('),j=source.indexOf('function '+b+'(',i);
  assert.ok(i>=0&&j>i,'missing helper '+a);return source.slice(i,j);
}
test('both preset decks have 7,980 unique entries with Japanese glosses',()=>{
  assert.equal(shan.length,5480);assert.equal(burmese.length,2500);
  const all=[...shan,...burmese];
  assert.equal(new Set(all.map(x=>x.id)).size,7980);
  assert.ok(shan.every(x=>x.shan&&x.japanese_core));
  assert.ok(burmese.every(x=>x.burmese&&x.japanese_core));
});
const helpers=slice('glossParts','pos')+slice('pos','zones')+slice('distractors','beep');
test('sampled distractors do not share Japanese senses',()=>{
  const preamble=[
    "const jp=x=>x.japanese_core||x.japanese||x.english||'';",
    "const orig=(x,l)=>l==='shan'?x.shan:x.burmese;",
    "const shuffle=a=>[...a].sort(()=>Math.random()-.5);",
    "const rivalsFor=()=>[];",
    "const glossLookup={shan:new Map(),burmese:new Map()};"
  ].join('\n');
  const exercise=[
    "for(const lang of ['shan','burmese'])for(const x of DATA[lang])",
    " for(const sense of glossParts(jp(x))){const m=glossLookup[lang];m.set(sense,(m.get(sense)||0)+1)}",
    "let tested=0,ambiguous=0;",
    "for(const lang of ['shan','burmese']){const pool=DATA[lang];",
    " for(const [i,x] of pool.entries()){if(i%Math.max(1,Math.floor(pool.length/250)))continue;",
    " if(!isUnambiguous(x,lang))ambiguous++;",
    " for(const dir of ['toJP','fromJP']){",
    " const opts=distractors(x,pool,lang,dir);",
    " if(opts.length!==3||opts.some(y=>glossOverlap(x,y)))throw Error('bad options '+x.id);",
    " const key=y=>dir==='fromJP'?orig(y,lang):jp(y);",
    " if(new Set(opts.map(key)).size!==3)throw Error('duplicate options '+x.id);",
    " tested++;}}}return {tested,ambiguous};"
  ].join('\n');
  const result=new Function('DATA',preamble+'\n'+helpers+'\n'+exercise)(data);
  assert.ok(result.tested>=1000);
  assert.ok(result.ambiguous>0);
});
test('long-term skill only grows on a new or due retrieval',()=>{
  const logic=slice('intervals','applyWrong');
  const pre=[
    "let t=10000000;const Date={now:()=>t},DAY=86400000,MIN=60000;",
    "let P={words:{}};const today=()=>'2026-10-09';",
    "const stage=w=>w.rec>=2?2:1;",
    "const W=x=>P.words[x.id]||(P.words[x.id]={seen:0,correct:0,wrong:0,rec:0,prod:0,listen:0,spell:0,last:0,lastCorrect:0,nextDue:0,nemesis:false,seals:0,days:{},due:{}});"
  ].join('\n');
  const exercise=[
    "const q={x:{id:'test'},dir:'toJP',retry:0,typed:false};",
    "const a=applyCorrect(q),first=W(q.x).rec;t+=1000;",
    "const b=applyCorrect(q),early=W(q.x).rec;",
    "t=W(q.x).due.rec;const c=applyCorrect(q),due=W(q.x).rec;",
    "const d=applyCorrect({...q,retry:1}),retry=W(q.x).rec;",
    "return {first,early,due,retry,credits:[a.credited,b.credited,c.credited,d.credited]};"
  ].join('\n');
  const r=new Function(pre+'\n'+logic+'\n'+exercise)();
  assert.deepEqual([r.first,r.early,r.due,r.retry],[1,1,2,2]);
  assert.deepEqual(r.credits,[true,false,true,false]);
});
test('XP is persisted on each answer with no double credit at result',()=>{
  assert.ok(source.includes('S.xp+=gain;P.xp+=gain'));
  assert.ok(source.includes('S.xp+=bonus;P.xp+=bonus'));
  assert.ok(!source.includes('P.xp+=S.xp'));
  assert.ok(source.includes('P.reviewLog.push('));
});
