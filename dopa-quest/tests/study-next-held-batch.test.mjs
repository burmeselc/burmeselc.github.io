import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const previous=load('study-place-language-review-v1.json');
const geographic=load('held-geography-languages-audit-v1.json');
const conflict=load('held-conflict-speech-audit-v1.json');
const holds=new Map(load('study-details-holds-v1.json').records.map(x=>[x.card_id,x]));
const decks={burmese:new Map(load('burmese.json').map(x=>[x.id,x])),
 shan:new Map([...load('shan-1.json'),...load('shan-2.json')].map(x=>[x.id,x]))};
const live=new Set(Object.values(previous.cards).flat().map(x=>x.id));
test('next audit distinguishes 84 already released names from two genuinely new meanings',()=>{
 assert.equal(geographic.counts.original_audit_total,86);
 assert.equal(geographic.counts.already_in_main,84);
 assert.equal(geographic.counts.net_new_candidates,2);
 assert.equal(geographic.candidates.length,2);
 assert.equal(geographic.previously_published_checks.length,84);
 assert.equal(geographic.exceptions.length,8);
 const matchedIds=new Set(geographic.previously_published_checks.map(x=>x.id));
 assert.equal(matchedIds.size,84);
 for(const id of matchedIds)assert.ok(live.has(id));
 for(const x of geographic.candidates){assert.ok(!live.has(x.id));assert.equal(x.original_dictionary_verified,false);}
});
test('thirteen nonduplicated military/conflict and speech meanings are exact old holds',()=>{
 assert.equal(conflict.counts.total,13);
 assert.equal(conflict.counts.conflict,9);
 assert.equal(conflict.counts.speech,4);
 assert.equal(conflict.candidates.length,13);
 assert.equal(new Set(conflict.candidates.map(x=>x.id)).size,13);
 assert.equal(conflict.runtime_applied,false);
 for(const x of conflict.candidates){assert.ok(!live.has(x.id));assert.equal(x.source_dictionary_verified,false);}
});
test('15 new candidates match exactly the unchanged Japanese, English and old major source fields',()=>{
 const rows=[...geographic.candidates,...conflict.candidates];
 assert.equal(rows.length,15);
 assert.equal(new Set(rows.map(x=>x.id)).size,15);
 for(const x of rows){
  const d=decks[x.language].get(x.id),h=holds.get(x.id);
  assert.ok(d,x.id);assert.ok(h,x.id);
  assert.equal(d[x.language],x.word,x.id);
  assert.equal(d.english,x.english,x.id);
  assert.equal(d.japanese_core,x.gloss??x.japanese_core,x.id);
  assert.equal(h.gloss,d.japanese_core,x.id);
  assert.equal(h.current_major,x.current_major,x.id);
  assert.equal(h.reason,'detailed_scope_not_finalized_after_initial_review');
  assert.equal(x.proposed_medium.slice(0,2),h.current_major);
 }
});
test('unresolved category boundaries are not silently relabeled',()=>{
 assert.equal(geographic.exceptions.every(x=>x.status==='retained-needs-sense-or-major-review'),true);
 for(const x of geographic.exceptions){
  const h=holds.get(x.id),d=decks[x.language].get(x.id);
  assert.ok(h);assert.ok(d);
  assert.equal(h.current_major,x.existing_major);
  assert.equal(d.japanese_core,x.gloss);
  assert.equal(d.english,x.english);
 }
});
