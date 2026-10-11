import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const DATA=path.resolve('dopa-quest/data');
const read=f=>JSON.parse(fs.readFileSync(path.join(DATA,f),'utf8'));
const old=read('shan-extra-multiple-held-after-round2.json').entries;
const reviewed=read('shan-extra-final65-gloss-review-v1.json');
const taxonomy=read('study-taxonomy-v1.json');
const mediumNames=new Map(taxonomy.categories.flatMap(c=>c.children.map(x=>[x.id,x.label])));
test('Exactly the 65 held parent identities are individually reconsidered',()=>{
 assert.equal(old.length,65);
 assert.equal(reviewed.entries.length,65);
 assert.equal(new Set(reviewed.entries.map(r=>r.parent_card_id)).size,65);
 assert.equal(new Set(reviewed.entries.map(r=>r.rank)).size,65);
 assert.deepEqual(reviewed.entries.map(r=>r.parent_card_id).sort(),old.map(r=>r.parent_card_id).sort());
 assert.deepEqual(reviewed.counts,{
  'unresolved-multiple-sense-or-lexical-boundary':28,
  'additional-provisional-original-candidate':18,
  'taxonomy-candidate-repair-not-for-release':19
 });
});
test('Proposed classifications are correct candidates or explicit taxonomy repairs only; no sense approval or source mutation',()=>{
 const original=new Map(old.map(r=>[r.parent_card_id,r]));
 for(const row of reviewed.entries){
  const src=original.get(row.parent_card_id);
  assert.ok(src);
  assert.equal(row.rank,src.rank);
  assert.equal(row.shan,src.shan);
  assert.equal(row.source_gloss,src.source_gloss);
  assert.equal(row.source_definition,src.source_definition??null);
  assert.deepEqual(row.source_record_ids,src.source_record_ids);
  assert.deepEqual(row.original_candidates,src.original_candidates);
  assert.equal(row.editorial_review,'machine-proposal-unverified');
  assert.equal(row.requires_primary_dictionary_confirmation,true);
  assert.equal(row.sense_id,null);
  assert.equal(row.pos_candidate,null);
  assert.equal(row.publishable_as_approved_sense,false);
  assert.ok(row.rationale.length>=20);
  if(row.decision==='unresolved-multiple-sense-or-lexical-boundary'){
   assert.equal(row.proposed_medium,null);
   assert.equal(row.proposed_label,null);
  }else{
   assert.equal(row.proposed_label,mediumNames.get(row.proposed_medium));
   const originalCandidate=src.original_candidates.some(c=>c.medium===row.proposed_medium);
   if(row.decision==='additional-provisional-original-candidate')assert.ok(originalCandidate,'unsupported candidate '+row.rank);
   else if(row.decision==='taxonomy-candidate-repair-not-for-release')assert.ok(!originalCandidate,'reclassification should be explicit '+row.rank);
   else assert.fail('unexpected review disposition '+row.decision);
  }
 }
});
test('Final65 review never automatically modifies 572 second-pass release proposals',()=>{
 const shard=read('shan-extra-multiple-proposals-1.json');
 assert.equal(shard.cards.length,572);
 const released=new Set(shard.cards.map(c=>c[0]));
 assert.ok(reviewed.entries.every(e=>!released.has(e.parent_card_id)));
});
