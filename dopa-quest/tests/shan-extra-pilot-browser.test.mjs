import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

test('mobile: optional 1,000 Shan words are available as a separate quiz zone and can be reviewed',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready')&&
    window.DOPA_DATA?.shan?.length===6480);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_READY),true);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/6,480語/);
  assert.equal(await page.locator('#zone option[value="extra"]').count(),1);
  await page.locator('#zone').selectOption('extra');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  const ids=await page.locator('#choices button').evaluateAll(buttons=>buttons.map(x=>x.dataset.itemid));
  assert.equal(ids.length,4);
  assert.ok(ids.every(id=>id.startsWith('shn:anki:')));
  await page.locator('#choices button[data-correct="1"]').click();
  const p=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(p.totalQ,1);
  assert.ok(Object.keys(p.words).some(x=>x.startsWith('shn:anki:')));
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('missing optional CSV pilot leaves the original 5,480 Shan parents usable',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
  await page.route('**/data/shan-extra-pilot-1.json',route=>route.abort());
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const result=await page.evaluate(()=>({n:window.DOPA_DATA?.shan?.length,
    parents:window.DOPA_DATA?.shan_senses?.length,available:window.DOPA_EXTRA_READY}));
  assert.deepEqual(result,{n:5480,parents:7290,available:false});
  await page.locator('[data-dopa-route="quest"]').click();
  assert.equal(await page.locator('#zone option[value="extra"]').count(),0);
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
 }finally{await browser.close()}
});
