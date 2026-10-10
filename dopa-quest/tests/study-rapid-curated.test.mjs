import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch,extendMajorCorrections,extendPlaceLanguage,extendNextHeld,extendBulkGloss,extendRapidCurated}=require('../study-details.js');
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),pilot=load('study-rapid-curated-batch3-v1.json'),ledger=load('study-current-vocab-fast-sweep-v2.json'),source=load('study-bulk-review-candidates-v1.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const sourceDigest=JSON.stringify(decks);
const old=extendBulkGloss(taxonomy,extendNextHeld(taxonomy,extendPlaceLanguage(taxonomy,
 extendMajorCorrections(taxonomy,extendReviewBatch(taxonomy,
 extendCategory18(taxonomy,load('study-details-pilot-v1.json'),
 load('study-details-category18-review-v1.json'),decks,semantic),
 load('study-details-literature-review-v1.json'),decks,semantic),
 load('study-major-corrections-reviewed-v1.json'),decks,semantic),
 load('study-place-language-review-v1.json'),decks,semantic),
 load('study-next-held-pilot-v1.json'),decks,semantic),
 load('study-bulk-gloss-reviewed-pilot-v1.json'),decks,semantic);
const reviewed=extendRapidCurated(taxonomy,old,pilot,decks,semantic),engine=create(taxonomy,reviewed,decks),rows=[...pilot.cards.burmese,...pilot.cards.shan];
test('all 244 previous keyword candidates classified or deliberately deferred; no silent dictionary attestation',()=>{
 assert.deepEqual(pilot.counts,{proposals:244,classified:184,deferred:60,burmese:26,shan:158,major_corrections:131});
 assert.equal(source.candidates.length,278);
 const previous=new Set([...load('study-bulk-gloss-reviewed-pilot-v1.json').cards.burmese,...load('study-bulk-gloss-reviewed-pilot-v1.json').cards.shan].map(x=>x.id));
 const candidateIds=new Set(source.candidates.map(x=>x.id));
 assert.equal(candidateIds.size,278);
 const seen=new Set();
 for(const x of [...rows,...pilot.deferred_keyword_candidates]){
  assert.ok(candidateIds.has(x.id));assert.ok(!previous.has(x.id));assert.ok(!seen.has(x.id));seen.add(x.id);
 }
 assert.equal(seen.size,244);
 assert.equal(ledger.all_dictionary_senses_reviewed,false);
 assert.equal(ledger.all_card_senses_attested,false);
 assert.equal(ledger.counts.unaccounted_parent_ids,0);
 assert.equal(JSON.stringify(decks),sourceDigest);
});
test('184 Japanese/English-aligned provisional parents are available with reversible major corrections',()=>{
 assert.deepEqual(reviewed.counts,{burmese:1833,shan:2527});
 assert.equal(reviewed.coverage.burmese.review_pending+reviewed.coverage.shan.review_pending,2108);
 assert.equal(reviewed.coverage.burmese.scope_candidates+reviewed.coverage.shan.scope_candidates,6468);
 assert.equal(Object.values(pilot.medium_counts).reduce((a,b)=>a+b,0),184);
 const seen=new Set(),byMedium=new Map();
 let corrected=0;
 for(const row of rows){
  const l=row.id.startsWith('bur:')?'burmese':'shan';
  const x=decks[l].find(x=>x.id===row.id),sem=semantic[l].cards[row.id];
  assert.ok(x);assert.equal(old.cards[l][row.id],undefined);
  assert.equal(x[l],row.word);assert.equal(x.japanese_core,row.gloss);assert.equal(x.english,row.english);
  assert.equal(sem[0],row.legacy_major);assert.ok(['P','R'].includes(sem[1]));
  assert.equal(row.original_dictionary_verified,false);
  assert.ok(!seen.has(row.id));seen.add(row.id);
  const a=engine.annotation(x,l);
  assert.equal(a.medium,row.medium);
  assert.equal(engine.matches(x,l,{medium:row.medium}),true);
  assert.equal(engine.annotation({...x,id:row.id+':sense:2'},l),null);
  assert.equal(engine.annotation({...x,japanese_core:'altered'},l),null);
  assert.equal(engine.majorFor({...x,semantic_major:row.legacy_major,semantic_status:sem[1]},l),row.medium.slice(0,2));
  if(row.major_correction){
   corrected++;
   assert.deepEqual(reviewed.major_corrections[l][row.id],{from:row.legacy_major,to:row.medium.slice(0,2)});
   assert.notEqual(row.legacy_major,row.medium.slice(0,2));
  }
  byMedium.set(row.medium,(byMedium.get(row.medium)||0)+1);
 }
 assert.equal(corrected,131);
 for(const [m,n] of byMedium)assert.equal(pilot.medium_counts[m],n);
 for(const l of ['burmese','shan'])for(const row of pilot.cards[l]){
  const x=decks[l].find(x=>x.id===row.id);
  for(const y of decks[l])if(x.id!==y.id&&x.japanese_core===y.japanese_core&&engine.annotation(y,l))
   assert.equal(engine.canContrast(x,y,l),false,'gloss collision '+x.id+' '+y.id);
 }
 assert.equal(JSON.stringify(decks),sourceDigest);
});
test('every one of 7980 parent IDs is assigned to an accounted-for review state',()=>{
 assert.equal(ledger.counts.parent_cards,7980);
 assert.equal(ledger.counts.pr_eligible,6468);
 assert.equal(ledger.counts.new_provisional_classified,4360);
 assert.equal(ledger.counts.pr_remaining_held,2108);
 assert.equal(ledger.counts.m_h_parent_separate,1512);
 assert.equal(ledger.counts.parent_total_check,7980);
 assert.equal(ledger.remaining_pr_parent_records.length,2108);
 assert.equal(ledger.remaining_m_h_parent_records.length,1512);
 const cardIDs=new Set([...decks.burmese,...decks.shan].map(x=>x.id));
 const accounted=new Set([...Object.keys(reviewed.cards.burmese),...Object.keys(reviewed.cards.shan)]);
 assert.equal(accounted.size,4360);
 for(const x of ledger.remaining_pr_parent_records){
  const sem=semantic[x.language].cards[x.id];assert.ok(cardIDs.has(x.id));
  assert.ok(['P','R'].includes(sem[1]));assert.equal(x.legacy_major,sem[0]);
  assert.equal(accounted.has(x.id),false);assert.equal(x.independent_dictionary_verified,false);
  accounted.add(x.id);
 }
 for(const x of ledger.remaining_m_h_parent_records){
  const sem=semantic[x.language].cards[x.id];assert.ok(cardIDs.has(x.id));
  assert.ok(['M','H'].includes(sem[1]));assert.equal(accounted.has(x.id),false);
  accounted.add(x.id);
 }
 assert.equal(accounted.size,7980);
 for(const x of accounted)assert.ok(cardIDs.has(x));
 assert.equal(ledger.counts.sense_candidates_shan,7290);
 assert.equal(ledger.counts.sense_study_active,7241);
 assert.equal(ledger.counts.sense_candidates_held,49);
});
test('tampered gloss, fake tag, revised scope or missing deferred row aborts before modifying old metadata',()=>{
 const stable=JSON.stringify({old,decks});
 const invalid=f=>{const b=structuredClone(pilot);f(b);return b};
 assert.throws(()=>extendRapidCurated(taxonomy,old,invalid(x=>{x.cards.burmese[0].english+=' changed'}),decks,semantic),/Stale rapid/);
 assert.throws(()=>extendRapidCurated(taxonomy,old,invalid(x=>{x.cards.shan[0].tags.feature=['fictional']}),decks,semantic),/Invalid rapid review tag/);
 assert.throws(()=>extendRapidCurated(taxonomy,old,invalid(x=>{x.cards.shan.pop()}),decks,semantic),/language total/);
 assert.throws(()=>extendRapidCurated(taxonomy,old,invalid(x=>{x.cards.shan[0].id=x.cards.shan[1].id}),decks,semantic),/Stale rapid/);
 assert.throws(()=>extendRapidCurated(taxonomy,old,invalid(x=>{x.deferred_keyword_candidates.pop()}),decks,semantic),/Incomplete rapid keyword/);
 assert.equal(JSON.stringify({old,decks}),stable);
});
