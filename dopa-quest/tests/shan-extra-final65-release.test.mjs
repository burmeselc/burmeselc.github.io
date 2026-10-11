import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(path.resolve('dopa-quest/data',name),'utf8'));
const {attach}=require('../shan-extra-provisional.js');
const review=read('shan-extra-final65-gloss-review-v1.json');
const delta=read('shan-extra-final65-proposals-v1.json');
const progress=read('shan-extra-final65-release-manifest-v1.json');
const taxonomy=read('study-taxonomy-v1.json');
const manifest=read('shan-extra-manifest-v1.json');
const source=manifest.packs.flatMap(p=>read(p.file));
const singles=[1,2,3,4].map(i=>read('shan-extra-single-proposals-'+i+'.json'));
const multi=read('shan-extra-multiple-proposals-1.json');
const engine={taxonomy,
 mediums:new Map(taxonomy.categories.flatMap(c=>c.children.map(m=>[m.id,{...m,major:c.id}]))),
 annotation:()=>null,majorFor:c=>c.semantic_major,matches:()=>true};
test('Exactly 18 original-category proposals released and other 47 held without sense approval',()=>{
 assert.equal(delta.schema,'dopa-shan-extra-final65-proposals-v1');
 assert.equal(delta.status,'machine-proposal-unverified');
 assert.equal(delta.approved_senses,false);
 assert.deepEqual([delta.source_count,delta.single_count,delta.held_count],[65,18,47]);
 assert.equal(delta.cards.length,18);
 assert.equal(progress.additional_provisional,18);
 assert.equal(progress.remaining_held,47);
 assert.equal(progress.remaining_taxonomy_repairs,19);
 assert.equal(progress.remaining_sense_or_boundary,28);
 assert.equal(progress.total_provisional_with_delta,4949);
 assert.equal(progress.senses_approved,0);
 const released=review.entries.filter(e=>e.decision==='additional-provisional-original-candidate');
 const held=review.entries.filter(e=>e.decision!=='additional-provisional-original-candidate');
 assert.equal(released.length,18);assert.equal(held.length,47);
 assert.deepEqual(delta.cards.map(r=>r[0]),released.map(r=>r.parent_card_id).sort((a,b)=>
  released.find(x=>x.parent_card_id===a).rank-released.find(x=>x.parent_card_id===b).rank));
 const previous=new Set([...singles.flatMap(s=>s.cards.map(c=>c[0])),...multi.cards.map(c=>c[0])]);
 const byId=new Map(source.map(s=>[s.id,s]));
 const byReview=new Map(released.map(s=>[s.parent_card_id,s]));
 for(const [id,rank,shan,gloss,medium,tags] of delta.cards){
  const e=byReview.get(id),s=byId.get(id);
  assert.ok(e);assert.ok(s);assert.ok(!previous.has(id));
  assert.ok(e.original_candidates.some(c=>c.medium===medium));
  assert.equal(e.proposed_medium,medium);assert.equal(e.editorial_review,'machine-proposal-unverified');
  assert.equal(e.sense_id,null);assert.equal(e.publishable_as_approved_sense,false);
  assert.deepEqual([rank,shan,gloss],[s.rank,s.shan,s.japanese_core]);
  assert.deepEqual(tags,{semantic_type:[],feature:[],field:[],usage:[]});
 }
 assert.ok(held.every(e=>!delta.cards.some(row=>row[0]===e.parent_card_id)));
});
test('4,949 active without mutations; corrupt delta and collisions rejected, earlier fallback safe',()=>{
 const before=JSON.stringify(source);
 const active=attach(engine,singles,{shan:source},multi,delta);
 assert.equal(active.extraProvisional.count,4949);
 assert.equal(active.extraProvisional.original_single_count,4359);
 assert.equal(active.extraProvisional.multiple_review_count,572);
 assert.equal(active.extraProvisional.final65_review_count,18);
 assert.equal(active.extraProvisional.approved_senses,false);
 const byId=new Map(source.map(r=>[r.id,r]));
 for(const [id,,, ,medium] of delta.cards){
  const s=byId.get(id),a=active.annotation(s,'shan');
  assert.equal(a?.medium,medium);
  assert.equal(a?.provisional_only,true);
  assert.equal(a?.review_status,'machine-proposal-unverified');
  assert.equal(active.majorFor(s,'shan'),medium.slice(0,2));
  assert.ok(active.matches(s,'shan',{medium}));
 }
 for(const h of review.entries.filter(e=>e.decision!=='additional-provisional-original-candidate'))
  assert.equal(active.annotation(byId.get(h.parent_card_id),'shan'),null);
 assert.equal(JSON.stringify(source),before);
 const withoutFinal=attach(engine,singles,{shan:source},multi);
 assert.equal(withoutFinal.extraProvisional.count,4931);
 assert.equal(withoutFinal.extraProvisional.final65_review_count,0);
 assert.equal(attach(engine,singles,{shan:source}).extraProvisional.count,4359);
 const changed=structuredClone(delta);changed.cards[0][3]+=' typo';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,changed),/Stale final65 provisional source/);
 const wrong=structuredClone(delta);wrong.cards[0][4]='99.99';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,wrong),/Stale final65 provisional source/);
 const duplicate=structuredClone(delta);duplicate.cards[0][0]=multi.cards[0][0];
 assert.throws(()=>attach(engine,singles,{shan:source},multi,duplicate),/Stale final65 provisional source/);
 const invalidTags=structuredClone(delta);invalidTags.cards[0][5].usage=['invalid'];
 assert.throws(()=>attach(engine,singles,{shan:source},multi,invalidTags),/Invalid final65 tag/);
 assert.throws(()=>attach(engine,singles,{shan:source},null,delta),/Invalid final65 provisional shard/);
});
