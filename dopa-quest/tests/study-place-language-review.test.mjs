import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch,extendMajorCorrections,extendPlaceLanguage}=require('../study-details.js');
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json');
const originals={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const baseline=load('study-details-pilot-v1.json'),batch=load('study-place-language-review-v1.json'),holds=load('study-details-holds-v1.json');
const originalString=JSON.stringify(originals);
const prior=extendMajorCorrections(taxonomy,extendReviewBatch(taxonomy,
 extendCategory18(taxonomy,baseline,load('study-details-category18-review-v1.json'),originals,semantic),
 load('study-details-literature-review-v1.json'),originals,semantic),
 load('study-major-corrections-reviewed-v1.json'),originals,semantic);
const full=extendPlaceLanguage(taxonomy,prior,batch,originals,semantic);
const engine=create(taxonomy,full,originals);
const clone=x=>JSON.parse(JSON.stringify(x));

test('86 exact previously-held entries become detail candidates; original cards remain unchanged',()=>{
 assert.deepEqual(batch.counts,{burmese:59,shan:27});
 assert.deepEqual(full.counts,{burmese:1780,shan:2351});
 assert.equal(full.counts.burmese+full.counts.shan,4131);
 assert.equal(full.coverage.burmese.review_pending+full.coverage.shan.review_pending,2337);
 assert.equal(full.coverage.burmese.scope_candidates+full.coverage.shan.scope_candidates,6468);
 const previouslyHeld=new Map(holds.records.map(x=>[x.card_id,x]));
 for(const lang of ['burmese','shan']){
  for(const row of batch.cards[lang]){
   const original=originals[lang].find(x=>x.id===row.id),old=previouslyHeld.get(row.id);
   assert.ok(original);assert.ok(old);
   assert.equal(old.current_major,row.legacy_major);
   assert.equal(old.reason,'detailed_scope_not_finalized_after_initial_review');
   assert.equal(original[lang],row.word);assert.equal(original.japanese_core,row.gloss);
   assert.equal(original.english,row.english);
   assert.equal(semantic[lang].cards[row.id][0],row.legacy_major);
   assert.ok(['P','R'].includes(semantic[lang].cards[row.id][1]));
   const a=engine.annotation(original,lang);assert.ok(a);assert.equal(a.medium,row.medium);
   assert.equal(engine.matches(original,lang,{medium:row.medium}),true);
   assert.equal(engine.matches(original,lang,{tag:row.medium==='09.05'?'feature:spatial':'semantic_type:entity'}),true);
   assert.equal(engine.annotation({...original,id:row.id+':sense:2'},lang),null);
  }
 }
 assert.equal(JSON.stringify(originals),originalString);
});
test('proper names and language names are available even for sparse subgroups',()=>{
 assert.equal(batch.cards.burmese.filter(x=>x.medium==='09.05').length,56);
 assert.equal(batch.cards.shan.filter(x=>x.medium==='09.05').length,27);
 assert.equal(batch.cards.burmese.filter(x=>x.medium==='13.05').length,3);
 assert.equal(originals.burmese.filter(x=>engine.matches(x,'burmese',{medium:'13.05'})).length,3);
 assert.equal(originals.shan.filter(x=>engine.matches(x,'shan',{medium:'09.05'})).length,27);
 const ambiguous=originals.burmese.find(x=>x.id==='bur:1394981526737');
 assert.ok(ambiguous);assert.equal(engine.annotation(ambiguous,'burmese'),null);
 const mixed=originals.burmese.find(x=>x.id==='bur:1402175716613');
 assert.ok(mixed);assert.equal(engine.annotation(mixed,'burmese'),null);
});
test('known variants of the same place never appear as each other\'s wrong choice',()=>{
 for(const lang of ['burmese','shan'])for(const ids of batch.alias_groups[lang]){
  const cards=ids.map(id=>originals[lang].find(x=>x.id===id));
  assert.ok(cards.every(Boolean));
  for(const a of cards)for(const b of cards)if(a!==b)assert.equal(engine.canContrast(a,b,lang),false);
 }
});
test('stale or tampered sidecar fails before changing any existing metadata',()=>{
 const before=JSON.stringify({prior,originals});
 let corrupted=clone(batch);corrupted.cards.burmese[0].english+=' X';
 assert.throws(()=>extendPlaceLanguage(taxonomy,prior,corrupted,originals,semantic),/Stale/);
 corrupted=clone(batch);corrupted.cards.shan[0].medium='15.01';
 assert.throws(()=>extendPlaceLanguage(taxonomy,prior,corrupted,originals,semantic),/Stale/);
 corrupted=clone(batch);corrupted.cards.shan[0].tags.feature=['made_up'];
 assert.throws(()=>extendPlaceLanguage(taxonomy,prior,corrupted,originals,semantic),/Invalid place-language tag/);
 corrupted=clone(batch);corrupted.cards.burmese.pop();
 assert.throws(()=>extendPlaceLanguage(taxonomy,prior,corrupted,originals,semantic),/Invalid place-language count/);
 corrupted=clone(batch);corrupted.alias_groups.shan[0][1]='no-card';
 assert.throws(()=>extendPlaceLanguage(taxonomy,prior,corrupted,originals,semantic),/Invalid place-language alias/);
 assert.equal(JSON.stringify({prior,originals}),before);
});
