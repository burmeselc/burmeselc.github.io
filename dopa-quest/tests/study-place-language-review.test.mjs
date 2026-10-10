import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=(name)=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const queue=load('study-place-language-review-v1.json');
const holds=load('study-details-holds-v1.json').records;
const taxonomy=load('study-taxonomy-v1.json');
const decks={
 burmese:load('burmese.json'),
 shan:[...load('shan-1.json'),...load('shan-2.json')]
};
const byId=Object.fromEntries(Object.entries(decks).map(([l,rows])=>[l,new Map(rows.map(x=>[x.id,x]))]));
const heldById=new Map(holds.map(x=>[x.card_id,x]));
const domains=new Map(taxonomy.categories.flatMap(c=>c.children.map(m=>[m.id,c.id])));

test('42 exact source-gloss candidates target existing unused medium categories',()=>{
 assert.equal(queue.schema,'dopa-place-language-held-review-v1');
 assert.equal(queue.status,'proposals-only');
 assert.equal(queue.runtime_applied,false);
 assert.equal(queue.card_id_rewrites,0);
 assert.deepEqual(queue.counts,{total:42,by_lang:{burmese:19,shan:23},by_medium:{'09.05':39,'13.05':3}});
 assert.equal(new Set(queue.records.map(r=>r.id)).size,42);
 for(const r of queue.records){
  const x=byId[r.language].get(r.id),h=heldById.get(r.id);
  assert.ok(x,'missing original card '+r.id);
  assert.ok(h,'not a held entry '+r.id);
  assert.equal(x[r.language],r.word);
  assert.equal(x.japanese_core,r.gloss);
  assert.equal(x.english,r.english);
  assert.equal(h.word,r.word);
  assert.equal(h.gloss,r.gloss);
  assert.equal(h.current_major,r.existing_major);
  assert.equal(h.reason,'detailed_scope_not_finalized_after_initial_review');
  assert.equal(domains.get(r.proposed_medium),r.existing_major);
  assert.equal(r.game_applied,false);
  assert.equal(r.independent_dictionary_verified,false);
  assert.equal(r.review_status,'Japanese-and-embedded-English-concordant-candidate');
 }
});

test('no source card or live detailed metadata is modified by provisional proposals',()=>{
 const current=load('study-details-pilot-v1.json');
 const all=Object.entries(current.cards).flatMap(([language,m])=>Object.keys(m).map(id=>language+':'+id));
 const existing=new Set(all);
 for(const r of queue.records)assert.equal(existing.has(r.language+':'+r.id),false);
 assert.equal(decks.shan.length,5480);
 assert.equal(decks.burmese.length,2500);
});
