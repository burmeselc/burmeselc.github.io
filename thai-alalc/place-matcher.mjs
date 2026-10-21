/** Identify Thai geographical place names without guessing ALA-LC forms. */
export const placeTypes={province:'県級',district:'郡・区級',subdistrict:'タムボン・クウェーン級'};
export function gazetteerIndex(data){
 const result=new Map();
 for(const record of data?.records||[]){
  const [thai,type,code,parent]=record;
  if(typeof thai!=='string'||!thai||!placeTypes[type])continue;
  const first=thai[0];
  if(!result.has(first))result.set(first,[]);
  result.get(first).push({thai,type,code,parent});
 }
 for(const list of result.values())list.sort((a,b)=>b.thai.length-a.thai.length);
 return result;
}
export function findPlaceMentions(text,index){
 const source=String(text||'').normalize('NFC');
 const matches=[];
 for(let i=0;i<source.length;){
  // Prefer the longest name starting at the current position.
  // It is still only orthographic evidence, not proof of a named-entity reading.
  const match=(index.get(source[i])||[]).find(row=>source.startsWith(row.thai,i));
  if(match){matches.push({start:i,end:i+match.thai.length,...match});i+=match.thai.length;}
  else i++;
 }
 return matches;
}
export function isPlaceSpan(tokens,mention){
 let offset=0;const hits=[];
 for(let i=0;i<tokens.length;i++){
  const start=offset,end=offset+tokens[i].thai.length;offset=end;
  if(end>mention.start && start<mention.end)hits.push(i);
 }
 return hits;
}
