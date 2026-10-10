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


const secondBatch=load('study-next-500-second-audit-v1.json');
const second=D.extendNext500Second(tax,next,secondBatch,decks,semantic,batch);
const secondEngine=D.create(tax,second,decks);
test('second 500 Shan parents: stable P/R source IDs, cumulative counts and separate holds',()=>{
 assert.equal(secondBatch.counts.audited,500);
 assert.equal(secondBatch.counts.selected,151);
 assert.equal(secondBatch.counts.held,349);
 assert.equal(secondBatch.counts.major_corrections,129);
 assert.equal(secondBatch.audited_records.length,500);
 assert.equal(secondBatch.accepted.length,151);
 assert.equal(secondBatch.independent_dictionary_verified,false);
 const firstIDs=new Set(batch.audited_records.map(x=>x.id)),seen=new Set();
 for(const row of secondBatch.audited_records){
  assert.equal(row.language,'shan');
  assert.ok(!seen.has(row.id)&&!firstIDs.has(row.id));
  seen.add(row.id);
  const originalCard=decks.shan.find(x=>x.id===row.id);
  assert.ok(originalCard);
  assert.equal(originalCard.shan,row.word);
  assert.equal(originalCard.japanese_core,row.japanese_core);
  assert.equal(originalCard.english,row.english);
  assert.deepEqual(semantic.shan.cards[row.id].slice(0,2),[row.legacy_major,semantic.shan.cards[row.id][1]]);
  assert.ok(['P','R'].includes(semantic.shan.cards[row.id][1]));
  assert.equal(next.cards.shan[row.id],undefined);
  assert.equal(row.independent_dictionary_verified,false);
 }
 assert.equal(seen.size,500);
 assert.equal(second.counts.burmese,2205);
 assert.equal(second.counts.shan,2886);
 assert.equal(second.coverage.burmese.classified+second.coverage.shan.classified,5091);
 assert.equal(second.coverage.burmese.review_pending+second.coverage.shan.review_pending,1377);
 assert.equal(5091+1377,6468);
 assert.equal(JSON.stringify(decks),original);
});
test('151 selected bilingual meanings and major corrections remain safe for choices',()=>{
 for(const row of secondBatch.accepted){
  const src=decks.shan.find(x=>x.id===row.id);
  assert.ok(src);
  assert.equal(secondEngine.annotation(src,'shan')?.medium,row.medium);
  assert.equal(secondEngine.majorFor({...src,semantic_major:semantic.shan.cards[src.id][0],
    semantic_status:semantic.shan.cards[src.id][1]},'shan'),row.medium.slice(0,2));
  assert.equal(secondEngine.annotation({...src,japanese_core:'modified definition'},'shan'),null);
  for(const other of decks.shan)if(other.id!==src.id&&other.japanese_core===src.japanese_core&&secondEngine.annotation(other,'shan'))
   assert.equal(secondEngine.canContrast(src,other,'shan'),false);
 }
});
test('tampering an accepted gloss, duplicate audited ID or tag rejects entire second batch',()=>{
 const a=structuredClone(secondBatch);
 a.accepted[0].english+=' altered';
 assert.throws(()=>D.extendNext500Second(tax,next,a,decks,semantic,batch),/Stale second-500 candidate/);
 const b=structuredClone(secondBatch);
 b.audited_records[1].id=b.audited_records[0].id;
 assert.throws(()=>D.extendNext500Second(tax,next,b,decks,semantic,batch),/Stale second-500 source/);
 const c=structuredClone(secondBatch);
 c.accepted[0].tags.field=['invalid_value'];
 assert.throws(()=>D.extendNext500Second(tax,next,c,decks,semantic,batch),/Invalid second-500 tag/);
});
