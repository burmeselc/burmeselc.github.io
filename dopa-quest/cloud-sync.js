// DOPA QUEST v6 experimental cloud sync. Requires firebase-config.js and published Firestore rules.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const cfg=window.DOPA_FIREBASE_CONFIG;
if(!cfg?.projectId||!cfg?.apiKey||!cfg?.appId)throw new Error('Incomplete Firebase configuration');
const app=initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id),status=$('cloudStatus'),conflictBox=$('cloudConflict');
let uid=null,revision=0,busy=false,blocked=false,timer=null,dirty=false;
const docFor=id=>doc(db,'users',uid,'dopa_snapshots',id);
const memoryKey=()=>`dopa-sync-meta:${cfg.projectId}:${uid}`;
const memo=()=>{try{return JSON.parse(localStorage.getItem(memoryKey()))||{}}catch{return {}}};
const remember=(rev,hash)=>localStorage.setItem(memoryKey(),JSON.stringify({rev,hash}));
const snapshot=()=>window.DOPA_SYNC_API.snapshot();
const print=s=>{status.textContent=s};
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)+'/'+s.length};
const hasProgress=p=>Object.keys(p?.words||{}).length>0||(p?.totalQ||0)>0;
const changed=()=>memo().hash!==hash(JSON.stringify(snapshot()));
function hideConflict(){blocked=false;conflictBox.classList.add('hidden')}
function showConflict(msg){blocked=true;clearTimeout(timer);conflictBox.classList.remove('hidden');print('⚠ '+msg+'。同期を停止しました。')}
function chunks(s){
  const b=new TextEncoder().encode(s);if(b.length>15000000)throw Error('学習記録が15MBを超えてゐます');
  const parts=[];for(let i=0;i<b.length;i+=96000){
    let raw='';for(const x of b.subarray(i,i+96000))raw+=String.fromCharCode(x);
    parts.push(btoa(raw));
  }
  return parts;
}
function assemble(arr){
  const decoded=arr.map(s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
  const b=new Uint8Array(decoded.reduce((n,a)=>n+a.length,0));let i=0;
  for(const a of decoded){b.set(a,i);i+=a.length}
  return new TextDecoder().decode(b);
}
async function meta(){let d=await getDoc(docFor('meta'));return d.exists()?d.data():null}
async function download(m){
  if(!m||!Number.isInteger(m.chunks)||m.chunks<1||m.chunks>300)throw Error('クラウド保存形式が不正');
  const fetched=await Promise.all(Array.from({length:m.chunks},(_,i)=>getDoc(docFor('chunk-'+String(i).padStart(3,'0')))));
  if(fetched.some(x=>!x.exists()||typeof x.data().payload!=='string'))throw Error('クラウド記録の断片が不足');
  const p=JSON.parse(assemble(fetched.map(x=>x.data().payload)));
  if(!p||typeof p.words!=='object'||typeof p.rivals!=='object')throw Error('学習記録の形式が不正');
  return p;
}
async function restore(m){
  const p=await download(m);
  window.DOPA_SYNC_API.restore(p);
  revision=m.rev;remember(revision,hash(JSON.stringify(snapshot())));
  dirty=false;hideConflict();
  print(`✓ クラウドから復元（${Object.keys(p.words).length}語・版${revision}）`);
}
async function upload(expected){
  const raw=JSON.stringify(snapshot()),parts=chunks(raw);
  await runTransaction(db,async tx=>{
    const ref=docFor('meta'),before=await tx.get(ref),current=before.exists()?before.data().rev:0;
    if(current!==expected){const e=Error('Concurrent update');e.conflict=true;throw e}
    for(let i=0;i<parts.length;i++)tx.set(docFor('chunk-'+String(i).padStart(3,'0')),{payload:parts[i]});
    tx.set(ref,{rev:current+1,chunks:parts.length,format:1,updatedAt:serverTimestamp()});
  });
  return {raw,next:expected+1};
}
async function flush(){
  if(!uid||busy||blocked)return;
  if(!changed()){dirty=false;return}
  busy=true;clearTimeout(timer);print('学習記録を同期中…');
  try{
    const result=await upload(revision);
    revision=result.next;remember(revision,hash(result.raw));
    dirty=changed();print(`✓ クラウド同期完了（版${revision}）`);
  }catch(e){
    if(e.conflict)showConflict('別端末の記録と競合しました');
    else{print('同期できませんでした。学習記録は端末内に保持されてゐます。');console.error(e)}
  }finally{busy=false;if(dirty&&!blocked)scheduleUpload()}
}
function scheduleUpload(){
  if(!uid||blocked)return;
  dirty=true;clearTimeout(timer);timer=setTimeout(flush,20000);
}
async function reconcile(){
  if(!uid)return;print('クラウドの進捗を照合中…');
  try{
    const remote=await meta(),p=snapshot(),m=memo(),currentHash=hash(JSON.stringify(p));
    if(!remote){revision=0;hideConflict();await flush();return}
    revision=remote.rev;
    if(!hasProgress(p)||m.hash===currentHash){await restore(remote);return}
    if(m.rev===remote.rev){hideConflict();await flush();return}
    showConflict('端末とクラウド双方に異なる学習記録があります');
  }catch(e){print('クラウド照合失敗。端末内で学習は続行できます。');console.error(e)}
}
$('cloudLogin').onclick=async()=>{
  try{await signInWithPopup(auth,new GoogleAuthProvider())}
  catch(e){print('ログイン失敗：'+(e.code||e.message))}
};
$('cloudLogout').onclick=async()=>{clearTimeout(timer);await signOut(auth)};
$('cloudSync').onclick=()=>blocked?print('先に同期の競合を解決して下さい'):flush();
$('cloudChooseRemote').onclick=async()=>{
  if(!confirm('端末内の進捗をクラウドの内容で上書きします。先にSAVEでバックアップしましたか？'))return;
  try{await restore(await meta())}catch(e){print(e.message)}
};
$('cloudChooseLocal').onclick=async()=>{
  if(!confirm('クラウドの進捗をこの端末の内容で上書きします。両方のバックアップは保存済みですか？'))return;
  try{revision=(await meta())?.rev||0;hideConflict();await flush()}catch(e){print(e.message)}
};
window.DOPACloud={scheduleUpload,flush};
onAuthStateChanged(auth,async user=>{
  uid=user?.uid||null;clearTimeout(timer);busy=false;hideConflict();
  $('cloudLogin').disabled=!!uid;
  $('cloudLogout').disabled=!uid;
  $('cloudSync').disabled=!uid;
  if(uid){print('ログイン済み：'+(user.displayName||user.email||'Googleアカウント'));await reconcile()}
  else print('端末内保存中。Googleログインで同期できます。');
});