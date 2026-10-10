const DATA = window.DOPA_DATA;
const $ = id => document.getElementById(id);
const DAY=86400000, MIN=60000;
const KEY='dopaQuestV5_profile', OLDKEY='dopaQuestV4_profile';
const STAGES=['UNSEEN','SEEN','KNOWN','SOLID','MASTERED'];
let mode='campaign', S={}, voices=[], ctx=null, nextTimeout=null;
const fresh=()=>({xp:0,coin:0,totalQ:0,totalCorrect:0,bestCombo:0,day:'',daily:{q:0,revenge:0,prod:0,rewarded:false},words:{},rivals:{},issues:{},sound:true,slowCorrect:false,migratedFrom:'',reviewLog:[]});
function loadLocal(){try{let raw=localStorage.getItem(KEY);if(raw)return {...fresh(),...JSON.parse(raw)};raw=localStorage.getItem(OLDKEY);if(raw)return {...fresh(),...JSON.parse(raw),migratedFrom:'v4'};}catch(e){}return fresh()}
let P=loadLocal();
function ensureProfile(){if(!P.words||typeof P.words!=='object')P.words={};if(!P.rivals||typeof P.rivals!=='object')P.rivals={};if(!P.issues||typeof P.issues!=='object')P.issues={};if(!P.daily)P.daily=fresh().daily;if(!Array.isArray(P.reviewLog))P.reviewLog=[];}
ensureProfile();
function normalizeSoundPrefs(){
 const modes=['off','quiet','standard','flashy'];
 if(!modes.includes(P.sfxStyle))P.sfxStyle=P.sound===false?'off':'standard';
 P.sfxVolume=Number.isFinite(Number(P.sfxVolume))?Math.min(100,Math.max(0,Math.round(Number(P.sfxVolume)))):30;
 if(!modes.includes(P.lastSfxStyle)||P.lastSfxStyle==='off')P.lastSfxStyle='standard';
 P.sound=P.sfxStyle!=='off';
}
normalizeSoundPrefs();
function today(){let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function rollover(){if(P.day!==today()){P.day=today();P.daily={q:0,revenge:0,prod:0,rewarded:false}}}
rollover();
function save(){try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){console.warn('local save unavailable',e)}renderProfile();window.DOPACloud?.scheduleUpload?.()}
function getW(x){return P.words[x.id]||null}
function W(x){let w=P.words[x.id];if(!w){w={seen:0,correct:0,wrong:0,rec:0,prod:0,listen:0,spell:0,last:0,lastCorrect:0,nextDue:0,nemesis:false,seals:0,days:{},due:{}};P.words[x.id]=w}
 if(!w.due)w.due={};if(!w.days)w.days={};if(!Number.isFinite(w.spell))w.spell=0;if(!Number.isFinite(w.listen))w.listen=0;
 if(!w.v5Initialized){if(w.nextDue&&!Object.keys(w.due).length){if(w.rec)w.due.rec=w.nextDue;if(w.prod)w.due.prod=w.nextDue}w.v5Initialized=true}return w}
function stage(w){if(!w||!w.seen)return 0;if((w.rec||0)<2||(w.prod||0)<1)return 1;if((w.rec||0)<3||(w.prod||0)<2)return 2;if((w.seals||0)<1)return 3;return 4}
function lvInfo(xp){let lv=Math.floor(Math.sqrt(Math.max(0,xp)/90))+1,start=(lv-1)**2*90,next=lv**2*90;return{lv,cur:xp-start,need:next-start,p:100*(xp-start)/(next-start)}}
function titleFor(lv){return lv>=25?'Lexicon Overlord':lv>=15?'Memory Raider':lv>=8?'Word Hunter':lv>=4?'Combo Learner':'Rookie'}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shuffle(a){let b=[...a];for(let i=b.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function orig(x,l){return l==='shan'?x.shan:x.burmese}
function jp(x){return x.japanese_core||x.japanese||x.english||''}
function note(x,l){return x.japanese_note||(x.english||'')}
function glossParts(s){return [...new Set(String(s||'').normalize('NFKC').split(/[；;、，,／/]/).map(x=>x.replace(/[。．！？!？\s　]+/g,'').trim().toLowerCase()).filter(Boolean))]}
function glossOverlap(a,b){let aa=new Set(glossParts(jp(a)));return glossParts(jp(b)).some(x=>aa.has(x))}
function normalizedGloss(x){return String(jp(x)).normalize('NFKC').replace(/[\s　。、，,；;:：・]+/g,'').toLowerCase()}
function isUnambiguous(x,l){return (glossLookup[l].get(normalizedGloss(x))||0)===1}
function pos(x,l){return l==='shan'?(x.game_pos||x.pos||''):(x.game_pos||x.category||x.type_hint||'')}
function indexOf(x,l){return l==='shan'?Number(x.rank||99999):Number(x.order||99999)}
function zones(l){if(l==='shan')return[['all','全5,480語',1,5480],['z1','頻度 1–100',1,100],['z2','101–300',101,300],['z3','301–500',301,500],['z4','501–1000',501,1000],['z5','1001–2000',1001,2000],['z6','2001–5480',2001,5480]];return[['all','全2,500語',1,2500],['z1','教材 1–100',1,100],['z2','101–300',101,300],['z3','301–500',301,500],['z4','501–1000',501,1000],['z5','1001–1500',1001,1500],['z6','1501–2500',1501,2500]]}
const byId = Object.fromEntries([...DATA.shan,...DATA.burmese,...(DATA.shan_senses||[])].map(x=>[x.id,x]));
const glossLookup={shan:new Map(),burmese:new Map()};
for(const lang of ['shan','burmese'])for(const x of DATA[lang]){
 const m=glossLookup[lang],t=normalizedGloss(x);m.set(t,(m.get(t)||0)+1);
}
const DOMAIN_LABELS_BY_LANG=window.DOPA_SEMANTIC_LABELS_BY_LANG||{burmese:window.DOPA_SEMANTIC_LABELS||{},shan:{}};
const DOMAIN_READY_BY_LANG=window.DOPA_SEMANTIC_READY_BY_LANG||{burmese:!!window.DOPA_SEMANTIC_READY,shan:false};
let previousSemanticLanguage=null;
function senseStudyActive(){return $('lang')?.value==='shan'&&!!$('shanSenseMode')?.checked&&!!DATA.shan_senses}
function activeDeck(l){return l==='shan'&&senseStudyActive()?DATA.shan_senses:DATA[l]}
function updateShanSenseControl(){
 const input=$('shanSenseMode'),note=$('shanSenseNotice');
 if(!input)return;
 input.disabled=$('lang').value!=='shan'||!window.DOPA_SENSE_READY;
 if(note)note.textContent=!window.DOPA_SENSE_READY?'語義カードデータを読み込めないため、従来の5,480カードだけを使ひます。':
 '語義別モードでは7,290候補のうち7,241件を出題。同綴りの別語義は同じ四択に出さず、両方向で学べます。新IDの復習履歴は別管理です。';
}

function domainEligible(x,l){
 const control=$('semanticCategory');
 return !control||control.value==='all'||!DOMAIN_READY_BY_LANG[l]||
  (x.semantic_major===control.value&&['P','R'].includes(x.semantic_status));
}
function updateSemanticCategories(){
 const select=$('semanticCategory'),notice=$('semanticCategoryNotice');
 if(!select)return;
 const l=$('lang').value,labels=DOMAIN_LABELS_BY_LANG[l]||{};
 const old=previousSemanticLanguage===l?(select.value||'all'):'all';
 previousSemanticLanguage=l;
 if(!DOMAIN_READY_BY_LANG[l]){
   select.innerHTML='<option value="all">意味分類を利用できません</option>';
   select.value='all';select.disabled=true;
   if(notice)notice.textContent='分類データが読み込めないため、全語彙モードを利用します。';
   return;
 }
 let options='<option value="all">全カテゴリ（従来どおり）</option>';
 for(const [id,name] of Object.entries(labels)){
   const count=activeDeck(l).filter(x=>x.semantic_major===id&&['P','R'].includes(x.semantic_status)&&String(x.game_include??'1')!=='0').length;
   options+='<option value="'+esc(id)+'">'+esc(id+' '+name+'（'+count+'語）')+'</option>';
 }
 select.innerHTML=options;
 select.value=labels[old]?old:'all';select.disabled=false;
 if(notice)notice.textContent=l==='shan'?
   'シャン語分類は暫定版。多義1,242項目と訳語不足31項目をカテゴリ限定学習から除外（全カテゴリでは利用可能）。':
   'ビルマ語分類は暫定版。多義239項目をカテゴリ限定学習から除外（全カテゴリでは利用可能）。';
}
// Detailed study filters are session settings; they never rewrite profile/history data.
let previousDetailDeck=null,detailReviewLimit=20;
function detailFilters(){return {medium:$('semanticMedium')?.value||'all',tag:$('semanticTag')?.value||'all'}}
function detailFilterActive(){const f=detailFilters();return f.medium!=='all'||f.tag!=='all'}
function studyEligible(x,l){return domainEligible(x,l)&&(!window.DOPA_DETAIL||window.DOPA_DETAIL.matches(x,l,detailFilters()))}
function updateDetailFilters(){
 const medium=$('semanticMedium'),tag=$('semanticTag'),notice=$('studyDetailNotice');
 if(!medium||!tag)return;
 const engine=window.DOPA_DETAIL,l=$('lang').value,key=l+':'+senseStudyActive();
 let oldMedium=medium.value||'all',oldTag=tag.value||'all';
 if(key!==previousDetailDeck){oldMedium='all';oldTag='all'}
 previousDetailDeck=key;
 const available=!!engine&&!!DOMAIN_READY_BY_LANG[l];
 medium.disabled=tag.disabled=!available;
 if(!available){
  medium.innerHTML=tag.innerHTML='<option value="all">限定しない</option>';
  if(notice)notice.textContent='詳細分類を利用できません。従来の全語彙学習を続けられます。';
  renderDetailReview();return;
 }
 const deck=activeDeck(l).filter(x=>String(x.game_include??'1')!=='0'&&domainEligible(x,l));
 const annotated=deck.filter(x=>engine.annotation(x,l));
 const ids=new Set(annotated.map(x=>engine.annotation(x,l).medium));
 medium.innerHTML='<option value="all">限定しない</option>'+[...engine.mediums].filter(([id])=>ids.has(id)).map(([id,a])=>{
  const count=annotated.filter(x=>engine.annotation(x,l).medium===id).length;
  return '<option value="'+esc(id)+'">'+esc(id+' '+a.label+'（'+count+'件）')+'</option>';
 }).join('');
 medium.value=ids.has(oldMedium)?oldMedium:'all';
 const scoped=annotated.filter(x=>engine.matches(x,l,{medium:medium.value}));
 const tagIds=new Set(scoped.flatMap(x=>Object.entries(engine.annotation(x,l).tags).flatMap(([axis,values])=>values.map(v=>axis+':'+v))));
 tag.innerHTML='<option value="all">限定しない</option>'+engine.taxonomy.tag_axes.map(axis=>{
  const options=axis.values.filter(v=>tagIds.has(axis.axis+':'+v)).map(v=>{
   const id=axis.axis+':'+v,count=scoped.filter(x=>engine.matches(x,l,{tag:id})).length;
   return '<option value="'+esc(id)+'">'+esc(engine.taxonomy.tag_labels[axis.axis][v]+'（'+count+'件）')+'</option>';
  }).join('');
  return options?'<optgroup label="'+esc(axis.label)+'">'+options+'</optgroup>':'';
 }).join('');
 tag.value=tagIds.has(oldTag)?oldTag:'all';
 const count=deck.filter(x=>engine.matches(x,l,detailFilters())).length;
 if(notice)notice.textContent='食物・身体・道具や交通の一部を試験分類。訳語による確認で、原辞書の照合は未完了です。'+
  (detailFilterActive()?'絞り込み '+count+'件（エリア指定前）。四択に足りない語は開始時に除外します。':'このデッキで詳細分類済み '+annotated.length+'件。未分類の語も限定しなければ学べます。');
 detailReviewLimit=20;renderDetailReview();
}
function renderDetailReview(){
 const list=$('studyDetailReviewList'),summary=$('studyDetailReviewSummary'),more=$('studyDetailReviewMore');
 if(!list||!summary||!more)return;
 const engine=window.DOPA_DETAIL,l=$('lang').value;
 const rows=engine&&DOMAIN_READY_BY_LANG[l]?activeDeck(l).filter(x=>String(x.game_include??'1')!=='0'&&studyEligible(x,l)&&engine.annotation(x,l)):[];
 summary.textContent='分類済みの語を確認（'+rows.length+'件・エリア指定前）';
 list.innerHTML=rows.slice(0,detailReviewLimit).map(x=>{
  const a=engine.annotation(x,l),labels=Object.entries(a.tags).flatMap(([axis,values])=>values.map(v=>engine.taxonomy.tag_labels[axis][v]));
  return '<div style="padding:8px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere"><b>'+esc(orig(x,l))+'</b><div>'+esc(jp(x))+'</div><div class="small">'+esc(engine.mediums.get(a.medium).label+' ／ '+labels.join('・'))+'</div></div>';
 }).join('')||'<p class="small">この条件の詳細分類済みカードはありません。</p>';
 more.classList.toggle('hidden',rows.length<=detailReviewLimit);
 more.textContent='続きを表示（残り '+Math.max(0,rows.length-detailReviewLimit)+'件）';
 more.onclick=()=>{detailReviewLimit+=20;renderDetailReview()};
}
function zonePool(){let l=$('lang').value,z=$('zone').value,def=zones(l).find(t=>t[0]===z)||zones(l)[0];return activeDeck(l).filter(x=>{let i=indexOf(x,l);return i>=def[2]&&i<=def[3]&&String(x.game_include??'1')!=='0'&&studyEligible(x,l)})}
function updateZones(){let l=$('lang').value,cur=$('zone').value||'all';$('zone').innerHTML=zones(l).map(z=>`<option value="${z[0]}">${z[1]}</option>`).join('');if(zones(l).some(z=>z[0]===cur))$('zone').value=cur;updateShanSenseControl();updateSemanticCategories();updateDetailFilters();renderZoneStats();refreshVoices()}
function renderProfile(){rollover();let L=lvInfo(P.xp||0);$('lv').textContent='LV.'+L.lv;$('lvl').style.setProperty('--p',Math.max(0,Math.min(100,L.p))+'%');$('xpBar').style.width=L.p+'%';$('xpText').textContent=`${Math.round(L.cur)}/${Math.round(L.need)} XP`;$('title').textContent=titleFor(L.lv);$('coin').textContent='◈ '+(P.coin||0);
 let ws=Object.values(P.words),m=ws.filter(w=>stage(w)>=4).length,n=ws.filter(w=>w.nemesis).length,r=Object.values(P.rivals).filter(v=>v.confusions>=2&&!v.cleared).length;
 $('masterSummary').textContent=`MASTERED ${m} ・ NEMESIS ${n} ・ RIVAL ${r} ・ ${(P.totalQ||0)}問`;
 let q=[['30問',P.daily.q||0,30],['REVENGE 5',P.daily.revenge||0,5],['逆引き 8',P.daily.prod||0,8]];
 $('quests').innerHTML=q.map(([t,v,max])=>`<div class="quest ${v>=max?'done':''}"><b>${t}</b><span>${Math.min(v,max)}/${max}</span><div class="bar" style="height:3px;margin-top:4px"><div style="width:${Math.min(100,v/max*100)}%"></div></div></div>`).join('');
 $('migrateHint').textContent=P.migratedFrom==='v4'?'v4 の端末内進捗を継承しました。旧データは残してあります。':'別のHTMLから移す場合は旧版の SAVE → 本版の LOAD を使って下さい。';}
function renderZoneStats(){let l=$('lang').value,all=activeDeck(l).filter(x=>String(x.game_include??'1')!=='0');$('zoneStats').innerHTML=zones(l).slice(1).map(z=>{let arr=all.filter(x=>{let i=indexOf(x,l);return i>=z[2]&&i<=z[3]&&studyEligible(x,l)}),known=arr.filter(x=>stage(getW(x))>=2).length,master=arr.filter(x=>stage(getW(x))>=4).length,p=arr.length?master/arr.length*100:0;return `<div class="zone"><b>${Math.round(p)}%</b><span>${z[1]}<br>KNOWN ${known}/${arr.length}</span><div class="mini"><div style="width:${p}%"></div></div></div>`}).join('')}
function rivalKey(a,b){return [a,b].sort().join('||')}
function playableRival(r){let a=byId[r.a],b=byId[r.b];return a&&b&&a.id!==b.id&&jp(a)!==jp(b)&&orig(a,a.id.startsWith('shn:')?'shan':'burmese')!==orig(b,b.id.startsWith('shn:')?'shan':'burmese')}
function rivalsFor(x){return Object.values(P.rivals).filter(r=>r.confusions>=2&&!r.cleared&&playableRival(r)&&(r.a===x.id||r.b===x.id)).sort((a,b)=>b.confusions-a.confusions)}
function recordConfusion(a,b){if(!b||a.id===b.id)return null;let key=rivalKey(a.id,b.id);let r=P.rivals[key]||(P.rivals[key]={a:a.id,b:b.id,confusions:0,wins:0,cleared:false,last:0});r.confusions++;r.wins=0;r.cleared=false;r.last=Date.now();return r}
function activeRivalPool(base){let ids=new Set(base.map(x=>x.id));let rs=Object.values(P.rivals).filter(r=>r.confusions>=2&&!r.cleared&&playableRival(r)&&ids.has(r.a)&&ids.has(r.b));let set=new Set(rs.flatMap(r=>[r.a,r.b]));return base.filter(x=>set.has(x.id))}
function isDue(x){let w=getW(x);if(!w||!w.seen)return false;let due=w.due||{};let now=Date.now();return (w.rec>0&&Number(due.rec||w.nextDue||Infinity)<=now)||(w.prod>0&&Number(due.prod||w.nextDue||Infinity)<=now)||(w.spell>0&&Number(due.spell||Infinity)<=now)||(w.listen>0&&Number(due.listen||Infinity)<=now)}
function candidatePool(){let base=zonePool();if(mode==='due')return base.filter(isDue);if(mode==='weak'){return base.filter(x=>getW(x)?.nemesis||getW(x)?.wrong>=2)}if(mode==='rival')return activeRivalPool(base);
 if(mode==='campaign'){let unseen=base.filter(x=>!getW(x)),d=base.filter(isDue),learned=base.filter(x=>getW(x));return [...d,...unseen.slice(0,Math.max(80,+$('roundSize').value*5)),...learned]}return base}
function weight(x){let w=getW(x),s=stage(w),v=1;if(!w)v+=mode==='campaign'?8:2;if(isDue(x))v+=7;if(w?.nemesis)v+=mode==='weak'?12:5;v+=Math.min(5,(w?.wrong||0)*1.3)+Math.max(0,4-s);if(mode==='rival')v+=rivalsFor(x).length*4;return v}
function weightedSample(arr,n){let seen=new Set(),out=[],pool=arr.map(x=>[x,weight(x)]);while(out.length<n&&pool.length){let tot=pool.reduce((s,p)=>s+p[1],0),r=Math.random()*tot,idx=0;for(;idx<pool.length;idx++){r-=pool[idx][1];if(r<=0)break}let [x]=pool.splice(Math.min(idx,pool.length-1),1)[0];if(!seen.has(x.id)){out.push(x);seen.add(x.id)}}return out}
function voiceFor(l){return l==='burmese'?voices.find(v=>/^(my|my[-_])/i.test(v.lang)):null}
function refreshVoices(){try{voices=window.speechSynthesis?.getVoices?.()||[]}catch(e){voices=[]}let avail=!!voiceFor($('lang').value),opt=$('direction').querySelector('[value="listen"]');if(opt)opt.disabled=!avail;if(!avail&&$('direction').value==='listen')$('direction').value='adaptive';$('audioNotice').textContent=avail?'端末にミャンマー語の合成音声が見つかりました。聴解は合成音声で、収録音声ではありません。':'録音音声は未収録です。この端末では対象言語の合成音声も利用出来ないため、聴解問題を無効化してゐます。'}
function playSpeech(x){let voice=voiceFor(S.lang);if(!voice)return;try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(orig(x,S.lang));u.voice=voice;u.lang=voice.lang;u.rate=.78;speechSynthesis.speak(u)}catch(e){toast('音声を再生出来ません')}}
function adaptiveDir(x){let w=getW(x)||{},d=$('direction').value,ans=$('answerMode').value;
 if(d==='listen'&&voiceFor($('lang').value))return'listen';if(d==='toJP'||d==='fromJP')return d;if(d==='mix')return Math.random()<.5?'toJP':'fromJP';
 if((w.rec||0)<2)return'toJP';if((w.prod||0)<2)return'fromJP';
 if(voiceFor($('lang').value)&&$('includeAudio').checked&&Math.random()<.15)return'listen';
 if(ans!=='choice'&&(w.prod||0)>=3&&Math.random()<.25)return'fromJP';return Math.random()<.55?'toJP':'fromJP'}
function qFor(x,retry=0,old=null){let w=getW(x),dir=old?.dir||adaptiveDir(x),typed=old?old.typed:false;let answerMode=$('answerMode').value;
 if(!old&&dir==='fromJP')typed=answerMode==='typed'||(answerMode==='adaptive'&&(w?.prod||0)>=3&&Math.random()<.40);
 if(mode==='rival'){typed=false;if(!old)dir=Math.random()<.5?'toJP':'fromJP'}
 // A split Shan form may be asked in either direction: the multiple-choice
 // distractor filter excludes every other sense of the same spelling, so only
 // one meaning of that spelling can appear among the displayed options.
 // This tests recognition of a possible meaning, not contextual sense selection.
 if(x.sense_split)typed=false;
 // For Japanese-to-Shan questions, gloss-overlap distractor filtering prevents
 // alternative correct spellings with matching recorded glosses from co-occurring.
 let ambiguousFallback=!x.sense_split&&dir==='fromJP'&&!isUnambiguous(x,$('lang').value);
 if(ambiguousFallback){dir='toJP';typed=false}
 return{x,dir,typed,ambiguousFallback,retry,answered:false,isBoss:false,isNew:!w,isRival:rivalsFor(x).length>0}}
function distractors(item,pool,l,dir){
 // In category lessons, S.pool includes the whole selected domain across rank zones; never add unrelated distractors.
let targetLabel=dir==='fromJP'?orig(item,l):jp(item),ip=pos(item,l),ii=indexOf(item,l);
 let cand=pool.filter(x=>x.id!==item.id&&orig(x,l)!==orig(item,l)&&!glossOverlap(item,x)&&(typeof window==='undefined'||!window.DOPA_DETAIL||window.DOPA_DETAIL.canContrast(item,x,l))&&((dir==='fromJP'?orig(x,l):jp(x))!==targetLabel));let same=cand.filter(x=>pos(x,l)===ip);if(same.length>=3)cand=same;
 cand.sort((a,b)=>Math.abs(indexOf(a,l)-ii)-Math.abs(indexOf(b,l)-ii));let shortlist=shuffle(cand.slice(0,100));let riv=rivalsFor(item);let candidateIds=new Set(cand.map(x=>x.id));let special=riv.map(r=>byId[r.a===item.id?r.b:r.a]).filter(x=>x&&candidateIds.has(x.id));
 let labels=new Set([targetLabel]),seenSpelling=new Set([orig(item,l)]),out=[];
 for(let x of [...special,...shortlist,...shuffle(cand)]){
  let lab=dir==='fromJP'?orig(x,l):jp(x),spelling=orig(x,l);
  if(!lab||labels.has(lab)||seenSpelling.has(spelling))continue;
  labels.add(lab);seenSpelling.add(spelling);out.push(x);
  if(out.length>=3)break
 }return out}
function beep(kind){
 if(!P.sound)return false;
 return window.DOPASound?.play(kind,{preset:P.sfxStyle,volume:P.sfxVolume})||false;
}
function refreshSoundControls(){
 normalizeSoundPrefs();
 const preset=$('sfxPreset'),volume=$('sfxVolume'),value=$('sfxVolumeValue'),status=$('sfxSessionStatus');
 if(!P.sound||P.sfxVolume===0)window.DOPASound?.stop?.();
 if(preset)preset.value=P.sfxStyle;
 if(volume)volume.value=String(P.sfxVolume);
 if(value)value.textContent=P.sfxVolume+'%';
 if(status)status.textContent=window.DOPASound?.status?.()||'サウンドエンジンが読み込まれてゐません。';
 $('soundBtn').textContent=P.sound?'♪ SOUND':'× MUTE';
}
function vibe(v){try{navigator.vibrate?.(v)}catch(e){}}
function toast(t){let e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
function banner(t,k=''){let e=$('banner');e.textContent=t;e.className='banner show '+k;setTimeout(()=>e.className='banner',900)}
function floatXP(t,el){if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;let r=(el||$('card')).getBoundingClientRect(),e=document.createElement('div');e.className='float';e.textContent=t;e.style.left=r.left+r.width*.6+'px';e.style.top=r.top+r.height*.25+'px';document.body.appendChild(e);setTimeout(()=>e.remove(),950)}
function intervals(score){return [5*MIN,6*60*MIN,DAY,3*DAY,7*DAY,21*DAY,60*DAY][Math.min(Math.max(0,score),6)]}
function skillFor(q){return q.typed?'spell':q.dir==='toJP'?'rec':q.dir==='listen'?'listen':'prod'}
function nextDueFor(w){let d=w.due||{},times=['rec','prod',...(w.spell?['spell']:[]),...(w.listen?['listen']:[])].map(k=>Number(d[k]||Infinity));return Math.min(...times)}
function applyCorrect(q){
 let w=W(q.x),now=Date.now(),prev=stage(w),sk=skillFor(q),
 wasNem=w.nemesis,wason=w.seals||0,oldLast=w.lastCorrect||0;
 let lastScheduled=Number(w.due[sk]||0);
 let credited=!q.retry&&((w[sk]||0)===0||!lastScheduled||now>=lastScheduled);
 w.seen++;w.correct++;w.last=now;w.days[today()]=(w.days[today()]||0)+1;
 // Only a first retrieval or a due review increases long-term mastery.
 if(credited){
   w[sk]=Math.min(6,(w[sk]||0)+1);
   w.due[sk]=now+intervals(w[sk]);
   if(oldLast&&now-oldLast>=18*60*60*1000&&w.rec>=2&&w.prod>=1)
     w.seals=Math.min(9,(w.seals||0)+1);
   w.lastCorrect=now;w.nextDue=nextDueFor(w);
 }
 if(wasNem&&credited&&oldLast&&now-oldLast>=18*60*60*1000&&w.correct>=Math.max(4,w.wrong*2)&&w.seals>=1)w.nemesis=false;
 return {before:prev,after:stage(w),sealed:(!wason&&w.seals>0),
 nemesisKilled:wasNem&&!w.nemesis,sk,credited};
}
function applyWrong(q){let w=W(q.x),now=Date.now(),sk=skillFor(q);w.seen++;w.wrong++;w.last=now;w.due[sk]=now+5*MIN;w.nextDue=nextDueFor(w);w[sk]=Math.max(0,(w[sk]||0)-1);if(w.wrong>=3)w.nemesis=true;return w.nemesis}
function start(){clearTimeout(nextTimeout);let arr=candidatePool(),n=+$('roundSize').value;if(detailFilterActive()&&arr.length){const l=$('lang').value,pool=activeDeck(l).filter(x=>String(x.game_include??'1')!=='0'&&studyEligible(x,l));arr=arr.filter(x=>['toJP','fromJP'].every(dir=>distractors(x,pool,l,dir).length===3));if(!arr.length){toast('この絞り込みでは四択に十分な語がありません。中分類・タグ・エリアを広げて下さい。');return}}if(!arr.length){toast(mode==='due'?'期限到来の復習語はまだありません':mode==='weak'?'NEMESISはまだありません':mode==='rival'?'混同を2回以上記録するとRIVAL戦が解放されます':'対象語がありません');return}let base=weightedSample(arr,Math.min(n,arr.length));S={lang:$('lang').value,pool:($('semanticCategory')?.value!=='all'||detailFilterActive()?activeDeck($('lang').value).filter(x=>String(x.game_include??'1')!=='0'&&studyEligible(x,$('lang').value)):zonePool()),base,queue:base.map(x=>qFor(x)),initial:base.length,done:0,hit:0,miss:0,firstHits:0,practiceHits:0,combo:0,best:0,xp:0,coin:0,revengeKills:0,nemKills:0,seals:0,prodHits:0,typedHits:0,audioHits:0,rivalWins:0,mistakes:[],timer:null,start:0};$('setup').classList.add('hidden');$('profile').classList.add('hidden');$('result').classList.add('hidden');$('game').classList.remove('hidden');next()}
function next(){clearTimer();clearTimeout(nextTimeout);if(!S.queue.length)return finish();let q=S.queue.shift();q.isBoss=!q.retry&&((S.done+1)%5===0);S.cur=q;renderQ(q)}
function renderQ(q){let x=q.x,w=W(x),l=S.lang,c=$('card');c.className='card'+(q.isBoss?' boss':'')+(w.nemesis?' nemesis':'')+(q.isRival?' rival':'');let tags=[];if(q.isBoss)tags.push('<span class="enemy boss">BOSS ×2</span>');if(q.retry)tags.push('<span class="enemy rev">REVENGE</span>');if(w.nemesis)tags.push('<span class="enemy nem">NEMESIS</span>');if(q.isRival)tags.push('<span class="enemy rival">RIVAL</span>');if(q.isNew)tags.push('<span class="enemy new">NEW</span>');if(q.ambiguousFallback)tags.push('<span class="enemy new">同義語による逆引き回避</span>');if(q.typed)tags.push('<span class="enemy typed">SPELL CHECK</span>');if(q.dir==='listen')tags.push('<span class="enemy audio">TTS LISTEN</span>');
 const detail=window.DOPA_DETAIL?.annotation(x,l);let meta=l==='shan'?`${x.rank}位${Number.isFinite(Number(x.count))?'・'+Number(x.count).toLocaleString()+'件':''}・${esc(pos(x,l)||'未分類')}`:`#${x.order}・${esc(pos(x,l)||'VOCAB')}`;$('meta').innerHTML=tags.join('')+' '+meta+(x.semantic_major?'・領域 '+esc(x.semantic_major)+'（暫定）':'')+(detail?'・'+esc(window.DOPA_DETAIL.mediums.get(detail.medium).label):'');let from=q.dir==='fromJP'||q.typed;
 $('prompt').className='prompt'+(from?' jp':'');$('prompt').textContent=q.dir==='listen'?'音声を聴いて意味を答へる':from?(jp(x)+(x.sense_split&&x.game_pos?'〔'+x.game_pos+'〕':'')):orig(x,l);$('ipa').textContent='';
 $('audioPlay').classList.toggle('hidden',q.dir!=='listen');if(q.dir==='listen')$('audioPlay').onclick=()=>playSpeech(x);
 renderMastery(w);$('choices').innerHTML='';$('choices').classList.toggle('hidden',q.typed);$('typedBox').classList.toggle('hidden',!q.typed);$('feedback').className='feedback';$('feedback').innerHTML='';
 if(q.typed){S.options=[];$('typedAnswer').value='';$('typedAnswer').placeholder='原語の綴りを入力';$('typedAnswer').lang=l==='shan'?'shn':'my';$('typedAnswer').disabled=false;$('typedSubmit').disabled=false;$('typedSubmit').onclick=submitTyped;setTimeout(()=>$('typedAnswer').focus(),50)}
 else{let opts=shuffle([x,...distractors(x,S.pool,l,q.dir)]);S.options=opts;opts.forEach((o,i)=>{let b=document.createElement('button');b.className='choice';b.dataset.correct=o.id===x.id?'1':'0';b.dataset.itemid=o.id;b.dataset.key=i+1;b.textContent=q.dir==='fromJP'?orig(o,l):jp(o);b.onclick=()=>answer(b,o.id===x.id,false,o);$('choices').appendChild(b)})}
 if(q.isBoss){banner(w.nemesis?'☠ NEMESIS BOSS':q.isRival?'⚔ RIVAL BOSS':'⚠ BOSS WAVE');beep('bossEnter')}
 updateHUD();startTimer();if(q.dir==='listen')setTimeout(()=>{if(S.cur===q&&!q.answered)playSpeech(x)},180)}
function renderMastery(w){let s=stage(w);$('mastery').innerHTML=[0,1,2,3,4].map(i=>`<i class="rankdot ${i<=s?'on':''}"></i>`).join('')+`<span class="rankname">${STAGES[s]}</span>`;
 let skills=[['rec','文字→意味'],['prod','意味→文字4択'],['spell','綴り入力'],['listen','聴解（合成音声）']];$('subskill').innerHTML=skills.map(([k,t])=>`<div class="skill ${k}"><div class="skilltop"><span>${t}</span><b>${w[k]||0}/6</b></div><div class="bar"><div style="width:${(w[k]||0)/6*100}%"></div></div></div>`).join('')}
function clearTimer(){if(S.timer){clearInterval(S.timer);S.timer=null}}
function startTimer(){clearTimer();let speed=$('speed').value;if(speed==='normal'||S.cur.typed){$('timestat').textContent='∞';S.start=performance.now();return}let sec=speed==='rush'?10:6;if(S.cur.isBoss)sec=Math.max(4,sec-1);let end=performance.now()+sec*1000;S.start=performance.now();S.timer=setInterval(()=>{let rem=Math.max(0,end-performance.now());$('timestat').textContent=(rem/1000).toFixed(1);if(!rem){clearTimer();answer(null,false,true,null)}},90)}
function normalizedOriginal(v){return String(v||'').normalize('NFC').replace(/[\s\u200b\u200c\u200d\u2060]+/g,'').trim()}
function submitTyped(){if(!$('typedAnswer').value.trim())return;let ans=normalizedOriginal($('typedAnswer').value),want=normalizedOriginal(orig(S.cur.x,S.lang)),ok=ans===want;answer(null,ok,false,null)}
function feedbackDetail(x,full=true){return `<div class="detail"><b>${esc(orig(x,S.lang))}</b>${x.ipa?'　'+esc(x.ipa):''}<br>${esc(jp(x))}${full&&note(x,S.lang)?`<div class="note">${esc(note(x,S.lang))}</div>`:''}<button type="button" class="flag" id="reportIssue">⚑ この訳・設問を要確認に登録</button></div>`}
function markIssue(x){P.issues[x.id]={id:x.id,word:orig(x,S.lang),japanese:jp(x),lang:S.lang,flaggedAt:new Date().toISOString()};save();toast('校閲候補として記録しました（SAVEで書き出せます）');let b=$('reportIssue');if(b)b.disabled=true}
function registerRivalWin(x){let active=rivalsFor(x),result=0;for(let r of active){let other=r.a===x.id?r.b:r.a;if(!S.options?.some(y=>y.id===other))continue;r.wins=(r.wins||0)+1;if(r.wins>=4&&!r.cleared){r.cleared=true;result++}}return result}
function answer(btn,ok,timeout,selected){let q=S.cur;if(!q||q.answered)return;q.answered=true;clearTimer();if(q.typed){$('typedAnswer').disabled=true;$('typedSubmit').disabled=true}else{[...$('choices').children].forEach(b=>b.disabled=true)};
 let x=q.x,w=W(x),coinBefore=S.coin,memoryCredit=false;if(!q.retry){S.done++;P.daily.q++;P.totalQ++}let mult=q.isBoss?2:1,comboMult=Math.min(2.5,1+Math.floor(S.combo/3)*.25);
 if(ok){let levelBefore=lvInfo(P.xp).lv;let ev=applyCorrect(q);memoryCredit=ev.credited;S.hit++;if(!q.retry){P.totalCorrect++;S.firstHits++;if(!ev.credited)S.practiceHits++}S.combo++;S.best=Math.max(S.best,S.combo);P.bestCombo=Math.max(P.bestCombo,S.combo);
 if(q.dir==='fromJP'){S.prodHits++;P.daily.prod++}if(q.typed)S.typedHits++;if(q.dir==='listen')S.audioHits++;if(q.retry){S.revengeKills++;P.daily.revenge++}
 let rivalKills=!q.retry?registerRivalWin(x):0;S.rivalWins+=rivalKills;
 let gain=Math.round((q.retry?8:14)*mult*comboMult*(w.nemesis?1.6:1));if(ev.sealed){gain+=35;S.seals++;banner('✦ SEALED +35','seal')}if(ev.nemesisKilled){gain+=80;S.nemKills++;S.coin+=12;banner('☠ NEMESIS PURGED +80','seal')}if(rivalKills){gain+=70*rivalKills;S.coin+=10*rivalKills;banner('⚔ RIVAL CLEARED','seal')}
 S.xp+=gain;P.xp+=gain;S.coin+=q.isBoss?5:1;if(btn)btn.classList.add('correct');$('feedback').className='feedback on';$('feedback').innerHTML=`<div class="hit">${q.typed?'SPELL CLEAR':q.retry?'REVENGE COMPLETE':'PERFECT HIT'} <span class="gain">+${gain} XP</span></div>${(!q.retry&&!ev.credited)?'<div class="small">短期練習：XP獲得。熟練度は復習期限後に上昇します。</div>':''}${feedbackDetail(x,false)}`;
 floatXP('+'+gain+' XP',btn||$('card'));
 let fx=ev.nemesisKilled?'nemesis':ev.sealed?'seal':rivalKills?'rival':q.isBoss?'boss':
   lvInfo(P.xp).lv>levelBefore?'levelup':
   S.combo===10?'combo10':S.combo===5?'combo5':S.combo===3?'combo3':
   'ok';
 beep(fx);vibe(16);if(ev.after>ev.before)toast(`${STAGES[ev.before]} → ${STAGES[ev.after]}`)}
 else{S.miss++;S.combo=0;S.mistakes.push(x);let nem=applyWrong(q);if(btn)btn.classList.add('wrong');if(!q.typed)[...$('choices').children].forEach(b=>{if(b.dataset.correct==='1')b.classList.add('correct')});
 if(selected){let r=recordConfusion(x,selected);if(r&&r.confusions===2)banner('⚔ RIVAL UNLOCKED','nem')}
 if(q.retry<2){let rq=qFor(x,q.retry+1,q),at=Math.min(3,S.queue.length);S.queue.splice(at,0,rq)}
 $('feedback').className='feedback on';$('feedback').innerHTML=`<div class="miss">${timeout?'TIME OUT':q.typed?'SPELL MISS':'MISS'} → ${esc(q.typed?orig(x,S.lang):q.dir==='fromJP'?orig(x,S.lang):jp(x))}</div>${feedbackDetail(x)}<div class="small" style="padding-top:5px">${q.retry<2?'数問後に短期復習します。':'時間を空けた復習も必要です。'}${nem?' NEMESIS化':''}</div>`;
 if(nem)banner('☠ NEMESIS ACTIVE','nem');beep('bad');vibe([25,20,25]);$('card').classList.add('shake');setTimeout(()=>$('card').classList.remove('shake'),300)}
 if(!q.retry){
   P.reviewLog.push({at:Date.now(),id:x.id,skill:skillFor(q),ok:!!ok,credited:!!memoryCredit});
   if(P.reviewLog.length>1000)P.reviewLog=P.reviewLog.slice(-1000);
 }
 P.coin+=S.coin-coinBefore;
 $('reportIssue').onclick=()=>markIssue(x);renderMastery(W(x));updateHUD();save();if(ok){
   const explain=()=>{
     clearTimeout(nextTimeout);
     if(!$('continueBtn')){
       const area=$('feedback');
       const detail=note(x,S.lang);
       if(detail)area.insertAdjacentHTML('beforeend','<div class="detail note">'+esc(detail)+'</div>');
       area.insertAdjacentHTML('beforeend','<button type="button" class="next-question" id="continueBtn">確認した → 次の問題へ</button>');
       $('continueBtn').onclick=next;
     }
     const more=$('detailHold');if(more)more.remove();
   };
   if(P.slowCorrect)explain();
   else {
     const detail=note(x,S.lang);
     if(detail||jp(x).length>38){
       $('feedback').insertAdjacentHTML('beforeend','<button type="button" class="flag" id="detailHold">解説を見る（自動送りを停止）</button>');
       $('detailHold').onclick=explain;
     }
     nextTimeout=setTimeout(next,950);
   }
 }else{$('feedback').insertAdjacentHTML('beforeend','<button type="button" class="next-question" id="continueBtn">確認した → 次の問題へ</button>');$('continueBtn').onclick=next}}
function updateHUD(){$('qstat').textContent=`${Math.min(S.done||0,S.initial||0)}/${S.initial||0}`;$('hitstat').textContent=S.hit||0;$('combo').textContent=S.combo||0;$('xpstat').textContent=S.xp||0;$('roundBar').style.width=((S.done||0)/(S.initial||1)*100)+'%'}
function finish(){clearTimer();clearTimeout(nextTimeout);let coinBefore=S.coin;let uniq=[...new Map(S.mistakes.map(x=>[x.id,x])).values()],attempt=S.done,acc=attempt?S.firstHits/attempt:0,rank=acc>=.97?'SS':acc>=.92?'S':acc>=.84?'A':acc>=.72?'B':acc>=.58?'C':'D',bonus=0,rewards=[];
 if(!uniq.length){bonus+=90;S.coin+=15;rewards.push('NO MISS +90 XP / ◈15')}if(S.best>=10){bonus+=50;S.coin+=8;rewards.push('10 COMBO +50 XP / ◈8')}
 if(P.daily.q>=30&&P.daily.revenge>=5&&P.daily.prod>=8&&!P.daily.rewarded){bonus+=250;S.coin+=50;P.daily.rewarded=true;rewards.push('DAILY ALL CLEAR +250 XP / ◈50')}
 S.xp+=bonus;P.xp+=bonus;P.coin+=S.coin-coinBefore;beep(acc>=.72?'resultGood':'resultLow');save();window.DOPACloud?.flush?.();renderZoneStats();$('game').classList.add('hidden');$('profile').classList.remove('hidden');let list=uniq.map(x=>`<div class="mistake"><b>${esc(orig(x,S.lang))}</b>　${esc(jp(x))}　<span class="small">${getW(x)?.nemesis?'NEMESIS':''}</span></div>`).join('');
 $('result').innerHTML=`<div class="end"><div class="small">QUEST COMPLETE</div><div class="rank">${rank}</div><b>${Math.round(acc*100)}% CLEAR</b><div class="endgrid"><div><b>${S.xp}</b><span>XP</span></div><div><b>${S.best}</b><span>MAX COMBO</span></div><div><b>${S.typedHits}</b><span>SPELL</span></div><div><b>${S.rivalWins}</b><span>RIVAL WIN</span></div></div><div class="loot"><b>REWARD</b><br>◈ ${S.coin} DOPA ${rewards.length?'<br>'+rewards.join('<br>'):''}<br>REVENGE ${S.revengeKills} ・ NEMESIS ${S.nemKills} ・ SEALED ${S.seals}<br>初回正答 ${S.firstHits}/${S.done} ・ 早期練習 ${S.practiceHits}</div>${uniq.length?`<div class="mistakes">${list}</div>`:''}<button class="primary" id="again">▶ NEXT QUEST</button></div>`;
 $('result').classList.remove('hidden');$('again').onclick=()=>{$('result').classList.add('hidden');$('setup').classList.remove('hidden');renderProfile();renderZoneStats()}}
function modeText(){return{campaign:'初見と期限到来語を優先。4択の認識を固め、逆引き、任意の文字入力へ進みます。',due:'復習期限の来た語を重点攻略。短期連続正答はXPになりますが、熟練度は初回か期限到来後の想起でのみ上昇します。',weak:'累積3回以上誤答した語を集中練習します。',rival:'4択で同じ二語を2回以上取り違へると解放。苦手な対立を集中して学びます。',free:'指定エリアを自由に練習。文字入力も選べます。'}[mode]}
function download(name,obj){let b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
function init(){document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));$('modeHelp').textContent=modeText()});
 $('lang').onchange=updateZones;$('zone').onchange=renderZoneStats;const semanticSelect=$('semanticCategory');if(semanticSelect)semanticSelect.onchange=()=>{updateDetailFilters();renderZoneStats()};for(const id of ['semanticMedium','semanticTag'])if($(id))$(id).onchange=()=>{updateDetailFilters();renderZoneStats()};if($('clearStudyDetails'))$('clearStudyDetails').onclick=()=>{$('semanticMedium').value=$('semanticTag').value='all';updateDetailFilters();renderZoneStats()};const senseChoice=$('shanSenseMode');if(senseChoice)senseChoice.onchange=()=>{updateShanSenseControl();updateSemanticCategories();updateDetailFilters();renderZoneStats()};const slow=$('slowCorrect');if(slow){slow.checked=!!P.slowCorrect;slow.onchange=()=>{P.slowCorrect=slow.checked;save()}};$('direction').onchange=()=>{$('includeAudio').disabled=$('direction').value==='listen'};
 $('start').onclick=start;$('soundBtn').onclick=()=>{
 if(P.sound){P.lastSfxStyle=P.sfxStyle;P.sfxStyle='off'}
 else P.sfxStyle=P.lastSfxStyle||'standard';
 refreshSoundControls();save();
 };
 if($('sfxPreset'))$('sfxPreset').onchange=()=>{
   P.sfxStyle=$('sfxPreset').value;
   if(P.sfxStyle!=='off')P.lastSfxStyle=P.sfxStyle;
   refreshSoundControls();save();
 };
 if($('sfxVolume'))$('sfxVolume').oninput=()=>{
   P.sfxVolume=Number($('sfxVolume').value);
   refreshSoundControls();save();
 };
 document.querySelectorAll('[data-sfx-preview]').forEach(button=>{
   button.onclick=()=>{
     refreshSoundControls();
     const played=beep(button.dataset.sfxPreview);
     if(!played&&P.sound)toast('この環境では音楽保護のため効果音を鳴らせません');
     refreshSoundControls();
   };
 });
 $('backupBtn').onclick=()=>{download('dopa_quest_v6_progress.json',{format:'DOPA_QUEST_V5',exportedAt:new Date().toISOString(),profile:P});toast('進捗・RIVAL・校閲候補を出力しました')};
 $('loadBtn').onclick=()=>$('loadFile').click();$('loadFile').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{let o=JSON.parse(await f.text());if(!['DOPA_QUEST_V4','DOPA_QUEST_V5'].includes(o.format)||!o.profile||!o.profile.words)throw Error('invalid');if(Object.keys(P.words).length&&!confirm('現在の進捗を読み込んだファイルの内容で置き換へます。実行しますか？'))return;P={...fresh(),...o.profile,migratedFrom:o.format==='DOPA_QUEST_V4'?'v4':''};ensureProfile();normalizeSoundPrefs();rollover();save();renderZoneStats();refreshSoundControls();toast('進捗を読み込みました')}catch(err){toast('進捗ファイルを読めません')}finally{e.target.value=''}};
 $('typedAnswer').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitTyped()}});
 document.addEventListener('keydown',e=>{if($('game').classList.contains('hidden')||S.cur?.typed||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;let n=+e.key;if(n>=1&&n<=4){let b=$('choices').children[n-1];if(b&&!b.disabled)b.click()}});
 $('modeHelp').textContent=modeText();updateZones();renderProfile();refreshSoundControls();
 try{window.speechSynthesis?.addEventListener('voiceschanged',refreshVoices)}catch(e){}
}
window.DOPA_SYNC_API = {
  snapshot(){return JSON.parse(JSON.stringify(P))},
  restore(profile){if(!profile||typeof profile!=='object'||!profile.words||!profile.rivals)throw Error('Invalid profile');
    P={...fresh(),...profile};ensureProfile();normalizeSoundPrefs();rollover();
    localStorage.setItem(KEY,JSON.stringify(P));
    renderProfile();renderZoneStats();refreshSoundControls();
    if($('slowCorrect'))$('slowCorrect').checked=!!P.slowCorrect;
    $('result').classList.add('hidden');$('game').classList.add('hidden');
    $('setup').classList.remove('hidden');$('profile').classList.remove('hidden');
  }
};
init();
window.dispatchEvent(new Event('dopa-game-ready'));
