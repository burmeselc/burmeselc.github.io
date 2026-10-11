/* DOPA QUEST: local-only editorial management hub; source and SRS are read-only. */
(function(root){
 'use strict';
 const notes=root.DOPA_EDITORIAL_NOTES;
 const button=document.getElementById('editorialHubOpen');
 if(!button||!notes?.list)return;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const TYPES=[
  ['all','全種類'],['translation-question','訳語・定義'],['sense-split-suggestion','語義分割'],
  ['category-change-suggestion','カテゴリ'],['tag-change-suggestion','タグ'],
  ['part-of-speech-question','品詞'],['source-or-example-question','原典・例文'],['other','その他']
 ];
 const STATUS=[['all','全状態'],['open','未処理'],['addressed','個人確認済み'],['withdrawn','撤回']];
 const template=(items)=>items.map(([v,n])=>'<option value="'+esc(v)+'">'+esc(n)+'</option>').join('');
 const styles=document.createElement('style');
 styles.textContent=
  '#editorialHub{position:fixed;inset:0;z-index:2900;background:#020714d9;display:flex;align-items:center;justify-content:center;padding:8px;overscroll-behavior:contain}'+
  '#editorialHub.hidden{display:none!important}.editorial-hub-sheet{width:min(100%,850px);max-height:96dvh;overflow:auto;background:#101b30;color:#e8f7ff;border:1px solid #546c88;border-radius:18px;padding:14px;overscroll-behavior:contain}'+
  '.editorial-hub-sheet h2{margin:0;font-size:19px}.editorial-hub-sheet p{font-size:12px;line-height:1.6}'+
  '.editorial-hub-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.editorial-hub-toolbar>*{flex:1 1 155px;min-width:0}'+
  '.editorial-hub-sheet input,.editorial-hub-sheet select{min-height:42px;width:100%;color:#fff;background:#091224;border:1px solid #5c7490;border-radius:9px;padding:7px;font:inherit;font-size:13px}'+
  '.editorial-hub-actions{display:flex;gap:7px;flex-wrap:wrap}.editorial-hub-actions button,.editorial-hub-sheet .hub-btn{background:#1b3854;color:#e7f6ff;border:1px solid #5b7895;border-radius:9px;min-height:40px;padding:8px 10px;font-size:12px}'+
  '.editorial-hub-entry{border-top:1px solid #35445a;padding:12px 0}.editorial-hub-word{font:700 19px/1.8 "DopaPadauk",Padauk,sans-serif;overflow-wrap:anywhere}'+
  '.editorial-hub-detail{color:#b8cbe1;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.editorial-hub-tag{color:#9fe0ee;font-size:11px}'+
  '@media(max-width:450px){.editorial-hub-sheet{padding:10px}.editorial-hub-toolbar>*{flex:1 1 135px}}';
 document.head.appendChild(styles);
 const wrapper=document.createElement('div');wrapper.id='editorialHub';wrapper.className='hidden';
 wrapper.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="editorialHubTitle" class="editorial-hub-sheet" tabindex="-1">'+
  '<div class="editorial-hub-actions" style="justify-content:space-between;align-items:center"><h2 id="editorialHubTitle">校閲メモ管理</h2><button type="button" id="hubClose">閉ぢる</button></div>'+
  '<p>個人用の未検証メモです。機械提案と対案は別表示し、原語・元の訳・カードID・学習履歴は変更しません。保存先はこの端末です。</p>'+
  '<div class="editorial-hub-toolbar"><input id="hubSearch" type="search" placeholder="原語・訳・メモ・ID・根拠を全文検索" aria-label="校閲メモを全文検索">'+
  '<select id="hubType" aria-label="メモ種類">'+template(TYPES)+'</select><select id="hubStatus" aria-label="メモ状態">'+template(STATUS)+'</select></div>'+
  '<p id="hubCount" role="status" aria-live="polite"></p><div id="hubList"></div>'+
  '<div class="editorial-hub-actions"><button type="button" id="hubMore">さらに表示</button>'+
  '<button type="button" id="hubJSON">JSON出力</button><button type="button" id="hubCSV">CSV出力</button>'+
  '<button type="button" id="hubImport">JSONから安全に復元</button><input type="file" id="hubImportFile" accept=".json,application/json" hidden></div>'+
  '<p id="hubMessage" role="status" aria-live="polite"></p>'+
  '<p>バックアップ復元では同一IDの異なるメモを上書きせず、衝突があれば全件取込みを取り消します。Firebaseとのメモ同期はまだありません。</p></section>';
 document.body.appendChild(wrapper);
 const $=id=>document.getElementById(id);
 let previousFocus=null,previousOverflow='',limit=50;
 function cardFor(n){
  return (root.DOPA_DATA?.shan||[]).find(c=>c.id===n.parent_card_id)||
   {id:n.parent_card_id,shan:n.shan_source,japanese_core:n.gloss_snapshot,rank:n.source_rank};
 }
 function machineFor(n){
  const d=root.DOPA_DETAIL,c=cardFor(n),a=d?.annotation?.(c,'shan');
  if(!a)return '分類情報なし';
  if(a.medium)return (d.mediums?.get(a.medium)?.label||a.medium)+'（'+a.medium+'／'+(a.classification_confidence||'未検証')+'）';
  return a.hold_reason?'保留：'+a.hold_reason:'根拠不足・未分類';
 }
 function rows(){
  const q=$('hubSearch').value.trim().toLocaleLowerCase(),type=$('hubType').value,status=$('hubStatus').value;
  return notes.list().filter(n=>(type==='all'||n.note_types.includes(type))&&
    (status==='all'||n.status===status)&&
    (!q||[n.note_id,n.parent_card_id,n.shan_source,n.gloss_snapshot,n.proposal,n.reason,machineFor(n)].some(x=>String(x??'').toLocaleLowerCase().includes(q))));
 }
 function render(){
  try{
   const all=rows();
   $('hubCount').textContent=all.length+'件（全メモ '+notes.list().length+'件）／表示 '+Math.min(limit,all.length)+'件';
   $('hubList').innerHTML=all.slice(0,limit).map(n=>{
    const type=n.note_types.map(t=>TYPES.find(x=>x[0]===t)?.[1]||t).join('・');
    const state=STATUS.find(s=>s[0]===n.status)?.[1]||n.status;
    return '<article class="editorial-hub-entry" data-note="'+esc(n.note_id)+'">'+
     '<div class="editorial-hub-word">'+esc(n.shan_source)+'</div>'+
     '<div class="editorial-hub-detail">'+esc(n.gloss_snapshot)+'</div>'+
     '<div class="editorial-hub-tag">'+esc(type)+' ／ '+esc(state)+' ／ '+esc(n.updated_at.slice(0,10))+'</div>'+
     '<p><b>機械分類：</b>'+esc(machineFor(n))+'</p>'+
     '<p><b>個人の対案：</b>'+esc(n.proposal||'未記入')+'</p>'+
     '<p><b>疑義・根拠：</b>'+esc(n.reason||'未記入')+'</p>'+
     '<div class="editorial-hub-actions"><button type="button" data-act="open">カード・メモを開く</button>'+
     '<button type="button" data-act="library">単語帳で探す</button>'+
     (n.status!=='addressed'?'<button type="button" data-act="addressed">確認済みにする</button>':'')+
     (n.status!=='open'?'<button type="button" data-act="open-status">未処理へ戻す</button>':'')+
     (n.status!=='withdrawn'?'<button type="button" data-act="withdrawn">撤回</button>':'')+'</div></article>';
   }).join('')||'<p>条件に合ふ校閲メモはありません。</p>';
   $('hubMore').hidden=limit>=all.length;
  }catch(e){$('hubMessage').textContent='校閲メモを読めません：'+e.message}
 }
 function open(){
  previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
  limit=50;wrapper.classList.remove('hidden');document.body.style.overflow='hidden';
  $('hubMessage').textContent='';render();$('hubClose').focus();
 }
 function close(){
  wrapper.classList.add('hidden');document.body.style.overflow=previousOverflow;
  previousFocus?.focus?.();root.DOPA_VOCAB_UI?.refresh?.();
 }
 button.addEventListener('click',open);
 $('hubClose').addEventListener('click',close);
 wrapper.addEventListener('click',e=>{if(e.target===wrapper)close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrapper.classList.contains('hidden')){e.preventDefault();close()}});
 for(const id of ['hubSearch','hubType','hubStatus'])$(id).addEventListener(id==='hubSearch'?'input':'change',()=>{limit=50;render()});
 $('hubMore').addEventListener('click',()=>{limit+=50;render()});
 $('hubList').addEventListener('click',e=>{
  const button=e.target.closest('button[data-act]'),entry=button?.closest('[data-note]');
  if(!entry)return;
  try{
   const n=notes.list().find(x=>x.note_id===entry.dataset.note),c=n&&cardFor(n);
   if(!n)return;
   const action=button.dataset.act;
   if(['addressed','withdrawn','open-status'].includes(action)){
    notes.changeStatus(n.note_id,action==='open-status'?'open':action);
    render();$('hubMessage').textContent='端末内の校閲状態を更新しました。';return;
   }
   close();
   if(action==='open'){root.DOPA_EDITORIAL_UI?.open?.(c);return}
   if(action==='library'){
    const lang=$('lang');if(lang){lang.value='shan';lang.dispatchEvent(new Event('change',{bubbles:true}))}
    document.querySelector('[data-dopa-route="library"]')?.click();
    const scope=$('vocabScope'),search=$('vocabSearch');
    if(scope){scope.value='all';scope.dispatchEvent(new Event('change',{bubbles:true}))}
    if(search){search.value=n.shan_source;search.dispatchEvent(new Event('input',{bubbles:true}))}
   }
  }catch(err){$('hubMessage').textContent='操作できませんでした：'+err.message}
 });
 function download(extension){
  try{
   const content=extension==='json'?notes.exportJSON():notes.exportCSV();
   const url=URL.createObjectURL(new Blob([content],{type:extension==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='dopa-shan-editorial-notes-'+new Date().toISOString().slice(0,10)+'.'+extension;
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
   $('hubMessage').textContent='校閲メモを書き出しました（学習データとは別です）。';
  }catch(e){$('hubMessage').textContent=e.message}
 }
 $('hubJSON').addEventListener('click',()=>download('json'));
 $('hubCSV').addEventListener('click',()=>download('csv'));
 $('hubImport').addEventListener('click',()=>$('hubImportFile').click());
 $('hubImportFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
   if(f.size>20000000)throw Error('ファイルが大きすぎます');
   const data=await f.text(),preview=notes.importJSON(data,{dryRun:true});
   if(!confirm('校閲メモ '+preview.added+'件を追加します。同じIDのメモは上書きしません。続けますか？'))return;
   const imported=notes.importJSON(data);
   $('hubMessage').textContent=imported.added+'件を安全に追加しました（既存 '+imported.existing+'件）。';
   render();
  }catch(err){$('hubMessage').textContent='復元できません：'+err.message}
  finally{e.target.value=''}
 });
 root.DOPA_EDITORIAL_HUB={open,close,refresh:render};
})(window);
