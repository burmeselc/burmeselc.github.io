/** Ephemeral, presentation-only word-boundary overrides for forward ALA-LC output. */
export function canJoin(tokens,index){
 if(index<=0||index>=tokens.length)return false;
 const a=tokens[index-1],b=tokens[index];
 return a.origin!=='literal'&&b.origin!=='literal'&&
        a.origin!=='unresolved'&&b.origin!=='unresolved'&&
        Boolean(b.spaceBefore)&&!(/\s/u.test(a.thai+b.thai));
}
export function boundaryValue(tokens,index,overrides){
 return overrides.has(index)?overrides.get(index):Boolean(tokens[index]?.spaceBefore);
}
export function joinAt(tokens,index,overrides){
 if(!canJoin(tokens,index))return false;
 overrides.set(index,false);return true;
}
export function resetBoundary(tokens,index,overrides){
 if(index<=0||index>=tokens.length||!canJoin(tokens,index))return false;
 overrides.delete(index);return true;
}
export function outputText(tokens,overrides=new Map()){
 return tokens.map((t,i)=>(boundaryValue(tokens,i,overrides)?' ':'')+
   (t.origin==='unresolved'&&!t.corrected?'〔未解析：'+t.thai+'〕':t.roman)).join('');
}
