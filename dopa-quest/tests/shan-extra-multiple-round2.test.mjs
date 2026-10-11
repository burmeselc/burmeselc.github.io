import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('dopa-quest/data');
const load=(name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const manifest=load('shan-extra-multiple-round2-manifest-v1.json');
const held=load(manifest.held_file);
const groups=['1-3','4-6','7-9','10-12'];
const original=groups.flatMap(g=>load('shan-extra-multiple-review-'+g+'.json').entries);
const fresh=groups.flatMap(g=>load('shan-extra-multiple-round2-'+g+'.json').entries);
const older=original.filter(x=>x.assessment.status==='provisional-single-category');
const source=new Map(original.map(x=>[x.parent_card_id,x]));
test('Exactly all 637 conflict records accounted for as 572 proposals and 65 holds',()=>{
 assert.equal(original.length,637);
 assert.equal(source.size,637);
 assert.equal(older.length,62);
 assert.equal(fresh.length,510);
 assert.equal(held.entries.length,65);
 assert.equal(manifest.source_total,637);
 assert.equal(manifest.prior_provisional,62);
 assert.equal(manifest.new_second_pass_proposals,510);
 assert.equal(manifest.combined_provisional,572);
 assert.equal(manifest.held_after_second_pass,65);
 const all=[...older,...fresh,...held.entries];
 assert.equal(new Set(all.map(x=>x.parent_card_id)).size,637);
 assert.equal(new Set(all.map(x=>x.rank)).size,637);
 assert.deepEqual(all.map(x=>x.parent_card_id).sort(),original.map(x=>x.parent_card_id).sort());
});
test('Round2 lexical candidates are evidence-linked, source-preserving, unverified and never approved',()=>{
 const tax=load('study-taxonomy-v1.json');
 const names=new Map(tax.categories.flatMap(c=>c.children.map(x=>[x.id,x.label])));
 for(const x of fresh){
  const orig=source.get(x.parent_card_id);
  assert.ok(orig);
  assert.equal(orig.assessment.status,'held-for-lexical-review');
  assert.equal(x.rank,orig.rank);
  assert.equal(x.shan,orig.shan);
  assert.equal(x.source_gloss,orig.source_gloss);
  assert.equal(x.source_definition,orig.source_definition??null);
  assert.deepEqual(x.source_record_ids,orig.source_record_ids);
  assert.equal(x.selected_label,names.get(x.selected_medium));
  const selected=orig.category_candidates.find(c=>c.medium===x.selected_medium);
  assert.ok(selected,'new category must be one of original evidence-linked candidates: '+x.rank);
  assert.deepEqual(x.selected_original_cues,selected.evidence);
  assert.ok(x.rationale.length>20);
  assert.equal(x.judgement,'provisional-lexical-center-not-validated');
  assert.equal(x.source_confirmation_required,true);
  assert.equal(x.editorial_review,'machine-proposal-unverified');
  assert.equal(x.pos_candidate,null);
  assert.equal(x.sense_id,null);
  assert.equal(x.publishable_as_approved_sense,false);
 }
});
test('All 65 held rows retain provenance and are excluded from published source and round2 proposals',()=>{
 assert.equal(held.status,'held-not-deployed');
 const singles=[1,2,3,4].flatMap(i=>load('shan-extra-single-proposals-'+i+'.json').cards.map(c=>c[0]));
 assert.equal(singles.length,4359);
 const singleSet=new Set(singles);
 const heldSet=new Set(held.entries.map(r=>r.parent_card_id));
 const secondSet=new Set(fresh.map(r=>r.parent_card_id));
 for(const x of held.entries){
  const orig=source.get(x.parent_card_id);
  assert.ok(orig);
  assert.equal(orig.assessment.status,'held-for-lexical-review');
  assert.equal(x.rank,orig.rank);
  assert.equal(x.shan,orig.shan);
  assert.equal(x.source_gloss,orig.source_gloss);
  assert.deepEqual(x.original_candidates,orig.category_candidates);
  assert.ok(x.reason.length>25);
  assert.equal(x.editorial_review,'machine-proposal-unverified');
  assert.equal(x.pos_candidate,null);
  assert.equal(x.sense_id,null);
  assert.equal(x.publishable_as_approved_sense,false);
 }
 for(const x of [...original,...fresh]){
  assert.ok(!singleSet.has(x.parent_card_id),'overlap with published single category');
 }
 assert.ok(fresh.every(x=>!heldSet.has(x.parent_card_id)));
 assert.equal(new Set(fresh.map(x=>x.parent_card_id)).size,510);
 assert.deepEqual(manifest.by_group.map(x=>x.round2),[272,99,79,60]);
 assert.deepEqual(manifest.by_group.map(x=>x.held),[38,6,9,12]);
 assert.equal(manifest.unchanged.all_shan_parent_cards,16985);
 assert.equal(manifest.unchanged.extra_source_parents,11505);
});
