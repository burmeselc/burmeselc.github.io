import test from 'node:test';
import assert from 'node:assert/strict';
import {indexThaiLexicon,suggestLexicalSegments} from '../lexical-segmenter.mjs';

const data=[
 {thai:'ภาษา',web_rank:'2',pos:'N'},
 {thai:'ไทย',web_rank:'1',pos:'Adj'},
 {thai:'ภาษาไทย',web_rank:'5',pos:'N'},
 {thai:'รถ',web_rank:'2'},
 {thai:'ไฟ',web_rank:'3'},
 {thai:'รถไฟ',web_rank:'2'},
 {thai:'ก',web_rank:'1'},
 {thai:'กวัก',web_rank:'4'},
 {thai:'(…) กว่า (…) เป็นไหนๆ'},
];
test('Lexical segmenter favors known lexemes and exposes alternatives',()=>{
 const index=indexThaiLexicon(data);
 const result=suggestLexicalSegments('ภาษาไทย',index,{topK:3});
 assert.equal(result.candidates[0].tokens.map(t=>t.thai).join(' '),'ภาษาไทย');
 assert.ok(result.candidates.some(x=>x.tokens.map(t=>t.thai).join(' ')==='ภาษา ไทย'));
});
test('Compound entry is lexicon match, not proof of ALA-LC word division',()=>{
 const index=indexThaiLexicon(data);
 const result=suggestLexicalSegments('รถไฟ',index);
 assert.equal(result.candidates[0].tokens[0].thai,'รถไฟ');
 assert.equal(result.candidates[0].tokens[0].kind,'lexicon');
});
test('Unknown characters and non-Thai characters remain visible',()=>{
 const index=indexThaiLexicon(data);
 const result=suggestLexicalSegments('กXYZ!',index);
 assert.equal(result.candidates[0].tokens.map(x=>x.thai).join(''),'กXYZ!');
 assert.ok(result.candidates[0].tokens.some(x=>x.kind==='literal'));
});
test('Interactive candidate size is bounded',()=>{
 const index=indexThaiLexicon(data);
 assert.equal(suggestLexicalSegments('ก'.repeat(301),index).truncated,true);
 assert.ok(suggestLexicalSegments('ก',index,{topK:500}).candidates.length<=5);
});
