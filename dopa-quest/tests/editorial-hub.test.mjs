import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createStore,KEY}=require('../editorial-notes.js');
const path='dopa-quest/';
const makeStorage=()=>{const m=new Map();return {
 getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),
 snapshot:()=>JSON.stringify([...m])
}};
const sample={id:'shn:anki:source-identity',rank:8123,shan:'ၵူၼ်း',japanese_core:'人'};
function store(storage){return createStore(storage,()=>1781260000000,()=>'safe')}
test('non-destructive JSON restore merges new IDs and leaves SRS entirely untouched',()=>{
 const original=makeStorage(),notes=store(original);
 original.setItem('dopaQuestV5_profile',JSON.stringify({xp:9,words:{stable:{dueAt:123}}}));
 notes.save(sample,{note_types:['translation-question'],reason:'訳語の確認'});
 const exported=notes.exportJSON(),src=JSON.parse(exported);
 assert.equal(src.schema,'dopa-shan-editorial-notes-export-v1');
 assert.equal(src.storage_key,KEY);
 assert.equal(src.notes.length,1);
 const target=makeStorage(),incoming=store(target);
 const before=target.snapshot();
 assert.deepEqual(incoming.importJSON(exported,{dryRun:true}),{added:1,existing:0,total:1});
 assert.equal(target.snapshot(),before);
 assert.deepEqual(incoming.importJSON(exported),{added:1,existing:0,total:1});
 assert.deepEqual(incoming.importJSON(exported),{added:0,existing:1,total:1});
 assert.equal(incoming.list()[0].shan_source,sample.shan);
 assert.equal(JSON.parse(original.getItem('dopaQuestV5_profile')).xp,9);
 assert.equal(target.getItem('dopaQuestV5_profile'),null);
});
test('corrupted, modified or conflicting note backups fail closed',()=>{
 const disk=makeStorage(),notes=store(disk);
 notes.save(sample,{note_types:['category-change-suggestion'],reason:'分類を確認する'});
 const backup=JSON.parse(notes.exportJSON()),before=disk.snapshot();
 const conflicting=structuredClone(backup);conflicting.notes[0].reason='different value';
 assert.throws(()=>notes.importJSON(JSON.stringify(conflicting)),/上書きしません/);
 assert.equal(disk.snapshot(),before);
 for(const change of [
  x=>{x.schema='wrong'},
  x=>{x.storage_key='dopaQuestV5_profile'},
  x=>{x.notes[0].note_types=['unknown']},
  x=>{x.notes[0].source_rank=-1},
  x=>{x.notes.push(structuredClone(x.notes[0]))},
  x=>{x.notes[0].note_id=''},
  x=>{x.notes[0].created_at='not a timestamp'}
 ]){
  const copy=structuredClone(backup);change(copy);
  assert.throws(()=>notes.importJSON(JSON.stringify(copy)));
  assert.equal(disk.snapshot(),before);
 }
 assert.throws(()=>notes.importJSON('{invalid json}'));
 assert.equal(disk.snapshot(),before);
});
test('editorial hub is separate from progress, with accessible entry and one-tap flags',()=>{
 const html=fs.readFileSync(path+'index.html','utf8');
 const hub=fs.readFileSync(path+'editorial-hub.js','utf8');
 const store=fs.readFileSync(path+'editorial-notes.js','utf8');
 const ui=fs.readFileSync(path+'editorial-notes-ui.js','utf8');
 const sw=fs.readFileSync(path+'service-worker.js','utf8');
 for(const k of ['editorialHubOpen','./editorial-hub.js'])assert.ok(html.includes(k));
 for(const k of ['hubSearch','hubType','hubStatus','hubList','hubJSON','hubCSV','hubImport','hubImportFile','machineFor','changeStatus'])assert.ok(hub.includes(k),k);
 for(const k of ['dopa-shan-editorial-notes-export-v1','importJSON'])assert.ok((store+hub).includes(k),k);
 for(const k of ['translation-question','category-change-suggestion','source-or-example-question'])assert.ok(ui.includes('data-flag="'+k+'"'));
 assert.ok(sw.includes('./editorial-hub.js'));
 assert.ok(!hub.includes('dopaQuestV5_profile'));
 assert.ok(!hub.includes('firebase.firestore'));
});
