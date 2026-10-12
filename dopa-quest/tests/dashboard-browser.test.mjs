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
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#setup').isVisible(),false);
  assert.equal(await page.locator('#dopaBoot').isVisible(),false);
  assert.equal(await page.locator('[data-dopa-route="home"]').getAttribute('aria-current'),'page');
  const old=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#setup').isVisible(),false);
  assert.equal(await page.locator('#dashXp').textContent(),String(old.xp));
  assert.equal(await page.locator('#dashPlanNew').isVisible(),true);
  assert.equal(await page.locator('#dashPlanShort').isVisible(),true);
  assert.equal(await page.locator('#dashPlanReview').isVisible(),true);
  assert.match(await page.locator('#dashPlanContext').textContent(),/シャン語|ビルマ語/);
  assert.ok((await page.evaluate(()=>window.DOPA_DASHBOARD.currentPlan())).newAvailable>=0);
  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  assert.equal(await page.locator('#flashcardPanel').isVisible(),false);
  await page.locator('#dopaSettingsOpen').click();
  assert.equal(await page.locator('#dopaSettings').isVisible(),true);
  assert.equal(await page.locator('#cloudStatus').isVisible(),true);
  assert.equal(await page.locator('#soundSettings').isVisible(),true);
  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  assert.equal(await page.locator('#backupBtn').count(),1);
  // A restored cloud snapshot must not reopen the classic setup over Settings.
  await page.evaluate(()=>window.DOPA_SYNC_API.restore(window.DOPA_SYNC_API.snapshot()));
  assert.equal(await page.locator('#dopaSettings').isVisible(),true);
  assert.equal(await page.locator('#setup').isVisible(),false);
  assert.equal(await page.locator('#profile').isVisible(),false);
  await page.locator('[data-dopa-route="home"]').click();
  await page.evaluate(()=>window.DOPA_SYNC_API.restore(window.DOPA_SYNC_API.snapshot()));
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#setup').isVisible(),false);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.equal(await page.locator('#setup').isVisible(),true);
  await page.locator('[data-dopa-route="cards"]').click();
  assert.equal(await page.locator('#flashcardPanel').isVisible(),true);
  assert.equal(await page.locator('[data-dopa-route="cards"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#dopaNav').isVisible(),true);
  assert.equal(await page.locator('#flashcardPanel').evaluate(el=>getComputedStyle(el).position),'static');

  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  await page.locator('#flashExit').click();
  await page.locator('[data-dopa-route="library"]').click();
  assert.equal(await page.locator('#vocabPanel').isVisible(),true);
  assert.equal(await page.locator('[data-dopa-route="library"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#dopaNav').isVisible(),true);

  assert.equal(await page.locator('#flashcardPanel').isVisible(),false);
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#vocabPanel').isVisible(),false);
  assert.equal(await page.locator('#setup').isVisible(),false);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.deepEqual(await page.evaluate(()=>window.DOPA_SYNC_API.snapshot().words),old.words);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('home weak-review button restores QUEST history without modifying legacy words',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_DASHBOARD&&!!window.DOPA_FLASH_UI);
  const before=await page.evaluate(()=>{
   const profile=window.DOPA_SYNC_API.snapshot();
   const first=window.DOPA_SYNC_API.flashcardContext().pool[0];
   profile.words[first.id]={seen:3,wrong:3,correct:0,nemesis:true};
   window.DOPA_SYNC_API.restore(profile);
   return {id:first.id,words:JSON.stringify(profile.words)};
  });
  assert.equal(await page.locator('#dashWeak').isEnabled(),true);
  assert.match(await page.locator('#dashWeak').textContent(),/1枚/);
  await page.locator('#dashWeak').click();
  assert.equal(await page.locator('#flashScope').inputValue(),'weak');
  assert.equal(await page.locator('#flashStart').isEnabled(),true);
  await page.locator('#flashStart').click();
  assert.equal(await page.locator('#flashFace').isVisible(),true);
  await page.locator('#flashReveal').click();
  await page.locator('[data-flash-rating="good"]').click();
  const after=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(JSON.stringify(after.words),before.words);
  assert.ok(after.flashcards.cards[before.id].recognition);
  assert.equal(after.totalQ,0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
