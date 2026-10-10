/* DOPA QUEST flashcards v1: independent, deterministic spaced-repetition engine. */
(function(root){
 'use strict';
 const DAY=86400000, MIN=60000, MAX_DAYS=36500;
 const RATINGS=['again','hard','good','easy'];
 const DIRECTIONS=['recognition','production'];
 const SCOPES=['due','new','free'];
 const DEFAULTS={newPerDay:20,reviewPerDay:100,defaultDirection:'recognition'};
 const safeInt=(value,fallback,min,max)=>{
  const n=Number(value);
  return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;
 };
 function dayKey(now=Date.now()){
  const d=new Date(now);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 }
 function ensure(profile,now=Date.now()){
  if(!profile.flashcards||typeof profile.flashcards!=='object'||Array.isArray(profile.flashcards))profile.flashcards={};
  const f=profile.flashcards;
  f.version=1;
  if(!f.cards||typeof f.cards!=='object'||Array.isArray(f.cards))f.cards={};
  if(!f.settings||typeof f.settings!=='object'||Array.isArray(f.settings))f.settings={};
  f.settings.newPerDay=safeInt(f.settings.newPerDay,20,0,500);
  f.settings.reviewPerDay=safeInt(f.settings.reviewPerDay,100,0,2000);
  if(!DIRECTIONS.includes(f.settings.defaultDirection))f.settings.defaultDirection='recognition';
  if(!f.daily||typeof f.daily!=='object'||f.daily.day!==dayKey(now))
   f.daily={day:dayKey(now),newCount:0,reviewCount:0};
  f.daily.newCount=safeInt(f.daily.newCount,0,0,100000);
  f.daily.reviewCount=safeInt(f.daily.reviewCount,0,0,100000);
  return f;
 }
 function entry(cards,id,direction){
  return cards?.[id]?.[direction]||null;
 }
 function validDirection(direction){if(!DIRECTIONS.includes(direction))throw Error('Invalid flashcard direction')}
 function validRating(rating){if(!RATINGS.includes(rating))throw Error('Invalid flashcard rating')}
 function isDue(state,now=Date.now()){
  return !!state&&Number.isFinite(state.dueAt)&&state.dueAt<=now;
 }
 function schedule(previous,rating,now=Date.now()){
  validRating(rating);
  if(!Number.isFinite(now)||now<0)throw Error('Invalid flashcard timestamp');
  const old=previous||null;
  const state=old?.state||'new',step=old?.step||0;
  const repetitions=safeInt(old?.repetitions,0,0,10000000);
  const lapses=safeInt(old?.lapses,0,0,10000000);
  const originalInterval=Number.isFinite(old?.intervalDays)?Math.max(1,old.intervalDays):1;
  // Early voluntary practice cannot advance a scheduled card; forgetting still resets it.
  if(old&&Number.isFinite(old.dueAt)&&old.dueAt>now&&rating!=='again'){
   return {...old,lastRating:rating,lastPracticeAt:now,
    practiceCount:safeInt(old.practiceCount,0,0,10000000)+1};
  }
  let nextState='learning',nextStep=0,days=0,delay=MIN,lapseAdd=0;
  if(state==='review'){
   if(rating==='again'){
    nextState='relearning';nextStep=1;delay=10*MIN;lapseAdd=1;
   }else{
    nextState='review';
    const multiplier=rating==='hard'?1.2:rating==='good'?2.5:3.5;
    const floor=rating==='easy'?4:1;
    days=Math.min(MAX_DAYS,Math.max(floor,Math.round(originalInterval*multiplier)));
    delay=days*DAY;
   }
  }else if(rating==='easy'){
   nextState='review';days=4;delay=4*DAY;
  }else if(rating==='again'){
   nextState=state==='relearning'?'relearning':'learning';
   nextStep=0;delay=MIN;
  }else if(rating==='hard'){
   nextState=state==='relearning'?'relearning':'learning';
   nextStep=step;delay=5*MIN;
  }else if(step>=1){
   nextState='review';days=1;delay=DAY;
  }else{
   nextState=state==='relearning'?'relearning':'learning';
   nextStep=1;delay=10*MIN;
  }
  return {
   state:nextState,step:nextStep,dueAt:now+delay,
   intervalDays:days,repetitions:repetitions+1,lapses:lapses+lapseAdd,
   lastReviewedAt:now,lastRating:rating,
   practiceCount:safeInt(old?.practiceCount,0,0,10000000)
  };
 }
 function normGloss(x){
  return String(x.japanese_core||x.japanese||x.english||'')
   .normalize('NFKC').replace(/[\s　。、，,；;:：・]+/g,'').toLowerCase();
 }
 function spelling(x,lang){return String(lang==='shan'?x.shan:x.burmese||'')}
 // Reverse cards with a gloss shared by different headwords cannot be answered unambiguously.
 function eligibleProduction(x,allDeck,lang){
  const g=normGloss(x),form=spelling(x,lang);
  if(!g||!form)return false;
  return !allDeck.some(y=>y.id!==x.id&&normGloss(y)===g&&spelling(y,lang)!==form);
 }
 function select(options){
  const {pool=[],allDeck=pool,cards={},direction='recognition',
   scope='due',limit=20,now=Date.now(),newRemaining=Infinity,reviewRemaining=Infinity,lang='shan'}=options;
  validDirection(direction);
  if(!SCOPES.includes(scope))throw Error('Invalid flashcard scope');
  const existing=new Set(),out=[],formsByGloss=new Map();
  if(direction==='production')for(const x of allDeck){
   const gloss=normGloss(x),form=spelling(x,lang);
   if(!gloss||!form)continue;
   let forms=formsByGloss.get(gloss);
   if(!forms){forms=new Set();formsByGloss.set(gloss,forms)}
   forms.add(form);
  }
  const items=pool.filter(x=>{
   if(!x?.id||existing.has(x.id))return false;
   existing.add(x.id);
   const gloss=normGloss(x),form=spelling(x,lang);
   return !!form&&!!gloss&&
    (direction==='recognition'||formsByGloss.get(gloss)?.size===1);
  });
  const candidates=items.filter(x=>{
   const s=entry(cards,x.id,direction);
   if(scope==='new')return !s&&newRemaining>0;
   if(scope==='due')return !!s&&isDue(s,now)&&
    (s.state!=='review'||reviewRemaining>0);
   return !!s||newRemaining>0;
  });
  candidates.sort((a,b)=>{
   const x=entry(cards,a.id,direction),y=entry(cards,b.id,direction);
   const sortVal=z=>!z?Number.MAX_SAFE_INTEGER:z.dueAt;
   if(scope==='due')return sortVal(x)-sortVal(y);
   if(scope==='free')return (isDue(x,now)?0:x?2:1)-(isDue(y,now)?0:y?2:1);
   return 0;
  });
  let newly=0,reviewed=0;
  for(const x of candidates){
   if(out.length>=Math.max(0,limit))break;
   const s=entry(cards,x.id,direction);
   if(!s&&++newly>newRemaining)continue;
   if(scope==='due'&&s?.state==='review'&&++reviewed>reviewRemaining)continue;
   out.push(x);
  }
  return out;
 }
 function labelDue(previous,rating,now=Date.now()){
  const result=schedule(previous,rating,now),left=Math.max(0,result.dueAt-now);
  if(left<60*MIN)return Math.max(1,Math.round(left/MIN))+'分';
  if(left<DAY)return Math.round(left/(60*MIN))+'時間';
  return Math.round(left/DAY)+'日';
 }
 const api={DAY,MIN,DEFAULTS,RATINGS,DIRECTIONS,dayKey,ensure,entry,isDue,schedule,select,eligibleProduction,labelDue};
 root.DOPA_FLASH_ENGINE=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
