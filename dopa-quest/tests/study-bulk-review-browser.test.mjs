import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('bulk-reviewed optional detail browsing on iPhone preserves default learning and history',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',x=>errors.push(x.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot&&!!window.DOPA_DETAIL);
  const s=await page.evaluate(()=>{
   const d=window.DOPA_DETAIL,words=window.DOPA_DATA;
   return {bur:d.coverage.burmese.classified,shan:d.coverage.shan.classified,
    pending:d.coverage.burmese.review_pending+d.coverage.shan.review_pending,
    b:d.annotation(words.burmese.find(x=>x.id==='bur:1395616482982'),'burmese')?.medium,
    sh:d.annotation(words.shan.find(x=>x.id==='shn:1783945287990'),'shan')?.medium,
    progress:Object.keys(window.DOPA_SYNC_API.snapshot().words).length,
    width:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert.ok(s.bur>=1807);
  assert.ok(s.shan>=2369);
  assert.ok(s.pending<=2292);
  assert.equal(s.bur+s.shan+s.pending,6468);
  assert.equal(s.b,'09.05');assert.equal(s.sh,'01.02');
  assert.equal(s.progress,0);assert.ok(s.width<=s.viewport);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
