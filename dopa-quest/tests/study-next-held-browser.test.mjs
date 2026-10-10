import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('mobile optional new held categories load without modifying scores or withheld senses',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot&&!!window.DOPA_DETAIL);
  const details=await page.evaluate(()=>{
   const d=window.DOPA_DETAIL,deck=window.DOPA_DATA,find=(l,id)=>deck[l].find(x=>x.id===id);
   return {
    burNew:d.annotation(find('burmese','bur:1432342945541'),'burmese')?.medium,
    shnNew:d.annotation(find('shan','shn:1783945287672'),'shan')?.medium,
    held:d.annotation(find('shan','shn:1783945286612'),'shan'),
    burLang:deck.burmese.filter(x=>d.matches(x,'burmese',{medium:'13.05'})).length,
    classified:d.coverage.burmese.classified+d.coverage.shan.classified,
    pending:d.coverage.burmese.review_pending+d.coverage.shan.review_pending,
    progress:Object.keys(window.DOPA_SYNC_API.snapshot().words).length,
    scrollWidth:document.documentElement.scrollWidth,innerWidth
   };
  });
  assert.equal(details.burNew,'13.05');
  assert.equal(details.shnNew,'09.05');
  assert.equal(details.held,null);
  assert.ok(details.burLang>=4);
  assert.ok(details.classified>=4142);
  assert.ok(details.pending<=2326);
  assert.equal(details.classified+details.pending,6468);
  assert.equal(details.progress,0);
  assert.ok(details.scrollWidth<=details.innerWidth);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
