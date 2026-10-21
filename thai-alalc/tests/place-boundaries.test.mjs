import test from 'node:test';
import assert from 'node:assert/strict';
import {romanizeThai} from '../romanizer.mjs';
import {gazetteerIndex} from '../place-matcher.mjs';
import {applyPlaceJoins,proposePlaceJoins} from '../place-boundaries.mjs';
import {outputText} from '../boundary-editor.mjs';
const index=gazetteerIndex({records:[['ระยอง','province','21'],['เมืองระยอง','district','2101','21']]});
test('A gazetteer name joins only internal token boundaries',()=>{
 const tokens=romanizeThai('จังหวัดระยอง',[]).tokens;
 const original=outputText(tokens);
 const originalThai=tokens.map(t=>t.thai).join('');
 const overrides=new Map();
 const proposals=proposePlaceJoins(tokens,index,overrides);
 const changed=applyPlaceJoins(tokens,index,overrides);
 assert.equal(changed.length,proposals.length);
 assert.ok(changed.length>=1);
 assert.equal(tokens.map(t=>t.thai).join(''),originalThai);
 assert.notEqual(outputText(tokens,overrides),original);
 assert.equal(proposePlaceJoins(tokens,index,overrides).length,0);
});
test('Already edited boundaries are preserved and punctuation prevents joining',()=>{
 const tokens=romanizeThai('ระยอง, ระยอง',[]).tokens;
 const overrides=new Map();
 const result=applyPlaceJoins(tokens,index,overrides);
 assert.ok(result.every(x=>x.index>0));
 const text=outputText(tokens,overrides);
 assert.ok(text.includes(', '));
});
test('Unrecognized place name produces zero place-specific joins',()=>{
 const tokens=romanizeThai('ภาษาไทย',[]).tokens;
 assert.deepEqual(proposePlaceJoins(tokens,index),[]);
});
