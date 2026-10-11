import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createStore,KEY}=require('../editorial-notes.js');
const card={id:'shn:anki:test',rank:12345,shan:'ၵိၼ်',japanese_core:'食べる'};
function fixture(){
 const entries=new Map(),storage={getItem:k=>entries.has(k)?entries.get(k):null,
  setItem:(k,v)=>entries.set(k,v)};
 return {entries,storage,api:createStore(storage,()=>1791800000000,()=>'unique')};
}
test('local notes preserve source snapshots and are isolated from progress',()=>{
 const {api,entries}=fixture();
 const n=api.save(card,{note_types:['translation-question','sense-split-suggestion'],
  reason:'要確認',proposal:'別義の可能性'});
 assert.equal(n.status,'open');assert.equal(n.parent_card_id,card.id);
 assert.equal(api.list(card.id).length,1);
 const updated=api.save({...card,shan:'changed',japanese_core:'changed'},
  {note_types:['other'],reason:'修正'},n.note_id);
 assert.equal(updated.shan_source,card.shan);
 assert.equal(updated.gloss_snapshot,card.japanese_core);
 assert.equal(updated.created_at,n.created_at);
 api.changeStatus(n.note_id,'withdrawn');
 assert.equal(api.list()[0].status,'withdrawn');
 assert.equal(JSON.parse(api.exportJSON()).notes.length,1);
 assert.match(api.exportCSV(),/withdrawn/);
 assert.equal(entries.size,1);assert.ok(entries.has(KEY));
});
test('bad input, corrupt storage, quota errors never destroy saved notes',()=>{
 const {api,entries,storage}=fixture();
 assert.throws(()=>api.save(card,{note_types:['wrong'],reason:'a'}),/種類/);
 assert.throws(()=>api.save(card,{note_types:['other'],reason:' '}),/記入/);
 const n=api.save(card,{note_types:['other'],reason:'確認'});
 assert.throws(()=>api.save({...card,id:'different'},
  {note_types:['other'],reason:'変更'},n.note_id),/別のカード/);
 const valid=entries.get(KEY);
 entries.set(KEY,'{broken');
 assert.throws(()=>api.save(card,{note_types:['other'],reason:'確認'}),/壊れて/);
 assert.equal(entries.get(KEY),'{broken');
 entries.set(KEY,valid);
 storage.setItem=()=>{throw Error('QuotaExceeded')};
 assert.throws(()=>api.save(card,{note_types:['other'],reason:'追加'}),/QuotaExceeded/);
 assert.equal(api.list().length,1);
});
test('CSV formula injection blocked',()=>{
 const {api}=fixture();
 api.save(card,{note_types:['other'],reason:'=HYPERLINK("x")'});
 assert.ok(api.exportCSV().includes("'=HYPERLINK"));
});
