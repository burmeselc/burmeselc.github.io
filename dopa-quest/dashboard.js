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
  // Exactly one top-level view must be visible. Settings content is nested
  // inside dopaSettings; hide its ancestor rather than the inner sync panel.
  for(const id of ['dopaDashboard','dopaSettings','setup','profile','vocabPanel','flashcardPanel','result']){
   const show=target==='home'?id==='dopaDashboard':
    target==='settings'?id==='dopaSettings':
    target==='quest'?id==='setup'||id==='profile':
    false;
   $(id)?.classList.toggle('hidden',!show);
  }
  // Cloud/sound panel is now inside settings. Do not hide it separately.
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
  document.body.classList.add('dopa-modern-mode');
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
  // The card/library panels are launched after the quest layout is reset.
  // Reflect the actual destination, never the temporary quest route.
  nav.querySelectorAll('[data-dopa-route]').forEach(button=>{
   if(button.dataset.dopaRoute===target)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  });
  if(scroll)root.scrollTo?.({top:0,behavior:'instant'});
 }
 function initialize(){
  const p=snapshot();
  if(!p)return;
  nav.querySelectorAll('[data-dopa-route]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.dopaRoute)));
  $('flashExit')?.addEventListener('click',()=>{if(route==='cards'){route='quest';visibility('quest')}});
  $('vocabExit')?.addEventListener('click',()=>{if(route==='library'){route='quest';visibility('quest')}});
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
  // Preserve the initial classic setup for all existing bookmark links and regressions.
  // New dashboard is available immediately from the fixed Home tab.
  nav.querySelector('[data-dopa-route="quest"]')?.setAttribute('aria-current','page');
  render();
 }
 root.addEventListener('dopa-game-ready',initialize,{once:true});
 root.addEventListener('dopa-profile-restored',()=>{
  // Restore may replace all counters. Never reconstruct missing historical daily records.
  if(route==='home')render();
 });
 root.DOPA_DASHBOARD={go,render,dueCount};
})(window);
