import test from 'node:test';
import assert from 'node:assert/strict';
import {gazetteerIndex,findPlaceMentions} from '../place-matcher.mjs';
const geo={records:[['ระยอง','province','21'],['เมืองระยอง','district','2101','21'],['เชียงใหม่','province','50']]};
test('find Thai province and longest district names',()=>{
 const idx=gazetteerIndex(geo);
 assert.equal(findPlaceMentions('กรณีจังหวัดระยอง',idx)[0].thai,'ระยอง');
 assert.equal(findPlaceMentions('อำเภอเมืองระยอง',idx)[0].thai,'เมืองระยอง');
});
test('No ALA-LC romanization invented from RTGS',()=>{
 const matches=findPlaceMentions('เชียงใหม่',gazetteerIndex(geo));
 assert.equal(matches[0].type,'province');
 assert.equal(matches[0].roman,undefined);
});
