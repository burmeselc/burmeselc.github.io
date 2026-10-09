import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
const launch=()=>chromium.launch({headless:true});
const capture=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));return errors};
test('Shan domain-only four-choice session on Chromium mobile viewport and progress survives reload',async()=>{
 const browser=await launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=capture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===5480&&window.DOPA_SEMANTIC_READY_BY_LANG?.shan===true);
  assert.equal(await page.locator('#lang').inputValue(),'shan');
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  await page.locator('#semanticCategory').selectOption('06');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  for(let n=0;n<5;n++){
    await page.waitForFunction(()=>document.querySelectorAll('#choices button').length===4);
    const cat=await page.locator('#choices button').evaluateAll(buttons=>{
      const byId=new Map(window.DOPA_DATA.shan.map(x=>[x.id,x]));
      return buttons.map(b=>({major:byId.get(b.dataset.itemid)?.semantic_major,status:byId.get(b.dataset.itemid)?.semantic_status,source:byId.get(b.dataset.itemid)?.shan}));
    });
    assert.equal(cat.length,4);
    assert.ok(cat.every(x=>x.major==='06'&&x.status==='P'));
    assert.equal(new Set(cat.map(x=>x.source)).size,4);
    assert.match(await page.locator('#meta').textContent(),/領域 06/);
    await page.locator('#choices button[data-correct="0"]').first().click();
    await page.locator('#continueBtn').click();
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dopaQuestV5_profile')||'null'));
  assert.ok(saved?.totalQ>=1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===5480);
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('dopaQuestV5_profile')||'null'));
  assert.equal(persisted.totalQ,saved.totalQ);
  await page.locator('#lang').selectOption('burmese');
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  assert.equal(await page.locator('#semanticCategory').inputValue(),'all');
  await page.screenshot({path:'dopa-shan-category-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('missing Shan sidecar disables only Shan categories and does not break Burmese',async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage(),errors=capture(page);
  await page.route('**/data/shan-categories-v1.json',route=>route.abort());
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===5480);
  assert.equal(await page.locator('#semanticCategory').isDisabled(),true);
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.locator('#lang').selectOption('burmese');
  await page.waitForFunction(()=>window.DOPA_SEMANTIC_READY_BY_LANG?.burmese===true);
  assert.equal(await page.locator('#semanticCategory').isDisabled(),false);
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
