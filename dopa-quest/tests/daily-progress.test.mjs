import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),D=require('../daily-progress.js');
const noon=(day)=>new Date(day+'T12:00:00').getTime();
const time=noon('2026-10-11');
test('legacy progress remains intact and earlier history is never reconstructed',()=>{
 const p={xp:19045,totalQ:778,words:{'shn:a':{rec:4}},reviewLog:[{id:'shn:a',at:time-60000,ok:true}]};
 const before=JSON.stringify({xp:p.xp,totalQ:p.totalQ,words:p.words,reviewLog:p.reviewLog});
 const s=D.summary(p,time);
 assert.equal(s.streak,0);assert.equal(s.distinctToday,0);assert.equal(s.weeklyDays,0);
 assert.equal(Object.keys(p.dailyStats.days).length,0);
 assert.equal(JSON.stringify({xp:p.xp,totalQ:p.totalQ,words:p.words,reviewLog:p.reviewLog}),before);
});
test('mission thresholds, XP exactly once and unique word IDs across modes/directions',()=>{
 const p={xp:100,words:{'shn:a':{rec:4}}};
 for(let i=0;i<4;i++)D.record(p,{kind:'quest',id:'shn:'+i,success:true,now:time});
 assert.equal(p.xp,100);
 const fifth=D.record(p,{kind:'flashcard',id:'shn:4',success:true,now:time});
 assert.equal(fifth.awardedXp,35);
 assert.equal(p.xp,135);
 assert.equal(D.summary(p,time).streak,1);
 assert.equal(D.summary(p,time).rememberedToday,5);
 for(let i=0;i<8;i++)D.record(p,{kind:i%2?'flashcard':'quest',id:'shn:0',success:true,now:time});
 assert.equal(p.xp,135);
 assert.equal(D.summary(p,time).distinctToday,5);
 for(let i=5;i<10;i++)D.record(p,{kind:'quest',id:'shn:'+i,success:false,now:time});
 assert.equal(p.xp,160);
 assert.equal(D.summary(p,time).missions.filter(x=>x.completed).length,3);
 assert.equal(D.summary(p,time).day.missionsClaimed.length,3);
 assert.equal(D.summary(p,time).day.missionXp,60);
 assert.equal(p.words['shn:a'].rec,4);
 const restored=JSON.parse(JSON.stringify(p));
 assert.equal(D.summary(restored,time).missions.filter(x=>x.completed).length,3);
 assert.equal(D.record(restored,{kind:'quest',id:'shn:1',success:true,now:time}).awardedXp,0);
});
test('streak requires 5 different words on consecutive local days with today grace',()=>{
 const p={xp:0};
 for(const day of ['2026-10-09','2026-10-10']){
  for(let i=0;i<5;i++)D.record(p,{kind:'quest',id:'shn:'+i,success:false,now:noon(day)});
 }
 assert.equal(D.summary(p,time).streak,2);
 D.record(p,{kind:'quest',id:'shn:0',success:false,now:time});
 assert.equal(D.summary(p,time).streak,2);
 for(let i=1;i<5;i++)D.record(p,{kind:'quest',id:'shn:'+i,success:false,now:time});
 assert.equal(D.summary(p,time).streak,3);
 assert.equal(D.summary(p,time).weeklyDays,3);
 assert.equal(D.summary(p,noon('2026-10-13')).streak,0);
 assert.equal(D.week(p.dailyStats,noon('2026-10-13')).length,7);
});
test('old day arrays are compacted without inventing new days',()=>{
 const p={};
 for(let i=0;i<6;i++)D.record(p,{kind:'quest',id:'shn:'+i,success:true,now:noon('2026-09-01')});
 D.record(p,{kind:'flashcard',id:'shn:new',success:true,now:time});
 const old=p.dailyStats.days['2026-09-01'];
 assert.equal(old.distinctCount,6);
 assert.equal(old.rememberedCount,6);
 assert.equal(old.uniqueWords,undefined);
 assert.equal(Object.keys(p.dailyStats.days).length,2);
 assert.equal(D.streak(p.dailyStats,noon('2026-09-01')),1);
});
test('malformed learning event never writes XP',()=>{
 const p={xp:25};
 assert.throws(()=>D.record(p,{kind:'bogus',id:'shn:a',now:time}),/Invalid/);
 assert.throws(()=>D.record(p,{kind:'quest',id:'shn:a',success:1,now:time}),/Invalid/);
 assert.throws(()=>D.record(p,{kind:'quest',id:'',now:time}),/Invalid/);
 assert.equal(p.xp,25);
});
