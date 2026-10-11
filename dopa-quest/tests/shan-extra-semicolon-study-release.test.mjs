import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=name=>JSON.parse(fs.readFileSync('dopa-quest/data/'+name,'utf8'));
const {attach}=require('../shan-extra-provisional.js');
const qnames=['shan-extra-semicolon-queue-1-3.json','shan-extra-semicolon-queue-4-6.json',
 'shan-extra-semicolon-queue-7-9.json','shan-extra-semicolon-queue-10-12.json'];
const sourceQueue=qnames.flatMap(n=>read(n).entries);
const manifest=read('shan-extra-manifest-v1.json');
const source=manifest.packs.flatMap(p=>read(p.file));
const taxonomy=read('study-taxonomy-v1.json');
const delta=read('shan-extra-semicolon-study-release-v1.json');
const release=read('shan-extra-semicolon-study-release-manifest-v1.json');
const singles=[1,2,3,4].map(n=>read('shan-extra-single-proposals-'+n+'.json'));
const multi=read('shan-extra-multiple-proposals-1.json');
const final65=read('shan-extra-final65-proposals-v1.json');
const engine={taxonomy,mediums:new Map(taxonomy.categories.flatMap(c=>c.children.map(m=>[m.id,m]))),
 annotation:()=>null,majorFor:c=>c.semantic_major,matches:()=>true};
test('983 source preserved; 607 first-cue categories and 376 flagged without invented category',()=>{
 assert.deepEqual([source.length,sourceQueue.length,delta.cards.length],[11505,983,983]);
 assert.equal(delta.schema,'dopa-shan-extra-semicolon-study-release-v1');
 assert.equal(delta.status,'machine-proposal-unverified');assert.equal(delta.approved_senses,false);
 assert.equal(delta.sense_split_approved,false);
 assert.equal(release.category_candidate_assigned,607);
 assert.equal(release.not_enough_cue_uncategorized,376);
 assert.equal(release.approved_new_senses,0);
 assert.equal(release.total_annotated_after_release,5932);
 assert.equal(release.total_categorized_after_release,5556);
 const bySource=new Map(source.map(c=>[c.id,c]));
 const byQueue=new Map(sourceQueue.map(c=>[c.parent_card_id,c]));
 const existing=new Set([...singles.flatMap(c=>c.cards.map(r=>r[0])),
  ...multi.cards.map(r=>r[0]),...final65.cards.map(r=>r[0])]);
 assert.equal(new Set(delta.cards.map(c=>c[0])).size,983);
 let assigned=0;
 for(const [id,rank,shan,gloss,medium,tags] of delta.cards){
  const s=bySource.get(id),q=byQueue.get(id);
  assert.ok(s&&q);assert.ok(!existing.has(id));
  assert.equal(q.editorial_review,'machine-proposal-unverified');
  assert.equal(q.sense_id,null);assert.equal(q.publishable_as_approved_sense,false);
  assert.deepEqual([rank,shan,gloss],[s.rank,s.shan,s.japanese_core]);
  const first=q.fragments.flatMap(f=>f.category_candidates||[]).map(c=>c.medium)[0]||null;
  assert.equal(medium,first);if(medium!==null){assert.ok(engine.mediums.has(medium));assigned++}
  assert.deepEqual(tags,{semantic_type:[],feature:[],field:[],usage:[]});
 }
 assert.equal(assigned,607);
});
test('983 low-confidence annotations are reversible; fallbacks and collisions are strict',()=>{
 const before=JSON.stringify(source);
 const full=attach(engine,singles,{shan:source},multi,final65,delta);
 assert.equal(full.extraProvisional.count,5932);
 assert.equal(full.extraProvisional.categorized_count,5556);
 assert.equal(full.extraProvisional.semicolon_review_count,983);
 assert.equal(full.extraProvisional.semicolon_categorized_count,607);
 assert.equal(full.extraProvisional.semicolon_needs_category_count,376);
 const bySource=new Map(source.map(s=>[s.id,s]));
 for(const [id,,,,medium] of delta.cards){
  const s=bySource.get(id),a=full.annotation(s,'shan');
  assert.equal(a.medium,medium);
  assert.equal(a.review_status,'machine-proposal-unverified');
  assert.equal(a.boundary_unverified,true);
  assert.equal(a.classification_confidence,'low');
  assert.equal(full.majorFor(s,'shan'),medium?medium.slice(0,2):null);
  if(medium)assert.ok(full.matches(s,'shan',{medium}));
  else assert.equal(full.matches(s,'shan',{medium:'01.01'}),false);
 }
 assert.equal(JSON.stringify(source),before);
 assert.equal(attach(engine,singles,{shan:source},multi,final65).extraProvisional.count,4949);
 assert.equal(attach(engine,singles,{shan:source},multi).extraProvisional.count,4931);
 assert.equal(attach(engine,singles,{shan:source}).extraProvisional.count,4359);
 const stale=structuredClone(delta);stale.cards[0][3]+='変化';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,stale),/Stale semicolon/);
 const collision=structuredClone(delta);collision.cards[0][0]=final65.cards[0][0];
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,collision),/Stale semicolon/);
 const falseCategory=structuredClone(delta);falseCategory.cards[0][4]='99.99';
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,falseCategory),/Stale semicolon/);
 const invalid=structuredClone(delta);invalid.cards[0][5].usage=['not-real'];
 assert.throws(()=>attach(engine,singles,{shan:source},multi,final65,invalid),/Invalid semicolon tag/);
 assert.throws(()=>attach(engine,singles,{shan:source},null,final65,delta),/Invalid semicolon provisional shard/);
});
