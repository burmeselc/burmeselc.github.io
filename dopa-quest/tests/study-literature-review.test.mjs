import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18,extendReviewBatch}=require('../study-details.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),original=load('study-details-pilot-v1.json');
const supplement=load('study-details-category18-review-v1.json');
const literature=load('study-details-literature-review-v1.json'),holds=load('study-details-holds-v1.json');
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const category18=extendCategory18(taxonomy,original,supplement,decks,semantic);
const full=extendReviewBatch(taxonomy,category18,literature,decks,semantic);
const engine=create(taxonomy,full,decks);
const deep=x=>JSON.parse(JSON.stringify(x));

test('15 conservative literary/history assignments with one genuinely mixed parent held',()=>{
 assert.deepEqual(literature.counts.burmese,{total:9,candidates:9,held:0});
 assert.deepEqual(literature.counts.shan,{total:7,candidates:6,held:1});
 assert.equal(full.counts.burmese,1706);
 assert.equal(full.counts.shan,2308);
 assert.equal(full.coverage.burmese.scope_candidates+full.coverage.shan.scope_candidates,6468);
 assert.equal(full.coverage.burmese.review_pending+full.coverage.shan.review_pending,2454);
 assert.equal(full.coverage.burmese.untriaged+full.coverage.shan.untriaged,0);
 const heldIds=new Set(holds.records.filter(x=>x.reason==='middle_taxonomy_scope_requires_review').map(x=>x.card_id));
 assert.equal(heldIds.size,16);
 for(const lang of ['burmese','shan'])for(const x of literature.cards[lang]){
  assert.ok(heldIds.has(x.id));
  const d=decks[lang].find(y=>y.id===x.id);
  assert.ok(d);
  assert.equal(d[lang],x.word);
  assert.equal(d.japanese_core,x.gloss);
  assert.equal(d.english,x.english);
  const assigned=x.status==='gloss-reviewed-pilot-candidate';
  assert.equal(!!engine.annotation(d,lang),assigned);
  if(assigned){
   assert.equal(engine.annotation(d,lang).medium,x.medium);
   assert.deepEqual(x.tags.field,[x.medium==='12.05'?'literature':'history']);
   assert.equal(engine.matches(d,lang,{tag:'field:'+x.tags.field[0]}),true);
  }
  assert.equal(engine.matches(d,lang),true);
 }
 const mixed=decks.shan.find(x=>x.id==='shn:1783945284130');
 assert.equal(engine.annotation(mixed,'shan'),null);
});
test('the 15 new cards can be found in both medium filters and full browse without four-choice padding',()=>{
 const summary={};
 for(const lang of ['burmese','shan'])for(const m of ['12.05','12.06']){
  const subset=decks[lang].filter(x=>engine.matches(x,lang,{medium:m}));
  const expected=literature.cards[lang].filter(x=>x.medium===m).length;
  assert.equal(subset.length,expected);
  assert.ok(subset.every(x=>engine.annotation(x,lang).medium===m));
  summary[lang+m]=expected;
 }
 assert.equal(summary['burmese12.05'],8);
 assert.equal(summary['burmese12.06'],1);
 assert.equal(summary['shan12.05'],4);
 assert.equal(summary['shan12.06'],2);
});
test('invalid batch data fail closed, leaving old results and immutable source decks untouched',()=>{
 const before=JSON.stringify({original,category18,decks});
 let invalid=deep(literature);
 invalid.cards.burmese[0].english+=' altered';
 assert.throws(()=>extendReviewBatch(taxonomy,category18,invalid,decks,semantic),/Stale/);
 invalid=deep(literature);invalid.cards.burmese[0].tags.field=['fictional'];
 assert.throws(()=>extendReviewBatch(taxonomy,category18,invalid,decks,semantic),/Invalid review batch tag/);
 invalid=deep(literature);invalid.cards.shan[0].medium='13.02';
 assert.throws(()=>extendReviewBatch(taxonomy,category18,invalid,decks,semantic),/Invalid review batch candidate/);
 invalid=deep(literature);invalid.cards.shan[0].id=invalid.cards.shan[1].id;
 assert.throws(()=>extendReviewBatch(taxonomy,category18,invalid,decks,semantic),/Stale/);
 invalid=deep(literature);invalid.cards.burmese.pop();
 assert.throws(()=>extendReviewBatch(taxonomy,category18,invalid,decks,semantic),/Invalid review batch inventory/);
 assert.equal(JSON.stringify({original,category18,decks}),before);
});
