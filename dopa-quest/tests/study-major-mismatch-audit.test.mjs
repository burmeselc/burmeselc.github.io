import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch}=require('../study-details.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const audit=load('study-major-mismatch-proposals-v1.json');
const held=load('study-details-holds-v1.json');
const taxonomy=load('study-taxonomy-v1.json');
const source={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const base=load('study-details-pilot-v1.json');
const extended=extendReviewBatch(taxonomy,extendCategory18(taxonomy,base,load('study-details-category18-review-v1.json'),source,semantic),
 load('study-details-literature-review-v1.json'),source,semantic);
const engine=create(taxonomy,extended,source);
test('all 33 original-major mismatches are exact source matched, proposed only and remain in held pool',()=>{
 assert.deepEqual(audit.counts,{total:33,candidates:31,held:2,burmese:15,shan:18});
 assert.equal(audit.runtime_applied,false);
 assert.equal(audit.legacy_major_map_changed,false);
 assert.equal(audit.original_cards_changed,0);
 assert.equal(new Set(audit.cards.map(x=>x.id)).size,33);
 const holdIndex=new Map(held.records.map(x=>[x.card_id,x]));
 for(const item of audit.cards){
  const x=source[item.language].find(row=>row.id===item.id);
  const h=holdIndex.get(item.id);
  assert.ok(x);assert.ok(h);
  assert.equal(x[item.language],item.word);
  assert.equal(x.japanese_core,item.gloss);
  assert.equal(x.english,item.english);
  assert.equal(h.current_major,item.existing_major);
  assert.equal(h.reason,item.review_reason);
  assert.equal(semantic[item.language].cards[item.id][0],item.existing_major);
  assert.equal(engine.annotation(x,item.language),null);
  if(item.proposed_medium){
   assert.equal(item.status,'category-correction-candidate');
   assert.notEqual(item.existing_major,item.proposed_medium.slice(0,2));
   assert.equal(engine.mediums.get(item.proposed_medium)?.major,item.proposed_medium.slice(0,2));
   assert.equal(engine.matches(x,item.language,{medium:item.proposed_medium}),false);
  }else{
   assert.equal(item.status,'needs-source-review');
   assert.ok(item.uncertainty);
  }
 }
});
