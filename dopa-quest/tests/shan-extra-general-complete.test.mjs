import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {attach}=require('../shan-extra-provisional.js');
const read=name=>JSON.parse(fs.readFileSync('dopa-quest/data/'+name,'utf8'));
const source=read('shan-extra-manifest-v1.json').packs.flatMap(p=>read(p.file));
const byId=new Map(source.map(x=>[x.id,x]));
const singles=[1,2,3,4].map(x=>read('shan-extra-single-proposals-'+x+'.json'));
const multi=read('shan-extra-multiple-proposals-1.json');
const final65=read('shan-extra-final65-proposals-v1.json');
const semicolon=read('shan-extra-semicolon-study-release-v1.json');
const batch=[1,2,3,4].map(x=>read('shan-extra-general-review-batch'+x+'-v1.json'));
const held=read('shan-extra-held47-review-v1.json');
const oldHeld=read('shan-extra-final65-gloss-review-v1.json').entries.filter(x=>
  x.decision!=='additional-provisional-original-candidate');
const taxonomy=read('study-taxonomy-v1.json');
const mediums=new Map(taxonomy.categories.flatMap(c=>c.children.map(m=>[m.id,m])));
const engine={taxonomy,mediums,annotation:()=>null,majorFor:c=>c.semantic_major,matches:()=>true};

test('exact complete partition of 11,505 extra Shan parents with 47 unresolved',()=>{
 assert.equal(source.length,11505);assert.equal(byId.size,11505);
 assert.deepEqual(batch.map(x=>x.source_count),[1500,1500,1500,1026]);
 assert.deepEqual(batch.map(x=>x.categorized_with_cue),[8,2,0,1]);
 assert.deepEqual(batch.map(x=>x.uncategorized_need_review),[1492,1498,1500,1025]);
 assert.equal(held.source_count,47);assert.equal(held.category_repair_count,19);
 assert.equal(held.meaning_boundary_count,28);
 const existing=[...singles.flatMap(x=>x.cards.map(r=>r[0])),...multi.cards.map(r=>r[0]),
  ...final65.cards.map(r=>r[0]),...semicolon.cards.map(r=>r[0])];
 const general=batch.flatMap(x=>x.cards),heldIDs=held.cards.map(c=>c.parent_card_id);
 assert.equal(existing.length,5932);
 assert.equal(general.length,5526);
 assert.equal(heldIDs.length,47);
 const all=[...existing,...general.map(r=>r[0]),...heldIDs];
 assert.equal(new Set(all).size,11505);
 assert.deepEqual(new Set(all),new Set(source.map(x=>x.id)));
 assert.equal(new Set(heldIDs).size,47);
 assert.deepEqual(new Set(heldIDs),new Set(oldHeld.map(x=>x.parent_card_id)));
 for(const [id,rank,shan,gloss,medium,confidence,basis,flags] of general){
  const s=byId.get(id);assert.ok(s);
  assert.deepEqual([rank,shan,gloss],[s.rank,s.shan,s.japanese_core]);
  assert.equal(s.semantic_status,'U');
  assert.ok(flags.includes('source-check-pending'));
  assert.equal(medium===null,confidence==='none');
  assert.equal(medium===null,basis==='insufficient-cue');
  if(medium!==null)assert.ok(mediums.has(medium));
 }
 for(const h of held.cards){
  const s=byId.get(h.parent_card_id);
  assert.ok(s);assert.deepEqual([h.rank,h.shan_original,h.japanese_core_original],
   [s.rank,s.shan,s.japanese_core]);
  assert.equal(h.proposed_medium,null);assert.equal(h.source_dictionary_verified,false);
  assert.equal(h.sense_split_approved,false);
  assert.ok(h.hold_reason);
 }
});

test('all 11,505 extra records have reversible annotations and no source mutation',()=>{
 const before=JSON.stringify(source);
 const live=attach(engine,singles,{shan:source},multi,final65,semicolon,batch,held);
 assert.equal(live.extraProvisional.count,11505);
 assert.equal(live.extraProvisional.categorized_count,5567);
 assert.equal(live.extraProvisional.general_review_count,5526);
 assert.equal(live.extraProvisional.general_categorized_count,11);
 assert.equal(live.extraProvisional.general_uncategorized_count,5515);
 assert.equal(live.extraProvisional.held_review_count,47);
 assert.equal(live.extraProvisional.held_category_repair_count,19);
 assert.equal(live.extraProvisional.held_meaning_boundary_count,28);
 for(const s of source){assert.ok(live.annotation(s,'shan'))}
 for(const h of held.cards){
  const x=live.annotation(byId.get(h.parent_card_id),'shan');
  assert.equal(x?.medium,null);assert.equal(x?.review_status,h.review_status);
  assert.equal(x?.sense_split_approved,false);assert.equal(x?.hold_reason,h.hold_reason);
  assert.equal(live.majorFor(byId.get(h.parent_card_id),'shan'),null);
 }
 for(const [index,b] of batch.entries()){
  const subset=attach(engine,singles,{shan:source},multi,final65,semicolon,batch.slice(0,index+1));
  assert.equal(subset.extraProvisional.general_review_count,[1500,3000,4500,5526][index]);
 }
 assert.equal(JSON.stringify(source),before);
 assert.equal(attach(engine,singles,{shan:source},multi,final65,semicolon).extraProvisional.count,5932);
 const corrupt=structuredClone(batch);corrupt[3].cards[0][3]+='x';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,semicolon,corrupt),/Stale general review/);
 const duplicate=structuredClone(held);duplicate.cards[0].parent_card_id=batch[0].cards[0][0];
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,semicolon,batch,duplicate),/Invalid held Shan parent/);
 const invented=structuredClone(held);invented.cards[0].proposed_medium='09.05';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,semicolon,batch,invented),/Invalid held Shan parent/);
});
