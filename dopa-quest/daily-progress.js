/* DOPA QUEST daily milestones, distinct-card streaks and seven-day history.
 * New history begins only when a genuine answer or rating is recorded.
 * Existing quest daily rewards remain separate.
 */
(function(root){
 'use strict';
 const MISSIONS=Object.freeze([
  {id:'unique5',title:'異なる語を5語学習',target:5,xp:15,source:'distinct'},
  {id:'recall5',title:'5語を自力で思ひ出す',target:5,xp:20,source:'remembered'},
  {id:'unique10',title:'異なる語を10語学習',target:10,xp:25,source:'distinct'}
 ]);
 const STREAK_TARGET=5;
 function dayKey(time=Date.now()){
  const d=new Date(time);
  if(!Number.isFinite(d.getTime()))throw Error('Invalid daily timestamp');
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 }
 function priorDay(day,offset=1){
  const [year,month,date]=day.split('-').map(Number);
  const d=new Date(year,month-1,date,12,0,0);
  d.setDate(d.getDate()-offset);
  return dayKey(d.getTime());
 }
 const array=x=>Array.isArray(x)?x:[];
 function ensure(profile){
  if(!profile.dailyStats||typeof profile.dailyStats!=='object'||Array.isArray(profile.dailyStats))
   profile.dailyStats={version:1,days:{}};
  const store=profile.dailyStats;store.version=1;
  if(!store.days||typeof store.days!=='object'||Array.isArray(store.days))store.days={};
  return store;
 }
 function freshDay(){
  return {questAnswers:0,flashcardRatings:0,uniqueWords:[],rememberedWords:[],missionsClaimed:[],missionXp:0};
 }
 function count(day,key){
  return array(day?.[key]).length;
 }
 function missionStatus(day){
  const seen=count(day,'uniqueWords'),recalled=count(day,'rememberedWords');
  return MISSIONS.map(m=>({...m,progress:Math.min(m.target,m.source==='distinct'?seen:recalled),
   completed:array(day?.missionsClaimed).includes(m.id)}));
 }
 function record(profile,event){
  const {kind,id,success=false,now=Date.now()}=event||{};
  if(!['quest','flashcard'].includes(kind)||typeof id!=='string'||!id||id.length>200||
     typeof success!=='boolean'||!Number.isFinite(now))throw Error('Invalid daily learning event');
  const store=ensure(profile),key=dayKey(now),d=store.days[key]||(store.days[key]=freshDay());
  d.uniqueWords=array(d.uniqueWords);d.rememberedWords=array(d.rememberedWords);
  d.missionsClaimed=array(d.missionsClaimed);
  if(kind==='quest')d.questAnswers=(Number(d.questAnswers)||0)+1;
  else d.flashcardRatings=(Number(d.flashcardRatings)||0)+1;
  // Each lexical card counts once per day regardless of learning direction or repeated review.
  if(!d.uniqueWords.includes(id))d.uniqueWords.push(id);
  if(success&&!d.rememberedWords.includes(id))d.rememberedWords.push(id);
  let awardedXp=0;
  for(const m of missionStatus(d)){
   if(m.progress===m.target&&!m.completed){
    d.missionsClaimed.push(m.id);
    awardedXp+=m.xp;
   }
  }
  if(awardedXp){
   d.missionXp=(Number(d.missionXp)||0)+awardedXp;
   profile.xp=(Number(profile.xp)||0)+awardedXp;
  }
  // Retain dated aggregates for calendar/streaks; only newest two weeks need ID arrays.
  // Never invent records for days before feature installation.
  const keep=new Set(Array.from({length:14},(_,i)=>priorDay(key,i)));
  for(const [date,row] of Object.entries(store.days)){
   if(date<key&&!keep.has(date)){
    if(Array.isArray(row.uniqueWords)){
     row.distinctCount=Math.max(Number(row.distinctCount)||0,row.uniqueWords.length);
     delete row.uniqueWords;
    }
    if(Array.isArray(row.rememberedWords)){
     row.rememberedCount=Math.max(Number(row.rememberedCount)||0,row.rememberedWords.length);
     delete row.rememberedWords;
    }
   }
  }
  return {date:key,awardedXp,day:d};
 }
 function distinct(day){return Array.isArray(day?.uniqueWords)?day.uniqueWords.length:Number(day?.distinctCount)||0}
 function recalled(day){return Array.isArray(day?.rememberedWords)?day.rememberedWords.length:Number(day?.rememberedCount)||0}
 function streak(store,now=Date.now()){
  const today=dayKey(now),days=store?.days||{};
  let cursor=distinct(days[today])>=STREAK_TARGET?today:priorDay(today);
  let length=0;
  // Historical records are sparse; stop immediately at an unrecorded or incomplete date.
  while(length<5000&&distinct(days[cursor])>=STREAK_TARGET){
   length++;cursor=priorDay(cursor);
  }
  return length;
 }
 function week(store,now=Date.now()){
  const today=dayKey(now);
  return Array.from({length:7},(_,i)=>{
   const date=priorDay(today,6-i),day=store?.days?.[date];
   return {date,distinct:distinct(day),remembered:recalled(day),
    questAnswers:Number(day?.questAnswers)||0,flashcardRatings:Number(day?.flashcardRatings)||0,
    reached:distinct(day)>=STREAK_TARGET};
  });
 }
 function summary(profile,now=Date.now()){
  const store=ensure(profile),today=dayKey(now),day=store.days[today];
  const days=week(store,now);
  return {day:day||freshDay(),missions:missionStatus(day),streak:streak(store,now),
   recent:days,weeklyDays:days.filter(d=>d.reached).length,
   weeklyWords:days.reduce((a,x)=>a+x.distinct,0),
   distinctToday:distinct(day),rememberedToday:recalled(day)};
 }
 const api={MISSIONS,STREAK_TARGET,dayKey,priorDay,ensure,record,streak,week,summary};
 root.DOPA_DAILY=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
