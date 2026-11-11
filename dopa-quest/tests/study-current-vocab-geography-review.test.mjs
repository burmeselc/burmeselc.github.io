import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const batch=load('study-current-vocab-geography-review-batch1.json');
const holds=load('study-details-holds-v1.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const taxonomy=load('study-taxonomy-v1.json');
const old=new Map(holds.records.map(x=>[x.card_id,x]));
for(const [lang,rows]of Object.entries(decks))decks[lang]=new Map(rows.map(x=>[x.id,x]));
test('40 pending geography/language cards are provenance checked and never marked source-verified',()=>{
 assert.equal(batch.schema,'dopa-current-vocab-review-batch1-v1');
 assert.deepEqual(batch.counts,{total:40,candidates:37,held:3});
 assert.equal(batch.production_applied,false);
 assert.equal(batch.original_cards_modified,0);
 assert.equal(new Set(batch.proposed_records.map(x=>x.id)).size,40);
 for(const row of batch.proposed_records){
  const d=decks[row.language].get(row.id),h=old.get(row.id);
  assert.ok(d);assert.ok(h);
  assert.equal(d[row.language],row.word);
  assert.equal(d.japanese_core,row.gloss);
  assert.equal(d.english,row.english);
  assert.equal(h.current_major,row.legacy_major);
  assert.equal(h.reason,'detailed_scope_not_finalized_after_initial_review');
  if(row.proposed_medium){
   assert.equal(row.proposed_medium,'09.05');
   assert.equal(row.legacy_major,'09');
   assert.equal(row.status,'gloss-and-embedded-english-matched-candidate');
  }else{
   assert.equal(row.legacy_major,'13');
   assert.equal(row.status,'needs-source-review');
  }
 }
 const place=taxonomy.categories.find(x=>x.id==='09').children.find(x=>x.id==='09.05');
 assert.equal(place.label,'国・地域・地名');
});
