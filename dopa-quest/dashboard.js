/* DOPA QUEST dashboard routing. Keep game state and existing DOM IDs stable. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const ids=['dopaDashboard','dopaSettings','setup','profile','dopa-v6','flashcardPanel','vocabPanel','game','result'];
 const dashboard=$('dopaDashboard'),nav=$('dopaNav');
 if(!dashboard||!nav)return;
 let route='home',settingsMoved=false,statDays=7;
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
 function renderInsights(p){
  const engine=root.DOPA_STATS;
  if(!engine)return;
  const data=engine.range(p,statDays),memory=engine.mastery(p);
  $('statsTotal').textContent=(data.quest+data.cards).toLocaleString();
  $('statsAttempts').textContent='クエスト '+data.quest.toLocaleString()+' ・ カード '+data.cards.toLocaleString();
  $('statsDistinct').textContent=data.distinct.toLocaleString();
  $('statsRemembered').textContent=data.remembered.toLocaleString();
  $('statsActiveDays').textContent=data.activeDays+'日';
  $('statsActiveCaption').textContent='対象 '+data.days+'日間';
  const chart=$('statsBars');chart.replaceChildren();
  chart.dataset.days=String(statDays);
  const max=Math.max(1,...data.rows.map(row=>row.quest+row.cards));
  for(const [i,day] of data.rows.entries()){
   const cell=document.createElement('div');cell.className='dopa-stat-day';
   const stack=document.createElement('div');stack.className='dopa-stat-stack';
   const quest=document.createElement('i'),card=document.createElement('i');
   quest.className='quest';card.className='card';
   quest.style.height=(day.quest/max*100)+'%';
   card.style.height=(day.cards/max*100)+'%';
   stack.append(quest,card);
   const label=document.createElement('span');
   label.textContent=statDays===7?day.date.slice(5).replace('-','/'):
    (i%5===0||i===statDays-1?day.date.slice(5).replace('-','/'):'·');
   cell.title=day.date+'：クエスト'+day.quest+'問／カード'+day.cards+'件／異なる語'+day.distinct+'語';
   cell.append(stack,label);chart.appendChild(cell);
  }
  chart.setAttribute('aria-label',statDays+'日間の日別回答・評価数。'+
   data.rows.map(d=>d.date+' 四択'+d.quest+'回 カード'+d.cards+'件').join('、'));
  if(statDays===30)chart.scrollLeft=chart.scrollWidth;
  const accuracy=data.accuracy===null?'保存済みの回答ログがありません':
   '四択の正答率 '+data.accuracy+'%（この期間の保存ログ '+data.accuracyCount+'回答）';
  $('statsAccuracy').textContent=accuracy+
   '。クエストは初回答のみを集計し、カードの自己評価を正答率には含めません。'+
   (data.limitedLog?' 四択のログは最新最大1,000件に限られます。':'');
  $('statsStudied').textContent=memory.studied.toLocaleString();
  $('statsMastered').textContent=memory.mastered.toLocaleString();
  $('statsNemesis').textContent=memory.nemesis.toLocaleString();
  $('statsFlashReview').textContent=memory.flash.review.toLocaleString();
  const grades=$('statsMastery');grades.replaceChildren();
  for(const [n,name] of ['SEEN','KNOWN','SOLID','MASTERED'].entries()){
   const cell=document.createElement('div');
   const title=document.createElement('span');title.textContent=name;
   const count=document.createElement('b');count.textContent=memory.levels[n+1].toLocaleString();
   cell.append(title,count);grades.appendChild(cell);
  }
  const domainRows=$('statsDomainRows');domainRows.replaceChildren();
  const groups=engine.domains(p,root.DOPA_DATA,
   root.DOPA_SEMANTIC_LABELS_BY_LANG,root.DOPA_DETAIL);
  if(!groups.length){
   const note=document.createElement('p');note.className='dopa-stat-note';
   note.textContent='分類済みの語に学習記録がないため、まだ表示する領域はありません。';
   domainRows.appendChild(note);
  }
  for(const group of groups){
   const row=document.createElement('div');row.className='dopa-domain-row';
   const title=document.createElement('span');
   title.textContent=(group.lang==='shan'?'シャン語':'ビルマ語')+'・'+group.major+' '+group.name;
   const count=document.createElement('b');
   count.textContent=group.studied+'語（MASTERED '+group.mastered+'）';
   row.append(title,count);domainRows.appendChild(row);
  }
  for(const button of document.querySelectorAll('[data-stat-days]')){
   button.setAttribute('aria-pressed',String(Number(button.dataset.statDays)===statDays));
  }
 }
 function render(){
  const p=snapshot();if(!p)return;
  const due=dueCount(p);
  $('dashDue').textContent=due.toLocaleString();
  $('dashReview').textContent=due?'▶ 復習待ち '+due.toLocaleString()+'枚を学ぶ':'▶ 新しい単語カードを学ぶ';
  $('dashXp').textContent=Math.max(0,Number(p.xp)||0).toLocaleString();
  $('dashSeen').textContent=Object.keys(p.words||{}).length.toLocaleString();
  if(root.DOPA_DAILY){
   const d=root.DOPA_DAILY.summary(p);
   $('dashToday').textContent='今日 '+d.distinctToday+'語学習 ・ 自力で想起 '+d.rememberedToday+'語';
   $('dashStreak').textContent=d.streak+'日';
   $('dashMissionCount').textContent=d.missions.filter(m=>m.completed).length+' / '+d.missions.length+' 達成';
   const rows=$('dashMissionRows');rows.replaceChildren();
   for(const mission of d.missions){
    const row=document.createElement('div');row.className='dopa-mission'+(mission.completed?' done':'');
    const mark=document.createElement('span');mark.className='dopa-mission-icon';mark.textContent=mission.completed?'✓':'○';
    const mid=document.createElement('div');mid.className='dopa-mission-main';
    const title=document.createElement('b');title.textContent=mission.title;
    const detail=document.createElement('small');detail.textContent=mission.progress+' / '+mission.target+' 語';
    const bar=document.createElement('div');bar.className='dopa-mission-bar';
    const fill=document.createElement('div');fill.style.width=Math.min(100,100*mission.progress/mission.target)+'%';
    bar.appendChild(fill);mid.append(title,detail,bar);
    const reward=document.createElement('span');reward.className='dopa-mission-reward';
    reward.textContent=mission.completed?'獲得済み':'+'+mission.xp+' XP';
    row.append(mark,mid,reward);rows.appendChild(row);
   }
   $('dashWeekly').textContent=d.weeklyDays+' / 7日 達成 ・ '+d.weeklyWords+'語';
   const bars=$('dashWeekBars');bars.replaceChildren();
   const max=Math.max(10,...d.recent.map(x=>x.distinct));
   for(const item of d.recent){
    const cell=document.createElement('div');cell.className='dopa-week-day'+(item.reached?' done':'');
    const plot=document.createElement('div');plot.className='dopa-week-bar';
    const fill=document.createElement('i');fill.style.height=Math.round(100*item.distinct/max)+'%';plot.appendChild(fill);
    const name=document.createElement('span');
    const [y,m,day]=item.date.split('-').map(Number);
    name.textContent=new Date(y,m-1,day,12).toLocaleDateString('ja-JP',{weekday:'short'});
    cell.title=item.date+'：'+item.distinct+'語';
    cell.append(plot,name);bars.appendChild(cell);
   }
  }
  $('dashStatus').textContent=dueCount(p)?
   '復習期限が到来した単語カードの課題があります。':
   '単語カードの復習待ちはありません。クエストや新規学習を選べます。';
  renderInsights(p);
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
  if(settingsMoved)return;
  const backup=$('dopaBackupSlot'),soundSlot=$('dopaSoundSlot'),soundActions=$('dopaSoundActions');
  // Only move original nodes. Do not re-create file pickers, Firebase buttons,
  // status regions or sound controls: their registered listeners survive.
  if(!backup||!soundSlot||!soundActions)return;
  const sound=$('soundSettings');
  if(sound)soundSlot.appendChild(sound);
  for(const id of ['backupBtn','loadBtn','loadFile']){
   const el=$(id);if(el)backup.appendChild(el);
  }
  const mute=$('soundBtn');if(mute)soundActions.appendChild(mute);
  settingsMoved=true;
 }
 function organizeLearningControls(){
  // Move existing control nodes, never clone them: IDs, listeners, learning state
  // and compatibility with older saved profiles remain unchanged.
  const quest=$('setup'),controls=quest?.querySelector(':scope > .controls');
  if(controls&&!$('dopaQuestBasics')){
   const blocks=[...controls.children];
   const take=id=>blocks.find(el=>el.contains($(id)));
   const section=(tag,id,title,hint)=>{
    const wrapper=document.createElement(tag);
    wrapper.id=id;wrapper.className='wide dopa-setting-section';
    const heading=document.createElement('h3');heading.textContent=title;
    wrapper.appendChild(heading);
    if(hint){const note=document.createElement('p');note.className='dopa-setting-note';note.textContent=hint;wrapper.appendChild(note)}
    return wrapper;
   };
   const intro=document.createElement('div');intro.className='dopa-config-intro';
   intro.innerHTML='<h2>クエスト設定</h2><p>まず出題範囲と方向を選び、すぐに学習を始められます。</p>';
   quest.insertBefore(intro,quest.querySelector('.tabs'));
   const basics=section('section','dopaQuestBasics','基本条件','言語・出題数・方向・学習する語の範囲');
   const basicsGrid=document.createElement('div');basicsGrid.className='controls';
   for(const id of ['lang','roundSize','direction','zone','semanticCategory']){
    const node=take(id);if(node)basicsGrid.appendChild(node);
   }
   basics.appendChild(basicsGrid);
   controls.appendChild(basics);
   const start=take('start');if(start){start.classList.add('dopa-quest-start');controls.appendChild(start)}
   const advanced=document.createElement('details');
   advanced.className='wide dopa-setting-details';advanced.id='questAdvancedSettings';
   const summary=document.createElement('summary');summary.textContent='詳細設定・絞込みを開く';
   advanced.appendChild(summary);
   const advancedGrid=document.createElement('div');advancedGrid.className='controls';
   for(const id of ['speed','answerMode','includeAudio','slowCorrect','studyDetailControls','shanSenseMode','vocabOpen','flashOpen']){
    const node=take(id);if(node)advancedGrid.appendChild(node);
   }
   advanced.appendChild(advancedGrid);controls.appendChild(advanced);
   const modeHelp=$('modeHelp');if(modeHelp){
    modeHelp.classList.add('dopa-mode-description');
    quest.querySelector('.tabs')?.after(modeHelp);
   }
   const zones=$('zoneStats');if(zones){
    const d=document.createElement('details');d.id='questZoneStats';d.className='dopa-setting-details';
    const sm=document.createElement('summary');sm.textContent='エリア別の学習状況';
    d.appendChild(sm);d.appendChild(zones);controls.after(d);
   }
  }
  const cards=$('flashConfig')?.querySelector(':scope > .flash-config');
  if(cards&&!$('dopaFlashBasics')){
   const blocks=[...cards.children];
   const take=id=>blocks.find(el=>el.contains($(id)));
   const basic=document.createElement('section');basic.id='dopaFlashBasics';
   basic.className='wide dopa-setting-section';
   basic.innerHTML='<h3>単語カードの学習条件</h3><p class="dopa-setting-note">復習の種類・出題方向・単語帳を選びます。</p>';
   const grid=document.createElement('div');grid.className='flash-config';
   for(const id of ['flashScope','flashDirection','flashCollection','flashCount']){
    const node=take(id);if(node)grid.appendChild(node);
   }
   basic.appendChild(grid);cards.appendChild(basic);
   const advanced=document.createElement('details');advanced.id='flashAdvancedSettings';
   advanced.className='wide dopa-setting-details';
   const summary=document.createElement('summary');summary.textContent='1日の学習上限を設定';
   advanced.appendChild(summary);
   const advancedGrid=document.createElement('div');advancedGrid.className='flash-config';
   for(const id of ['flashNewLimit','flashReviewLimit']){
    const node=take(id);if(node)advancedGrid.appendChild(node);
   }
   advanced.appendChild(advancedGrid);cards.appendChild(advanced);
   const hint=document.createElement('p');hint.className='flash-caption dopa-setting-note';
   hint.textContent='「学習画面の絞込み」はクエスト設定の言語・エリア・カテゴリを使ひます。';
   basic.appendChild(hint);
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
  organizeLearningControls();
  document.querySelectorAll('[data-stat-days]').forEach(button=>button.addEventListener('click',()=>{
   statDays=Number(button.dataset.statDays)===30?30:7;
   if(route==='home')render();
  }));
  nav.querySelectorAll('[data-dopa-route]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.dopaRoute)));
  $('flashExit')?.addEventListener('click',()=>{if(route==='cards'){route='quest';visibility('quest')}});
  $('vocabExit')?.addEventListener('click',()=>{if(route==='library'){route='quest';visibility('quest')}});
  $('dashQuest').addEventListener('click',()=>go('quest'));
  $('dashCards').addEventListener('click',()=>go('cards'));
  $('dashReview').addEventListener('click',()=>{
   go('cards');
   if(root.DOPA_FLASH_UI&&$('flashScope'))$('flashScope').value=dueCount(snapshot())?'due':'new';
   $('flashScope')?.dispatchEvent(new Event('change'));
  });
  const header=$('soundBtn')?.closest('header');
  if(header){
   const button=document.createElement('button');button.type='button';button.className='pill';
   button.id='dopaSettingsOpen';button.textContent='⚙ 設定';
   header.appendChild(button);button.addEventListener('click',()=>go('settings'));
  }
  for(const p of ['game','flashcardPanel'])$(p)?.classList.add('dopa-play-viewport');
  // Always land on the dashboard: no legacy setup flash after cold starts or
  // profile restoration. Classic quest controls remain available via the Quest tab.
  go('home',{scroll:false});
  document.body.classList.add('dopa-ui-ready');
 }
 root.addEventListener('dopa-game-ready',initialize,{once:true});
 root.addEventListener('dopa-profile-restored',()=>{
  // The legacy profile loader temporarily unhides setup/profile. Restore the
  // current modern route immediately, without replacing saved learning data.
  // Cloud restore can happen while the user is looking at Settings or Home.
  if(route==='home'||route==='settings'){
   moveSettings();
   visibility(route);
   if(route==='home')render();
  }
  else if(route==='quest')visibility('quest');
  else if(route==='cards'||route==='library'){
   // Keep a visible study/library panel rather than exposing legacy setup.
   // Cloud restore guards against restoring during an active session.
   const panel=$(route==='cards'?'flashcardPanel':'vocabPanel');
   if(panel&&!panel.classList.contains('hidden')){
    $('setup').classList.add('hidden');$('profile').classList.add('hidden');
   }else visibility('quest');
  }
 });
 root.DOPA_DASHBOARD={go,render,dueCount};
})(window);
