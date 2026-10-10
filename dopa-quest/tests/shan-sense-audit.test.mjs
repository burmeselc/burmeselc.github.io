import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const audit=load('shan-sense-audit-v1.json');
const children=new Map(Array.from({length:8},(_,i)=>load('shan-senses-'+(i+1)+'.json')).flat().map(x=>[x.id,x]));
const parents=new Map([...load('shan-1.json'),...load('shan-2.json')].map(x=>[x.id,x]));
test('audit records preserve parent and child identities and never enable empty meanings',()=>{
 assert.equal(audit.read_only,true);assert.equal(audit.changed_records,0);assert.equal(audit.new_ids,0);
 assert.equal(audit.counts.empty_child_gloss,11);
 for(const r of audit.empty_glosses){
  const x=children.get(r.card_id),p=parents.get(r.parent_id);
  assert.equal(x.japanese_core,'');assert.equal(x.game_include,0);
  assert.equal(r.parent_japanese,p.japanese_core);assert.equal(r.parent_english,p.english);
  assert.equal(r.decision,'keep-withheld');
 }
 assert.equal(children.size,7290);assert.equal(parents.size,5480);
});
test('explicit preserved POS disagreements are evidence for review, not linguistic corrections',()=>{
 assert.equal(audit.counts.exact_source_pos_family_disagreements,64);
 const follow=audit.source_pos_disagreements.find(r=>r.card_id==='shn:1783945283895:sense:02:pos:01');
 assert.equal(follow.current_pos,'名詞');assert.equal(follow.preserved_source_pos,'動詞');
 assert.match(follow.context,/【動詞】 従う/);
 for(const r of audit.source_pos_disagreements){
  assert.equal(r.current_pos,children.get(r.card_id).game_pos);
  assert.equal(r.linguistic_pos_confirmed,false);assert.equal(r.generator_cause_confirmed,false);
 }
 assert.equal(audit.counts.embedded_pos_markers,6);
});
test('ambiguous/cross-domain detail holds preserve glosses and are not classified',()=>{
 const holds=load('study-details-holds-v1.json'),details=load('study-details-pilot-v1.json');
 const decks={burmese:new Map(load('burmese.json').map(x=>[x.id,x])),shan:parents};
 assert.equal(holds.records.length,269);
 for(const r of holds.records){
  assert.equal(r.gloss,decks[r.language].get(r.card_id).japanese_core);
  assert.ok(!details.cards[r.language][r.card_id]);
  assert.equal(r.production_change,false);
 }
});
