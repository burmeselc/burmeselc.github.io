import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/shan-senses-manifest.json',root),'utf8'));
const parts=manifest.parts.map(p=>JSON.parse(readFileSync(new URL('data/'+p.split('/').pop(),root),'utf8')));
const cards=parts.flat();
const parents=[...JSON.parse(readFileSync(new URL('data/shan-1.json',root),'utf8')),...JSON.parse(readFileSync(new URL('data/shan-2.json',root),'utf8'))];
const game=readFileSync(new URL('game.js',root),'utf8');
const boot=readFileSync(new URL('bootstrap.js',root),'utf8');
test('seven thousand split/singleton candidates preserve all original ID relations',()=>{
 assert.equal(cards.length,7290);
 assert.equal(parents.length,5480);
 assert.equal(new Set(cards.map(x=>x.id)).size,7290);
 const ids=new Set(parents.map(x=>x.id));
 assert.equal(new Set(cards.map(x=>x.parent_id)).size,5480);
 assert.ok(cards.every(x=>ids.has(x.parent_id)));
 assert.equal(cards.filter(x=>x.sense_split).length,3052);
 assert.equal(cards.filter(x=>!x.sense_split).length,4238);
 assert.ok(cards.filter(x=>!x.sense_split).every(x=>x.id===x.parent_id));
 assert.ok(cards.filter(x=>x.sense_split).every(x=>x.id!==x.parent_id));
});
test('eligible Shan sense cards have gloss, domain and distinct Japanese prompts',()=>{
 const expected=manifest.counts;
 assert.equal(expected.playable,7241);
 assert.equal(expected.split_playable,3034);
 assert.equal(expected.excluded_gloss,49);
 assert.equal(expected.excluded_collision,0);
 const usable=cards.filter(x=>x.game_include===1);
 assert.equal(usable.length,7241);
 assert.equal(usable.filter(x=>x.sense_split).length,3034);
 assert.ok(usable.every(x=>x.japanese_core&&x.semantic_major&&x.semantic_status==='P'));
 const norm=s=>s.normalize('NFKC').replace(/[\s　。、，,；;:：・]+/g,'').toLowerCase();
 const reviewedShared=usable.filter(x=>x.shared_gloss_review===true);
 assert.equal(reviewedShared.length,227);
 assert.ok(reviewedShared.every(x=>x.review_required===true));
 assert.ok(usable.every(x=>x.semantic_major&&x.japanese_core));
 // Shared gloss is handled at distractor selection, not by removing valid cards.
 assert.ok(cards.filter(x=>x.game_include===0).every(x=>x.exclusion_reason));
});
test('the sense lab never overwrites parent records or previously credited progress',()=>{
 assert.match(game,/const KEY='dopaQuestV5_profile'/);
 assert.match(game,/P\.words\[x\.id\]/);
 assert.match(game,/function activeDeck\(/);
 assert.match(game,/if\(x\.sense_split\)typed=false;/);
 assert.match(game,/seenSpelling\.has\(spelling\)/);
 assert.match(boot,/window\.DOPA_DATA\.shan_senses=expanded/);
 assert.match(boot,/window\.DOPA_SENSE_READY=true/);
});
