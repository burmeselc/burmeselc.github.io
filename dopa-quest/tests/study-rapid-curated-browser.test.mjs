import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('184 rapidly curated parents and 131 reversible major corrections load safely on mobile',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot&&!!window.DOPA_DETAIL);
  const result=await page.evaluate(()=>{
   const d=window.DOPA_DETAIL,deck=window.DOPA_DATA;
   const find=(l,id)=>deck[l].find(x=>x.id===id);
   const redCross=find('burmese','bur:1560606875098');
   const ShanVillage=find('shan','shn:1783945287740');
   const englishEtymology=find('shan','shn:1783945284507');
   return {
    total:d.coverage.burmese.classified+d.coverage.shan.classified,
    remaining:d.coverage.burmese.review_pending+d.coverage.shan.review_pending,
    crossMajor:d.annotation(redCross,'burmese')?.medium,
    correctedMajor:d.majorFor(redCross,'burmese'),
    sourceMajor:redCross.semantic_major,
    village:d.annotation(ShanVillage,'shan')?.medium,
    falsePositive:d.annotation(englishEtymology,'shan'),
    progress:Object.keys(window.DOPA_SYNC_API.snapshot().words).length,
    scrollWidth:document.documentElement.scrollWidth,windowWidth:innerWidth};
  });
  assert.equal(result.total,4360);
  assert.equal(result.remaining,2108);
  assert.equal(result.crossMajor,'09.01');
  assert.equal(result.correctedMajor,'09');
  assert.equal(result.sourceMajor,'15');
  assert.equal(result.village,'09.05');
  assert.equal(result.falsePositive,null);
  assert.equal(result.progress,0);
  assert.ok(result.scrollWidth<=result.windowWidth);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
