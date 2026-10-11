import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const A=require('../learning-stats.js');
const noon=day=>new Date(day+'T12:00:00').getTime();
const now=noon('2026-10-11');
const row=(ids,quest,cards,remembered=ids)=>({uniqueWords:ids,rememberedWords:remembered,questAnswers:quest,flashcardRatings:cards});

test('legacy profile with no dated history produces no fabricated daily activity',()=>{
 const profile={xp:20100,totalQ:948,words:{'shn:a':{seen:3,rec:2,prod:1}},
   reviewLog:[{at:noon('2026-09-01'),ok:true}]};
 const before=JSON.stringify(profile);
 const stats=A.range(profile,7,now);
 assert.equal(stats.rows.length,7);
 assert.equal(stats.quest,0);assert.equal(stats.cards,0);
 assert.equal(stats.distinct,0);assert.equal(stats.remembered,0);
 assert.equal(stats.activeDays,0);assert.equal(stats.accuracy,null);
 assert.equal(A.mastery(profile,now).studied,1);
 assert.equal(JSON.stringify(profile),before);
});

test('7/30-day stats sum actual recorded daily events, respecting missing days',()=>{
 const p={dailyStats:{days:{
  '2026-10-04':row(['shn:a'],4,1),
  '2026-10-05':row(['shn:a','shn:b'],1,2,['shn:b']),
  '2026-10-10':row(['shn:a','shn:c'],3,5),
  '2026-10-11':row(['shn:d'],2,2,[]),
  '2026-09-20':{distinctCount:6,rememberedCount:3,questAnswers:8,flashcardRatings:2},
  '2026-01-01':row(['shn:old'],50,40)
 }},reviewLog:[
  {at:noon('2026-10-04'),ok:false},
  {at:noon('2026-10-05'),ok:true},
  {at:noon('2026-10-11'),ok:true},
  {at:noon('2026-09-20'),ok:true}
 ]};
 const last7=A.range(p,7,now);
 assert.equal(last7.rows[0].date,'2026-10-05');
 assert.equal(last7.quest,6);assert.equal(last7.cards,9);
 assert.equal(last7.distinct,5);assert.equal(last7.remembered,3);
 assert.equal(last7.activeDays,3);
 assert.equal(last7.accuracy,100);assert.equal(last7.accuracyCount,2);
 const last30=A.range(p,30,now);
 assert.equal(last30.quest,18);assert.equal(last30.cards,12);
 assert.equal(last30.distinct,12);assert.equal(last30.remembered,7);
 assert.equal(last30.activeDays,5);
 assert.equal(last30.accuracy,75);assert.equal(last30.accuracyCount,4);
 assert.equal(last30.rows.length,30);
 assert.throws(()=>A.range(p,365,now),/range/);
});

test('a thousand-entry rolling answer log is labelled limited, not lifetime accuracy',()=>{
 const p={reviewLog:Array.from({length:1000},(_,i)=>({at:now-i*1000,ok:i%2===0}))};
 const s=A.range(p,7,now);
 assert.equal(s.accuracy,50);assert.equal(s.accuracyCount,1000);
 assert.equal(s.limitedLog,true);
 const empty=A.range({reviewLog:[]},7,now);
 assert.equal(empty.accuracy,null);assert.equal(empty.limitedLog,false);
});

test('mastery uses exact QUEST stage thresholds and flashcard directions',()=>{
 const p={words:{
  zero:{seen:0,rec:6,prod:6,seals:8},
  seen:{seen:1,rec:1,prod:0},
  known:{seen:7,rec:2,prod:1},
  solid:{seen:8,rec:3,prod:2,seals:0,nemesis:true},
  mastered:{seen:15,rec:3,prod:2,seals:1}
 },flashcards:{cards:{
  a:{recognition:{state:'review',dueAt:now-10},production:{state:'learning',dueAt:now+10}},
  b:{recognition:{state:'relearning',dueAt:now-5}}
 }}};
 assert.equal(A.stage(p.words.seen),1);
 assert.equal(A.stage(p.words.known),2);
 assert.equal(A.stage(p.words.solid),3);
 assert.equal(A.stage(p.words.mastered),4);
 const m=A.mastery(p,now);
 assert.deepEqual(m.levels,[0,1,1,1,1]);
 assert.equal(m.studied,4);assert.equal(m.mastered,1);assert.equal(m.nemesis,1);
 assert.deepEqual(m.flash,{directions:3,learning:2,review:1,due:2});
});

test('category summary is read-only, uses parent IDs and sorts actual studied items',()=>{
 const p={words:{
  'shn:1':{seen:2,rec:3,prod:2,seals:1},
  'shn:2':{seen:1,rec:1},
  'shn:3':{seen:1,rec:1},
  'bur:1':{seen:3,rec:2,prod:1}
 }};
 const decks={shan:[
  {id:'shn:1',semantic_major:'06'},{id:'shn:2',semantic_major:'06'},
  {id:'shn:3',semantic_major:'02'}
 ],burmese:[{id:'bur:1',semantic_major:'02'}],
 shan_senses:[{id:'sense:1',parent_id:'shn:1',semantic_major:'06'}]};
 const old=JSON.stringify(p);
 const groups=A.domains(p,decks,{shan:{'06':'食生活','02':'動物'},burmese:{'02':'動物'}});
 assert.equal(groups.length,3);
 assert.deepEqual(groups.map(x=>[x.key,x.studied,x.mastered]),[
  ['shan:06',2,1],['burmese:02',1,0],['shan:02',1,0]
 ]);
 assert.equal(JSON.stringify(p),old);
});
