import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
const launch=()=>chromium.launch({headless:true});
function errorsOn(page){const errors=[];page.on('pageerror',err=>errors.push(err.message));return errors;}
test('Burmese category: four-choice session, persistence, and Shan fallback',async()=>{
 const browser=await launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=errorsOn(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.burmese?.length===2500);
  await page.waitForFunction(()=>window.DOPA_SEMANTIC_READY_BY_LANG?.shan===true);
  assert.equal(await page.locator('#semanticCategory').isDisabled(),false);
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  await page.locator('#lang').selectOption('burmese');
  await page.waitForFunction(()=>window.DOPA_SEMANTIC_READY===true);
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  await page.locator('#semanticCategory').selectOption('06');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  for(let n=0;n<5;n++){
   await page.waitForFunction(()=>document.querySelectorAll('#choices button').length===4);
   assert.equal(await page.locator('#choices button').count(),4);
   assert.match(await page.locator('#meta').textContent(),/領域 06/);
   const labels=await page.locator('#choices button').allTextContents();
   assert.equal(new Set(labels).size,4);
   // Every answer (including the three false alternatives) belongs to the food domain.
   const scoped=await page.locator('#choices button').evaluateAll((buttons)=>{
     const byId=new Map(window.DOPA_DATA.burmese.map(w=>[w.id,w]));
     return buttons.map(b=>{const x=byId.get(b.dataset.itemid);return {category:window.DOPA_DETAIL?.majorFor?.(x,'burmese')||x?.semantic_major,status:x?.semantic_status}});
   });
   assert.deepEqual(scoped.map(x=>x.category),['06','06','06','06']);
   assert.ok(scoped.every(x=>x.status!=='M'));
   await page.locator('#choices button[data-correct="0"]').first().click();
   await page.locator('#continueBtn').waitFor();
   await page.locator('#continueBtn').click();
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dopaQuestV5_profile')||'null'));
  assert.ok(saved?.totalQ>=1);
  assert.ok(Object.keys(saved.words).length>=1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.burmese?.length===2500);
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('dopaQuestV5_profile')||'null').totalQ>=1));
  await page.locator('#lang').selectOption('shan');
  assert.equal(await page.locator('#semanticCategory').isDisabled(),false);
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  assert.equal(await page.locator('#semanticCategory').inputValue(),'all');
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),5480);
  await page.screenshot({path:'dopa-category-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser.close();}
});
test('rare semantic category still shows four in-category choices',async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage(),errors=errorsOn(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.burmese?.length===2500);
  await page.locator('#lang').selectOption('burmese');
  await page.locator('#semanticCategory').selectOption('18');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
  const actual=await page.locator('#choices button').evaluateAll(buttons=>{
    const byId=new Map(window.DOPA_DATA.burmese.map(w=>[w.id,w]));
    return buttons.map(b=>{const x=byId.get(b.dataset.itemid);return window.DOPA_DETAIL?.majorFor?.(x,'burmese')||x?.semantic_major});
  });
  assert.deepEqual(actual,['18','18','18','18']);
  assert.deepEqual(errors,[]);
 } finally {await browser.close()}
});
test('missing category data degrades to original all-words mode',async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage(),errors=errorsOn(page);
  await page.route('**/data/burmese-categories-v1.json',route=>route.abort());
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.burmese?.length===2500);
  await page.locator('#lang').selectOption('burmese');
  assert.equal(await page.locator('#semanticCategory').isDisabled(),true);
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
