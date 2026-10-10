import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch,extendMajorCorrections}=require('../study-details.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),base=load('study-details-pilot-v1.json');
const source=load('study-major-mismatch-proposals-v1.json');
const batch=load('study-major-corrections-reviewed-v1.json');
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const raw={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const decks=Object.fromEntries(Object.entries(raw).map(([lang,rows])=>[lang,rows.map(x=>({...x,semantic_major:semantic[lang].cards[x.id][0],semantic_status:semantic[lang].cards[x.id][1]}))]));
const prior=extendReviewBatch(taxonomy,extendCategory18(taxonomy,base,load('study-details-category18-review-v1.json'),raw,semantic),load('study-details-literature-review-v1.json'),raw,semantic);
const full=extendMajorCorrections(taxonomy,prior,batch,raw,semantic);
const engine=create(taxonomy,full,decks);
const clone=x=>JSON.parse(JSON.stringify(x));

test('31 original P/R parent cards gain new detailed majors, two difficult cases stay unassigned',()=>{
 assert.equal(source.counts.total,33);
 assert.deepEqual(batch.counts.burmese,{total:15,candidates:15,held:0});
 assert.deepEqual(batch.counts.shan,{total:18,candidates:16,held:2});
 assert.equal(full.counts.burmese,1721);
 assert.equal(full.counts.shan,2324);
 assert.equal(full.coverage.burmese.classified+full.coverage.shan.classified,4045);
 assert.equal(full.coverage.burmese.review_pending+full.coverage.shan.review_pending,2423);
 assert.equal(full.coverage.burmese.scope_candidates+full.coverage.shan.scope_candidates,6468);
 const candidates=source.cards.filter(x=>x.status==='category-correction-candidate');
 assert.equal(candidates.length,31);
 for(const lang of ['burmese','shan']){
  for(const row of batch.cards[lang]){
   const original=source.cards.find(x=>x.id===row.id);
   const x=decks[lang].find(c=>c.id===row.id);
   assert.ok(x);assert.ok(original);
   assert.equal(x[lang],row.word);
   assert.equal(x.japanese_core,row.gloss);
   assert.equal(x.english,row.english);
   assert.equal(row.existing_major,original.existing_major);
   assert.equal(x.semantic_major,row.existing_major);
   assert.equal(x.semantic_status==='P'||x.semantic_status==='R',true);
   if(row.status==='needs-source-review'){
    assert.equal(row.proposed_medium,null);
    assert.equal(engine.annotation(x,lang),null);
    assert.equal(engine.majorFor(x,lang),row.existing_major);
    continue;
   }
   assert.equal(row.proposed_medium,original.proposed_medium);
   assert.equal(engine.annotation(x,lang)?.medium,row.proposed_medium);
   assert.equal(engine.majorFor(x,lang),row.proposed_medium.slice(0,2));
   assert.notEqual(engine.majorFor(x,lang),row.existing_major);
   assert.equal(engine.matches(x,lang,{medium:row.proposed_medium}),true);
   const newMajor=engine.majorFor(x,lang),other={...x,japanese_core:'NOT THE SOURCE GLOSS'};
   assert.equal(engine.majorFor(other,lang),row.existing_major);
   assert.equal(engine.annotation(other,lang),null);
   assert.equal(x.semantic_major,row.existing_major); // No original map mutation.
   assert.ok(decks[lang].filter(y=>engine.majorFor(y,lang)===newMajor).includes(x));
   assert.ok(!decks[lang].filter(y=>engine.majorFor(y,lang)===row.existing_major).includes(x));
  }
 }
});
test('major correction overlays fail closed when source, old major or tags drift',()=>{
 const before=JSON.stringify({raw,decks,prior});
 let v=clone(batch);v.cards.burmese[0].english+='!';
 assert.throws(()=>extendMajorCorrections(taxonomy,prior,v,raw,semantic),/Stale/);
 v=clone(batch);v.cards.shan[0].existing_major='15';
 assert.throws(()=>extendMajorCorrections(taxonomy,prior,v,raw,semantic),/Stale/);
 v=clone(batch);v.cards.burmese[0].tags.feature=['invented_feature'];
 assert.throws(()=>extendMajorCorrections(taxonomy,prior,v,raw,semantic),/Invalid major correction tag/);
 v=clone(batch);v.cards.shan[0].proposed_medium='03.01';
 assert.throws(()=>extendMajorCorrections(taxonomy,prior,v,raw,semantic),/Invalid major correction candidate/);
 v=clone(batch);v.cards.shan.pop();
 assert.throws(()=>extendMajorCorrections(taxonomy,prior,v,raw,semantic),/Incomplete/);
 assert.equal(JSON.stringify({raw,decks,prior}),before);
});
test('basic play still includes all original parents and sense children inherit no corrected parent category',()=>{
 for(const lang of ['burmese','shan'])for(const x of decks[lang])assert.equal(engine.matches(x,lang),true);
 const x=decks.shan.find(x=>x.id==='shn:1783945286929');
 const child={...x,id:x.id+':sense:other',parent_id:x.id};
 assert.equal(engine.annotation(child,'shan'),null);
 assert.equal(engine.majorFor(child,'shan'),x.semantic_major);
 assert.equal(engine.majorFor(x,'shan'),'01');
 const m=clone(full);m.major_corrections.shan[x.id].to='03';
 assert.throws(()=>create(taxonomy,m,decks),/Invalid effective major correction/);
});
