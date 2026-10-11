import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const html=read('index.html'),game=read('game.js'),flash=read('flashcards-ui.js'),sw=read('service-worker.js');
test('v6.3 is a display release, not a persisted data migration',()=>{
 assert.match(html,/<title>DOPA QUEST v6\.3/);
 assert.match(html,/<h1>DOPA QUEST v6\.3<\/h1>/);
 assert.match(sw,/v6-3-editorial-links/);
 assert.match(game,/const KEY='dopaQuestV5_profile'/);
 assert.match(read('editorial-notes.js'),/dopa_shan_editorial_notes_v1/);
 assert.match(html,/editorial-notes-ui\.js/);
});
test('the same sidecar editor is linked from Shan flash backs and answered quests only',()=>{
 assert.match(html,/id="flashEditorialOpen"/);
 assert.match(flash,/!flipped\|\|session\.lang!=='shan'/);
 assert.match(flash,/DOPA_EDITORIAL_UI\?\.open\?\.\(current\)/);
 assert.match(game,/questEditorialOpen/);
 assert.match(game,/S\.cur\?\.answered/);
 assert.match(game,/clearTimeout\(nextTimeout\);nextTimeout=null/);
 assert.match(game,/mountQuestContinue\(\)/);
 assert.doesNotMatch(flash,/DOPA_EDITORIAL_NOTES\.save/);
});
