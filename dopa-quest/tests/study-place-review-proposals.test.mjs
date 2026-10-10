import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const batch=read('study-place-review-proposals-v1.json');
const holds=read('study-details-holds-v1.json');
const source={burmese:read('burmese.json'),shan:[...read('shan-1.json'),...read('shan-2.json')]};
const categories={burmese:read('burmese-categories-v1.json'),shan:read('shan-categories-v1.json')};
const base=read('study-details-pilot-v1.json');
const literature=read('study-details-literature-review-v1.json');
const mismatches=read('study-major-corrections-reviewed-v1.json');
const byHold=new Map(holds.records.map(x=>[x.card_id,x]));
const reviewIds=new Set([...literature.cards.burmese,...literature.cards.shan,...mismatches.cards.burmese,...mismatches.cards.shan].map(x=>x.id));

test('86 place candidates remain proposals for the next release, not runtime classifications',()=>{
 assert.equal(batch.schema,'dopa-place-review-batch-v1');
 assert.equal(batch.status,'proposals-only');
 assert.equal(batch.runtime_applied,false);
 assert.equal(batch.original_ids_changed,false);
 assert.deepEqual(batch.counts,{burmese:57,shan:29,total:86});
 assert.equal(new Set([...batch.cards.burmese,...batch.cards.shan].map(x=>x.id)).size,86);
 for(const lang of ['burmese','shan']){
  const words=new Map(source[lang].map(x=>[x.id,x]));
  for(const row of batch.cards[lang]){
   const word=words.get(row.id),held=byHold.get(row.id);
   assert.ok(word,'missing parent '+row.id);
   assert.ok(held,'not originally held '+row.id);
   assert.equal(row.word,word[lang]);
   assert.equal(row.gloss,word.japanese_core);
   assert.equal(row.english,word.english);
   assert.equal(row.old_major,'09');
   assert.equal(row.proposed_medium,'09.05');
   assert.equal(row.review_status,'gloss-and-embedded-english-aligned-proposal');
   assert.equal(row.dictionary_source_verified,false);
   assert.equal(held.current_major,'09');
   assert.equal(held.reason,'detailed_scope_not_finalized_after_initial_review');
   assert.equal(categories[lang].cards[row.id][0],'09');
   assert.ok(['P','R'].includes(categories[lang].cards[row.id][1]));
   assert.ok(!base.cards[lang][row.id]);
   assert.ok(!reviewIds.has(row.id));
  }
 }
});
test('same-gloss places require a wrong-answer collision guard before promotion',()=>{
 const bur=batch.cards.burmese.filter(x=>x.gloss==='村');
 assert.equal(bur.length,2);
 assert.notEqual(bur[0].id,bur[1].id);
 assert.equal(batch.cards.shan.filter(x=>x.gloss==='村').length,0);
});
