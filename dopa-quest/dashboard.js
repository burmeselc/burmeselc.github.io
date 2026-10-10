/* DOPA QUEST dashboard routing. Keep game state and existing DOM IDs stable. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const ids=['dopaDashboard','dopaSettings','setup','profile','dopa-v6','flashcardPanel','vocabPanel','game','result'];
 const dashboard=$('dopaDashboard'),nav=$('dopaNav');
 if(!dashboard||!nav)return;
 let route='quest',settingsMoved=false;
 function snapshot(){return root.DOPA_SYNC_API?.snapshot?.()||null}
 function dueCount(p){
  const now=Date.now();let n=0;
  for(const directions of Object.values(p?.flashcards?.cards||{})){
   for(const state of Object.values(directions||{})){
    if(state&&Number.isFinite(state.dueAt)&&state.dueAt<=now)n++;
   }
  }
  return n;
 }
 function render(){
  const p=snapshot();if(!p)return;
  $('dashDue').textContent=dueCount(p).toLocaleString();
  $('dashXp').textContent=Math.max(0,Number(p.xp)||0).toLocaleString();
  $('dashSeen').textContent=Object.keys(p.words||{}).length.toLocaleString();
  $('dashStatus').textContent=dueCount(p)?
   '復習期限が到来した単語カードの課題があります。':
   '単語カードの復習待ちはありません。クエストや新規学習を選べます。';
 }
 function visibility(target){
  for(const id of ['dopaDashboard','dopaSettings','setup','profile','dopa-v6'])
   $(id)?.classList.toggle('hidden',target==='home'?id!=='dopaDashboard':
    target==='settings'?id!=='dopaSettings':
    target==='quest'?id==='dopaDashboard'||id==='dopaSettings':true);
  nav.querySelectorAll('[data-dopa-route]').forEach(b=>{
   if(b.dataset.dopaRoute===target)b.setAttribute('aria-current','page');
   else b.removeAttribute('aria-current');
  });
 }
 function moveSettings(){
  if(settingsMoved)return;settingsMoved=true;
  const account=$('dopa-v6'),sound=$('soundSettings');
  if(account)$('dopaAccountSlot').appendChild(account);
  if(sound)$('dopaSoundSlot').appendChild(sound);
  const backup=$('dopaBackupSlot');
  for(const id of ['backupBtn','loadBtn','soundBtn','loadFile']){
   const el=$(id);if(el)backup.appendChild(el);
  }
 }
 function go(target,{scroll=true}={}){
  if(!snapshot())return;
  if(!$('game').classList.contains('hidden'))return;
  if(target==='home'){
   moveSettings();visibility('home');route='home';render();
  }else if(target==='settings'){
   moveSettings();visibility('settings');route='settings';
  }else if(target==='quest'){
   visibility('quest');route='quest';
  }else if(target==='cards'){
   visibility('quest');route='cards';
   if(root.DOPA_FLASH_UI)root.DOPA_FLASH_UI.open();
  }else if(target==='library'){
   visibility('quest');route='library';
   if(root.DOPA_VOCAB_UI)root.DOPA_VOCAB_UI.open();
  }
  if(scroll)root.scrollTo?.({top:0,behavior:'instant'});
 }
 function initialize(){
  const p=snapshot();
  if(!p)return;
  nav.querySelectorAll('[data-dopa-route]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.dopaRoute)));
  $('dashQuest').addEventListener('click',()=>go('quest'));
  $('dashCards').addEventListener('click',()=>go('cards'));
  $('dashReview').addEventListener('click',()=>{
   go('cards');
   if(root.DOPA_FLASH_UI&&$('flashScope'))$('flashScope').value='due';
   $('flashScope')?.dispatchEvent(new Event('change'));
  });
  const header=$('soundBtn')?.closest('header');
  if(header){
   const button=document.createElement('button');button.type='button';button.className='pill';
   button.id='dopaSettingsOpen';button.textContent='⚙ 設定';
   header.appendChild(button);button.addEventListener('click',()=>go('settings'));
  }
  for(const p of ['game','flashcardPanel'])$(p)?.classList.add('dopa-play-viewport');
  // Legacy e2e tests start with a clean profile. Existing learners see the new home.
  const returning=Object.keys(p.words||{}).length>0||
   Object.keys(p.flashcards?.cards||{}).length>0||
   Object.keys(p.vocabularyLibrary?.books||{}).length>0||
   (p.vocabularyLibrary?.bookmarks?.length||0)>0;
  if(returning)go('home',{scroll:false});
  else go('quest',{scroll:false});
 }
 root.addEventListener('dopa-game-ready',initialize,{once:true});
 root.addEventListener('dopa-profile-restored',()=>{
  // Restore may replace all counters. Never reconstruct missing historical daily records.
  if(route==='home')render();
 });
 root.DOPA_DASHBOARD={go,render,dueCount};
})(window);
