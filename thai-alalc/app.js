/* Dictionary-first, conservative ALA-LC assistance. All processing stays in browser. */
const input=document.querySelector('#input'),output=document.querySelector('#result');
const resultStatus=document.querySelector('#result-status'), dictionaryStatus=document.querySelector('#dictionary-status');
const candidatePanel=document.querySelector('#candidates'),candidateList=document.querySelector('#candidate-list');
const inputTitle=document.querySelector('#input-title'),modes=document.querySelectorAll('[data-mode]');
let entries=[],mode='forward',tokens=[];
let byThai=new Map(),byRoman=new Map();
const safe=v=>String(v??'').normalize('NFC').trim();
const canon=v=>safe(v).replace(/[’'ʼʾ]/g,'‘').replace(/\s+/g,' ').toLocaleLowerCase('en');
const THAI=/[\u0e00-\u0e7f]/u,ROMAN=/[A-Za-zÀ-žǍ-ǿưƯœŒæÆ‘\p{M}]/u;
const ranking={reviewed:0,tentative:1,unresolved:2};
const prefer=(a,b)=>(ranking[a.status]??2)-(ranking[b.status]??2);
function reindex(){
  byThai=new Map();byRoman=new Map();
  for(const e of entries){
    const a=e.thai[0];if(!byThai.has(a))byThai.set(a,[]);byThai.get(a).push(e);
    if(e.alalc){const r=canon(e.alalc)[0];if(!byRoman.has(r))byRoman.set(r,[]);byRoman.get(r).push(e);}
  }
  for(const map of [byThai,byRoman])for(const list of map.values())list.sort((a,b)=>b[mode==='reverse'?'alalc':'thai'].length-a[mode==='reverse'?'alalc':'thai'].length || prefer(a,b));
}
function addEntries(items){
 if(!Array.isArray(items))throw Error('辞書データは配列でなければなりません。');
 const normalized=items.filter(x=>x&&typeof x.thai==='string'&&x.thai.trim())
 .map(x=>({thai:safe(x.thai),alalc:safe(x.alalc),meaning:safe(x.meaning),ipa:safe(x.ipa),source:safe(x.source),
 status:['reviewed','tentative','unresolved'].includes(x.status)?x.status:'unresolved'}));
 const map=new Map(entries.map(x=>[JSON.stringify([x.thai,x.alalc,x.meaning]),x]));
 normalized.forEach(x=>map.set(JSON.stringify([x.thai,x.alalc,x.meaning]),x));
 entries=[...map.values()];reindex();
 dictionaryStatus.textContent='辞書 '+entries.length.toLocaleString()+' 件（読み込み済み）';render();return normalized.length;
}
function findMatches(text,at){
 const reverse=mode==='reverse', key=reverse?'alalc':'thai';
 const ch=reverse?canon(text[at]):text[at];
 const group=(reverse?byRoman:byThai).get(ch)||[];
 let matches=[],max=0;
 for(const e of group){
   const value=e[key];if(!value||value.length<max)continue;
   if(reverse?canon(text.slice(at,at+value.length))!==canon(value):text.slice(at,at+value.length)!==value)continue;
   if(reverse&&ROMAN.test(text[at+value.length]||''))continue;
   if(value.length>max){max=value.length;matches=[];}if(value.length===max)matches.push(e);
 }
 return {length:max,matches:matches.sort(prefer)};
}
function tokenize(text){
 const parts=[];let i=0;
 while(i<text.length){
  if(/\s/u.test(text[i])){let j=i+1;while(j<text.length&&/\s/u.test(text[j]))j++;parts.push({raw:text.slice(i,j),choices:[],space:true});i=j;continue;}
  const f=findMatches(text,i);if(f.length){parts.push({raw:text.slice(i,i+f.length),choices:f.matches,selected:0});i+=f.length;continue;}
  const thai=THAI.test(text[i]),roman=ROMAN.test(text[i]);let j=i+1;
  while(j<text.length&&(thai?THAI.test(text[j]):roman?ROMAN.test(text[j]):!THAI.test(text[j])&&!ROMAN.test(text[j])&&!/\s/u.test(text[j]))){
    if(findMatches(text,j).length)break;j++;
  }
  parts.push({raw:text.slice(i,j),choices:[],unknown:thai||roman});i=j;
 }
 return parts;
}
function tokenText(t){
 if(t.space||!t.choices.length)return t.raw;
 const e=t.choices[t.selected||0];return mode==='forward'?e.alalc||'〔未確定：'+e.thai+'〕':e.thai;
}
function getPrintable(){return mode==='search'?'':tokens.map(t=>t.unknown?'〔未登録：'+t.raw+'〕':tokenText(t)).join('');}
function showCandidates(i){
 const token=tokens[i];candidateList.replaceChildren();
 if(!token?.choices?.length){candidatePanel.hidden=true;return;}
 candidatePanel.hidden=false;
 for(const [k,e] of token.choices.entries()){
  const b=document.createElement('button');b.type='button';b.className='candidate-choice'+(k===token.selected?' is-selected':'');
  const word=document.createElement('span');word.className='candidate-word';
  word.textContent=mode==='forward'?e.alalc||'未確定':e.thai;
  const gloss=document.createElement('span');gloss.className='candidate-gloss';gloss.textContent=e.meaning||'意味情報なし';
  const more=document.createElement('em');more.textContent=' · '+e.status+' · '+(mode==='forward'?e.thai:e.alalc);
  gloss.append(more);b.append(word,gloss);b.addEventListener('click',()=>{token.selected=k;renderResult();showCandidates(i);});
  candidateList.append(b);
 }
}
function renderResult(){
 output.replaceChildren();output.classList.toggle('thai-result',mode==='reverse');
 if(!input.value.trim()){output.textContent='入力するとここに変換候補が表示されます。';candidatePanel.hidden=true;resultStatus.textContent='';return;}
 let unknown=0,ambiguous=0,unreviewed=0;
 tokens.forEach((t,i)=>{
  if(t.unknown){unknown++;const s=document.createElement('span');s.className='token-unknown';s.textContent='〔未登録：'+t.raw+'〕';output.append(s);return;}
  const e=t.choices?.[t.selected||0];if(e&&e.status!=='reviewed')unreviewed++;
  if(t.choices?.length>1){ambiguous++;const b=document.createElement('button');b.type='button';b.className='token-button';b.title='候補を選択';b.textContent=tokenText(t);b.addEventListener('click',()=>showCandidates(i));output.append(b);}
  else output.append(document.createTextNode(tokenText(t)));
 });
 resultStatus.textContent='辞書にない部分 '+unknown+' 箇所 · 候補選択 '+ambiguous+' 箇所 · 未査読 '+unreviewed+' 箇所。文章の分かち書きは別途確認が必要です。';
}
function renderSearch(){
 output.replaceChildren();candidatePanel.hidden=true;output.classList.add('thai-result');
 const q=canon(input.value);if(!q){output.textContent='見出し語・翻字・英語の意味から辞書を検索できます。';resultStatus.textContent='';return;}
 const found=entries.filter(x=>x.thai.includes(input.value.trim())||canon(x.alalc).includes(q)||canon(x.meaning).includes(q)).slice(0,75);
 for(const e of found){const b=document.createElement('button');b.type='button';b.className='candidate-choice';
  b.textContent=e.thai+'　'+(e.alalc||'未確定')+'　— '+(e.meaning||'意味情報なし');
  b.addEventListener('click',()=>navigator.clipboard?.writeText(e.alalc||e.thai));output.append(b);}
 if(!found.length)output.textContent='該当する辞書項目はありません。';
 resultStatus.textContent=found.length+' 件表示（最大75件）。クリックすると翻字をコピーします。';
}
function render(){if(mode==='search'){renderSearch();return;}tokens=tokenize(input.value);candidatePanel.hidden=true;renderResult();}
function setMode(v){
 mode=v;for(const b of modes){const on=b.dataset.mode===v;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));}
 inputTitle.textContent={forward:'タイ文字の入力',reverse:'ALA-LC翻字の入力',search:'見出し語・翻字・意味の検索'}[v];
 input.classList.toggle('roman-input',v==='reverse');input.placeholder={forward:'例：ภาษาไทย',reverse:'例：khā',search:'例：ภาษา / phā / language'}[v];
 input.value='';render();input.focus();
}
for(const b of modes)b.addEventListener('click',()=>setMode(b.dataset.mode));
input.addEventListener('input',render);
document.querySelector('#clear').addEventListener('click',()=>{input.value='';render();input.focus();});
document.querySelector('#copy').addEventListener('click',async()=>{
 const text=getPrintable();if(!text){resultStatus.textContent='コピーする結果がありません。';return;}
 try{await navigator.clipboard.writeText(text);resultStatus.textContent='コピーしました。';}
 catch{resultStatus.textContent='コピーできませんでした。ブラウザの権限を確認してください。';}
});
document.querySelector('#download').addEventListener('click',()=>{
 const text=getPrintable();if(!text){resultStatus.textContent='保存する結果がありません。';return;}
 const url=URL.createObjectURL(new Blob([text+'\n'],{type:'text/plain;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='thai-alalc.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
});
function parseCSV(text){
 const rows=[];let row=[],s='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(s);s='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(s);if(row.some(x=>x!==''))rows.push(row);row=[];s='';}
  else s+=c;
 }
 if(quoted)throw Error('CSVの引用符が閉じてゐません。');
 row.push(s);if(row.some(x=>x!==''))rows.push(row);
 const keys=rows.shift()?.map((v,i)=>i===0?v.replace(/^\ufeff/,'').trim():v.trim())||[];
 if(!keys.includes('thai'))throw Error('CSVに thai 列がありません。');
 return rows.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]||''])));
}
document.querySelector('#import-dictionary').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;const st=document.querySelector('#import-status');
 try{
  if(file.size>15e6)throw Error('15 MB以下のファイルを選んでください。');
  const text=await file.text();const rows=file.name.toLowerCase().endsWith('.json')?JSON.parse(text):parseCSV(text);
  const count=addEntries(rows);st.textContent=count+' レコードを追加しました（このページを開いてゐる間のみ）。';
 }catch(e){st.textContent='読み込みに失敗：'+e.message;}
});
fetch('./dictionary.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(addEntries)
.catch(e=>{dictionaryStatus.textContent='辞書を取得できませんでした：'+e.message;render();});
