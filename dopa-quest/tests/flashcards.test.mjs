import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),F=require('../flashcards.js');
const T=1791760000000;
const newCard=rating=>F.schedule(null,rating,T);
test('new-card four ratings and graduation steps',()=>{
 assert.equal(newCard('again').dueAt,T+F.MIN);
 assert.equal(newCard('hard').dueAt,T+5*F.MIN);
 assert.equal(newCard('good').dueAt,T+10*F.MIN);
 assert.equal(newCard('easy').dueAt,T+4*F.DAY);
 assert.equal(newCard('easy').state,'review');
 const learning=newCard('good');
 const graduated=F.schedule(learning,'good',learning.dueAt);
 assert.equal(graduated.state,'review');
 assert.equal(graduated.intervalDays,1);
 assert.equal(graduated.dueAt,learning.dueAt+F.DAY);
});
test('early voluntary review never advances next due; forgotten resets',()=>{
 const old=newCard('easy');
 const practice=F.schedule(old,'easy',T+F.MIN);
 assert.equal(practice.dueAt,old.dueAt);
 assert.equal(practice.repetitions,old.repetitions);
 assert.equal(practice.practiceCount,1);
 const forgotten=F.schedule(old,'again',T+F.MIN);
 assert.equal(forgotten.state,'relearning');
 assert.equal(forgotten.lapses,1);
 assert.equal(forgotten.dueAt,T+11*F.MIN);
 const earlyLearning=F.schedule(newCard('good'),'good',T+F.MIN);
 assert.equal(earlyLearning.state,'learning');
 assert.equal(earlyLearning.repetitions,1);
});
test('review multipliers and lapse return to learning without mutating caller',()=>{
 const prior={...newCard('easy'),intervalDays:3,dueAt:T,state:'review'};
 assert.equal(F.schedule(prior,'hard',T).intervalDays,4);
 assert.equal(F.schedule(prior,'good',T).intervalDays,8);
 assert.equal(F.schedule(prior,'easy',T).intervalDays,11);
 const lapse=F.schedule(prior,'again',T);
 assert.equal(lapse.state,'relearning');
 assert.equal(lapse.dueAt,T+10*F.MIN);
 assert.equal(lapse.lapses,1);
 assert.equal(prior.lapses,0);
 assert.equal(F.schedule(lapse,'good',lapse.dueAt).state,'review');
});
test('profile upgrade does not alter legacy words and resets only daily counters',()=>{
 const words={'shn:x':{rec:4,prod:2,nextDue:123}},p={words,flashcards:{cards:{'shn:one':{recognition:newCard('easy')}},settings:{newPerDay:22,reviewPerDay:130},daily:{day:'1970-01-01',newCount:900,reviewCount:500}}};
 F.ensure(p,T);
 assert.deepEqual(p.words,words);
 assert.equal(p.flashcards.settings.newPerDay,22);
 assert.equal(p.flashcards.daily.newCount,0);
 assert.ok(F.entry(p.flashcards.cards,'shn:one','recognition'));
 F.ensure(p,T);
 assert.equal(p.flashcards.daily.day,F.dayKey(T));
});
test('due, new, free, caps, and ambiguous Japanese-to-Shan filtering',()=>{
 const deck=[
  {id:'a',shan:'ၵ',japanese_core:'水'},
  {id:'b',shan:'ၶ',japanese_core:'水'},
  {id:'c',shan:'ၸ',japanese_core:'火'},
  {id:'d',shan:'ၽ',japanese_core:'光'}
 ];
 const records={a:{recognition:{...newCard('easy'),dueAt:T-1000}},
  c:{recognition:{...newCard('easy'),dueAt:T+F.DAY}}};
 const due=F.select({pool:deck,cards:records,scope:'due',direction:'recognition',lang:'shan',now:T,limit:10});
 assert.deepEqual(due.map(x=>x.id),['a']);
 const newly=F.select({pool:deck,cards:records,scope:'new',direction:'recognition',lang:'shan',now:T,limit:10,newRemaining:1});
 assert.deepEqual(newly.map(x=>x.id),['b']);
 assert.deepEqual(F.select({pool:deck,allDeck:deck,scope:'new',direction:'production',lang:'shan',limit:10}).map(x=>x.id),['c','d']);
 const empty=F.select({pool:deck,cards:records,scope:'due',direction:'recognition',lang:'shan',now:T,reviewRemaining:0});
 assert.deepEqual(empty,[]);
 assert.throws(()=>F.schedule(null,'unknown',T),/Invalid/);
 assert.throws(()=>F.select({scope:'wrong'}),/Invalid/);
});
