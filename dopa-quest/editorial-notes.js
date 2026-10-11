/* Isolated local-only Shan editorial queue. Not part of learning or Firebase profiles. */
(function(root){
 'use strict';
 const KEY='dopa_shan_editorial_notes_v1';
 const TYPES=['translation-question','sense-split-suggestion','category-change-suggestion','tag-change-suggestion','part-of-speech-question','source-or-example-question','other'];
 const STATUSES=['open','withdrawn','addressed'];
 const str=(v,max)=>String(v??'').trim().slice(0,max);
 function csvCell(v){
  let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 }
 function createStore(storage,clock=()=>Date.now(),random=()=>Math.random().toString(36).slice(2)){
  if(!storage?.getItem||!storage?.setItem)throw Error('Storage unavailable');
  function read(){
   const raw=storage.getItem(KEY);
   if(raw===null)return [];
   let data;
   try{data=JSON.parse(raw)}catch{throw Error('保存データが壊れてゐます。上書きしません')}
   if(data?.version!==1||!Array.isArray(data.notes)||data.notes.length>50000||
      data.notes.some(n=>!n||typeof n.note_id!=='string'||typeof n.parent_card_id!=='string'))
    throw Error('不正な校閲データです。上書きしません');
   return data.notes;
  }
  function write(notes){storage.setItem(KEY,JSON.stringify({version:1,notes}))}
  function list(id=null){return read().filter(n=>id===null||n.parent_card_id===id)
    .sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))}
  function save(card,input={},noteId=null){
   const notes=read(),old=noteId===null?null:notes.find(n=>n.note_id===noteId);
   if(noteId!==null&&!old)throw Error('編集するメモがありません');
   const id=str(card?.parent_card_id||card?.parent_id||card?.id,256),shan=str(card?.shan,300),rank=Number(card?.rank);
   if(!id||!shan||!Number.isInteger(rank)||rank<1)throw Error('シャン語カードを選んでください');
   if(old&&old.parent_card_id!==id)throw Error('別のカードのメモです');
   const types=[...new Set(Array.isArray(input.note_types)?input.note_types:[])],
    proposal=str(input.proposal,4000),reason=str(input.reason,4000),status=input.status||'open';
   if(!types.length||types.some(t=>!TYPES.includes(t)))throw Error('校閲の種類を選択してください');
   if(!reason&&!proposal)throw Error('疑義または対案を記入してください');
   if(!STATUSES.includes(status))throw Error('無効な状態です');
   if(!old&&notes.length>=50000)throw Error('件数の上限です');
   const at=new Date(clock()).toISOString();
   const entry={note_id:old?.note_id||'editorial-'+clock().toString(36)+'-'+random(),
    parent_card_id:old?.parent_card_id||id,source_rank:old?.source_rank||rank,
    shan_source:old?.shan_source||shan,
    gloss_snapshot:old?.gloss_snapshot??str(card.japanese_core||card.japanese||card.english,2000),
    note_types:types,proposal,reason,created_at:old?.created_at||at,updated_at:at,status};
   if(!old&&notes.some(n=>n.note_id===entry.note_id))throw Error('重複メモID');
   if(old)notes[notes.indexOf(old)]=entry;else notes.push(entry);
   write(notes);return entry;
  }
  function changeStatus(noteId,status){
   if(!STATUSES.includes(status))throw Error('無効な状態です');
   const notes=read(),i=notes.findIndex(n=>n.note_id===noteId);
   if(i<0)throw Error('メモが見つかりません');
   notes[i]={...notes[i],status,updated_at:new Date(clock()).toISOString()};
   write(notes);return notes[i];
  }
  const headers=['note_id','parent_card_id','source_rank','shan_source','gloss_snapshot','note_types',
   'proposal','reason','created_at','updated_at','status'];
  function exportJSON(){return JSON.stringify({schema:'dopa-shan-editorial-notes-export-v1',
   storage_key:KEY,exported_at:new Date(clock()).toISOString(),notes:list()},null,2)+'\n'}
  function exportCSV(){return [headers.map(csvCell).join(','),...list().map(n=>headers.map(k=>csvCell(
   k==='note_types'?n.note_types.join('|'):n[k])).join(','))].join('\r\n')+'\r\n'}
  return {key:KEY,types:TYPES,statuses:STATUSES,list,save,changeStatus,exportJSON,exportCSV};
 }
 const api={KEY,TYPES,STATUSES,createStore};
 try{if(root.localStorage)Object.assign(api,createStore(root.localStorage))}
 catch(e){if(root.console)root.console.warn('Editorial notes unavailable',e)}
 root.DOPA_EDITORIAL_NOTES=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
