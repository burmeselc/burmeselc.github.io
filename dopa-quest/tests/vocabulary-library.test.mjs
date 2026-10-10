import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),L=require('../vocabulary-library.js');
const allowed=new Set(['shn:1','shn:2','bur:1']);
test('legacy profile remains unchanged when saved collections are initialized',()=>{
 const words={'shn:1':{rec:3,prod:2,wrong:1}},flashcards:{version:1,cards:{'shn:1':{recognition:{state:'review',dueAt:1000}}}};
 const profile={words,flashcards,rivals:{abc:{confusions:2}}};
 const before=JSON.stringify({words,flashcards,rivals:profile.rivals});
 assert.deepEqual(L.ensure(profile),{version:1,bookmarks:[],books:{}});
 assert.equal(JSON.stringify({words:profile.words,flashcards:profile.flashcards,rivals:profile.rivals}),before);
 assert.deepEqual(L.ensure(profile).bookmarks,[]);
});
test('create, edit, remove wordbook by stable ID; bookmark independent and reversible',()=>{
 const p={words:{'shn:1':{rec:5}},vocabularyLibrary:null};
 let a=L.apply(p,'bookmark',{id:'shn:1'},allowed);
 assert.equal(a.added,true);
 assert.deepEqual(p.vocabularyLibrary.bookmarks,['shn:1']);
 assert.equal(L.apply(p,'bookmark',{id:'shn:1'},allowed).added,false);
 assert.deepEqual(p.vocabularyLibrary.bookmarks,[]);
 const book=L.apply(p,'create',{name:'  動詞   学習  '},allowed).id;
 assert.equal(p.vocabularyLibrary.books[book].name,'動詞 学習');
 assert.equal(L.apply(p,'book:'+book,{id:'shn:2'},allowed).added,true);
 assert.equal(L.apply(p,'book:'+book,{id:'bur:1'},allowed).added,true);
 assert.deepEqual(L.idsFor(p.vocabularyLibrary,'book:'+book),['shn:2','bur:1']);
 L.apply(p,'rename',{id:book,name:'研究 語彙'},allowed);
 assert.equal(p.vocabularyLibrary.books[book].name,'研究 語彙');
 L.apply(p,'delete',{id:book},allowed);
 assert.deepEqual(p.vocabularyLibrary.books,{});
 assert.equal(p.words['shn:1'].rec,5);
 assert.throws(()=>L.idsFor(p.vocabularyLibrary,'book:'+book),/Unknown wordbook/);
});
test('invalid card IDs, unknown books, and invalid names never create saved references',()=>{
 const p={};
 assert.throws(()=>L.apply(p,'bookmark',{id:'shn:deleted'},allowed),/Unknown vocabulary card/);
 assert.throws(()=>L.apply(p,'create',{name:'  '},allowed),/name/);
 assert.throws(()=>L.apply(p,'create',{name:'<script>'},allowed),/name/);
 assert.throws(()=>L.apply(p,'book:not-there',{id:'shn:1'},allowed),/Unknown wordbook/);
 assert.deepEqual(p.vocabularyLibrary.bookmarks,[]);
 assert.deepEqual(p.vocabularyLibrary.books,{});
});
test('Japanese, source-script and English search honors Unicode normalization',()=>{
 const rows=[
  {id:'a',shan:'ၵိၼ်',japanese_core:'食べる',english:'eat'},
  {id:'b',shan:'ၼမ်ႉ',japanese_core:'水',english:'water'},
  {id:'c',shan:'မႄႈ',japanese_core:'母親',english:'mother'}
 ];
 assert.deepEqual(L.query(rows,'WATER','shan').map(x=>x.id),['b']);
 assert.deepEqual(L.query(rows,'母','shan').map(x=>x.id),['c']);
 assert.deepEqual(L.query(rows,'ၵိၼ်','shan').map(x=>x.id),['a']);
 assert.deepEqual(L.query(rows,'','shan'),rows);
});
