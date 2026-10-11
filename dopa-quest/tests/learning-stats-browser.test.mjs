import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

for(const height of [667,844])test('learning stats preserve snapshot and show honest 7/30-day history at '+height+'px',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready')&&!!window.DOPA_STATS&&!!window.DOPA_DASHBOARD?.render);
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  const before=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(await page.locator('#statsBars .dopa-stat-day').count(),7);
  assert.equal(await page.locator('#statsTotal').textContent(),'0');
  assert.equal(await page.locator('#statsDistinct').textContent(),'0');
  assert.equal(await page.locator('#statsAccuracy').textContent().then(t=>t.includes('保存済みの回答ログがありません')),true);
  await page.locator('[data-stat-days="30"]').click();
  assert.equal(await page.locator('#statsBars .dopa-stat-day').count(),30);
  assert.equal(await page.locator('[data-stat-days="30"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-stat-days="7"]').click();
  const after=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.deepEqual(after.words,before.words);
  assert.deepEqual(after.flashcards,before.flashcards);
  assert.deepEqual(after.dailyStats,before.dailyStats);
  // Actual card rating adds one dated event; statistics do not credit a mere flip.
  await page.locator('[data-dopa-route="cards"]').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  await page.locator('#flashReveal').click();
  await page.locator('[data-flash-rating="good"]').click();
  await page.locator('#flashExit').click();
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#statsTotal').textContent(),'1');
  assert.equal(await page.locator('#statsDistinct').textContent(),'1');
  assert.equal(await page.locator('#statsRemembered').textContent(),'1');
  assert.match(await page.locator('#statsAttempts').textContent(),/カード 1/);
  // A saved snapshot restore refreshes only presentation, not the dated data.
  const rated=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  await page.evaluate(p=>window.DOPA_SYNC_API.restore(p),rated);
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#statsTotal').textContent(),'1');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready')&&!!window.DOPA_STATS);
  assert.equal(await page.locator('#statsTotal').textContent(),'1');
  assert.equal(await page.locator('#statsBars .dopa-stat-day').count(),7);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
