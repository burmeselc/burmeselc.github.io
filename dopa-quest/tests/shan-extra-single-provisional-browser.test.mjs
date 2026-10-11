import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('provisional single-category Shan overlay adds 4,359 filterable cards without changing original source status',async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const result=await page.evaluate(()=>{
   const deck=window.DOPA_DATA.shan,engine=window.DOPA_DETAIL;
   const candidates=deck.filter(x=>x.rank>5480&&engine?.annotation(x,'shan')?.provisional_only);
   const unassigned=deck.filter(x=>x.rank>5480&&!engine?.annotation(x,'shan'));
   return {ready:window.DOPA_PROVISIONAL_SINGLE_READY,total:deck.length,
    extra:window.DOPA_EXTRA_COUNT,metadata:engine?.extraProvisional,
    candidateCount:candidates.length,unassigned:unassigned.length,
    statuses:new Set(candidates.map(x=>x.semantic_status)).size===1?[candidates[0].semantic_status]:[],
    sourceHistoryClean:candidates.every(x=>!Object.hasOwn(x,'sense_id'))};
  });
  assert.equal(result.ready,true);
  assert.equal(result.total,16985);
  assert.equal(result.extra,11505);
  assert.equal(result.metadata?.count,4359);
  assert.equal(result.metadata?.approved_senses,false);
  assert.equal(result.candidateCount,4359);
  assert.equal(result.unassigned,7146);
  assert.deepEqual(result.statuses,['U']);
  assert.equal(result.sourceHistoryClean,true);
  await page.locator('[data-dopa-route="quest"]').click();
  await page.locator('#semanticCategory').selectOption('02');
  const counts=await page.evaluate(()=>{
   const deck=window.DOPA_DATA.shan,engine=window.DOPA_DETAIL;
   return {listed:[...document.querySelector('#semanticCategory').options].find(x=>x.value==='02')?.textContent,
    filtered:deck.filter(x=>engine.majorFor(x,'shan')==='02'&&engine.annotation(x,'shan')?.provisional_only).length};
  });
  assert.ok(counts.filtered>0);
  assert.ok(counts.listed.includes('02'));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
