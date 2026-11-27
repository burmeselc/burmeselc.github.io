/* 文化圏の関係は編集上の仮説。実測された共起確率ではない。 */
function buildCatalog(base,lines,expansion=[],metadata=[],relations=[]){
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
 for(const x of ITEMS){x.inheritedTags=[...x.tags];x.specificTags=[];x.links=[];x.detailLevel=x.sid===null?'base':'domain'}
 for(const [id,tags,desc] of metadata){const x=BY[id];if(!x)throw Error('Unknown metadata ID: '+id);x.specificTags=[...new Set(tags)];x.tags=[...new Set([...x.inheritedTags,...tags])];x.desc=desc;x.detailLevel='item'}
 for(const [a,b,type,reason] of relations){if(!BY[a]||!BY[b]||a===b)throw Error('Invalid relation: '+a+' / '+b);BY[a].links.push({id:b,type,reason});BY[b].links.push({id:a,type,reason})}
 return {C,SUBS,ITEMS,BY};
}
const CM=(()=>{
 const v=x=>x===undefined||x==='?'?null:Number(x), b=c=>'b'+c.id,s=x=>'s'+x.id,i=x=>'i'+x.id;
 const uniq=x=>[...new Set(x)], common=(a,b)=>a.filter(x=>b.includes(x));
 const titleKey=x=>x.title.normalize('NFKC').replace(/[　\s]/g,'').toLowerCase();
 const orderKey=x=>{let k=2166136261;for(const ch of x.id){k=Math.imul(k^ch.charCodeAt(0),16777619)}return k>>>0};
 const tie=(x,y)=>orderKey(x)-orderKey(y)||x.id.localeCompare(y.id);
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
 // Evidence is explicit item-level editorial links or shared specific tags.
 function context(C,S,I,a,feedback={}){
  const combined={...a,...Object.fromEntries(Object.entries(feedback).map(([k,val])=>['i'+k,val]))};
  const positives=I.filter(x=>v(combined[i(x)])>0).map(x=>({x,value:v(combined[i(x)])}));
  const negatives=I.filter(x=>v(combined[i(x)])<0).map(x=>({x,value:v(combined[i(x)])}));
  const w=tags(C,S,I,combined), explicit=new Map(),negativeLinks=new Map();
  for(const {x,value} of positives)for(const l of x.links||[]){if(!explicit.has(l.id))explicit.set(l.id,[]);explicit.get(l.id).push({source:x,type:l.type,reason:l.reason,value})}
  for(const {x} of negatives)for(const l of x.links||[])negativeLinks.set(l.id,(negativeLinks.get(l.id)||0)+1);
  const scores=new Map();
  function evidence(x){
   if(scores.has(x.id))return scores.get(x.id);
   const links=(explicit.get(x.id)||[]).slice().sort((a,b)=>b.value-a.value||a.source.id.localeCompare(b.source.id));
   const matches=positives.map(({x:p,value})=>({source:p,value,tags:common(x.specificTags||[],p.specificTags||[]).filter(t=>!generic.has(t))})).filter(m=>m.tags.length).sort((a,b)=>b.tags.length-a.tags.length||b.value-a.value);
   const overlapScore=matches.slice(0,3).reduce((n,m)=>n+Math.min(3,m.tags.length)*m.value*.7,0);
   const linkScore=links.reduce((n,l)=>n+(l.value===3?7:4),0);
   const negative=negatives.map(({x:p})=>common(x.specificTags||[],p.specificTags||[]).filter(t=>!generic.has(t)).length).reduce((n,k)=>n+Math.min(k,3)*.7,0)+(negativeLinks.get(x.id)||0)*2;
   const e={links,matches,score:Math.min(24,linkScore)+Math.min(12,overlapScore)-Math.min(10,negative)};scores.set(x.id,e);return e
  }
  return {w,positives,explicit,evidence}
 }
 function explain(x,ctx,C,S,a){
  const e=ctx.evidence(x);
  if(e.links.length){const l=e.links[0];return {kind:'link',label:l.type,text:l.reason,source:l.source.title,sourceId:l.source.id,interested:l.value===2}}
  if(e.matches.length){const m=e.matches[0];return {kind:'specific',label:'作品の特徴が共通',text:m.tags.slice(0,4).join('・'),source:m.source.title,sourceId:m.source.id,interested:m.value===2}}
  const near=ctx.positives.filter(p=>x.cid===p.x.cid).sort((a,b)=>Number(x.sid!==null&&b.x.sid===x.sid)-Number(x.sid!==null&&a.x.sid===x.sid)||b.value-a.value)[0];
  if(near)return {kind:'domain',label:x.sid!==null&&near.x.sid===x.sid?'同じ下位文化圏':'同じ基本文化圏',text:'文化圏の分類に基づく候補。個別作品間の関連は未登録です。',source:near.x.title,sourceId:near.x.id,interested:near.value===2};
  const t=x.tags.filter(k=>(ctx.w[k]||0)>0).sort((a,b)=>ctx.w[b]-ctx.w[a]).slice(0,4);
  return {kind:'domain',label:'文化圏・タグからの提案',text:t.length?t.join('・'):(x.sid===null?C[x.cid].name:S[x.sid].name)}
 }
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
   const choose=(pool)=>{const x=pool.filter(x=>!seen.has(titleKey(x))).sort((x,y)=>affinity(y,w)-affinity(x,w)||tie(x,y))[0];if(x){seen.add(titleKey(x));out.push({kind:'i',id:x.id})}};
   if(ranked.length){choose(ranked[0].items);choose(ranked[1]?.items||c.baseItems)}else if(c.b!==-2){choose(c.baseItems);choose(c.baseItems)}
  }
  return out;
 }
 function makeBoundary(C,S,I,a){
  const w=tags(C,S,I,a),tested=new Set(I.filter(x=>Object.hasOwn(a,i(x))).map(x=>x.cid)),hot=new Set(profile(C,S,a).filter(x=>x.score>0).map(x=>x.id)),used=new Set(),seen=new Set(I.filter(x=>Object.hasOwn(a,i(x))).map(titleKey));
  const pool=I.filter(x=>!tested.has(x.cid)&&!hot.has(x.cid)&&v(a[b(C[x.cid])])!==-2&&(x.sid===null||v(a[s(S[x.sid])])!==-2));
  const out=[];
  for(let k=0;k<8;k++){const choices=pool.filter(x=>!used.has(x.cid)&&!seen.has(titleKey(x)));if(!choices.length)break;choices.sort((x,y)=>(k<6?affinity(y,w)-affinity(x,w):Math.abs(affinity(x,w)-.5)-Math.abs(affinity(y,w)-.5))||tie(x,y));const x=choices[0];used.add(x.cid);seen.add(titleKey(x));out.push({kind:'i',id:x.id})}
  return out;
 }
 function recommend(C,S,I,a,feedback={}){
  const groups=roots(C,S,a),p=profile(C,S,a),hot=new Set(p.filter(x=>x.score>0).map(x=>x.id));
  const ctx=context(C,S,I,a,feedback),w=ctx.w;
  if(!groups.length&&!ctx.positives.length)return {direct:[],bridge:[],adventure:[],byRoot:[],related:[],seedFallback:[],ctx};
  const scores=Object.fromEntries(p.map(c=>[c.id,c.score??0]));
  const seen=new Set(I.filter(x=>Object.hasOwn(feedback,x.id)||['3','0','-2'].includes(a[i(x)])).map(titleKey));
  const candidates=I.filter(x=>!seen.has(titleKey(x))&&!Object.hasOwn(feedback,x.id)&&v(a[b(C[x.cid])])!==-2&&(x.sid===null||v(a[s(S[x.sid])])!==-2));
  const used=new Set(seen);
  const groupTags=g=>uniq(g.flatMap(c=>[...c.tags,...S.filter(x=>x.cid===c.id&&v(a[s(x)])>0).flatMap(x=>x.tags)]));
  function rank(x,local){return affinity(x,w)+ctx.evidence(x).score+Math.max(0,scores[x.cid])*1.2+(x.sid===null?0:(v(a[s(S[x.sid])])??0)*2)+(a[i(x)]==='2'?8:0)+(local?common(x.tags,local).reduce((n,t)=>n+strength(t),0)*1.5:0)}
  const choose=(pool,cmp)=>{const x=pool.filter(x=>!used.has(titleKey(x))).sort(cmp)[0];if(x)used.add(titleKey(x));return x};
  // Concrete favorites are a separate entry point; explicit relations outrank generic overlap.
  // Round-robin across source works prevents a prolific node from taking all recommendations.
  const related=[], sources=ctx.positives.slice().sort((a,b)=>b.value-a.value||tie(a.x,b.x));
  for(let round=0;round<3&&related.length<12;round++){
   for(const {x:source} of sources){
    if(related.length===12)break;
    const ids=new Set((source.links||[]).map(l=>l.id));
    const pool=candidates.filter(x=>ids.has(x.id));
    const x=choose(pool,(x,y)=>rank(y,null)-rank(x,null)||tie(x,y));
    if(x)related.push(x);
   }
  }
  if(related.length<12){
   const similar=candidates.filter(x=>ctx.evidence(x).matches.some(m=>m.tags.length>=2));
   while(related.length<12){const x=choose(similar,(x,y)=>ctx.evidence(y).score-ctx.evidence(x).score||rank(y,null)-rank(x,null)||tie(x,y));if(!x)break;related.push(x)}
  }
  // Fallback for the many works whose specific metadata has not yet been curated.
  const seedFallback=[];
  for(let round=0;round<3&&seedFallback.length<12;round++){
   for(const {x:source} of sources){
    if(seedFallback.length===12)break;
    const x=choose(candidates.filter(x=>x.cid===source.cid&&(!groups.length||!hot.has(x.cid))),(x,y)=>Number(source.sid!==null&&y.sid===source.sid)-Number(source.sid!==null&&x.sid===source.sid)||rank(y,null)-rank(x,null)||tie(x,y));
    if(x)seedFallback.push(x)
   }
  }
  const byRoot=groups.map(g=>{
   const local=groupTags(g),out=[],counts={};
   const pool=candidates.filter(x=>g.some(c=>c.id===x.cid));
   for(let k=0;k<6;k++){
    const x=choose(pool,(x,y)=>(counts[x.cid]||0)-(counts[y.cid]||0)||rank(y,local)-rank(x,local)||tie(x,y));
    if(!x)break;out.push(x);counts[x.cid]=(counts[x.cid]||0)+1;
   }
   return out;
  });
  const remote=candidates.filter(x=>!hot.has(x.cid)),bridge=[],adventure=[],domainSeen=new Set();
  // Each root contributes at most one adjacent suggestion per round.
  for(let round=0;round<2&&bridge.length<8;round++){
   for(const g of groups){if(bridge.length===8)break;const local=groupTags(g);const x=choose(remote.filter(x=>!domainSeen.has(x.cid)&&common(x.tags,local).some(t=>!generic.has(t))&&affinity(x,w)>0),(x,y)=>rank(y,local)-rank(x,local)||tie(x,y));if(x){bridge.push(x);domainSeen.add(x.cid)}}
  }
  for(let k=0;k<4;k++){const x=choose(remote.filter(x=>!domainSeen.has(x.cid)&&affinity(x,w)>0),(x,y)=>Math.abs(affinity(x,w)-.4)-Math.abs(affinity(y,w)-.4)||tie(x,y));if(!x)break;adventure.push(x);domainSeen.add(x.cid)}
  return {direct:byRoot.flat(),bridge,adventure,byRoot,related,seedFallback,ctx};
 }
 return {profile,roots,tags,affinity,makeSub,makeDetail,makeBoundary,recommend,context,explain};
})();