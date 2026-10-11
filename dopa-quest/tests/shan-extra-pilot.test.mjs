import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const path=name=>new URL('../data/'+name,import.meta.url);
const get=name=>JSON.parse(readFileSync(path(name),'utf8'));
const original=[...get('shan-1.json'),...get('shan-2.json')];
const pilot=get('shan-extra-pilot-1.json');
const pack2=get('shan-extra-pack-2.json');
const pack3=get('shan-extra-pack-3.json');
const pack4=get('shan-extra-pack-4.json');
const pack5=get('shan-extra-pack-5.json');
const manifest=get('shan-extra-manifest-v1.json');
const originalIds=new Set(original.map(x=>x.id));
const originalForms=new Set(original.map(x=>x.shan.normalize('NFC')));

function validatePack(pack,startRank){
 const seenIds=new Set(),seenForms=new Set();
 for(const [i,c] of pack.entries()){
  assert.match(c.id,/^shn:anki:[0-9a-f]{16}$/);
  assert.ok(!originalIds.has(c.id));
  assert.ok(!originalForms.has(c.shan.normalize('NFC')));
  assert.ok(!seenIds.has(c.id));
  assert.ok(!seenForms.has(c.shan));
  seenIds.add(c.id);seenForms.add(c.shan);
  assert.ok(c.shan&&c.shan===c.shan.normalize('NFC'));
  assert.ok(c.japanese_core?.length>=2&&c.japanese_core?.length<=80);
  assert.ok(Number.isSafeInteger(c.source_serial)&&c.source_serial>=1&&c.source_serial<=19637);
  assert.equal(c.rank,startRank+i);
  assert.equal(c.source_file,'anki_shan_jpn.csv');
  assert.equal(c.review_status,'source-gloss-pilot');
  assert.equal(c.semantic_status,'U');
  assert.equal(c.game_include,1);
 }
}

test('original 5,480 parents and pilot 1,000 IDs remain unchanged',()=>{
 assert.equal(original.length,5480);
 assert.equal(pilot.length,1000);
 validatePack(pilot,5481);
});

test('second 2,000-word pack has deterministic new IDs, valid source provenance, and no collisions',()=>{
 assert.equal(pack2.length,2000);
 validatePack(pack2,6481);
 const oldIds=new Set(pilot.map(x=>x.id));
 const oldForms=new Set(pilot.map(x=>x.shan));
 const rows=new Set();
 for(const c of pack2){
  assert.ok(!oldIds.has(c.id),'old card IDs must be immutable and disjoint');
  assert.ok(!oldForms.has(c.shan),'no duplicate new headwords across packs');
  assert.equal(c.id,'shn:anki:'+createHash('sha256').update('dopa-shan-extra-v2\x00'+c.shan,'utf8').digest('hex').slice(0,16));
  assert.ok(Number.isInteger(c.source_row)&&c.source_row>0&&c.source_row<=19637);
  assert.ok(!rows.has(c.source_row),'source lines are unique provenance keys');
  rows.add(c.source_row);
  assert.ok(c.source_definition?.length>2);
  assert.ok(c.game_pos?.length>0);
  assert.ok(!/[A-Za-z一-鿿]/.test(c.shan),'Roman-letter contamination in Shan source form');
  assert.ok(!/\[\[|\[[A-Za-z][^\]]*\]/.test(c.japanese_core),'broken English residue in Japanese glossary');
 }
 assert.ok(Math.min(...pack2.map(x=>x.source_row))<100);
 assert.ok(Math.max(...pack2.map(x=>x.source_row))>19500);
});

test('third 2,500-word source-gloss pack uses stable noncolliding IDs and original provenance',()=>{
 assert.equal(pack3.length,2500);
 validatePack(pack3,8481);
 const priorIds=new Set([...pilot,...pack2].map(x=>x.id));
 const priorForms=new Set([...pilot,...pack2].map(x=>x.shan));
 const rows=new Set();
 for(const c of pack3){
  assert.ok(!priorIds.has(c.id),'published card IDs must not be overwritten');
  assert.ok(!priorForms.has(c.shan),'no duplicate additional Shan headwords');
  assert.equal(c.id,'shn:anki:'+createHash('sha256')
   .update('dopa-shan-extra-v2\x00'+c.shan,'utf8').digest('hex').slice(0,16));
  assert.ok(Number.isInteger(c.source_row)&&c.source_row>0&&c.source_row<=19637);
  assert.ok(!rows.has(c.source_row),'source lines must remain unique');
  rows.add(c.source_row);
  assert.ok(c.source_definition?.length>2);
  assert.ok(c.game_pos?.length>0);
  assert.ok(!/[A-Za-z一-鿿]/.test(c.shan));
  assert.ok(!/\[\[|\[[A-Za-z][^\]]*\]/.test(c.japanese_core));
 }
 assert.ok(Math.min(...pack3.map(x=>x.source_row))<100);
 assert.ok(Math.max(...pack3.map(x=>x.source_row))>19500);
 assert.equal(new Set([...original,...pilot,...pack2,...pack3].map(x=>x.id)).size,10980);
});

test('fourth pack adds 2,500 traceable, stable-ID and noncolliding Shan headwords',()=>{
 assert.equal(pack4.length,2500);
 validatePack(pack4,10981);
 const prev=[...pilot,...pack2,...pack3];
 const oldIds=new Set(prev.map(x=>x.id));
 const oldForms=new Set(prev.map(x=>x.shan));
 const rows=new Set();
 for(const c of pack4){
  assert.ok(!oldIds.has(c.id),'old card IDs are immutable');
  assert.ok(!oldForms.has(c.shan),'no previously published headword can be reused');
  assert.equal(c.id,'shn:anki:'+createHash('sha256')
   .update('dopa-shan-extra-v2\x00'+c.shan,'utf8').digest('hex').slice(0,16));
  assert.ok(Number.isInteger(c.source_row)&&c.source_row>0&&c.source_row<=19637);
  assert.ok(!rows.has(c.source_row));
  rows.add(c.source_row);
  assert.ok(c.source_definition?.length>2);
  assert.ok(c.game_pos?.length>0);
  assert.ok(!/[A-Za-z一-鿿]/.test(c.shan));
  assert.ok(!/\[\[|\[[A-Za-z][^\]]*\]/.test(c.japanese_core));
 }
 assert.ok(Math.min(...pack4.map(x=>x.source_row))<100);
 assert.ok(Math.max(...pack4.map(x=>x.source_row))>19500);
 assert.equal(new Set([...original,...prev,...pack4].map(x=>x.id)).size,13480);
});

test('fifth pack adds 2,500 traceable new Shan forms without overwriting old IDs',()=>{
 assert.equal(pack5.length,2500);
 validatePack(pack5,13481);
 const prev=[...pilot,...pack2,...pack3,...pack4];
 const priorIds=new Set(prev.map(x=>x.id));
 const priorForms=new Set(prev.map(x=>x.shan));
 const sourceRows=new Set();
 for(const c of pack5){
  assert.ok(!priorIds.has(c.id),'published cards must retain prior IDs');
  assert.ok(!priorForms.has(c.shan),'published headwords cannot recur');
  assert.equal(c.id,'shn:anki:'+createHash('sha256')
   .update('dopa-shan-extra-v2\x00'+c.shan,'utf8').digest('hex').slice(0,16));
  assert.ok(Number.isInteger(c.source_row)&&c.source_row>0&&c.source_row<=19637);
  assert.ok(!sourceRows.has(c.source_row));
  sourceRows.add(c.source_row);
  assert.ok(c.source_definition?.length>2);
  assert.ok(c.game_pos?.length>0);
  assert.ok(!/[A-Za-z一-鿿]/.test(c.shan));
  assert.ok(!/\[\[|\[[A-Za-z][^\]]*\]/.test(c.japanese_core));
 }
 assert.ok(Math.min(...pack5.map(x=>x.source_row))<100);
 assert.ok(Math.max(...pack5.map(x=>x.source_row))>19500);
 assert.equal(new Set([...original,...prev,...pack5].map(x=>x.id)).size,15980);
});

test('manifest references independently validated optional packs and checks published bytes',()=>{
 assert.equal(manifest.schema,'dopa-shan-extra-packs-v1');
 assert.equal(manifest.base_parent_count,5480);
 assert.deepEqual(manifest.packs.map(p=>[p.file,p.expected_count,p.start_rank,p.end_rank]),[
  ['shan-extra-pilot-1.json',1000,5481,6480],
  ['shan-extra-pack-2.json',2000,6481,8480],
  ['shan-extra-pack-3.json',2500,8481,10980],
  ['shan-extra-pack-4.json',2500,10981,13480],
  ['shan-extra-pack-5.json',2500,13481,15980]
 ]);
 const checksum=createHash('sha256').update(readFileSync(path('shan-extra-pack-2.json'))).digest('hex');
 assert.equal(checksum,manifest.packs[1].pack_sha256);
 const thirdChecksum=createHash('sha256').update(readFileSync(path('shan-extra-pack-3.json'))).digest('hex');
 assert.equal(thirdChecksum,manifest.packs[2].pack_sha256);
 const fourthChecksum=createHash('sha256').update(readFileSync(path('shan-extra-pack-4.json'))).digest('hex');
 assert.equal(fourthChecksum,manifest.packs[3].pack_sha256);
 const fifthChecksum=createHash('sha256').update(readFileSync(path('shan-extra-pack-5.json'))).digest('hex');
 assert.equal(fifthChecksum,manifest.packs[4].pack_sha256);
 assert.equal(manifest.packs[4].source_sha256,manifest.packs[3].source_sha256);
 assert.equal(manifest.packs[3].source_sha256,manifest.packs[2].source_sha256);
 assert.equal(manifest.packs[2].source_sha256,manifest.packs[1].source_sha256);
 assert.equal(manifest.packs[1].source_sha256,'1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7');
});

test('sense inventory, categories, user progress, and offline shell remain independent of new packs',()=>{
 const sense=get('shan-senses-manifest.json');
 assert.equal(sense.parent_count,5480);
 assert.equal(sense.candidate_count,7290);
 assert.equal(sense.counts.playable,7241);
 assert.equal(Object.keys(get('shan-categories-v1.json').cards).length,5480);
 const bootstrap=readFileSync(new URL('../bootstrap.js',import.meta.url),'utf8');
 assert.ok(bootstrap.indexOf("loadSemantic('./data/shan-categories-v1.json'") <
           bootstrap.indexOf("fetch('./data/shan-extra-manifest-v1.json'"));
 assert.match(bootstrap,/window\.DOPA_EXTRA_READY=window\.DOPA_EXTRA_COUNT>0/);
 assert.match(bootstrap,/DOPA_EXTRA_PACK_STATUS/);
 assert.match(bootstrap,/for\(const pack of extraManifest\.packs\)/);
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/\['extra','追加語彙（試験版）',5481/);
 const sw=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/shan-extra-pilot-1\.json/);
 assert.match(sw,/shan-extra-pack-2\.json/);
 assert.match(sw,/shan-extra-pack-3\.json/);
 assert.match(sw,/shan-extra-pack-4\.json/);
 assert.match(sw,/shan-extra-pack-5\.json/);
 assert.match(sw,/shan-extra-manifest-v1\.json/);
 assert.match(sw,/OPTIONAL_PACKS\.map\(path=>cache\.add\(path\)\.catch/);
 assert.match(sw,/learning-stats\.js/);
});

test('sampled four-choice alternatives in both directions never collide by Japanese gloss',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const a=source.indexOf('function glossParts('),b=source.indexOf('function zones(',a);
 const c=source.indexOf('function distractors('),d=source.indexOf('function beep(',c);
 assert.ok(a>=0&&b>a&&c>=0&&d>c);
 const helpers=source.slice(a,b)+source.slice(c,d);
 const exec=new Function('pool','targets',`
 const jp=x=>x.japanese_core||x.japanese||x.english||'';
 const orig=(x,l)=>l==='shan'?x.shan:x.burmese;
 const shuffle=x=>x;
 const rivalsFor=()=>[];
 const byId={};
 ${helpers}
 let checked=0;
 for(const x of targets){
   for(const dir of ['toJP','fromJP']){
     const options=distractors(x,pool,'shan',dir);
     if(options.length!==3)throw Error('fewer than three distractors for '+x.id);
     if(options.some(y=>glossOverlap(x,y)))throw Error('gloss collision at '+x.id);
     const label=y=>dir==='toJP'?jp(y):orig(y,'shan');
     if(new Set(options.map(label)).size!==3)throw Error('repeated answer label for '+x.id);
     checked++;
   }
 }
 return checked;
 `);
 const all=[...original,...pilot,...pack2,...pack3,...pack4,...pack5];
 const sampled=[...pilot.filter((_,i)=>i%35===0),...pack2.filter((_,i)=>i%35===0),...pack3.filter((_,i)=>i%35===0),...pack4.filter((_,i)=>i%35===0),...pack5.filter((_,i)=>i%35===0)];
 assert.equal(exec(all,sampled),sampled.length*2);
});
