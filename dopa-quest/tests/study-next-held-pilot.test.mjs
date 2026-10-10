import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch,extendMajorCorrections,extendPlaceLanguage,extendNextHeld}=require('../study-details.js');
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),pilot=load('study-next-held-pilot-v1.json');
const original={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const unchanged=JSON.stringify(original);
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const holds=new Map(load('study-details-holds-v1.json').records.map(x=>[x.card_id,x]));
const audits=[...load('held-geography-languages-audit-v1.json').candidates,
 ...load('held-conflict-speech-audit-v1.json').candidates];
const prior=extendPlaceLanguage(taxonomy,extendMajorCorrections(taxonomy,
 extendReviewBatch(taxonomy,extendCategory18(taxonomy,load('study-details-pilot-v1.json'),
 load('study-details-category18-review-v1.json'),original,semantic),
 load('study-details-literature-review-v1.json'),original,semantic),
 load('study-major-corrections-reviewed-v1.json'),original,semantic),
 load('study-place-language-review-v1.json'),original,semantic);
const full=extendNextHeld(taxonomy,prior,pilot,original,semantic),engine=create(taxonomy,full,original);
const copy=x=>structuredClone(x);

test('eleven of fifteen audited held meanings enter optional filters, four remain withheld',()=>{
 assert.equal(audits.length,15);
 assert.deepEqual(pilot.counts,{audited:15,classified:11,held:4,burmese:6,shan:5});
 assert.deepEqual(full.counts,{burmese:1786,shan:2356});
 assert.equal(full.coverage.burmese.review_pending+full.coverage.shan.review_pending,2326);
 assert.equal(full.coverage.burmese.scope_candidates+full.coverage.shan.scope_candidates,6468);
 assert.equal(JSON.stringify(original),unchanged);
 const audit=new Map(audits.map(x=>[x.id,x]));
 const all=[...pilot.cards.burmese,...pilot.cards.shan,...pilot.deferred];
 assert.equal(new Set(all.map(x=>x.id)).size,15);
 for(const row of all){
  const raw=audit.get(row.id),lang=row.id.startsWith('bur:')?'burmese':'shan';
  const source=original[lang].find(x=>x.id===row.id),old=holds.get(row.id);
  assert.ok(raw,row.id);assert.ok(source,row.id);assert.ok(old,row.id);
  assert.equal(source[lang],row.word);assert.equal(source.japanese_core,row.gloss);
  assert.equal(source.english,row.english);
  assert.equal(raw.word,row.word);
  assert.equal(raw.gloss??raw.japanese_core,row.gloss);
  assert.equal(raw.english,row.english);
  assert.equal(row.legacy_major,raw.current_major);
  assert.equal(old.current_major,row.legacy_major);
  assert.equal(old.reason,'detailed_scope_not_finalized_after_initial_review');
  assert.equal(semantic[lang].cards[row.id][0],row.legacy_major);
  assert.ok(['P','R'].includes(semantic[lang].cards[row.id][1]));
  assert.equal(row.original_dictionary_verified,false);
 }
 for(const lang of ['burmese','shan'])for(const row of pilot.cards[lang]){
  const source=original[lang].find(x=>x.id===row.id),a=engine.annotation(source,lang);
  assert.equal(a?.medium,row.medium);
  assert.equal(engine.matches(source,lang,{medium:row.medium}),true);
  assert.equal(engine.annotation({...source,id:row.id+':sense:1'},lang),null);
  assert.equal(engine.annotation({...source,japanese_core:'changed'},lang),null);
 }
 for(const row of pilot.deferred){
  const lang=row.id.startsWith('bur:')?'burmese':'shan';
  assert.equal(row.review_status,'needs-source-review');
  assert.equal(row.medium,null);assert.equal(row.tags,null);assert.ok(row.reason);
  assert.equal(engine.annotation(original[lang].find(x=>x.id===row.id),lang),null);
 }
});
test('identical Japanese answers cannot appear against each other as wrong answers',()=>{
 for(const lang of ['burmese','shan'])for(const row of pilot.cards[lang]){
  const a=original[lang].find(x=>x.id===row.id);
  for(const b of original[lang])if(b.id!==a.id&&
      b.japanese_core===a.japanese_core&&engine.annotation(b,lang)){
   assert.equal(engine.canContrast(a,b,lang),false,a.id+' and '+b.id);
   assert.equal(engine.canContrast(b,a,lang),false,b.id+' and '+a.id);
  }
 }
});
test('a stale source, tag, domain or claimed deferral fails closed',()=>{
 const before=JSON.stringify({prior,original});
 const check=(edit,re)=>{const bad=copy(pilot);edit(bad);assert.throws(
  ()=>extendNextHeld(taxonomy,prior,bad,original,semantic),re);};
 check(x=>x.cards.burmese[0].english+=' altered',/Stale next held/);
 check(x=>x.cards.shan[0].tags.feature=['nonexistent'],/Invalid next held tag/);
 check(x=>x.cards.burmese[0].medium='13.01',/Invalid next held pilot entry/);
 check(x=>x.cards.shan.push(copy(x.cards.burmese[0])),/inventory mismatch/);
 check(x=>{x.deferred[0].medium='13.01';},/Invalid next held deferred/);
 check(x=>{x.cards.shan[0].id=x.cards.shan[1].id;},/Stale next held/);
 assert.equal(JSON.stringify({prior,original}),before);
});
