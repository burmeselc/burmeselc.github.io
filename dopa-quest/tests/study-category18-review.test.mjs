import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create,extendCategory18}=require('../study-details.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json');
const base=load('study-details-pilot-v1.json');
const queue=load('study-details-category18-review-v1.json');
const semantic={burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')};
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const supplement=()=>extendCategory18(taxonomy,base,queue,decks,semantic);
const full=supplement(),engine=create(taxonomy,full,decks);
const clone=x=>JSON.parse(JSON.stringify(x));

test('category 18 has exactly 127 eligible original cards, 28 pilot assignments and 99 held',()=>{
 assert.deepEqual(queue.counts.burmese,{total:24,candidates:12,held:12});
 assert.deepEqual(queue.counts.shan,{total:103,candidates:16,held:87});
 assert.equal(full.counts.burmese,1697);
 assert.equal(full.counts.shan,2302);
 assert.equal(full.coverage.burmese.scope_candidates+full.coverage.shan.scope_candidates,6468);
 assert.equal(full.coverage.burmese.review_pending+full.coverage.shan.review_pending,2469);
 assert.equal(full.coverage.burmese.untriaged+full.coverage.shan.untriaged,0);
 for(const l of ['burmese','shan']){
  assert.equal(full.coverage[l].major_ids.at(-1),'18');
  const eligible=decks[l].filter(x=>semantic[l].cards[x.id][0]==='18'&&
    ['P','R'].includes(semantic[l].cards[x.id][1]));
  assert.deepEqual(new Set(queue.cards[l].map(x=>x.id)),new Set(eligible.map(x=>x.id)));
  for(const x of queue.cards[l]){
   const d=decks[l].find(v=>v.id===x.id);
   assert.equal(x.word,d[l]);assert.equal(x.gloss,d.japanese_core);
   assert.equal(!!engine.annotation(d,l),x.status==='gloss-reviewed-pilot-candidate');
   assert.equal(engine.matches(d,l),true);
  }
 }
 assert.equal(Object.keys(base.cards.burmese).length,1685);
 assert.equal(Object.keys(base.cards.shan).length,2286);
});

test('category 18 trial filters are usable without inventing meanings',()=>{
 for(const l of ['burmese','shan']){
  const relevant=decks[l].filter(x=>engine.matches(x,l,{medium:'18.04'}));
  assert.ok(relevant.length>=4);
  assert.ok(relevant.every(x=>engine.annotation(x,l)?.medium==='18.04'));
 }
 const unresolved=queue.cards.shan.find(x=>x.status==='needs-source-review');
 const source=decks.shan.find(x=>x.id===unresolved.id);
 assert.equal(engine.annotation(source,'shan'),null);
 assert.equal(engine.matches(source,'shan',{medium:'18.04'}),false);
 const x=decks.shan.find(x=>x.id===queue.cards.shan.find(r=>r.medium)?.id);
 assert.equal(engine.annotation({...x,japanese_core:'別の意味'},'shan'),null);
 assert.equal(engine.annotation({...x,id:x.id+':sense:2'},'shan'),null);
});

test('equal definitions cannot be used as alternative incorrect answers',()=>{
 for(const l of ['burmese','shan']){
  const entries=queue.cards[l].filter(x=>x.medium);
  const glosses=new Map();
  for(const x of entries)glosses.set(x.gloss,[...(glosses.get(x.gloss)||[]),x.id]);
  for(const ids of glosses.values())if(ids.length>1)
   for(const id of ids)for(const other of ids.filter(v=>v!==id)){
    const a=decks[l].find(x=>x.id===id),b=decks[l].find(x=>x.id===other);
    assert.equal(engine.canContrast(a,b,l),false);
   }
 }
});

test('stale, partial or invalid review data fail closed and do not change base metadata',()=>{
 const original=JSON.stringify(base);
 const bad=clone(queue);bad.cards.shan[0].gloss+='？';
 assert.throws(()=>extendCategory18(taxonomy,base,bad,decks,semantic),/Stale/);
 const partial=clone(queue);partial.cards.burmese.pop();
 assert.throws(()=>extendCategory18(taxonomy,base,partial,decks,semantic),/Incomplete/);
 const fakeTag=clone(queue),row=fakeTag.cards.shan.find(x=>x.medium);
 row.tags.semantic_type=['made_up'];
 assert.throws(()=>extendCategory18(taxonomy,base,fakeTag,decks,semantic),/Invalid category 18 tag/);
 assert.throws(()=>extendCategory18(taxonomy,base,queue,decks,{burmese:null,shan:null}),/major map/);
 assert.equal(JSON.stringify(base),original);
 assert.equal(create(taxonomy,base,decks).annotation(
  decks.shan.find(x=>x.id===queue.cards.shan.find(r=>r.medium)?.id),'shan'),null);
});
