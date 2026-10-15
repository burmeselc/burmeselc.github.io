import test from 'node:test';
import assert from 'node:assert/strict';
import {romanizeThai,romanizeSyllable} from '../romanizer.mjs';
const examples=[
 ['กา','kā'],['ไก่','kai'],['ค่า','khā'],['ฆ่า','khā'],
 ['ผ้า','phā'],['พา','phā'],['คน','khon'],['ขน','khon'],
 ['นก','nok'],['บ้าน','bān'],['พูด','phūt'],['แม่น','mǣn'],
 ['รถ','rot'],['โมง','mōng'],['เรียน','rīan'],['โรง','rōng']
];
for(const [thai,roman] of examples){
 test('Rule-only syllable '+thai,()=>{
  const actual=romanizeThai(thai,[]).text;
  assert.equal(actual,roman);
 });
}
test('Common รร and silent marker examples',()=>{
 assert.equal(romanizeThai('กรรม',[]).text,'kam');
 assert.equal(romanizeThai('สวรรค์',[]).text,'sawan');
});
test('Unknown compound is romanized without a dictionary',()=>{
 const result=romanizeThai('โรงเรียน',[]);
 assert.equal(result.text,'rōng rīan');
 assert.equal(result.reviewed,0);
 assert.ok(result.guessed>=2);
 assert.ok(result.needsReview>=1); // word division still provisional
});
test('Reviewed lexicon controls lexical exceptions and spacing',()=>{
 const dictionary=[
  {thai:'ภาษา',alalc:'phāsā',status:'reviewed'},
  {thai:'ไทย',alalc:'Thai',status:'reviewed'},
  {thai:'มหาวิทยาลัย',alalc:'mahāwitthayālai',status:'reviewed'}
 ];
 assert.equal(romanizeThai('ภาษาไทย',dictionary).text,'phāsā Thai');
 assert.equal(romanizeThai('มหาวิทยาลัย',dictionary).text,'mahāwitthayālai');
 assert.equal(romanizeThai('มหาวิทยาลัย',dictionary).reviewed,1);
});
test('Unknown, unsupported material remains visible, never silently dropped',()=>{
 const res=romanizeThai('ก์ะ',[]);
 assert.ok(res.text.includes('未解析')||res.needsReview>0);
});
test('Thai numerals and punctuation are preserved or transliterated',()=>{
 assert.equal(romanizeThai('๑๒๓',[]).text,'123');
 assert.equal(romanizeThai('กา, บ้าน',[]).text,'kā, bān');
});
test('Input is not required to be in the dictionary',()=>{
 const r=romanizeThai('ไก่',[]);
 assert.equal(r.guessed,1);
 assert.equal(r.unresolved,0);
});
test('Long text avoids recursion overflow',()=>{
 const word='กา'.repeat(1200);
 const r=romanizeThai(word,[]);
 assert.equal(r.guessed,1200);
 assert.ok(r.text.startsWith('kā kā'));
});
