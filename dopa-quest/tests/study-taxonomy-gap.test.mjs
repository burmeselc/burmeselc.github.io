import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {create,extendCategory18}=require('../study-details.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json');
const metadata=load('study-details-pilot-v1.json');
const held=load('study-details-holds-v1.json');
const proposals=load('study-taxonomy-gap-proposals-v1.json');
const small=load('study-small-category-proposals-v1.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const map=Object.fromEntries(Object.entries(decks).map(([l,rows])=>[l,new Map(rows.map(x=>[x.id,x]))]));
const engine=create(taxonomy,metadata,decks);

test('eighteen legacy majors remain stable with five new non-forced medium buckets',()=>{
 assert.equal(taxonomy.categories.length,18);
 assert.equal(engine.mediums.size,82);
 for(const [mid,label] of [
  ['09.05','国・地域・地名'],['12.05','文学・物語・詩歌'],
  ['12.06','歴史・歴史叙述'],['13.05','言語名・言語変種'],
  ['17.07','派生・名詞化・語形成']]){
  assert.equal(engine.mediums.get(mid)?.label,label);
  assert.equal(decks.burmese.filter(x=>engine.matches(x,'burmese',{medium:mid})).length,0);
  assert.equal(decks.shan.filter(x=>engine.matches(x,'shan',{medium:mid})).length,0);
 }
 assert.ok(taxonomy.tag_axes.find(x=>x.axis==='field').values.includes('literature'));
 assert.ok(taxonomy.tag_axes.find(x=>x.axis==='field').values.includes('history'));
 assert.equal(taxonomy.tag_labels.field.literature,'文学');
 assert.equal(taxonomy.tag_labels.field.history,'歴史');
});

test('sixteen literature/history cases are exact held cards, not silent new classifications',()=>{
 assert.equal(proposals.schema,'dopa-taxonomy-gap-proposals-v1');
 assert.equal(proposals.count,16);
 assert.equal(proposals.records.length,16);
 assert.equal(new Set(proposals.records.map(x=>x.card_id)).size,16);
 assert.equal(proposals.records.filter(x=>x.proposed_medium==='12.05').length,13);
 assert.equal(proposals.records.filter(x=>x.proposed_medium==='12.06').length,3);
 const byId=new Map(held.records.map(x=>[x.card_id,x]));
 for(const row of proposals.records){
  const x=map[row.language].get(row.card_id);
  const original=byId.get(row.card_id);
  assert.ok(x);assert.ok(original);
  assert.equal(original.reason,'middle_taxonomy_scope_requires_review');
  assert.equal(original.current_major,'12');
  assert.equal(x[row.language],row.word);
  assert.equal(x.japanese_core,row.gloss);
  assert.equal(row.status,'proposal-not-approved');
  assert.equal(row.source_check,'pending');
  assert.equal(engine.annotation(x,row.language),null);
  assert.equal(engine.matches(x,row.language,{medium:row.proposed_medium}),false);
  assert.equal(engine.matches(x,row.language),true);
 }
});

test('seven small-category drafts are unique, nested, optional and never forced into quiz metadata',()=>{
 assert.equal(small.status,'design-only');
 assert.equal(small.categories.length,7);
 assert.equal(new Set(small.categories.map(x=>x.id)).size,7);
 for(const sub of small.categories){
  assert.equal(sub.status,'design-only');
  assert.ok(/^\d{2}\.\d{2}\.\d{2}$/.test(sub.id));
  assert.equal(sub.id.slice(0,5),sub.medium);
  assert.ok(engine.mediums.has(sub.medium));
  assert.equal(sub.id in metadata.medium_counts.shan,false);
  assert.equal(sub.id in metadata.medium_counts.burmese,false);
 }
 // The existing one-card classification remains discoverable without four-choice padding.
 const one=decks.shan.filter(x=>engine.matches(x,'shan',{medium:'07.03'}));
 assert.equal(one.length,1);
});

test('category 18 validation remains compatible with the extended taxonomy',()=>{
 const result=extendCategory18(taxonomy,metadata,load('study-details-category18-review-v1.json'),decks,{
  burmese:load('burmese-categories-v1.json'),shan:load('shan-categories-v1.json')
 });
 assert.equal(result.counts.burmese+result.counts.shan,3999);
 assert.equal(result.coverage.burmese.review_pending+result.coverage.shan.review_pending,2469);
});
