/* Read-only learning statistics. Does not manufacture historical records. */
(function(root){
 'use strict';
 const toCount=x=>Number.isFinite(Number(x))?Math.max(0,Math.floor(Number(x))):0;
 const array=x=>Array.isArray(x)?x:[];
 function dayKey(now=Date.now()){
  const d=new Date(now);
  if(!Number.isFinite(d.getTime()))throw Error('Invalid statistics date');
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 }
 function localDay(date,offset=0){
  const [y,m,d]=date.split('-').map(Number);
  const v=new Date(y,m-1,d,12);
  v.setDate(v.getDate()+offset);
  return dayKey(v.getTime());
 }
 function dailyRow(date,source){
  const day=source?.[date];
  const distinct=Array.isArray(day?.uniqueWords)?day.uniqueWords.length:toCount(day?.distinctCount);
  const remembered=Array.isArray(day?.rememberedWords)?day.rememberedWords.length:toCount(day?.rememberedCount);
  return {date,distinct,remembered,quest:toCount(day?.questAnswers),cards:toCount(day?.flashcardRatings)};
 }
 function range(profile,days=7,now=Date.now()){
  if(![7,30].includes(days))throw Error('Statistics range must be 7 or 30 days');
  const today=dayKey(now),store=profile?.dailyStats?.days||{};
  const rows=Array.from({length:days},(_,i)=>dailyRow(localDay(today,i-days+1),store));
  const sum=key=>rows.reduce((n,d)=>n+d[key],0);
  const recent=Array.isArray(profile?.reviewLog)?profile.reviewLog:[];
  const start=localDay(today,1-days),startAt=new Date(start+'T00:00:00').getTime();
  const log=recent.filter(r=>Number.isFinite(r?.at)&&r.at>=startAt&&r.at<=now&&typeof r.ok==='boolean');
  const accuracy=log.length?Math.round(100*log.filter(r=>r.ok).length/log.length):null;
  return {rows,days,distinct:sum('distinct'),remembered:sum('remembered'),
   quest:sum('quest'),cards:sum('cards'),
   activeDays:rows.filter(r=>r.quest+r.cards>0).length,
   accuracy,accuracyCount:log.length,
   limitedLog:recent.length>=1000};
 }
 function stage(w){
  if(!w||toCount(w.seen)===0)return 0;
  if(toCount(w.rec)<2||toCount(w.prod)<1)return 1;
  if(toCount(w.rec)<3||toCount(w.prod)<2)return 2;
  if(toCount(w.seals)<1)return 3;
  return 4;
 }
 function mastery(profile,now=Date.now()){
  const levels=[0,0,0,0,0],items=profile?.words||{};
  let nemesis=0;
  for(const w of Object.values(items)){
   if(!w||typeof w!=='object')continue;
   const level=stage(w);
   if(level>0)levels[level]++;
   if(level>0&&w.nemesis===true)nemesis++;
  }
  let learning=0,review=0,due=0,directions=0;
  const cards=profile?.flashcards?.cards||{};
  for(const slots of Object.values(cards)){
   if(!slots||typeof slots!=='object')continue;
   for(const dir of ['recognition','production']){
    const state=slots[dir];
    if(!state||typeof state!=='object')continue;
    directions++;
    if(state.state==='review')review++;
    else learning++;
    if(Number.isFinite(state.dueAt)&&state.dueAt<=now)due++;
   }
  }
  return {levels,studied:levels.slice(1).reduce((a,b)=>a+b,0),
   mastered:levels[4],nemesis,flash:{directions,learning,review,due}};
 }
 function domains(profile,decks=[],labels={},detail=null){
  const groups=new Map();
  for(const [lang,cards] of [['shan',decks?.shan],['burmese',decks?.burmese]]){
   if(!Array.isArray(cards))continue;
   for(const x of cards){
    if(!x||typeof x.id!=='string')continue;
    const w=profile?.words?.[x.id];
    if(stage(w)===0)continue;
    const major=detail?.majorFor?.(x,lang)||x.semantic_major;
    if(typeof major!=='string'||!major)continue;
    const key=lang+':'+major;
    if(!groups.has(key))groups.set(key,{key,lang,major,
      name:labels?.[lang]?.[major]||'領域 '+major,studied:0,mastered:0});
    const row=groups.get(key);row.studied++;
    if(stage(w)===4)row.mastered++;
   }
  }
  return [...groups.values()].sort((a,b)=>b.studied-a.studied||a.key.localeCompare(b.key)).slice(0,6);
 }
 const api={dayKey,range,stage,mastery,domains};
 root.DOPA_STATS=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
