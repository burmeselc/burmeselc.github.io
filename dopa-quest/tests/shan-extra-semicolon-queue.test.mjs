import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const D=path.resolve('dopa-quest/data');
const load=name=>JSON.parse(fs.readFileSync(path.join(D,name),'utf8'));
const manifest=load('shan-extra-semicolon-review-manifest-v1.json');
const originals=[];
for(let b=1;b<=12;b++)for(const part of ['a','b']){
 const pathName=`shan-extra-semantic-review-${b}${part}.json`;
 for(const r of load(pathName))originals.push({...r,__file:'dopa-quest/data/'+pathName});
}
const expected=originals.filter(r=>r.review_status==='pending-sense-boundary');
const queues=manifest.shards.map(shard=>load(shard.file));
const all=queues.flatMap(q=>q.entries);
function diagnose(frags){
 const sets=frags.map(f=>new Set((f.category_candidates||[]).map(c=>c.medium)));
 if(!sets.every(s=>s.size>0))return 'cue-coverage-incomplete';
 const intersection=sets.reduce((a,b)=>new Set([...a].filter(x=>b.has(x))));
 return intersection.size?'shared-domain-cue-hypothesis':'disjoint-domain-cue-hypothesis';
}
test('All 983 semicolon-held parents and 2098 fragments preserved once, in rank order',()=>{
 assert.equal(originals.length,11505);
 assert.equal(expected.length,983);
 assert.equal(manifest.total_parent_records,983);
 assert.equal(manifest.total_candidate_fragments,2098);
 assert.equal(queues.reduce((n,q)=>n+q.fragments,0),2098);
 assert.deepEqual(queues.map(q=>q.count),[226,274,261,222]);
 assert.deepEqual(queues.map(q=>q.fragments),[485,575,556,482]);
 assert.equal(all.length,983);
 assert.equal(new Set(all.map(e=>e.parent_card_id)).size,983);
 assert.equal(new Set(all.map(e=>e.rank)).size,983);
 assert.deepEqual(all.map(e=>e.rank),[...all.map(e=>e.rank)].sort((a,b)=>a-b));
 assert.deepEqual(all.map(e=>e.parent_card_id).sort(),expected.map(e=>e.parent_card_id).sort());
});
test('No source or segmentation proposal mutated, no sense IDs introduced',()=>{
 const originalById=new Map(expected.map(r=>[r.parent_card_id,r]));
 let count=0;const stats={};
 for(const entry of all){
  const src=originalById.get(entry.parent_card_id);
  assert.ok(src);
  assert.equal(entry.rank,src.rank);
  assert.equal(entry.shan,src.shan);
  assert.equal(entry.source_gloss,src.source_gloss);
  assert.equal(entry.source_definition,src.source_definition??null);
  assert.equal(entry.pos_source,src.pos_source??null);
  assert.deepEqual(entry.source_record_ids,src.source_record_ids||[]);
  assert.equal(entry.source_review_file,src.__file);
  assert.deepEqual(entry.fragments,src.segmentation_candidates);
  assert.equal(entry.fragment_count,entry.fragments.length);
  assert.equal(entry.provisional_boundary_diagnostic,diagnose(entry.fragments));
  assert.equal(entry.editorial_review,'machine-proposal-unverified');
  assert.equal(entry.pos_candidate,null);
  assert.equal(entry.sense_id,null);
  assert.equal(entry.publishable_as_approved_sense,false);
  for(const f of entry.fragments){
   assert.equal(f.verified_sense_id,null);
   assert.equal(f.status,'segmentation-proposal-not-a-validated-sense');
  }
  count+=entry.fragments.length;
  stats[entry.provisional_boundary_diagnostic]=(stats[entry.provisional_boundary_diagnostic]||0)+1;
 }
 assert.equal(count,2098);
 assert.deepEqual(stats,manifest.diagnostic_counts);
 assert.deepEqual(stats,{'cue-coverage-incomplete':837,'disjoint-domain-cue-hypothesis':82,'shared-domain-cue-hypothesis':64});
});
test('983 held parents do not overlap either of 4,359 and 572 provisional UI releases',()=>{
 const single=new Set([1,2,3,4].flatMap(i=>load(`shan-extra-single-proposals-${i}.json`).cards.map(x=>x[0])));
 const multi=new Set(load('shan-extra-multiple-proposals-1.json').cards.map(x=>x[0]));
 assert.equal(single.size,4359);
 assert.equal(multi.size,572);
 for(const e of all){
  assert.ok(!single.has(e.parent_card_id));
  assert.ok(!multi.has(e.parent_card_id));
 }
});
