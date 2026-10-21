import {findPlaceMentions} from './place-matcher.mjs';
import {canJoin,boundaryValue} from './boundary-editor.mjs';
/** Suggest internal boundaries of exact gazetteer spans, without changing the spelling.
 * Never remove user-authored whitespace or punctuations, and never override user edits.
 */
export function proposePlaceJoins(tokens,placeIndex,overrides=new Map()){
 const input=tokens.map(t=>t.thai).join('');
 const mentions=findPlaceMentions(input,placeIndex);
 const offsets=[];let pos=0;
 for(const t of tokens){offsets.push(pos);pos+=t.thai.length;}
 const proposals=[];
 for(const place of mentions){
  for(let i=1;i<tokens.length;i++){
   if(offsets[i]<=place.start||offsets[i]>=place.end)continue;
   if(!canJoin(tokens,i)||overrides.has(i))continue;
   if(boundaryValue(tokens,i,overrides)){
    proposals.push({index:i,name:place.thai,type:place.type,code:place.code});
   }
  }
 }
 return proposals;
}
export function applyPlaceJoins(tokens,placeIndex,overrides=new Map()){
 const proposals=proposePlaceJoins(tokens,placeIndex,overrides);
 for(const proposal of proposals)overrides.set(proposal.index,false);
 return proposals;
}
