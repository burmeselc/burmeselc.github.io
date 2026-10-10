import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch,extendMajorCorrections,extendPlaceLanguage,extendNextHeld,extendBulkGloss}=require('../study-details.js');
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),pilot=load('study-bulk-gloss-reviewed-pilot-v1.json'),
 candidates=load('study-bulk-review-candidates-v1.json'),inventory=load('study-current-parent-first-pass-v1.json'),
patterns=load('study-bulk-review-patterns-v1.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const original=JSON.stringify(decks);
const current=extendNextHeld(taxonomy,extendPlaceLanguage(taxonomy,extendMajorCorrections(taxonomy,
 extendReviewBatch(taxonomy,extendCategory18(taxonomy,load('study-details-pilot-v1.json'),
 load('study-details-category18-review-v1.json'),decks,semantic),
 load('study-details-literature-review-v1.json'),decks,semantic),
 load('study-major-corrections-reviewed-v1.json'),decks,semantic),
 load('study-place-language-review-v1.json'),decks,semantic),
 load('study-next-held-pilot-v1.json'),decks,semantic);
const merged=extendBulkGloss(taxonomy,current,pilot,decks,semantic),engine=create(taxonomy,merged,decks);
test('full existing parent inventory is accounted for without inventing dictionary attestation',()=>{
 assert.equal(decks.burmese.length+decks.shan.length,7980);
 assert.equal(inventory.counts.all_parent,7980);
 assert.equal(inventory.counts.pr_eligible,6468);
 assert.equal(inventory.counts.prior_classified,4142);
 assert.equal(inventory.counts.prepromotion_held,2326);
 assert.equal(inventory.counts.m_or_h_parent,1512);
 assert.equal(inventory.counts.shan_sense_candidates,7290);
 assert.equal(inventory.counts.shan_senses_deployed,7241);
 assert.equal(inventory.counts.shan_senses_held,49);
 assert.equal(inventory.counts.unaccounted_card_ids,0);
 assert.equal(inventory.uncertain_parent_ids.length,2326);
 assert.equal(inventory.legacy_mh_parent_ids.length,1512);
 assert.equal(inventory.independent_dictionary_verified,false);
 const allIds=new Set([...decks.burmese,...decks.shan].map(x=>x.id));
 const allListed=new Set([...inventory.uncertain_parent_ids,...inventory.legacy_mh_parent_ids].map(x=>x.id));
 const originalAllocated=new Set([...Object.keys(current.cards.burmese),...Object.keys(current.cards.shan)]);
 assert.equal(originalAllocated.size,4142);
 assert.equal(new Set([...allListed,...originalAllocated]).size,7980);
 assert.equal(allListed.size,2326+1512);
 for(const x of inventory.uncertain_parent_ids){
  const lang=x.language,sem=semantic[lang].cards[x.id];
  assert.ok(allIds.has(x.id));assert.ok(['P','R'].includes(sem[1]));assert.equal(x.major,sem[0]);
  assert.equal(originalAllocated.has(x.id),false);assert.equal(x.independent_dictionary_verified,false);
 }
 for(const x of inventory.legacy_mh_parent_ids)assert.ok(['M','H'].includes(semantic[x.language].cards[x.id][1]));
});
test('bulk proposals remain non-authoritative and 34 selected additions preserve source definitions',()=>{
 assert.equal(patterns.rules.length,82);
 assert.equal(candidates.counts.pattern_matches,candidates.candidates.length);
 assert.equal(candidates.counts.human_selected_pilot,34);
 assert.equal(pilot.counts.total,34);
 assert.equal(pilot.counts.burmese,21);assert.equal(pilot.counts.shan,13);
 assert.equal(merged.counts.burmese,1807);
 assert.equal(merged.counts.shan,2369);
 assert.equal(merged.coverage.burmese.review_pending+merged.coverage.shan.review_pending,2292);
 assert.equal(merged.coverage.burmese.scope_candidates+merged.coverage.shan.scope_candidates,6468);
 const offered=new Map(candidates.candidates.map(x=>[x.id,x]));
 for(const lang of ['burmese','shan'])for(const row of pilot.cards[lang]){
  const src=decks[lang].find(x=>x.id===row.id),old=current.cards[lang][row.id],a=engine.annotation(src,lang);
  assert.equal(old,undefined);
  assert.ok(src&&offered.has(row.id));
  assert.equal(src[lang],row.word);assert.equal(src.japanese_core,row.gloss);assert.equal(src.english,row.english);
  assert.equal(semantic[lang].cards[row.id][0],row.legacy_major);
  assert.ok(['P','R'].includes(semantic[lang].cards[row.id][1]));
  assert.equal(a?.medium,row.medium);
  assert.equal(row.original_dictionary_verified,false);
  assert.equal(engine.annotation({...src,id:row.id+':sense:2'},lang),null);
  assert.equal(engine.annotation({...src,japanese_core:'altered'},lang),null);
  for(const y of decks[lang])if(y.id!==src.id&&y.japanese_core===src.japanese_core&&engine.annotation(y,lang))
   assert.equal(engine.canContrast(src,y,lang),false,'collision: '+src.id+' '+y.id);
 }
 assert.equal(JSON.stringify(decks),original);
});
test('stale source, tampered ID, invented tag and missing data fail closed',()=>{
 const before=JSON.stringify(current);
 const bad=structuredClone(pilot);bad.cards.burmese[0].english+=' tampered';
 assert.throws(()=>extendBulkGloss(taxonomy,current,bad,decks,semantic),/Stale bulk/);
 const bad2=structuredClone(pilot);bad2.cards.shan[0].tags.field=['fictional'];
 assert.throws(()=>extendBulkGloss(taxonomy,current,bad2,decks,semantic),/Invalid bulk tag/);
 const bad3=structuredClone(pilot);bad3.cards.burmese.pop();
 assert.throws(()=>extendBulkGloss(taxonomy,current,bad3,decks,semantic),/Bulk language count/);
 const bad4=structuredClone(pilot);bad4.cards.burmese[1].id=bad4.cards.burmese[0].id;
 assert.throws(()=>extendBulkGloss(taxonomy,current,bad4,decks,semantic),/Stale bulk/);
 assert.equal(JSON.stringify(current),before);
});
