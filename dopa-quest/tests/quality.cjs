// Run locally: node dopa-quest/tests/quality.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const fixture={shan:[
 {id:'s1',shan:'ၵိၼ်',rank:1,japanese_core:'食べる'},
 {id:'s2',shan:'မႃး',rank:2,japanese_core:'来る'}
],burmese:[
 {id:'b1',burmese:'သွား',order:1,japanese_core:'行く'},
 {id:'b2',burmese:'ကြွ',order:2,japanese_core:'行く'},
 {id:'b3',burmese:'စား',order:3,japanese_core:'食べる'},
 {id:'b4',burmese:'အိပ်',order:4,japanese_core:'寝る'},
 {id:'b5',burmese:'စားသောက်',order:5,japanese_core:'食べる；飲む'},
 {id:'b6',burmese:'ရောက်',order:6,japanese_core:'到着する'}
]};
const sandbox={
 window:{DOPA_DATA:fixture},
 document:{getElementById:id=>({value:{lang:'burmese',direction:'fromJP',answerMode:'choice'}[id]||'',checked:false})},
 localStorage:{getItem:()=>null,setItem:()=>{}},
 console,Date,Math,performance:{now:()=>0}
};
vm.createContext(sandbox);
const isolated=source.replace(/\ninit\(\);\s*window\.dispatchEvent[\s\S]*$/,'')+
 '\nwindow.__test={isUnambiguous,glossOverlap,qFor,distractors,applyCorrect,W,ensureProfile};';
vm.runInContext(isolated,sandbox,{filename:'game.js'});
const t=sandbox.window.__test;
assert.equal(t.isUnambiguous(fixture.burmese[0],'burmese'),false,'duplicate reverse hint must be rejected');
assert.equal(t.isUnambiguous(fixture.burmese[2],'burmese'),true,'distinct word must remain available');
assert.equal(t.qFor(fixture.burmese[0]).dir,'toJP','duplicate reverse question becomes recognition');
assert.equal(t.qFor(fixture.burmese[2]).dir,'fromJP','valid reverse question remains production');
const opts=t.distractors(fixture.burmese[2],fixture.burmese,'burmese','toJP');
assert.ok(opts.every(x=>!t.glossOverlap(x,fixture.burmese[2])),'distractors cannot overlap Japanese meanings');
const question={x:fixture.burmese[2],dir:'toJP',retry:0};
const first=t.applyCorrect(question),word=t.W(question.x);
assert.equal(first.credited,true);
assert.equal(word.rec,1);
const early=t.applyCorrect(question);
assert.equal(early.credited,false,'early repetition is practice, not long-term evidence');
assert.equal(word.rec,1);
word.due.rec=Date.now()-1;
const due=t.applyCorrect(question);
assert.equal(due.credited,true);
assert.equal(word.rec,2);
const retry=t.applyCorrect({...question,retry:1});
assert.equal(retry.credited,false,'immediate REVENGE never credits long-term memory');
assert.equal(word.rec,2);
assert.match(source,/P\.xp\+=gain/,'XP must be credited per question');
assert.doesNotMatch(source,/P\.xp\+=S\.xp/,'XP may not be double-counted at round end');
assert.match(source,/reviewLog\.push/,'primary review history must be recorded');
console.log('DOPA QUEST v6.1 review-quality checks: PASS');
