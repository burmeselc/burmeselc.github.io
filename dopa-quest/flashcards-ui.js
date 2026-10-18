/* DOPA QUEST four-rating flashcard UI; loaded after game.js. */
(function(root){
 'use strict';
 const engine=root.DOPA_FLASH_ENGINE,api=root.DOPA_SYNC_API;
 const $=id=>document.getElementById(id);
 if(!engine||!api?.flashcardContext||!$('flashOpen'))return;
 const panels={setup:$('setup'),profile:$('profile'),game:$('game'),result:$('result'),
  flash:$('flashcardPanel'),config:$('flashConfig'),stage:$('flashStage'),
  finished:$('flashFinished')};
 let session=null,flipped=false,current=null,ratingsLocked=false,returnToVocabulary=false;
 // Device-only UI preferences. Never write these controls into SRS or cloud profiles.
 const PREF_KEY='dopa-card-ui-prefs-v1';
 function readPrefs(){
  try{const p=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');return p&&typeof p==='object'?p:{}}catch{return {}}
 }
 function savePrefs(){
  try{localStorage.setItem(PREF_KEY,JSON.stringify({
   scope:$('flashScope').value,direction:$('flashDirection').value,
   collection:$('flashCollection').value,count:$('flashCount').value
  }))}catch(e){console.warn('Flashcard UI preferences unavailable',e)}
 }
 function selectIfAvailable(id,value){
  const el=$(id);
  if(typeof value==='string'&&[...el.options].some(option=>option.value===value))el.value=value;
 }
 const original=(x,lang)=>String(lang==='shan'?x.shan:lang==='thai'?x.thai:x.burmese||'');
 const japanese=x=>String(x.japanese_core||x.japanese||x.english||'');
 const makeOptions=()=>{
  const context=api.flashcardContext(),direction=$('flashDirection').value,
   scope=$('flashScope').value,now=Date.now(),f=context.flashcards;
  const daily=f.daily.day===engine.dayKey(now)?f.daily:{newCount:0,reviewCount:0};
  const collection=$('flashCollection').value,ids=collection==='filtered'?null:
   new Set(root.DOPA_VOCAB_LIBRARY.idsFor(context.vocabularyLibrary,collection));
  return {...context,direction,scope,now,collection,
   pool:ids?context.allDeck.filter(x=>ids.has(x.id)):context.pool,
   limit:Number($('flashCount').value),
   newRemaining:Math.max(0,Number(f.settings.newPerDay)-daily.newCount),
   reviewRemaining:Math.max(0,Number(f.settings.reviewPerDay)-daily.reviewCount)};
 };
 function refreshCollections(choice='filtered'){
  const library=api.flashcardContext().vocabularyLibrary;
  const items=Object.entries(library.books);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const select=$('flashCollection');
  select.innerHTML='<option value="filtered">学習画面の絞込み（従来どほり）</option>'+
   '<option value="bookmarks">ブックマーク（'+library.bookmarks.length+'）</option>'+
   items.map(([id,b])=>'<option value="'+esc('book:'+id)+'">'+esc(b.name)+'（'+b.cards.length+'）</option>').join('');
  select.value=[...select.options].some(x=>x.value===choice)?choice:'filtered';
 }
 function candidates(){
  const o=makeOptions();
  return engine.select({...o,cards:o.flashcards.cards});
 }
 function updateAvailability(){
  if(panels.flash.classList.contains('hidden')||!panels.config.classList.contains('hidden'))return;
  try{
   const o=makeOptions(),c=engine.select({...o,cards:o.flashcards.cards});
   const lang=o.lang==='shan'?'シャン語':o.lang==='thai'?'タイ語':'ビルマ語';
   $('flashContextLabel').textContent=lang+' ／ '+(o.collection==='filtered'?
     $('zone').selectedOptions[0]?.textContent+' ／ '+$('semanticCategory').selectedOptions[0]?.textContent:
     $('flashCollection').selectedOptions[0]?.textContent+'（保存した語のみ）');
   $('flashAvailability').textContent='今回出題できるカード '+c.length+'枚'+
    '・本日の新規残 '+o.newRemaining+'・長期復習残 '+o.reviewRemaining+
    (o.scope==='weak'?'。期限到来の苦手語を優先し、期限前のカードは自主練習として扱ひます。':'。')+
    (o.direction==='production'?'複数の原語に同じ日本語義があるカードは逆引きから除外します。':'');
   $('flashStart').disabled=c.length===0;
  }catch(e){$('flashAvailability').textContent='カードの選択条件を確認できません。';$('flashStart').disabled=true;console.error(e)}
 }
 function showConfig(){
  document.body.classList.remove('dopa-flash-playing');
  session=null;current=null;flipped=false;ratingsLocked=false;
  panels.config.classList.remove('hidden');
  panels.stage.classList.add('hidden');
  panels.finished.classList.add('hidden');
  updateAvailability();
 }
 function open(options={}){
  if(!panels.game.classList.contains('hidden'))return;
  returnToVocabulary=options.fromLibrary===true;
  if(root.DOPA_VOCAB_UI&&returnToVocabulary)$('vocabPanel').classList.add('hidden');
  panels.setup.classList.add('hidden');panels.profile.classList.add('hidden');
  panels.result.classList.add('hidden');panels.flash.classList.remove('hidden');
  const f=api.flashcardContext().flashcards,prefs=readPrefs();
  $('flashDirection').value=f.settings.defaultDirection;
  selectIfAvailable('flashDirection',prefs.direction);
  $('flashNewLimit').value=String(f.settings.newPerDay);
  $('flashReviewLimit').value=String(f.settings.reviewPerDay);
  $('flashScope').value='due';
  selectIfAvailable('flashScope',prefs.scope);
  selectIfAvailable('flashCount',prefs.count);
  refreshCollections(options.collection||prefs.collection||'filtered');
  showConfig();
  if(!candidates().length&&$('flashScope').value==='due'){$('flashScope').value='new';updateAvailability()}
  panels.flash.scrollIntoView({block:'start'});
 }
 function exit(){
  document.body.classList.remove('dopa-flash-playing');
  session=null;current=null;
  panels.flash.classList.add('hidden');panels.stage.classList.add('hidden');
  if(returnToVocabulary&&root.DOPA_VOCAB_UI){
   returnToVocabulary=false;root.DOPA_VOCAB_UI.resume();
  }else{
   returnToVocabulary=false;
   panels.setup.classList.remove('hidden');panels.profile.classList.remove('hidden');
  }
 }
 function renderCard(){
  if(!current||!session)return;
  const front=session.direction==='recognition'?(session.lang==='thai'&&$('thaiReading')?.value==='roman'?current.romanization_draft:original(current,session.lang)):japanese(current);
  const back=session.direction==='recognition'?japanese(current):original(current,session.lang);
  $('flashFaceHint').textContent=flipped?'解答':'問題';
  $('flashFaceWord').textContent=flipped?back:front;
  $('flashFaceWord').lang=(flipped?(session.direction==='production'):(session.direction==='recognition'))
   ?(session.lang==='shan'?'shn':session.lang==='thai'?'th':'my'):'ja';
  $('flashFaceWord').classList.toggle('jp',flipped?(session.direction==='recognition'):(session.direction==='production'));
  const extra=[session.lang==='thai'&&$('thaiReading')?.value!=='thai'?current.romanization_draft:'',current.game_pos||current.pos||'',current.japanese_note||'',
   current.english&&current.english!==japanese(current)?current.english:''].filter(Boolean);
  const provisional=session.lang==='shan'?root.DOPA_DETAIL?.annotation(current,'shan'):null;
  if(flipped&&provisional?.provisional_only){
   if(provisional.review_status==='held-sense-boundary')extra.push('〔意味境界の確認保留・語義未承認〕');
   else if(provisional.review_status==='held-category-repair')extra.push('〔分類修正の確認保留・未検証〕');
   else if(provisional.review_status==='uncategorized-needs-review')extra.push('〔分類根拠なし・原典確認待ち〕');
   else if(provisional.boundary_unverified)extra.push(provisional.medium?
     '〔語義境界未検証・カテゴリ暫定〕':'〔語義境界未検証・未分類〕');
   else extra.push('〔機械分類・未検証〕');
  }
  $('flashFaceNote').textContent=flipped?extra.join(' ／ '):'';
  $('flashFaceNote').classList.toggle('hidden',!flipped||!extra.length);
  $('flashFaceTip').textContent=flipped?'タップして問題に戻す':'タップして答へを見る';
  $('flashReveal').classList.toggle('hidden',flipped);
  $('flashRatings').classList.toggle('hidden',!flipped);
  // The note entry lives outside the flip button and never advances SRS grading.
  $('flashEditorialOpen').classList.toggle('hidden',!flipped||session.lang!=='shan'||!root.DOPA_EDITORIAL_UI?.open);
  if(flipped)for(const btn of $('flashRatings').querySelectorAll('button')){
   const state=engine.entry(api.flashcardContext().flashcards.cards,current.id,session.direction);
   btn.querySelector('span').textContent=engine.labelDue(state,btn.dataset.flashRating);
  }
 }
 function flip(){
  if(!current||ratingsLocked)return;
  flipped=!flipped;
  renderCard();
 }
 function next(){
  if(!session)return;
  if(session.index>=session.queue.length){finish();return}
  current=session.queue[session.index];flipped=false;ratingsLocked=false;
  $('flashCounter').textContent=(session.index+1)+' / '+session.queue.length;
  $('flashSessionStatus').textContent=(session.direction==='recognition'?'原語 → 日本語':'日本語 → 原語');
  $('flashSessionBar').style.width=(session.index/session.queue.length*100)+'%';
  renderCard();
 }
 function finish(){
  document.body.classList.remove('dopa-flash-playing');
  if(!session)return;
  const n=session.rated,s=session;
  session=null;current=null;
  panels.stage.classList.add('hidden');panels.finished.classList.remove('hidden');
  $('flashResultText').textContent=n+'回答を記録しました。'+
   '「忘れた」'+(s.counts.again||0)+'・「難しい」'+(s.counts.hard||0)+
   '・「覚えた」'+(s.counts.good||0)+'・「簡単」'+(s.counts.easy||0)+
   '。復習期限を迎へたカードは再度学べます。';
 }
 function start(){
  const newLimit=Number($('flashNewLimit').value),reviewLimit=Number($('flashReviewLimit').value);
  try{api.flashcardSettings(newLimit,reviewLimit)}
  catch(e){$('flashAvailability').textContent='1日の上限は新規0～500、長期復習0～2000の整数で指定して下さい。';return}
  const options=makeOptions(),queue=engine.select({...options,cards:options.flashcards.cards});
  if(!queue.length){updateAvailability();return}
  session={queue,index:0,rated:0,counts:{},lang:options.lang,direction:options.direction};
  panels.config.classList.add('hidden');panels.finished.classList.add('hidden');
  panels.stage.classList.remove('hidden');
  document.body.classList.add('dopa-flash-playing');
  next();
 }
 function rate(rating){
  if(!session||!current||!flipped||ratingsLocked||!engine.RATINGS.includes(rating))return;
  ratingsLocked=true;
  try{
   const result=api.flashcardRate(current.id,session.direction,rating);
   if(!result||!Number.isFinite(result.dueAt))throw Error('Flashcard state not saved');
   session.rated++;session.counts[rating]=(session.counts[rating]||0)+1;
   session.index++;
   // A newly scheduled short-step card may reappear only after its due time;
   // never award an immediate repeat. Other cards remain interleaved.
   if(session.index>=session.queue.length&&session.rated<100){
    const f=api.flashcardContext().flashcards,now=Date.now(),last=current.id;
    const repeats=session.queue.filter(x=>x.id!==last).filter(x=>{
     const s=engine.entry(f.cards,x.id,session.direction);
     return s&&['learning','relearning'].includes(s.state)&&engine.isDue(s,now);
    });
    if(repeats.length)session.queue.push(...repeats.slice(0,10));
   }
   next();
  }catch(e){ratingsLocked=false;console.error(e);$('flashSessionStatus').textContent='保存に失敗しました。再試行して下さい。'}
 }
 $('flashOpen').addEventListener('click',open);
 $('flashExit').addEventListener('click',exit);
 $('flashAgain').addEventListener('click',showConfig);
 $('flashStart').addEventListener('click',start);
 $('flashFace').addEventListener('click',flip);
 $('flashReveal').addEventListener('click',flip);
 $('flashEditorialOpen').addEventListener('click',()=>{
  if(!session||!current||!flipped||session.lang!=='shan')return;
  root.DOPA_EDITORIAL_UI?.open?.(current);
 });
 $('flashRatings').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>rate(btn.dataset.flashRating)));
 ['flashScope','flashDirection','flashCount','flashNewLimit','flashReviewLimit','flashCollection'].forEach(id=>
  $(id).addEventListener('change',()=>{
   if(['flashScope','flashDirection','flashCount','flashCollection'].includes(id))savePrefs();
   updateAvailability();
  }));
 root.addEventListener('dopa-profile-restored',()=>{
  // Cloud/LOAD can restore while Home or Settings is open. Calling exit()
  // unconditionally makes the legacy quest setup visible on top of those views.
  if(!panels.flash.classList.contains('hidden')){
   returnToVocabulary=false;
   exit();
  }
  const f=api.flashcardContext().flashcards;
  $('flashNewLimit').value=String(f.settings.newPerDay);
  $('flashReviewLimit').value=String(f.settings.reviewPerDay)});
 root.DOPA_FLASH_UI={open,exit,showConfig};
})(window);
