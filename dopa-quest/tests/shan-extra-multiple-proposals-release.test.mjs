import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const DATA=path.resolve('dopa-quest/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(DATA,name),'utf8'));
const {attach}=require('../shan-extra-provisional.js');
const taxonomy=read('study-taxonomy-v1.json'),manifest=read('shan-extra-manifest-v1.json');
const source=manifest.packs.flatMap(p=>read(p.file));
const firstFour=[1,2,3,4].map(i=>read('shan-extra-single-proposals-'+i+'.json'));
const reviewed=read('shan-extra-multiple-proposals-1.json');
const allConflict=['1-3','4-6','7-9','10-12'].flatMap(g=>read('shan-extra-multiple-review-'+g+'.json').entries);
const firstPass=allConflict.filter(e=>e.assessment.status==='provisional-single-category');
const secondPass=['1-3','4-6','7-9','10-12'].flatMap(g=>read('shan-extra-multiple-round2-'+g+'.json').entries);
const held=read('shan-extra-multiple-held-after-round2.json').entries;
const engine={
 taxonomy,
 mediums:new Map(taxonomy.categories.flatMap(c=>c.children.map(m=>[m.id,{...m,major:c.id}]))),
 annotation:()=>null,majorFor:c=>c.semantic_major,matches:()=>true
};
test('572 exactly account for source-ranked first+second pass, excluding all 65 holds and 4359 original singles',()=>{
 assert.equal(source.length,11505);
 assert.equal(reviewed.schema,'dopa-shan-extra-multiple-proposals-v1');
 assert.equal(reviewed.status,'machine-proposal-unverified');
 assert.equal(reviewed.approved_senses,false);
 assert.equal(reviewed.source_count,637);
 assert.equal(reviewed.single_count,572);
 assert.equal(reviewed.held_count,65);
 assert.equal(reviewed.cards.length,572);
 assert.equal(firstPass.length,62);
 assert.equal(secondPass.length,510);
 assert.equal(held.length,65);
 const expected=new Map([...firstPass.map(r=>[r.parent_card_id,r.assessment.proposed_primary_medium]),
   ...secondPass.map(r=>[r.parent_card_id,r.selected_medium])]);
 assert.equal(expected.size,572);
 const beforeIds=new Set(firstFour.flatMap(s=>s.cards.map(r=>r[0])));
 const heldIds=new Set(held.map(r=>r.parent_card_id));
 const sourceById=new Map(source.map(r=>[r.id,r]));
 const ids=new Set();
 for(const [id,rank,shan,gloss,medium,tags] of reviewed.cards){
  assert.ok(!ids.has(id));
  ids.add(id);
  assert.ok(!beforeIds.has(id),'overlap with prior single candidate');
  assert.ok(!heldIds.has(id),'held conflict must not be published');
  assert.equal(expected.get(id),medium);
  const s=sourceById.get(id);
  assert.equal(s?.rank,rank);
  assert.equal(s?.shan,shan);
  assert.equal(s?.japanese_core,gloss);
  assert.equal(s?.semantic_status,'U');
  assert.deepEqual(tags,{semantic_type:[],feature:[],field:[],usage:[]});
 }
 assert.deepEqual(reviewed.cards.map(c=>c[1]),[...reviewed.cards.map(c=>c[1])].sort((a,b)=>a-b));
});
test('573rd proposal, corrupted category, duplicate, unknown tag and mutated source must fail closed',()=>{
 const pre=JSON.stringify(source);
 const e=attach(engine,firstFour,{shan:source},reviewed);
 assert.equal(e.extraProvisional.count,4931);
 assert.equal(e.extraProvisional.original_single_count,4359);
 assert.equal(e.extraProvisional.multiple_review_count,572);
 assert.equal(e.extraProvisional.editorial_review,'machine-proposal-unverified');
 assert.equal(e.extraProvisional.approved_senses,false);
 for(const [id,rank,shan,gloss,medium] of reviewed.cards){
  const s=source.find(x=>x.id===id);
  assert.ok(s);
  const a=e.annotation(s,'shan');
  assert.equal(a?.provisional_only,true);
  assert.equal(a?.review_status,'machine-proposal-unverified');
  assert.equal(a?.medium,medium);
  assert.equal(e.majorFor(s,'shan'),medium.slice(0,2));
  assert.ok(e.matches(s,'shan',{medium}));
 }
 for(const r of held){
  const s=source.find(x=>x.id===r.parent_card_id);
  assert.equal(e.annotation(s,'shan'),null);
 }
 assert.equal(JSON.stringify(source),pre,'original card data must stay unchanged');
 const fallback=attach(engine,firstFour,{shan:source});
 assert.equal(fallback.extraProvisional.count,4359);
 assert.equal(fallback.extraProvisional.multiple_review_count,0);
 const wrongCategory=structuredClone(reviewed);wrongCategory.cards[0][4]='99.99';
 assert.throws(()=>attach(engine,firstFour,{shan:source},wrongCategory),/Stale multiple-cue provisional source/);
 const dup=structuredClone(reviewed);dup.cards[0][0]=firstFour[0].cards[0][0];
 assert.throws(()=>attach(engine,firstFour,{shan:source},dup),/Stale multiple-cue provisional source/);
 const invalidTag=structuredClone(reviewed);invalidTag.cards[0][5].feature.push('imaginary_tag');
 assert.throws(()=>attach(engine,firstFour,{shan:source},invalidTag),/Invalid multiple-cue tag/);
 const changedGloss=structuredClone(reviewed);changedGloss.cards[0][3]+=' (edited)';
 assert.throws(()=>attach(engine,firstFour,{shan:source},changedGloss),/Stale multiple-cue provisional source/);
 const extra=structuredClone(reviewed);extra.cards.push(extra.cards[0]);extra.single_count=573;
 assert.throws(()=>attach(engine,firstFour,{shan:source},extra),/Invalid multiple-cue provisional shard/);
});
