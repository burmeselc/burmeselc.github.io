import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('single Shan proposals usable in category UI without overwriting parent card data',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const data=await page.evaluate(()=>{
   const deck=window.DOPA_DATA.shan;
   const x=deck.find(c=>c.rank===14482),a=window.DOPA_DETAIL.annotation(x,'shan');
   const statuses={};
   for(const row of deck.slice(5480)){
    const ann=window.DOPA_DETAIL.annotation(row,'shan');
    if(ann?.provisional_only)statuses[ann.review_status]=(statuses[ann.review_status]||0)+1;
   }
   return {total:deck.length,addition:window.DOPA_EXTRA_COUNT,originalStatus:x.semantic_status,
    sourceGloss:x.japanese_core,annotation:a,major:window.DOPA_DETAIL.majorFor(x,'shan'),
    count:window.DOPA_DETAIL.extraProvisional?.count,multipleCount:window.DOPA_DETAIL.extraProvisional?.multiple_review_count,final65Count:window.DOPA_DETAIL.extraProvisional?.final65_review_count,statuses,final65:window.DOPA_DETAIL.annotation(deck.find(c=>c.rank===5821),'shan'),reviewed:window.DOPA_DETAIL.annotation(deck.find(c=>c.rank===5484),'shan'),held:window.DOPA_DETAIL.annotation(deck.find(c=>c.rank===5569),'shan')?.provisional_only||false};
  });
  assert.equal(data.total,16985);assert.equal(data.addition,11505);
  assert.equal(data.count,4949);assert.equal(data.originalStatus,'U');
  assert.equal(data.annotation.medium,'02.02');assert.equal(data.annotation.provisional_only,true);
  assert.equal(data.major,'02');
  assert.equal(data.multipleCount,572);
  assert.equal(data.final65Count,18);
  assert.equal(data.final65?.medium,'03.04');
  assert.equal(data.reviewed?.medium,'12.01');
  assert.equal(data.reviewed?.provisional_only,true);
  assert.equal(data.held,false);
  assert.deepEqual(data.statuses,{'machine-proposal-unverified':4949});
  assert.match(await page.locator('#semanticCategoryNotice').textContent(),/4,949件.*未検証/);
  await page.locator('[data-dopa-route="quest"]').click();
  await page.locator('#semanticCategory').selectOption('02');
  assert.match(await page.locator('#semanticCategory option:checked').textContent(),/02/);
  assert.equal(await page.locator('#semanticMedium option[value="02.02"]').count(),1);
  assert.match(await page.locator('#studyDetailNotice').textContent(),/未検証/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('missing proposal shard retains regular app and existing classifications',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await page.route(/shan-extra-single-proposals-3\.json/,r=>r.abort());
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),16985);
  assert.equal(await page.evaluate(()=>window.DOPA_DETAIL?.extraProvisional?.count||0),0);
  assert.equal(await page.locator('#semanticCategory').isDisabled(),false);
 }finally{await browser.close()}
});

test('missing new multiple-cue shard retains 4,359 original provisional classifications',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await page.route(/shan-extra-multiple-proposals-1\.json/,r=>r.abort());
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const counts=await page.evaluate(()=>({
   total:window.DOPA_DATA.shan.length,
   count:window.DOPA_DETAIL.extraProvisional?.count,
   extended:window.DOPA_DETAIL.extraProvisional?.multiple_review_count
  }));
  assert.deepEqual(counts,{total:16985,count:4359,extended:0});
  assert.match(await page.locator('#semanticCategoryNotice').textContent(),/4,359件.*未検証/);
 }finally{await browser.close()}
});


test('missing final65 delta retains 4,931 earlier provisional classifications',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await page.route(/shan-extra-final65-proposals-v1\\.json/,r=>r.abort());
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const result=await page.evaluate(()=>({count:window.DOPA_DETAIL.extraProvisional?.count,final65:window.DOPA_DETAIL.extraProvisional?.final65_review_count}));
  assert.deepEqual(result,{count:4931,final65:0});
  assert.match(await page.locator('#semanticCategoryNotice').textContent(),/4,931件.*未検証/);
 }finally{await browser.close()}
});
