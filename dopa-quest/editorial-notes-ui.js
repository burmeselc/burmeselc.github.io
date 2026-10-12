/* Optional Shan editorial notes editor. Never touches learning profiles or cloud sync. */
(function(root){
 'use strict';
 const store=root.DOPA_EDITORIAL_NOTES;
 if(!store?.save)return;
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels=[['translation-question','訳語・定義'],['sense-split-suggestion','語義分割'],
  ['category-change-suggestion','カテゴリ'],['tag-change-suggestion','タグ'],
  ['part-of-speech-question','品詞'],['source-or-example-question','原典・例文'],['other','その他']];
 const css=document.createElement('style');css.textContent=
 '#editorialOverlay{position:fixed;inset:0;z-index:3000;background:#000b;display:flex;align-items:flex-end;justify-content:center;padding:6px;overscroll-behavior:contain}'+
 '#editorialOverlay.hidden{display:none!important}.editorial-sheet{width:min(100%,700px);max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#10182c;color:white;border:1px solid #4c6180;border-radius:20px 20px 9px 9px;padding:15px 14px calc(14px + env(safe-area-inset-bottom))}'+
 '.editorial-sheet h2{font-size:17px;margin:0}.editorial-sheet h3{font-size:14px}.editorial-word{font:700 21px/1.9 "DopaPadauk",Padauk,sans-serif;overflow-wrap:anywhere;min-height:43px}'+
 '.editorial-sheet label{display:block;margin:7px 0;font-size:13px}.editorial-types{display:grid;grid-template-columns:1fr 1fr;gap:8px}.editorial-types label{margin:0;display:flex;align-items:center;gap:6px}'+
 '.editorial-sheet textarea,.editorial-sheet select{width:100%;border:1px solid #475f82;border-radius:9px;color:white;background:#090f20;padding:9px;font:inherit;font-size:14px}.editorial-sheet textarea{min-height:68px;resize:vertical}'+
 '.editorial-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.editorial-actions button,.editorial-note button{min-height:38px;border:1px solid #6180a2;border-radius:9px;background:#1c3855;color:white;padding:8px 11px}.editorial-note{font-size:12px;border-top:1px solid #34435c;padding:7px 0;overflow-wrap:anywhere}'+
 '@media(max-width:420px){.editorial-types{grid-template-columns:1fr}}';
 document.head.appendChild(css);
 const wrap=document.createElement('div');wrap.id='editorialOverlay';wrap.className='hidden';
 wrap.innerHTML='<section class="editorial-sheet" role="dialog" aria-modal="true" aria-labelledby="editorialTitle" tabindex="-1">'+
  '<div class="editorial-actions" style="align-items:center;justify-content:space-between"><h2 id="editorialTitle">シャン語校閲メモ</h2><button type="button" id="editorialClose">閉ぢる</button></div>'+
  '<div id="editorialWord" class="editorial-word"></div><p id="editorialGloss" class="small"></p>'+
  '<p class="small">個人用の未検証メモです。原辞書・学習成績・語義IDは変更しません。この端末にのみ保存されます。</p>'+
  '<div class="editorial-actions" id="editorialQuickFlags"><button type="button" data-flag="translation-question">訳に疑問</button><button type="button" data-flag="category-change-suggestion">分類がおかしい</button><button type="button" data-flag="source-or-example-question">後で調べる</button></div>'+
  '<form id="editorialForm"><div id="editorialTypes" class="editorial-types">'+
  labels.map(([v,label])=>'<label><input type="checkbox" value="'+v+'"> '+label+'</label>').join('')+
  '</div><label for="editorialProposal">疑義・修正案</label><textarea id="editorialProposal" maxlength="4000" placeholder="分類変更や訳語の対案"></textarea>'+
  '<label for="editorialReason">根拠・確認事項</label><textarea id="editorialReason" maxlength="4000" placeholder="辞書や文例と照合する点"></textarea>'+
  '<label for="editorialStatus">このメモの状態</label><select id="editorialStatus"><option value="open">未処理</option><option value="withdrawn">撤回</option><option value="addressed">個人確認済み</option></select>'+
  '<div class="editorial-actions"><button type="submit">メモを保存</button><button type="button" id="editorialNew">新しいメモ</button></div></form>'+
  '<p id="editorialMessage" class="small" role="status" aria-live="polite"></p>'+
  '<h3>この語の保存済みメモ</h3><div id="editorialExisting"></div>'+
  '<div class="editorial-actions"><button type="button" id="editorialJSON">全メモをJSON出力</button><button type="button" id="editorialCSV">全メモをCSV出力</button></div>'+
  '<p class="small">端末変更やストレージ消去の前にはエクスポートしてください。Firebase同期は未実装です。</p></section>';
 document.body.appendChild(wrap);
 let card=null,editing=null,previousFocus=null,previousOverflow='';
 function message(s){$('editorialMessage').textContent=s}
 function reset(){editing=null;$('editorialForm').reset();message('')}
 function list(){
  if(!card)return;
  try{
   const notes=store.list(card.parent_card_id||card.parent_id||card.id);
   $('editorialExisting').innerHTML=notes.map(n=>'<div class="editorial-note">'+
    '<div>'+esc(n.note_types.join('、'))+' ／ '+esc(n.status)+'</div><p>'+esc(n.reason||n.proposal)+'</p>'+
    '<button type="button" data-note-id="'+esc(n.note_id)+'">編集・撤回</button></div>').join('')||
    '<p class="small">保存済みメモはありません。</p>';
  }catch(e){message(e.message)}
 }
 function open(next){
  if(!next?.id||!next?.shan||!store?.save)return false;
  card=next;previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
  reset();$('editorialWord').textContent=next.shan;
  $('editorialGloss').textContent=String(next.japanese_core||next.japanese||next.english||'');
  wrap.classList.remove('hidden');document.body.style.overflow='hidden';
  list();$('editorialClose').focus();return true;
 }
 function close(){
  wrap.classList.add('hidden');document.body.style.overflow=previousOverflow;
  card=null;editing=null;previousFocus?.focus?.();
  root.DOPA_VOCAB_UI?.refresh?.();
 }
 $('editorialClose').addEventListener('click',close);
 wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrap.classList.contains('hidden')){e.preventDefault();close()}});
 $('editorialQuickFlags').addEventListener('click',e=>{
  const type=e.target.closest('button[data-flag]')?.dataset.flag;
  if(!type||!card)return;
  const reasons={
   'translation-question':'訳語・定義を再確認する',
   'category-change-suggestion':'意味カテゴリを再確認する',
   'source-or-example-question':'原典・用例を後で調べる'
  };
  if(!Object.hasOwn(reasons,type))return;
  try{
   const id=card.parent_card_id||card.parent_id||card.id;
   const found=store.list(id).find(x=>x.status==='open'&&x.note_types.length===1&&x.note_types[0]===type&&x.reason===reasons[type]&&!x.proposal);
   if(found){message('同じ未処理の疑義を既に記録してゐます。');return}
   store.save(card,{note_types:[type],reason:reasons[type],status:'open'});
   list();message('疑義を端末に記録しました。原語と学習履歴は変更してゐません。');
  }catch(err){message('記録できませんでした：'+err.message)}
 });
 $('editorialNew').addEventListener('click',reset);
 $('editorialExisting').addEventListener('click',e=>{
  const b=e.target.closest('button[data-note-id]');if(!b||!card)return;
  try{
   const n=store.list(card.parent_card_id||card.parent_id||card.id).find(x=>x.note_id===b.dataset.noteId);
   if(!n)return;
   reset();editing=n.note_id;
   for(const box of $('editorialTypes').querySelectorAll('input'))box.checked=n.note_types.includes(box.value);
   $('editorialProposal').value=n.proposal;$('editorialReason').value=n.reason;
   $('editorialStatus').value=n.status;message('メモを編集中。撤回は状態の変更から行へます。');
  }catch(err){message(err.message)}
 });
 $('editorialForm').addEventListener('submit',e=>{
  e.preventDefault();if(!card)return;
  try{
   store.save(card,{note_types:[...$('editorialTypes').querySelectorAll('input:checked')].map(x=>x.value),
    proposal:$('editorialProposal').value,reason:$('editorialReason').value,
    status:$('editorialStatus').value},editing);
   reset();list();message('端末に保存しました。');
  }catch(err){message('保存できませんでした：'+err.message)}
 });
 function exportFile(ext){
  try{
   const body=ext==='json'?store.exportJSON():store.exportCSV();
   const url=URL.createObjectURL(new Blob([body],{type:ext==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='dopa-shan-editorial-notes-'+new Date().toISOString().slice(0,10)+'.'+ext;
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);message('ファイル出力を開始しました。');
  }catch(err){message('出力できませんでした：'+err.message)}
 }
 $('editorialJSON').addEventListener('click',()=>exportFile('json'));
 $('editorialCSV').addEventListener('click',()=>exportFile('csv'));
 root.DOPA_EDITORIAL_UI={open,close};
})(window);
