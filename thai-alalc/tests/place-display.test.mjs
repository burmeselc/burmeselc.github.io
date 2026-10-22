import test from 'node:test';
import assert from 'node:assert/strict';
import {romanizeThai} from '../romanizer.mjs';
import {gazetteerIndex} from '../place-matcher.mjs';
import {placeTokenAnnotations,capitalizePlaceStart,displayPlaceText} from '../place-display.mjs';
const gaz=gazetteerIndex({records:[['ระยอง','province','21'],['เชียงใหม่','province','50']]});
test('Place status covers name but not province classifier',()=>{
 const tokens=romanizeThai('จังหวัดระยอง',[]).tokens;
 const marked=placeTokenAnnotations(tokens,gaz);
 assert.ok(marked.size>0);
 const joined=tokens.map(t=>t.thai).join('');
 let offset=0;
 for(let i=0;i<tokens.length;i++){
  const start=offset;offset+=tokens[i].thai.length;
  if(marked.has(i))assert.ok(offset>joined.indexOf('ระยอง'));
 }
});
test('Capitalization is optional and does not mutate token text',()=>{
 const tokens=[{thai:'ระ',roman:'ra',origin:'rule',spaceBefore:false},{thai:'ยอง',roman:'yǭng',origin:'rule',spaceBefore:true}];
 const marked=placeTokenAnnotations(tokens,gaz);
 const raw=displayPlaceText(tokens,new Map(),marked,false);
 const upper=displayPlaceText(tokens,new Map(),marked,true);
 assert.notEqual(raw,upper);
 assert.equal(raw,displayPlaceText(tokens,new Map(),marked,false));
 assert.ok(upper.includes('R'));
});
test('Unrecognized words never gain place formatting',()=>{
 const t=romanizeThai('ภาษาไทย',[]).tokens;
 assert.equal(placeTokenAnnotations(t,gaz).size,0);
 assert.equal(displayPlaceText(t,new Map(),new Map(),true),displayPlaceText(t,new Map(),new Map(),false));
});
