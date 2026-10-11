import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DATA=path.resolve('dopa-quest/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(DATA,name),'utf8'));
const manifest=read('shan-extra-multiple-review-manifest-v1.json');
const source=[];
for(let b=1;b<=12;b++)for(const p of ['a','b']){
 const filename=`shan-extra-semantic-review-${b}${p}.json`;
 for(const row of read(filename))source.push({...row,__file:'dopa-quest/data/'+filename});
}
const expected=source.filter(r=>r.review_status==='ambiguous-multiple-category-cues');
const parts=manifest.parts.map(p=>({...p,data:read(p.file)}));
const queue=parts.flatMap(p=>p.data.entries);

test('Exactly all 637 multi-category source parents are queued, once',()=>{
 assert.equal(source.length,11505);
 assert.equal(expected.length,637);
 assert.equal(manifest.conflict_count,637);
 assert.equal(manifest.extracted_unique_parent_ids,637);
 assert.equal(queue.length,637);
 const byId=new Map(queue.map(r=>[r.parent_card_id,r]));
 assert.equal(byId.size,637,'duplicate parent ID');
 assert.equal(new Set(queue.map(r=>r.rank)).size,637,'duplicate rank');
 assert.deepEqual([...byId.keys()].sort(),expected.map(r=>r.parent_card_id).sort());
 assert.deepEqual(queue.map(r=>r.rank),[...queue.map(r=>r.rank)].sort((a,b)=>a-b));
});

test('Each queue entry retains original Shan orthography, gloss, evidence and source metadata',()=>{
 const original=new Map(expected.map(r=>[r.parent_card_id,r]));
 const taxonomy=read('study-taxonomy-v1.json');
 const mediums=new Set(taxonomy.categories.flatMap(c=>c.children.map(m=>m.id)));
 for(const entry of queue){
  const src=original.get(entry.parent_card_id);
  assert.ok(src,'missing source for '+entry.rank);
  assert.equal(entry.rank,src.rank);
  assert.equal(entry.shan,src.shan);
  assert.equal(entry.source_gloss,src.source_gloss);
  assert.equal(entry.source_definition,src.source_definition??null);
  assert.deepEqual(entry.source_record_ids,src.source_record_ids||[]);
  assert.equal(entry.source_row,src.source_row??null);
  assert.equal(entry.pos_source,src.pos_source??null);
  assert.equal(entry.source_review_file,src.__file);
  assert.deepEqual(entry.category_candidates,src.category_candidates);
  assert.deepEqual(entry.segmentation_candidates,src.segmentation_candidates||[]);
  assert.ok(entry.category_candidates.length>=2);
  assert.ok(entry.category_candidates.every(c=>mediums.has(c.medium)));
  assert.equal(entry.editorial_review,'machine-proposal-unverified');
  assert.equal(entry.publishable_as_approved_sense,false);
  assert.equal(entry.pos_candidate,null);
  assert.equal(entry.sense_id,null);
  assert.equal(entry.assessment.needs_source_confirmation,true);
  assert.ok(entry.assessment.reason.trim().length>=12);
  if(entry.assessment.status==='provisional-single-category'){
   assert.ok(entry.category_candidates.some(c=>c.medium===entry.assessment.proposed_primary_medium),
     'proposed category missing from source candidates: '+entry.rank);
  }else{
   assert.equal(entry.assessment.status,'held-for-lexical-review');
   assert.equal(entry.assessment.proposed_primary_medium,null);
  }
 }
});

test('Partition and triage counts balance and no public sidecar is mutated',()=>{
 const all=queue;
 const proposals=all.filter(r=>r.assessment.status==='provisional-single-category');
 const held=all.filter(r=>r.assessment.status==='held-for-lexical-review');
 assert.equal(proposals.length,62);
 assert.equal(held.length,575);
 assert.equal(manifest.triaged_single_category_proposals,62);
 assert.equal(manifest.held_for_lexical_review,575);
 assert.deepEqual(parts.map(p=>p.data.count),[337,118,100,82]);
 assert.deepEqual(parts.map(p=>p.data.triaged_proposals),[27,13,12,10]);
 for(const part of parts){
  const rows=part.data.entries;
  assert.equal(part.count,rows.length);
  assert.equal(part.triaged_proposals,rows.filter(x=>x.assessment.status==='provisional-single-category').length);
  assert.equal(part.pending,rows.filter(x=>x.assessment.status==='held-for-lexical-review').length);
 }
 const singleCards=[1,2,3,4].flatMap(i=>read(`shan-extra-single-proposals-${i}.json`).cards);
 assert.equal(singleCards.length,4359);
 const singleIds=new Set(singleCards.map(c=>c[0]));
 assert.ok(all.every(r=>!singleIds.has(r.parent_card_id)),'existing published provisional overlap');
 assert.equal(manifest.other_groups_unchanged.semicolon_boundary_held,983);
 assert.equal(manifest.other_groups_unchanged.no_supported_category_cue,5526);
});
