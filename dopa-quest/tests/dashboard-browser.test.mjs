import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('dashboard routes preserve IDs, quiz progress and current flashcards',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_DASHBOARD&&!!window.DOPA_SYNC_API?.snapshot&&!!window.DOPA_FLASH_UI);
  const old=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#setup').isVisible(),false);
  assert.equal(await page.locator('#dashXp').textContent(),String(old.xp));
  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  assert.equal(await page.locator('#flashcardPanel').isVisible(),false);
  await page.locator('#dopaSettingsOpen').click();
  assert.equal(await page.locator('#dopaSettings').isVisible(),true);
  assert.equal(await page.locator('#cloudStatus').isVisible(),true);
  assert.equal(await page.locator('#soundSettings').isVisible(),true);
  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  assert.equal(await page.locator('#backupBtn').count(),1);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.equal(await page.locator('#setup').isVisible(),true);
  await page.locator('[data-dopa-route="cards"]').click();
  assert.equal(await page.locator('#flashcardPanel').isVisible(),true);
  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  await page.locator('#flashExit').click();
  await page.locator('[data-dopa-route="library"]').click();
  assert.equal(await page.locator('#vocabPanel').isVisible(),true);
  assert.equal(await page.locator('#flashcardPanel').isVisible(),false);
  await page.locator('#vocabExit').click();
  assert.deepEqual(await page.evaluate(()=>window.DOPA_SYNC_API.snapshot().words),old.words);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
