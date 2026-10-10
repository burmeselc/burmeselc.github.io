/* Searchable vocabulary browser with saved bookmarks and custom study lists. */
(function(root){
 'use strict';
 const api=root.DOPA_SYNC_API,libAPI=root.DOPA_VOCAB_LIBRARY,$=id=>document.getElementById(id);
 if(!api?.vocabularyContext||!libAPI||!$('vocabOpen'))return;
 const panel=$('vocabPanel'),setup=$('setup'),profile=$('profile');
 let shown=40;
 const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function context(){return api.vocabularyContext()}
 function word(x,lang){return String(lang==='shan'?x.shan:x.burmese||'')}
 function gloss(x){return String(x.japanese_core||x.japanese||x.english||'')}
 function listOptions(){
  const {library}=context(),views=$('vocabView'),target=$('vocabTarget'),oldView=views.value,oldTarget=target.value;
  const books=Object.entries(library.books).sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
  views.innerHTML='<option value="all">すべて</option><option value="bookmarks">ブックマーク（'+library.bookmarks.length+'）</option>'+
   books.map(([id,x])=>'<option value="'+html('book:'+id)+'">'+html(x.name)+'（'+x.cards.length+'）</option>').join('');
  target.innerHTML='<option value="bookmarks">ブックマーク（'+library.bookmarks.length+'）</option>'+
   books.map(([id,x])=>'<option value="'+html('book:'+id)+'">'+html(x.name)+'（'+x.cards.length+'）</option>').join('');
  if([...views.options].some(x=>x.value===oldView))views.value=oldView;
  if([...target.options].some(x=>x.value===oldTarget))target.value=oldTarget;
  const custom=target.value.startsWith('book:');
  $('vocabRename').disabled=$('vocabDelete').disabled=!custom;
  const key=target.value;
  $('vocabStudy').textContent=key==='bookmarks'?'ブックマークを単語カードで学ぶ':'この単語帳を単語カードで学ぶ';
  $('vocabStudy').disabled=!libAPI.idsFor(library,key).length;
 }
 function results(){
  const {lang,pool,allDeck,library}=context(),scope=$('vocabScope').value,view=$('vocabView').value;
  let cards=scope==='filtered'?pool:allDeck;
  if(view!=='all'){
   const ids=new Set(libAPI.idsFor(library,view));
   cards=cards.filter(x=>ids.has(x.id));
  }
  cards=libAPI.query(cards,$('vocabSearch').value,lang);
  return {cards,lang,library};
 }
 function refresh(){
  if(panel.classList.contains('hidden'))return;
  listOptions();
  const {cards,lang,library}=results(),target=$('vocabTarget').value;
  const bookmarks=new Set(library.bookmarks),active=new Set(libAPI.idsFor(library,target));
  const targetLabel=target==='bookmarks'?'ブックマーク':'選択中の単語帳';
  $('vocabContext').textContent=(lang==='shan'?'シャン語':'ビルマ語')+
   (lang==='shan'&&$('shanSenseMode')?.checked?'・語義別カード':'・親カード')+
   ' ／ '+($('vocabScope').value==='filtered'?'現在の学習フィルタ':'全デッキ');
  $('vocabStatus').textContent=cards.length+'件見つかりました（'+Math.min(shown,cards.length)+'件表示）。'+
   'ブックマーク'+bookmarks.size+'件・'+targetLabel+active.size+'件。'+
   '「学習対象外」と表示された語は一覧に残りますが、単語カードには出題されません。';
  const detail=root.DOPA_DETAIL;
  $('vocabList').innerHTML=cards.slice(0,shown).map(x=>{
   const a=detail?.annotation(x,lang);
   const category=a?detail.mediums.get(a.medium)?.label:'';
   const status=String(x.game_include??'1')==='0'?'学習対象外':'';
   const original=word(x,lang),jp=gloss(x),saved=bookmarks.has(x.id),member=active.has(x.id);
   const attrs='data-id="'+html(x.id)+'"';
   return '<div class="vocab-row"><div class="vocab-main"><div class="vocab-word">'+html(original)+'</div>'+
    '<div class="vocab-gloss">'+html(jp)+'</div><div class="vocab-meta">'+
    html([x.game_pos||x.pos||'',category||x.semantic_major&&('領域 '+x.semantic_major)||'未分類',status].filter(Boolean).join(' ／ '))+
    (x.english?'<div>'+html(x.english)+'</div>':'')+'</div></div>'+
    '<div class="vocab-row-actions"><button type="button" data-action="bookmark" '+attrs+
    ' class="'+(saved?'vocab-marked':'')+'" aria-pressed="'+saved+'">'+(saved?'★ 保存':'☆ 保存')+'</button>'+
    (target==='bookmarks'?'':'<button type="button" data-action="target" '+attrs+
    ' class="'+(member?'vocab-marked':'')+'" aria-pressed="'+member+'">'+(member?'登録済':'＋ 登録')+'</button>')+
    '</div></div>';
  }).join('')||'<p class="vocab-status">該当する語はありません。検索条件や語義別設定を確認してください。</p>';
  $('vocabMore').classList.toggle('hidden',shown>=cards.length);
  $('vocabMore').textContent='さらに表示（残り'+Math.max(0,cards.length-shown)+'件）';
 }
 function open(){
  if(!$('game').classList.contains('hidden')||!$('flashcardPanel').classList.contains('hidden'))return;
  setup.classList.add('hidden');profile.classList.add('hidden');
  $('result').classList.add('hidden');panel.classList.remove('hidden');
  shown=40;refresh();panel.scrollIntoView({block:'start'});
 }
 function exit(){
  panel.classList.add('hidden');
  setup.classList.remove('hidden');profile.classList.remove('hidden');
 }
 function resume(){
  panel.classList.remove('hidden');
  setup.classList.add('hidden');profile.classList.add('hidden');
  refresh();panel.scrollIntoView({block:'start'});
 }
 function message(e){$('vocabStatus').textContent=e.message||String(e)}
 $('vocabOpen').addEventListener('click',open);
 $('vocabExit').addEventListener('click',exit);
 $('vocabSearch').addEventListener('input',()=>{shown=40;refresh()});
 for(const id of ['vocabScope','vocabView','vocabTarget'])$(id).addEventListener('change',()=>{shown=40;refresh()});
 $('vocabMore').addEventListener('click',()=>{shown+=40;refresh()});
 $('vocabList').addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  try{
   const action=button.dataset.action==='bookmark'?'bookmark':$('vocabTarget').value;
   api.vocabularyAction(action,{id:button.dataset.id});
   refresh();
  }catch(err){message(err)}
 });
 $('vocabCreate').addEventListener('click',()=>{
  try{
   const out=api.vocabularyAction('create',{name:$('vocabBookName').value});
   $('vocabBookName').value='';listOptions();
   $('vocabTarget').value='book:'+out.id;
   $('vocabView').value='all';refresh();
  }catch(err){message(err)}
 });
 $('vocabRename').addEventListener('click',()=>{
  try{
   const key=$('vocabTarget').value;
   if(!key.startsWith('book:'))return;
   api.vocabularyAction('rename',{id:key.slice(5),name:$('vocabBookName').value});
   $('vocabBookName').value='';refresh();
  }catch(err){message(err)}
 });
 $('vocabDelete').addEventListener('click',()=>{
  const key=$('vocabTarget').value;if(!key.startsWith('book:'))return;
  const state=context().library,book=state.books[key.slice(5)];
  if(!book||!confirm('単語帳「'+book.name+'」を削除しますか？ 元のカードと学習履歴は残ります。'))return;
  try{api.vocabularyAction('delete',{id:key.slice(5)});$('vocabTarget').value='bookmarks';$('vocabView').value='all';refresh()}
  catch(err){message(err)}
 });
 $('vocabStudy').addEventListener('click',()=>{
  const target=$('vocabView').value!=='all'?$('vocabView').value:$('vocabTarget').value;
  try{
   if(!libAPI.idsFor(context().library,target).length)return;
   panel.classList.add('hidden');
   root.DOPA_FLASH_UI.open({collection:target,fromLibrary:true});
  }catch(err){panel.classList.remove('hidden');message(err)}
 });
 root.addEventListener('dopa-profile-restored',()=>{panel.classList.add('hidden');shown=40});
 root.DOPA_VOCAB_UI={open,exit,resume,refresh};
})(window);
