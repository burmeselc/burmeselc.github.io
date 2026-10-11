import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

test('mobile editorial hub filters notes, changes status and opens source card without modifying XP',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.DOPA_SYNC_API?.snapshot&&window.DOPA_DATA?.shan?.length===16985);
  const id=await page.evaluate(()=>{
   const c=window.DOPA_DATA.shan.find(x=>x.rank===9712);
   if(!c)throw Error('source card missing');
   window.DOPA_EDITORIAL_NOTES.save(c,{note_types:['translation-question'],reason:'原訳を再確認する'});
   return c.id;
  });
  const xp=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot().xp);
  await page.locator('#dopaSettingsOpen').click();
  await page.locator('#editorialHubOpen').click();
  await page.locator('#editorialHub:not(.hidden)').waitFor();
  assert.match(await page.locator('#hubCount').textContent(),/1件/);
  await page.locator('#hubSearch').fill('原訳を再確認');
  assert.equal(await page.locator('.editorial-hub-entry').count(),1);
  await page.locator('#hubType').selectOption('category-change-suggestion');
  assert.equal(await page.locator('.editorial-hub-entry').count(),0);
  await page.locator('#hubType').selectOption('translation-question');
  assert.equal(await page.locator('.editorial-hub-entry').count(),1);
  await page.locator('.editorial-hub-entry [data-act="addressed"]').click();
  await page.locator('#hubStatus').selectOption('open');
  assert.equal(await page.locator('.editorial-hub-entry').count(),0);
  await page.locator('#hubStatus').selectOption('addressed');
  assert.equal(await page.locator('.editorial-hub-entry').count(),1);
  await page.locator('.editorial-hub-entry [data-act="open"]').click();
  await page.locator('#editorialOverlay:not(.hidden)').waitFor();
  const after=await page.evaluate(id=>({
   xp:window.DOPA_SYNC_API.snapshot().xp,
   note:window.DOPA_EDITORIAL_NOTES.list(id)[0]
  }),id);
  assert.equal(after.xp,xp);
  assert.equal(after.note.status,'addressed');
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
