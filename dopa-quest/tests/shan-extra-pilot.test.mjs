import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const parents=[...get('shan-1.json'),...get('shan-2.json')];
const pack=get('shan-extra-pilot-1.json');
const identities=new Set(parents.map(x=>x.id));
const spellings=new Set(parents.map(x=>x.shan.normalize('NFC')));

test('the pilot adds 1,000 distinct headwords without changing or replacing original Shan IDs',()=>{
 assert.equal(parents.length,5480);
 assert.equal(pack.length,1000);
 assert.equal(new Set(pack.map(x=>x.id)).size,1000);
 assert.equal(new Set(pack.map(x=>x.shan)).size,1000);
 assert.ok(pack.every((x,i)=>x.rank===5481+i));
 for(const c of pack){
  assert.match(c.id,/^shn:anki:[0-9a-f]{16}$/);
  assert.ok(!identities.has(c.id));
  assert.ok(!spellings.has(c.shan.normalize('NFC')));
  assert.ok(c.shan&&c.shan===c.shan.normalize('NFC'));
  assert.ok(c.japanese_core?.length>=2&&c.japanese_core?.length<=80);
  assert.ok(c.source_serial>=1&&c.source_serial<=19637);
  assert.equal(c.source_file,'anki_shan_jpn.csv');
  assert.equal(c.review_status,'source-gloss-pilot');
  assert.equal(c.semantic_status,'U','extra words must not inherit unrelated 18-domain tags');
  assert.equal(c.game_include,1);
 }
});

test('the original sense inventory, category sidecars, and baseline counts remain unchanged',()=>{
 const manifest=get('shan-senses-manifest.json');
 assert.equal(manifest.parent_count,5480);
 assert.equal(manifest.candidate_count,7290);
 assert.equal(manifest.counts.playable,7241);
 assert.equal(Object.keys(get('shan-categories-v1.json').cards).length,5480);
 const bootstrap=readFileSync(new URL('../bootstrap.js',import.meta.url),'utf8');
 assert.ok(bootstrap.indexOf("loadSemantic('./data/shan-categories-v1.json'") <
           bootstrap.indexOf("fetch('./data/shan-extra-pilot-1.json'"));
 assert.match(bootstrap,/window\.DOPA_EXTRA_READY=true/);
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/\['extra','追加語彙（試験版）',5481/);
 const sw=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/shan-extra-pilot-1\.json/);
 assert.match(sw,/learning-stats\.js/);
});
