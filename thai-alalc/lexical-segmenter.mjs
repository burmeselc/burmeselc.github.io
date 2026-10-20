/**
 * Lexicon-based Thai tokenization prototype.
 * IMPORTANT: dictionary lexemes are NOT the same as ALA-LC word divisions.
 * Use this only to propose constituent boundaries for later manual/grammatical review.
 */
function keyOf(entry){return String(entry?.thai||'').normalize('NFC').trim();}
export function indexThaiLexicon(entries){
 const index=new Map(), seen=new Set();
 for(const entry of entries||[]){
   const word=keyOf(entry);
   if(!word || word.length>80 || /[\s()[\]{}…]/u.test(word) || !/[\u0e01-\u0e5b]/u.test(word))continue;
   if(seen.has(word))continue;
   seen.add(word);
   const first=word[0];if(!index.has(first))index.set(first,[]);
   index.get(first).push({word,rank:Number(entry.web_rank)||null,
     pos:entry.pos||'',meaning:entry.meaning||'',source_id:entry.source_id||''});
 }
 for(const rows of index.values())rows.sort((a,b)=>b.word.length-a.word.length);
 return index;
}
function candidateCompare(a,b){return a.cost-b.cost||a.tokens.length-b.tokens.length;}
export function suggestLexicalSegments(input,index,{topK=3}={}){
 const text=String(input??'').normalize('NFC');
 const maxK=Math.max(1,Math.min(5,topK));
 // Candidate generation is bounded for interactive use.
 if(text.length>300)return {candidates:[],truncated:true};
 const best=Array.from({length:text.length+1},()=>[]);
 best[text.length]=[{cost:0,tokens:[]}];
 for(let i=text.length-1;i>=0;i--){
   const candidates=[];
   const push=(token,len,cost)=>{
     for(const continuation of best[i+len]||[]){
       candidates.push({cost:continuation.cost+cost,tokens:[token,...continuation.tokens]});
     }
   };
   const ch=text[i];
   if(!/[\u0e00-\u0e7f]/u.test(ch)){
     let j=i+1;while(j<text.length&&!/[\u0e00-\u0e7f]/u.test(text[j]))j++;
     push({thai:text.slice(i,j),kind:'literal'},j-i,0);
   }else{
     for(const entry of index.get(ch)||[]){
       if(!text.startsWith(entry.word,i))continue;
       // WebRank is a coarse signal and not a token-frequency probability.
       const rank=entry.rank?Math.max(1,Math.min(7,entry.rank)):4;
       const cost=1.7+(rank-1)*0.12-Math.min(0.5,entry.word.length*0.02);
       push({thai:entry.word,kind:'lexicon',pos:entry.pos,
         meaning:entry.meaning,source_id:entry.source_id},entry.word.length,cost);
     }
     push({thai:ch,kind:'unmatched'},1,5.5);
   }
   candidates.sort(candidateCompare);
   const unique=new Set();
   best[i]=candidates.filter(x=>{
     const signature=x.tokens.map(z=>z.kind+':'+z.thai).join('|');
     if(unique.has(signature))return false;
     unique.add(signature);return true;
   }).slice(0,maxK);
 }
 const results=(best[0]||[]).map(entry=>{
   const tokens=[];
   for(const token of entry.tokens){
     const last=tokens[tokens.length-1];
     if(last?.kind==='unmatched' && token.kind==='unmatched')last.thai+=token.thai;
     else tokens.push({...token});
   }
   return {cost:Math.round(entry.cost*100)/100,tokens};
 });
 return {candidates:results,truncated:false};
}
