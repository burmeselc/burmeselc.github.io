import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=n=>JSON.parse(fs.readFileSync('dopa-quest/data/'+n,'utf8'));
test('19 proposed rule repairs remain strictly held, 2 semantic boundaries prioritized',()=>{
 const a=read('shan-extra-19-taxonomy-repair-audit-v1.json'),
  source=read('shan-extra-final65-gloss-review-v1.json').entries,
  released=read('shan-extra-final65-proposals-v1.json');
 const expected=new Map(source.filter(e=>e.decision==='taxonomy-candidate-repair-not-for-release')
  .map(e=>[e.parent_card_id,e]));
 const valid=new Set(read('study-taxonomy-v1.json').categories.flatMap(c=>c.children.map(m=>m.id)));
 assert.equal(a.total,19);assert.equal(a.held,19);assert.equal(a.published,0);
 assert.equal(a.entries.length,19);assert.equal(a.entries.filter(e=>e.priority==='meaning-boundary').length,2);
 for(const e of a.entries){
  const old=expected.get(e.parent_card_id);
  assert.ok(old);assert.equal(e.source_gloss,old.source_gloss);
  assert.equal(e.proposed_medium,old.proposed_medium);assert.ok(valid.has(e.proposed_medium));
  assert.ok(!old.original_candidates.some(c=>c.medium===e.proposed_medium));
  assert.ok(!released.cards.some(c=>c[0]===e.parent_card_id));
  assert.equal(e.editorial_review,'machine-proposal-unverified');assert.equal(e.sense_id,null);
  assert.equal(e.publishable_as_approved_sense,false);
 }
});
