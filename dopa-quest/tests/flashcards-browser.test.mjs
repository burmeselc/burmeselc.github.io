import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
async function ready(page){
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.flashcardContext&&!!window.DOPA_FLASH_UI);
}
test('Shan four-button flashcards persist without crediting existing QUEST',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await ready(page);
  const old=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(Object.keys(old.words).length,0);
  await page.locator('#flashOpen').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashCount').selectOption('10');
  await page.locator('#flashStart').click();
  await page.locator('#flashFace').waitFor({state:'visible'});
  assert.equal(await page.locator('#flashRatings').isVisible(),false);
  await page.locator('#flashReveal').click();
  assert.equal(await page.locator('#flashRatings').isVisible(),true);
  await page.locator('[data-flash-rating="good"]').click();
  let snap=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  const ids=Object.keys(snap.flashcards.cards);
  assert.equal(ids.length,1);
  assert.ok(ids[0].startsWith('shn:'));
  assert.equal(snap.flashcards.cards[ids[0]].recognition.state,'learning');
  assert.equal(snap.flashcards.cards[ids[0]].recognition.lastRating,'good');
  assert.deepEqual(snap.words,old.words);
  assert.equal(snap.totalQ,old.totalQ);
  await page.reload();await page.waitForFunction(()=>!!window.DOPA_FLASH_UI);
  snap=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.ok(snap.flashcards.cards[ids[0]].recognition.dueAt>Date.now());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#flashOpen').click();
  await page.locator('#flashExit').click();
  assert.equal(await page.locator('#setup').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('Burmese reverse cards exclude ambiguous glosses; profile restore protects flashcards',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await page.locator('#lang').selectOption('burmese');
  await page.locator('#flashOpen').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashDirection').selectOption('production');
  await page.locator('#flashStart').click();
  assert.equal(await page.locator('#flashFace').isVisible(),true);
  const answer=await page.evaluate(()=>{
   const front=document.querySelector('#flashFaceWord').textContent;
   const all=window.DOPA_SYNC_API.flashcardContext().allDeck;
   const normalize=x=>String(x.japanese_core||x.japanese||x.english||'').normalize('NFKC').replace(/[\s　。、，,；;:：・]+/g,'').toLowerCase();
   const same=all.filter(x=>normalize(x)===front.normalize('NFKC').replace(/[\s　。、，,；;:：・]+/g,'').toLowerCase());
   return {headwords:new Set(same.map(x=>x.burmese)).size,front};
  });
  assert.equal(answer.headwords,1);
  await page.locator('#flashFace').click();
  await page.locator('[data-flash-rating="easy"]').click();
  const profile=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(Object.keys(profile.flashcards.cards).length,1);
  assert.equal(Object.keys(profile.words).length,0);
  await page.evaluate(profile=>window.DOPA_SYNC_API.restore(profile),profile);
  assert.equal(await page.locator('#setup').isVisible(),true);
  const restored=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.deepEqual(restored.flashcards.cards,profile.flashcards.cards);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
