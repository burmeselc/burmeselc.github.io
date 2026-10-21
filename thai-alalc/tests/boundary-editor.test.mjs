import test from 'node:test';
import assert from 'node:assert/strict';
import {romanizeThai} from '../romanizer.mjs';
import {canJoin,joinAt,resetBoundary,boundaryValue,outputText} from '../boundary-editor.mjs';
test('Join multiple adjacent romanization tokens and restore each boundary',()=>{
 const tokens=romanizeThai('จังหวัดระยอง',[]).tokens;
 const candidates=tokens.map(x=>x.roman);
 const overrides=new Map();
 const gap=tokens.findIndex((t,i)=>i>0&&canJoin(tokens,i));
 assert.ok(gap>0);
 const original=outputText(tokens,overrides);
 assert.equal(joinAt(tokens,gap,overrides),true);
 assert.equal(boundaryValue(tokens,gap,overrides),false);
 assert.notEqual(outputText(tokens,overrides),original);
 assert.deepEqual(tokens.map(t=>t.roman),candidates);
 assert.equal(resetBoundary(tokens,gap,overrides),true);
 assert.equal(outputText(tokens,overrides),original);
});
test('Cannot join across literal spaces, punctuation or unresolved segments',()=>{
 const tokens=romanizeThai('กา, บ้าน',[]).tokens;
 const overrides=new Map();
 const orig=outputText(tokens,overrides);
 for(let i=1;i<tokens.length;i++)assert.equal(joinAt(tokens,i,overrides),false);
 assert.equal(outputText(tokens,overrides),orig);
});
test('Edited text affects the exported output without editing source Thai',()=>{
 const tokens=romanizeThai('โรงเรียน',[]).tokens;
 const overrides=new Map();
 const originalThai=tokens.map(x=>x.thai).join('');
 const before=outputText(tokens,overrides);
 assert.ok(before.includes(' '));
 const i=tokens.findIndex((t,i)=>canJoin(tokens,i));
 assert.ok(i>0);
 joinAt(tokens,i,overrides);
 tokens[i].roman='CUSTOM';tokens[i].corrected=true;
 assert.ok(outputText(tokens,overrides).includes('CUSTOM'));
 assert.equal(tokens.map(x=>x.thai).join(''),originalThai);
});
