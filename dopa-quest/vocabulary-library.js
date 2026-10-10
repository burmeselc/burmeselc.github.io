/* DOPA QUEST personal vocabulary collections. Immutable source cards; ID-only references. */
(function(root){
 'use strict';
 const MAX_BOOKS=50, MAX_CARDS=10000;
 function ensure(profile){
  if(!profile.vocabularyLibrary||typeof profile.vocabularyLibrary!=='object'||
     Array.isArray(profile.vocabularyLibrary))profile.vocabularyLibrary={};
  const lib=profile.vocabularyLibrary;
  lib.version=1;
  if(!Array.isArray(lib.bookmarks))lib.bookmarks=[];
  if(!lib.books||typeof lib.books!=='object'||Array.isArray(lib.books))lib.books={};
  return lib;
 }
 function requireId(id,allowed){
  if(typeof id!=='string'||!allowed?.has(id))throw Error('Unknown vocabulary card');
 }
 function cleanName(value){
  if(typeof value!=='string')throw Error('Invalid wordbook name');
  const name=value.trim().replace(/\s+/g,' ');
  if(!name||name.length>48||/[<>]/.test(name))throw Error('Wordbook name must be 1–48 characters');
  return name;
 }
 function book(lib,id){
  if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(lib.books,id)||
     !lib.books[id]||!Array.isArray(lib.books[id].cards))throw Error('Unknown wordbook');
  return lib.books[id];
 }
 function toggleList(array,id){
  const index=array.indexOf(id);
  if(index!==-1){array.splice(index,1);return false}
  if(array.length>=MAX_CARDS)throw Error('Wordbook has too many cards');
  array.push(id);return true;
 }
 function apply(profile,action,{id,name}={},allowed){
  const lib=ensure(profile);
  if(action==='create'){
   const display=cleanName(name);
   if(Object.keys(lib.books).length>=MAX_BOOKS)throw Error('Wordbook limit reached');
   let key='book-'+Date.now().toString(36),suffix=0;
   while(Object.prototype.hasOwnProperty.call(lib.books,key)){suffix++;key='book-'+Date.now().toString(36)+'-'+suffix}
   lib.books[key]={name:display,cards:[],createdAt:Date.now()};
   return {id:key,library:lib};
  }
  if(action==='rename'){
   book(lib,id).name=cleanName(name);return {id,library:lib};
  }
  if(action==='delete'){
   book(lib,id);delete lib.books[id];return {id,library:lib};
  }
  requireId(id,allowed);
  if(action==='bookmark')return {id,added:toggleList(lib.bookmarks,id),library:lib};
  if(action.startsWith('book:')){
   const key=action.slice(5);
   return {id,added:toggleList(book(lib,key).cards,id),library:lib};
  }
  throw Error('Unknown vocabulary library operation');
 }
 function idsFor(lib,key){
  if(key==='bookmarks')return Array.isArray(lib?.bookmarks)?lib.bookmarks:[];
  if(typeof key==='string'&&key.startsWith('book:'))return book(lib,key.slice(5)).cards;
  if(key==='filtered')return null;
  throw Error('Unknown vocabulary collection');
 }
 function query(records,text,lang){
  const term=String(text||'').normalize('NFKC').trim().toLocaleLowerCase();
  if(!term)return records;
  return records.filter(x=>[x[lang],x.japanese_core,x.japanese,x.english,x.japanese_note,x.game_pos,x.pos]
   .some(y=>String(y||'').normalize('NFKC').toLocaleLowerCase().includes(term)));
 }
 const api={ensure,apply,idsFor,query,cleanName};
 root.DOPA_VOCAB_LIBRARY=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
