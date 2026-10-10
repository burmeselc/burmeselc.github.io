import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
async function ready(page){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.DOPA_VOCAB_UI&&!!window.DOPA_FLASH_UI&&!!window.DOPA_SYNC_API?.vocabularyContext);
}
test('Mobile Shan search → bookmark → custom book → four-rating session → reload',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);
  await page.locator('#vocabOpen').click();
  assert.equal(await page.locator('#vocabPanel').isVisible(),true);
  assert.ok(await page.locator('#vocabList .vocab-row').count()<=40);
  const first=await page.locator('#vocabList [data-action="bookmark"]').first().getAttribute('data-id');
  assert.ok(first.startsWith('shn:'));
  await page.locator('#vocabList [data-action="bookmark"]').first().click();
  let snapshot=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.deepEqual(snapshot.vocabularyLibrary.bookmarks,[first]);
  assert.deepEqual(snapshot.words,{});
  assert.deepEqual(snapshot.flashcards.cards,{});
  await page.locator('#vocabBookName').fill('復習するシャン語');
  await page.locator('#vocabCreate').click();
  const custom=await page.locator('#vocabTarget').inputValue();
  assert.ok(custom.startsWith('book:'));
  await page.locator('#vocabList [data-action="target"]').first().click();
  snapshot=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.deepEqual(snapshot.vocabularyLibrary.books[custom.slice(5)].cards,[first]);
  await page.locator('#vocabView').selectOption(custom);
  assert.equal(await page.locator('#vocabList .vocab-row').count(),1);
  await page.locator('#vocabStudy').click();
  assert.equal(await page.locator('#flashcardPanel').isVisible(),true);
  assert.equal(await page.locator('#flashCollection').inputValue(),custom);
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  await page.locator('#flashReveal').click();
  await page.locator('[data-flash-rating="good"]').click();
  snapshot=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(snapshot.flashcards.cards[first].recognition.lastRating,'good');
  assert.equal(snapshot.totalQ,0);
  assert.deepEqual(snapshot.words,{});
  await page.locator('#flashExit').click();
  assert.equal(await page.locator('#vocabPanel').isVisible(),true);
  await page.reload();
  await page.waitForFunction(()=>!!window.DOPA_VOCAB_UI);
  snapshot=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.ok(snapshot.vocabularyLibrary.bookmarks.includes(first));
  assert.ok(snapshot.vocabularyLibrary.books[custom.slice(5)].cards.includes(first));
  assert.equal(snapshot.flashcards.cards[first].recognition.lastRating,'good');
  await page.locator('#vocabOpen').click();
  await page.locator('#vocabView').selectOption(custom);
  assert.equal(await page.locator('#vocabList .vocab-row').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('Burmese bilingual search and saved-book restore never overwrite old QUEST history',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await ready(page);
  const original=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  const search=await page.evaluate(()=>{
   const candidates=window.DOPA_SYNC_API.vocabularyContext().allDeck;
   const x=candidates.find(x=>String(x.english||'').length>=5&&x.game_include!==0);
   return x.english.slice(0,5);
  });
  await page.locator('#vocabOpen').click();
  await page.locator('#vocabSearch').fill(search.toUpperCase());
  assert.ok(await page.locator('#vocabList .vocab-row').count()>0);
  await page.locator('#vocabExit').click();
  await page.locator('#lang').selectOption('burmese');
  await page.locator('#vocabOpen').click();
  await page.locator('#vocabSearch').fill('');
  const burmese=await page.locator('#vocabList [data-action="bookmark"]').first().getAttribute('data-id');
  assert.ok(burmese.startsWith('bur:'));
  await page.locator('#vocabList [data-action="bookmark"]').first().click();
  let profile=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.ok(profile.vocabularyLibrary.bookmarks.includes(burmese));
  await page.evaluate(p=>window.DOPA_SYNC_API.restore(p),profile);
  assert.equal(await page.locator('#setup').isVisible(),true);
  profile=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.ok(profile.vocabularyLibrary.bookmarks.includes(burmese));
  assert.deepEqual(profile.words,original.words);
  assert.equal(profile.totalQ,original.totalQ);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
