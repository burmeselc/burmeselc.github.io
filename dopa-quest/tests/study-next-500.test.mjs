import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const D=require('../study-details.js');
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
const tax=load('study-taxonomy-v1.json'),batch=load('study-next-500-audit-v1.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const original=JSON.stringify(decks);
let base=load('study-details-pilot-v1.json');
for(const [method,name] of [
 ['extendCategory18','study-details-category18-review-v1.json'],
 ['extendReviewBatch','study-details-literature-review-v1.json'],
 ['extendMajorCorrections','study-major-corrections-reviewed-v1.json'],
 ['extendPlaceLanguage','study-place-language-review-v1.json'],
 ['extendNextHeld','study-next-held-pilot-v1.json'],
 ['extendBulkGloss','study-bulk-gloss-reviewed-pilot-v1.json'],
 ['extendRapidCurated','study-rapid-curated-batch3-v1.json'],
 ['extendParent728','study-728-parent-review-batch-v1.json']
])base=D[method](tax,base,load(name),decks,semantic,...(method==='extendParent728'?[load('study-current-vocab-fast-sweep-v2.json')]:[]));
const next=D.extendNext500(tax,base,batch,decks,semantic),engine=D.create(tax,next,decks);
test('next 500 audit covers 500 unique original P/R parents without independent source attestation',()=>{
 assert.equal(batch.counts.audited,500);
 assert.equal(batch.counts.selected,33);
 assert.equal(batch.counts.held,467);
 assert.equal(batch.audited_records.length,500);
 assert.equal(batch.accepted.length,33);
 const seen=new Set();
 for(const x of batch.audited_records){
  assert.ok(!seen.has(x.id));seen.add(x.id);
  const source=decks[x.language].find(y=>y.id===x.id);
  assert.ok(source);assert.equal(source[x.language],x.word);
  assert.equal(source.japanese_core,x.japanese_core);assert.equal(source.english,x.english);
  assert.equal(x.independent_dictionary_verified,false);
  assert.equal(base.cards[x.language][x.id],undefined);
 }
 assert.equal(seen.size,500);
 assert.equal(batch.independent_dictionary_verified,false);
 assert.equal(JSON.stringify(decks),original);
});
test('33 conservative parent annotations preserve choice safety and previous coverage',()=>{
 assert.equal(next.counts.burmese,2205);
 assert.equal(next.counts.shan,2735);
 assert.equal(next.coverage.burmese.classified+next.coverage.shan.classified,4940);
 assert.equal(next.coverage.burmese.review_pending+next.coverage.shan.review_pending,1528);
 assert.equal(next.coverage.burmese.scope_candidates+next.coverage.shan.scope_candidates,6468);
 assert.equal(batch.accepted.filter(x=>x.major_correction).length,31);
 for(const row of batch.accepted){
  const x=decks[row.language].find(z=>z.id===row.id);
  assert.equal(engine.annotation(x,row.language)?.medium,row.medium);
  assert.equal(engine.majorFor({...x,semantic_major:semantic[row.language].cards[x.id][0],semantic_status:semantic[row.language].cards[x.id][1]},row.language),row.medium.slice(0,2));
  assert.equal(engine.annotation({...x,japanese_core:'tampered'},row.language),null);
  for(const y of decks[row.language])if(y.id!==x.id&&y.japanese_core===x.japanese_core&&engine.annotation(y,row.language))
   assert.equal(engine.canContrast(x,y,row.language),false);
 }
});
test('tampered source data or false semantic IDs reject the entire batch',()=>{
 const b=structuredClone(batch);b.accepted[0].english+=' fabricated';
 assert.throws(()=>D.extendNext500(tax,base,b,decks,semantic),/Stale selected/);
 const c=structuredClone(batch);c.audited_records.pop();
 assert.throws(()=>D.extendNext500(tax,base,c,decks,semantic),/Unsupported 500/);
 const d=structuredClone(batch);d.accepted[0].tags.field=['invalid'];
 assert.throws(()=>D.extendNext500(tax,base,d,decks,semantic),/Invalid 500-card tag/);
});
