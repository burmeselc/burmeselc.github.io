import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch,extendMajorCorrections,extendPlaceLanguage,
 extendNextHeld,extendBulkGloss,extendRapidCurated,extendParent728}=require('../study-details.js');
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),batch=load('study-728-parent-review-batch-v1.json'),
 queue=load('study-current-vocab-fast-sweep-v2.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const originals=JSON.stringify(decks);
const base=extendRapidCurated(taxonomy,
 extendBulkGloss(taxonomy,extendNextHeld(taxonomy,extendPlaceLanguage(taxonomy,
 extendMajorCorrections(taxonomy,extendReviewBatch(taxonomy,
 extendCategory18(taxonomy,load('study-details-pilot-v1.json'),
 load('study-details-category18-review-v1.json'),decks,semantic),
 load('study-details-literature-review-v1.json'),decks,semantic),
 load('study-major-corrections-reviewed-v1.json'),decks,semantic),
 load('study-place-language-review-v1.json'),decks,semantic),
 load('study-next-held-pilot-v1.json'),decks,semantic),
 load('study-bulk-gloss-reviewed-pilot-v1.json'),decks,semantic),
 load('study-rapid-curated-batch3-v1.json'),decks,semantic);
const final=extendParent728(taxonomy,base,batch,decks,semantic,queue),engine=create(taxonomy,final,decks);
test('728 held parents were reviewed: 547 new provisional classifications and 181 reasoned holds',()=>{
 assert.deepEqual(batch.counts,{audited:728,classified:547,deferred:181,
  burmese:372,shan:175,burmese_deferred:56,shan_deferred:125,major_corrections:351});
 assert.equal(final.counts.burmese,2205);
 assert.equal(final.counts.shan,2702);
 assert.equal(final.coverage.burmese.classified+final.coverage.shan.classified,4907);
 assert.equal(final.coverage.burmese.review_pending+final.coverage.shan.review_pending,1561);
 assert.equal(final.coverage.burmese.scope_candidates+final.coverage.shan.scope_candidates,6468);
 assert.equal(Object.values(batch.medium_counts).reduce((a,b)=>a+b,0),547);
 assert.equal([...batch.cards.burmese,...batch.cards.shan].filter(x=>x.major_correction).length,351);
 assert.equal(JSON.stringify(decks),originals);
});
test('reviewed IDs, bilingual source glosses, 18 majors and 82 medium taxonomy remain consistent',()=>{
 const mids=new Map(taxonomy.categories.flatMap(x=>x.children.map(y=>[y.id,x.id])));
 const all=new Set(),newIDs=new Set();
 for(const lang of ['burmese','shan']){
  const selected=queue.remaining_pr_parent_records.filter(x=>x.language===lang).slice(0,lang==='burmese'?428:300);
  for(const row of [...batch.cards[lang],...batch.deferred[lang]]){
   assert.ok(!all.has(row.id));all.add(row.id);
   assert.ok(selected.some(x=>x.id===row.id));
   const src=decks[lang].find(x=>x.id===row.id),sem=semantic[lang].cards[row.id];
   assert.ok(src);assert.equal(src[lang],row.word);
   assert.equal(src.japanese_core,row.gloss);assert.equal(src.english,row.english);
   assert.equal(sem[0],row.legacy_major);assert.ok(['P','R'].includes(sem[1]));
   assert.equal(row.independent_dictionary_verified,false);
   assert.equal(base.cards[lang][row.id],undefined);
   if(row.review_status==='gloss-reviewed-pilot-candidate'){
    newIDs.add(row.id);
    assert.equal(engine.annotation(src,lang)?.medium,row.medium);
    assert.equal(engine.matches(src,lang,{medium:row.medium}),true);
    assert.equal(engine.majorFor({...src,semantic_major:sem[0],semantic_status:sem[1]},lang),mids.get(row.medium));
    assert.equal(row.major_correction,mids.get(row.medium)!==sem[0]);
    if(row.major_correction)
     assert.deepEqual(final.major_corrections[lang][row.id],{from:sem[0],to:mids.get(row.medium)});
    assert.equal(engine.annotation({...src,id:row.id+':different'},lang),null);
    assert.equal(engine.annotation({...src,japanese_core:src.japanese_core+' changed'},lang),null);
   }else{
    assert.equal(row.review_status,'requires-dictionary-or-sense-review');
    assert.ok(row.reason);
    assert.equal(engine.annotation(src,lang),null);
   }
  }
 }
 assert.equal(all.size,728);assert.equal(newIDs.size,547);
 assert.equal(new Set([...all,...Object.keys(base.cards.burmese),...Object.keys(base.cards.shan)]).size,4360+728);
});
test('547 new items never act as false distractors to an existing identical Japanese answer',()=>{
 for(const lang of ['burmese','shan']){
  const byGloss=new Map();
  for(const x of decks[lang])if(engine.annotation(x,lang)){
   const ids=byGloss.get(x.japanese_core)||[];ids.push(x);byGloss.set(x.japanese_core,ids);
  }
  for(const row of batch.cards[lang]){
   const x=decks[lang].find(x=>x.id===row.id);
   for(const y of byGloss.get(row.gloss)||[])if(y.id!==x.id){
    assert.equal(engine.canContrast(x,y,lang),false,x.id+' vs '+y.id);
   }
  }
 }
});
test('fail closed if an ID, bilingual gloss, original review scope, medium or hold is changed',()=>{
 const stable=JSON.stringify(base),unchanged=JSON.stringify(decks);
 const tamper=f=>{const copy=structuredClone(batch);f(copy);return copy};
 assert.throws(()=>extendParent728(taxonomy,base,tamper(j=>j.cards.burmese[0].english+=' fake'),decks,semantic,queue),/Stale 728-parent/);
 assert.throws(()=>extendParent728(taxonomy,base,tamper(j=>j.cards.shan[0].tags.field=['invented']),decks,semantic,queue),/Invalid 728-parent tag/);
 assert.throws(()=>extendParent728(taxonomy,base,tamper(j=>j.cards.shan[0].medium='99.99'),decks,semantic,queue),/Invalid 728-parent classification/);
 assert.throws(()=>extendParent728(taxonomy,base,tamper(j=>j.deferred.burmese.pop()),decks,semantic,queue),/counts mismatch/);
 assert.throws(()=>extendParent728(taxonomy,base,tamper(j=>j.cards.burmese[1].id=j.cards.burmese[0].id),decks,semantic,queue),/Stale 728-parent/);
 assert.equal(JSON.stringify(base),stable);assert.equal(JSON.stringify(decks),unchanged);
});
