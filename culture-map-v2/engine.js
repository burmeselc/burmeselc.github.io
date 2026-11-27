/* 文化圏の関係は編集上の仮説。実測された共起確率ではない。 */
function buildCatalog(base,lines,expansion=[]){
 const C=base.map(c=>({...c,baseItems:c.items.map(x=>({...x,cid:c.id,sid:null})),items:c.items.map(x=>({...x,cid:c.id,sid:null}))}));
 const SUBS=lines.map((line,id)=>{
  const [pid,name,tagText,titleText]=line.split('|'),cid=Number(pid),tags=tagText.split(',');
  const items=titleText.split(';').map((title,j)=>({id:'s'+id+'-'+j,cid,sid:id,title,desc:name+'の関連資料・作品。',tags:[...tags]}));
  C[cid].items.push(...items);
  return {id,cid,name,tags,items,prompt:C[cid].name+'のうち、'+name+'にどのくらい関心がありますか？ 例：'+items.slice(0,3).map(x=>x.title).join('、')};
 });
 // Append only: existing IDs, saved answers and feedback are preserved.
 const known=new Set(C.flatMap(c=>c.items).map(x=>x.title.normalize('NFKC').replace(/[　\s]/g,'').toLowerCase()));
 expansion.forEach(line=>{
  const [rawSid,titles]=line.split('|'),sid=Number(rawSid),s=SUBS[sid];
  if(!s||!titles)return;
  titles.split(';').forEach((title,j)=>{
   const key=title.normalize('NFKC').replace(/[　\s]/g,'').toLowerCase();
   if(!title||known.has(key))return;
   known.add(key);
   const x={id:'x'+sid+'-'+j,cid:s.cid,sid,title,desc:s.name+'の関連資料・作品。',tags:[...s.tags]};
   s.items.push(x);C[s.cid].items.push(x);
  });
 });
 const ITEMS=C.flatMap(c=>c.items),BY=Object.fromEntries(ITEMS.map(x=>[x.id,x]));
 return {C,SUBS,ITEMS,BY};
}
const CM=(()=>{
 const v=x=>x===undefined||x==='?'?null:Number(x), b=c=>'b'+c.id,s=x=>'s'+x.id,i=x=>'i'+x.id;
 const uniq=x=>[...new Set(x)], common=(a,b)=>a.filter(x=>b.includes(x));
 const titleKey=x=>x.title.normalize('NFKC').replace(/[　\s]/g,'').toLowerCase();
 const generic=new Set(['資料','体系','生活','歴史','音楽','文学','映画','漫画','ゲーム','ネット','社会','技術','異文化','キャラ','デザイン','前衛','物語']);
 const strength=t=>generic.has(t)?0.22:1;
 const similarity=(a,b)=>{const u=uniq([...a,...b]);return u.length?common(a,b).reduce((n,t)=>n+strength(t),0)/u.reduce((n,t)=>n+strength(t),0):0};
 function profile(C,S,a){
  return C.map(c=>{
   const broad=v(a[b(c)]),subs=S.filter(x=>x.cid===c.id).map(x=>v(a[s(x)])).filter(x=>x!==null),items=c.items.map(x=>v(a[i(x)])).filter(x=>x!==null);
   const n=(broad===null?0:4)+subs.length+items.length;
   const score=n?((broad===null?0:broad*4)+subs.reduce((p,x)=>p+x,0)+items.reduce((p,x)=>p+x,0))/n:null;
   return {...c,b:broad,score,count:(broad===null?0:1)+subs.length+items.length};
  }).sort((x,y)=>(y.score??-99)-(x.score??-99)||y.count-x.count||x.id-y.id)
 }
 function roots(C,S,a){
  const p=profile(C,S,a).filter(c=>c.score>0);
  const sig=c=>uniq([...c.tags,...S.filter(x=>x.cid===c.id&&v(a[s(x)])>0).flatMap(x=>x.tags)]);
  const out=[];
  for(const c of p){
   let best=-1,hit=.30;
   out.forEach((g,j)=>{const q=g.reduce((n,d)=>n+similarity(sig(c),sig(d)),0)/g.length;if(q>hit){best=j;hit=q}});
   if(best<0)out.push([c]);else out[best].push(c);
  }
  return out;
 }
 function tags(C,S,I,a){
  const w={};
  function add(ts,k){if(k===null||k===0)return;const t=uniq(ts);t.forEach(x=>w[x]=(w[x]||0)+k*strength(x)/Math.sqrt(t.length))}
  C.forEach(c=>add(c.tags,v(a[b(c)])));
  S.forEach(x=>add(x.tags,v(a[s(x)])===null?null:v(a[s(x)])*1.4));
  I.forEach(x=>{const val=v(a[i(x)]);if(val!==null)add(x.tags,val*1.5)});
  return w;
 }
 function affinity(x,w){const t=uniq(x.tags);return t.reduce((n,k)=>n+(w[k]||0)*strength(k),0)/Math.sqrt(t.length||1)}
 function representatives(C,S,a,limit){
  const all=profile(C,S,a),r=roots(C,S,a),picked=[],used=new Set();
  for(let j=0;j<limit;j++){let found=false;for(const g of r){if(g[j]&&picked.length<limit){picked.push(g[j]);used.add(g[j].id);found=true}}if(!found||picked.length===limit)break}
  if(!picked.length){const groups=new Set();for(const c of all){if(c.b===-2||groups.has(c.group))continue;picked.push(c);groups.add(c.group);if(picked.length>=Math.min(4,limit))break}}
  return picked;
 }
 function makeSub(C,S,a){return representatives(C,S,a,8).flatMap(c=>S.filter(x=>x.cid===c.id).map(x=>({kind:'s',id:x.id})))}
 function makeDetail(C,S,I,a){
  const r=representatives(C,S,a,8),out=[],seen=new Set(),w=tags(C,S,I,a);
  for(const c of r){
   const ranked=S.filter(x=>x.cid===c.id&&v(a[s(x)])!==-2).sort((x,y)=>(v(a[s(y)])??0)-(v(a[s(x)])??0));
   const choose=(pool)=>{const x=pool.filter(x=>!seen.has(titleKey(x))).sort((x,y)=>affinity(y,w)-affinity(x,w)||x.id.localeCompare(y.id))[0];if(x){seen.add(titleKey(x));out.push({kind:'i',id:x.id})}};
   if(ranked.length){choose(ranked[0].items);choose(ranked[1]?.items||c.baseItems)}else if(c.b!==-2){choose(c.baseItems);choose(c.baseItems)}
  }
  return out;
 }
 function makeBoundary(C,S,I,a){
  const w=tags(C,S,I,a),tested=new Set(I.filter(x=>Object.hasOwn(a,i(x))).map(x=>x.cid)),hot=new Set(profile(C,S,a).filter(x=>x.score>0).map(x=>x.id)),used=new Set(),seen=new Set(I.filter(x=>Object.hasOwn(a,i(x))).map(titleKey));
  const pool=I.filter(x=>!tested.has(x.cid)&&!hot.has(x.cid)&&v(a[b(C[x.cid])])!==-2&&(x.sid===null||v(a[s(S[x.sid])])!==-2));
  const out=[];
  for(let k=0;k<8;k++){const choices=pool.filter(x=>!used.has(x.cid)&&!seen.has(titleKey(x)));if(!choices.length)break;choices.sort((x,y)=>(k<6?affinity(y,w)-affinity(x,w):Math.abs(affinity(x,w)-.5)-Math.abs(affinity(y,w)-.5))||x.id.localeCompare(y.id));const x=choices[0];used.add(x.cid);seen.add(titleKey(x));out.push({kind:'i',id:x.id})}
  return out;
 }
 function recommend(C,S,I,a,feedback={}){
  const groups=roots(C,S,a),p=profile(C,S,a),hot=new Set(p.filter(x=>x.score>0).map(x=>x.id));
  if(!groups.length)return {direct:[],bridge:[],adventure:[],byRoot:[]};
  const combined={...a,...Object.fromEntries(Object.entries(feedback).map(([k,val])=>['i'+k,val]))},w=tags(C,S,I,combined);
  const scores=Object.fromEntries(p.map(c=>[c.id,c.score??0]));
  const seen=new Set(I.filter(x=>Object.hasOwn(feedback,x.id)||['3','0','-2'].includes(a[i(x)])).map(titleKey));
  const candidates=I.filter(x=>!seen.has(titleKey(x))&&!Object.hasOwn(feedback,x.id)&&v(a[b(C[x.cid])])!==-2&&(x.sid===null||v(a[s(S[x.sid])])!==-2));
  const used=new Set(seen);
  const groupTags=g=>uniq(g.flatMap(c=>[...c.tags,...S.filter(x=>x.cid===c.id&&v(a[s(x)])>0).flatMap(x=>x.tags)]));
  function rank(x,local){return affinity(x,w)+Math.max(0,scores[x.cid])*1.2+(x.sid===null?0:(v(a[s(S[x.sid])])??0)*2)+(a[i(x)]==='2'?8:0)+(local?common(x.tags,local).reduce((n,t)=>n+strength(t),0)*1.5:0)}
  const choose=(pool,cmp)=>{const x=pool.filter(x=>!used.has(titleKey(x))).sort(cmp)[0];if(x)used.add(titleKey(x));return x};
  const byRoot=groups.map(g=>{
   const local=groupTags(g),out=[],counts={};
   const pool=candidates.filter(x=>g.some(c=>c.id===x.cid));
   for(let k=0;k<6;k++){
    const x=choose(pool,(x,y)=>(counts[x.cid]||0)-(counts[y.cid]||0)||rank(y,local)-rank(x,local)||(x.id.localeCompare(y.id)));
    if(!x)break;out.push(x);counts[x.cid]=(counts[x.cid]||0)+1;
   }
   return out;
  });
  const remote=candidates.filter(x=>!hot.has(x.cid)),bridge=[],adventure=[],domainSeen=new Set();
  // Each root contributes at most one adjacent suggestion per round.
  for(let round=0;round<2&&bridge.length<8;round++){
   for(const g of groups){if(bridge.length===8)break;const local=groupTags(g);const x=choose(remote.filter(x=>!domainSeen.has(x.cid)&&common(x.tags,local).some(t=>!generic.has(t))&&affinity(x,w)>0),(x,y)=>rank(y,local)-rank(x,local)||x.id.localeCompare(y.id));if(x){bridge.push(x);domainSeen.add(x.cid)}}
  }
  for(let k=0;k<4;k++){const x=choose(remote.filter(x=>!domainSeen.has(x.cid)&&affinity(x,w)>0),(x,y)=>Math.abs(affinity(x,w)-.4)-Math.abs(affinity(y,w)-.4)||x.id.localeCompare(y.id));if(!x)break;adventure.push(x);domainSeen.add(x.cid)}
  return {direct:byRoot.flat(),bridge,adventure,byRoot};
 }
 return {profile,roots,tags,affinity,makeSub,makeDetail,makeBoundary,recommend};
})();