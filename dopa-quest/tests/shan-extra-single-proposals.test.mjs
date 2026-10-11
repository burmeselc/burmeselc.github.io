import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const DATA=path.resolve('dopa-quest/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(DATA,name),'utf8'));
const {attach}=require('../shan-extra-provisional.js');
const tax=read('study-taxonomy-v1.json'),manifest=read('shan-extra-manifest-v1.json');
const packs=manifest.packs.map(p=>read(p.file));
const source=packs.flat(),shards=[1,2,3,4].map(i=>read('shan-extra-single-proposals-'+i+'.json'));
const byId=new Map(source.map(c=>[c.id,c]));
const fakeEngine={
 taxonomy:tax,
 mediums:new Map(tax.categories.flatMap(c=>c.children.map(m=>[m.id,{...m,major:c.id}]))),
 annotation:()=>null,
 majorFor:c=>c.semantic_major,
 matches:()=>true
};
test('11,505 source parents, 4,359 safe single candidates; no mutation',()=>{
 assert.equal(source.length,11505);
 assert.equal(byId.size,11505);
 assert.deepEqual(shards.map(x=>x.single_count),[1560,1029,1014,756]);
 const before=JSON.stringify(source);
 const e=attach(fakeEngine,shards,{shan:source});
 assert.equal(e.extraProvisional.count,4359);
 assert.equal(e.extraProvisional.approved_senses,false);
 assert.equal(e.extraProvisional.editorial_review,'machine-proposal-unverified');
 assert.equal(JSON.stringify(source),before);
 const selected=new Set();
 const all=shards.flatMap(s=>s.cards);
 assert.equal(all.length,4359);
 for(const [id,rank,shan,gloss,medium] of all){
  assert.ok(!selected.has(id),'duplicated ID');
  selected.add(id);
  const card=byId.get(id),a=e.annotation(card,'shan');
  assert.equal(card.rank,rank); assert.equal(card.shan,shan); assert.equal(card.japanese_core,gloss);
  assert.equal(card.semantic_status,'U');
  assert.equal(a?.review_status,'machine-proposal-unverified');
  assert.equal(a?.provisional_only,true);
  assert.equal(a?.medium,medium);
  assert.equal(e.majorFor(card,'shan'),medium.slice(0,2));
  assert.ok(e.matches(card,'shan',{medium}));
  assert.equal(e.matches(card,'shan',{medium:'99.99'}),false);
 }
 for(const card of source.filter(c=>!selected.has(c.id))){
  assert.equal(e.annotation(card,'shan'),null);
  assert.equal(e.majorFor(card,'shan'),card.semantic_major);
 }
});
test('fail closed for corrupt category, missing source, duplicate ID, unknown tag',()=>{
 const bad=structuredClone(shards);bad[0].cards[0][4]='99.99';
 assert.throws(()=>attach(fakeEngine,bad,{shan:source}),/Stale provisional source/);
 const bad2=structuredClone(shards);bad2[1].cards[0][0]=shards[0].cards[0][0];
 assert.throws(()=>attach(fakeEngine,bad2,{shan:source}),/Stale provisional source/);
 const bad3=structuredClone(shards);bad3[0].cards[0][5].feature.push('nonexistent_feature');
 assert.throws(()=>attach(fakeEngine,bad3,{shan:source}),/Invalid provisional tag/);
 assert.throws(()=>attach(fakeEngine,shards,{shan:source.slice(0,500)}),/Stale provisional source/);
});
