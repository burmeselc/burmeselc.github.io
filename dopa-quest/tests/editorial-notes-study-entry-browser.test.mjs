import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
async function pageReady(page){
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
 await page.locator('[data-dopa-route="quest"]').click();
 await page.waitForFunction(()=>!!window.DOPA_FLASH_UI&&!!window.DOPA_EDITORIAL_UI);
}
test('v6.3: Shan flash back editorial notes do not rate cards or disrupt four buttons',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await pageReady(page);
  await page.locator('#questAdvancedSettings').evaluate(el=>el.open=true);
  await page.locator('#flashOpen').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  assert.equal(await page.locator('#flashEditorialOpen').isVisible(),false);
  await page.locator('#flashReveal').click();
  assert.equal(await page.locator('#flashEditorialOpen').isVisible(),true);
  const old=await page.evaluate(()=>({
   p:JSON.stringify(window.DOPA_SYNC_API.snapshot()),
   card:document.querySelector('#flashCounter').textContent
  }));
  await page.locator('#flashEditorialOpen').click();
  await page.locator('#editorialTypes input[value=translation-question]').check();
  await page.locator('#editorialReason').fill('語義の区切りを確認する');
  await page.locator('#editorialForm button[type=submit]').click();
  assert.match(await page.locator('#editorialMessage').textContent(),/保存しました/);
  await page.locator('#editorialClose').click();
  const back=await page.evaluate(()=>({
   p:JSON.stringify(window.DOPA_SYNC_API.snapshot()),
   card:document.querySelector('#flashCounter').textContent,
   notes:window.DOPA_EDITORIAL_NOTES.list().length
  }));
  assert.equal(back.p,old.p);assert.equal(back.card,old.card);assert.equal(back.notes,1);
  assert.equal(await page.locator('#flashRatings').isVisible(),true);
  await page.locator('[data-flash-rating="good"]').click();
  const after=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(Object.keys(after.flashcards.cards).length,1);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('v6.3: Shan wrong answer can review then use existing next action, with no extra XP',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await pageReady(page);
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#questAdvancedSettings').evaluate(el=>el.open=true);
  await page.locator('#slowCorrect').check();
  await page.locator('#start').click();
  await page.locator('#choices .choice[data-correct="0"]').first().click();
  assert.equal(await page.locator('#questEditorialOpen').isVisible(),true);
  const before=await page.evaluate(()=>JSON.stringify(window.DOPA_SYNC_API.snapshot()));
  await page.locator('#questEditorialOpen').click();
  await page.locator('#editorialTypes input[value=category-change-suggestion]').check();
  await page.locator('#editorialReason').fill('カテゴリに疑問がある');
  await page.locator('#editorialForm button[type=submit]').click();
  await page.locator('#editorialClose').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.DOPA_SYNC_API.snapshot())),before);
  assert.equal(await page.locator('#continueBtn').isVisible(),true);
  await page.locator('#continueBtn').click();
  await page.waitForFunction(()=>document.querySelector('#questDock').classList.contains('hidden'));
  assert.equal(await page.evaluate(()=>window.DOPA_EDITORIAL_NOTES.list().length),1);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('v6.3: correct-answer auto advance pauses when editor is opened',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await pageReady(page);
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#start').click();
  await page.locator('#choices .choice[data-correct="1"]').first().click();
  await page.evaluate(()=>document.querySelector('#questEditorialOpen')?.click());
  assert.equal(await page.locator('#editorialOverlay').isVisible(),true);
  await page.waitForTimeout(1150);
  assert.equal(await page.locator('#editorialOverlay').isVisible(),true);
  await page.locator('#editorialClose').click();
  assert.equal(await page.locator('#continueBtn').isVisible(),true);
  await page.locator('#continueBtn').click();
  await page.waitForFunction(()=>document.querySelector('#questDock').classList.contains('hidden'));
 }finally{await browser.close()}
});
test('v6.3: Burmese flashcards do not offer Shan editorial action',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await pageReady(page);
  await page.locator('#lang').selectOption('burmese');
  await page.locator('#questAdvancedSettings').evaluate(el=>el.open=true);
  await page.locator('#flashOpen').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  await page.locator('#flashReveal').click();
  assert.equal(await page.locator('#flashEditorialOpen').isVisible(),false);
 }finally{await browser.close()}
});
