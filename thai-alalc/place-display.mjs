import {findPlaceMentions} from './place-matcher.mjs';
/** Place recognition is an orthographic hint, not a certified toponym reading. */
export function placeTokenAnnotations(tokens,index){
 const joined=tokens.map(t=>t.thai).join('');
 const mentions=findPlaceMentions(joined,index);
 const marked=new Map();let offset=0;
 const starts=[];
 for(let i=0;i<tokens.length;i++){starts.push(offset);offset+=tokens[i].thai.length;}
 for(const mention of mentions){
  for(let i=0;i<tokens.length;i++){
   const start=starts[i],end=start+tokens[i].thai.length;
   if(tokens[i].origin==='literal'||end<=mention.start||start>=mention.end)continue;
   const exactStart=start===mention.start;
   const old=marked.get(i);
   if(!old || (mention.end-mention.start)>(old.end-old.start))
     marked.set(i,{...mention,exactStart});
  }
 }
 return marked;
}
export function capitalizePlaceStart(roman){
 return String(roman).replace(/[a-zà-žāēīōūǣǭưœæč]/iu,letter=>letter.toLocaleUpperCase('en'));
}
export function displayPlaceText(tokens,overrides,annotations,capitalization=false){
 return tokens.map((t,i)=>{
  const prefix=i>0&&(overrides.has(i)?overrides.get(i):t.spaceBefore)?' ':'';
  const original=t.origin==='unresolved'&&!t.corrected?'〔未解析：'+t.thai+'〕':t.roman;
  const note=annotations.get(i);
  return prefix+(capitalization&&note?.exactStart&&!t.corrected?capitalizePlaceStart(original):original);
 }).join('');
}
