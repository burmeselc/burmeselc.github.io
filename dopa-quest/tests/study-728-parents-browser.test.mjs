import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('500+ provisional new parent classifications and old history remain usable on mobile',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot&&!!window.DOPA_DETAIL);
  const got=await page.evaluate(()=>{
   const d=window.DOPA_DETAIL,p=window.DOPA_DATA;
   const b=p.burmese.find(x=>x.id==='bur:1394276921941');
   const sh=p.shan.find(x=>x.id==='shn:1783945283872');
   const held=p.shan.find(x=>x.id==='shn:1783945283871');
   return {burmese:d.coverage.burmese.classified,shan:d.coverage.shan.classified,
    remaining:d.coverage.burmese.review_pending+d.coverage.shan.review_pending,
    b:d.annotation(b,'burmese')?.medium,
    s:d.annotation(sh,'shan')?.medium,
    held:d.annotation(held,'shan'),
    progress:Object.keys(window.DOPA_SYNC_API.snapshot().words).length,
    overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.ok(got.burmese>=2205);assert.ok(got.shan>=2702);
  assert.ok(got.remaining<=1561);assert.equal(got.burmese+got.shan+got.remaining,6468);
  assert.equal(got.b,'17.03');
  assert.equal(got.s,'13.01');
  assert.equal(got.held,null);
  assert.equal(got.progress,0);assert.equal(got.overflow,false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
