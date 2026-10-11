import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {attach}=require('../shan-extra-provisional.js');
const read=name=>JSON.parse(fs.readFileSync('dopa-quest/data/'+name,'utf8'));
const manifest=read('shan-extra-manifest-v1.json');
const source=manifest.packs.flatMap(p=>read(p.file));
const byId=new Map(source.map(c=>[c.id,c]));
const sh=read('shan-extra-general-review-batch1-v1.json');
const singles=[1,2,3,4].map(i=>read('shan-extra-single-proposals-'+i+'.json'));
const multi=read('shan-extra-multiple-proposals-1.json');
const final65=read('shan-extra-final65-proposals-v1.json');
const semicolon=read('shan-extra-semicolon-study-release-v1.json');
const held=read('shan-extra-final65-gloss-review-v1.json').entries
 .filter(e=>e.decision!=='additional-provisional-original-candidate');
const previous=new Set([...singles.flatMap(s=>s.cards.map(r=>r[0])),
 ...multi.cards.map(r=>r[0]),...final65.cards.map(r=>r[0]),
 ...semicolon.cards.map(r=>r[0])]);
const heldIDs=new Set(held.map(e=>e.parent_card_id));
const taxonomy=read('study-taxonomy-v1.json');
const engine={taxonomy,mediums:new Map(taxonomy.categories.flatMap(c=>c.children.map(m=>[m.id,m]))),
 annotation:()=>null,majorFor:c=>c.semantic_major,matches:()=>true};

test('1,500 general review records have exact original IDs, glosses, and distinct classifications',()=>{
 assert.equal(source.length,11505);
 assert.equal(sh.schema,'dopa-shan-extra-general-review-v1');
 assert.equal(sh.status,'machine-proposal-unverified');
 assert.equal(sh.approved_senses,false);assert.equal(sh.source_preserved,true);
 assert.equal(sh.reviewed_by_human,false);
 assert.equal(sh.source_count,1500);assert.equal(sh.cards.length,1500);
 assert.deepEqual(sh.source_rank_span,[5483,9710]);
 assert.equal(sh.categorized_with_cue,8);assert.equal(sh.uncategorized_need_review,1492);
 assert.equal(new Set(sh.cards.map(r=>r[0])).size,1500);
 assert.equal(previous.size,5932);assert.equal(heldIDs.size,47);
 let classified=0;
 for(const r of sh.cards){
  const [id,rank,shan,gloss,medium,confidence,basis,flags]=r,original=byId.get(id);
  assert.ok(original);assert.equal(previous.has(id),false);assert.equal(heldIDs.has(id),false);
  assert.deepEqual([rank,shan,gloss],[original.rank,original.shan,original.japanese_core]);
  assert.equal(original.semantic_status,'U');
  assert.equal(r.length,8);assert.ok(flags.includes('source-check-pending'));
  if(medium===null){
   assert.equal(confidence,'none');assert.equal(basis,'insufficient-cue');
   assert.ok(flags.includes('category-unassigned'));
  }else{
   assert.equal(confidence,'low');assert.ok(engine.mediums.has(medium));
   assert.equal(flags.includes('category-unassigned'),false);
   classified++;
  }
 }
 assert.equal(classified,8);
 assert.equal(previous.size+heldIDs.size+sh.cards.length,7479);
});

test('optional review states update filters without rewriting vocabulary or breaking fallbacks',()=>{
 const before=JSON.stringify(source);
 const live=attach(engine,singles,{shan:source},multi,final65,semicolon,sh);
 assert.equal(live.extraProvisional.count,7432);
 assert.equal(live.extraProvisional.categorized_count,5564);
 assert.equal(live.extraProvisional.general_review_count,1500);
 assert.equal(live.extraProvisional.general_categorized_count,8);
 assert.equal(live.extraProvisional.general_uncategorized_count,1492);
 for(const [id,, , ,medium,confidence,basis,flags] of sh.cards){
  const c=byId.get(id),a=live.annotation(c,'shan');
  assert.equal(a?.medium,medium);
  assert.equal(a?.proposed_medium,medium);
  assert.equal(a?.classification_confidence,confidence);
  assert.equal(a?.category_basis,basis);
  assert.deepEqual(a?.review_flags,flags);
  assert.equal(a?.provisional_only,true);
  assert.equal(live.majorFor(c,'shan'),medium?medium.slice(0,2):null);
  if(medium)assert.equal(live.matches(c,'shan',{medium}),true);
  else assert.equal(live.matches(c,'shan',{medium:'01.01'}),false);
 }
 assert.equal(JSON.stringify(source),before);
 assert.equal(attach(engine,singles,{shan:source},multi,final65,semicolon).extraProvisional.count,5932);
 const stale=structuredClone(sh);stale.cards[0][3]+=' (corrupt)';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,semicolon,stale),/Stale general review/);
 const collision=structuredClone(sh);collision.cards[0][0]=semicolon.cards[0][0];
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,semicolon,collision),/Stale general review/);
 const fabricated=structuredClone(sh);fabricated.cards[0][4]='99.99';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,semicolon,fabricated),/Stale general review/);
});
