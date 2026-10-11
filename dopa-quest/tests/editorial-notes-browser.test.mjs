import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('wordbook review note save, status, export preserve learning profile',async()=>{
 const b=await chromium.launch({headless:true});
 try{
  const p=await b.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true,acceptDownloads:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(URL,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const before=await p.evaluate(()=>localStorage.getItem('dopaQuestV5_profile'));
  await p.locator('#vocabOpen').click();
  await p.locator('#vocabList button[data-action=editorial]').first().click();
  await p.locator('#editorialTypes input[value=translation-question]').check();
  await p.locator('#editorialReason').fill('英語定義も確認する');
  await p.locator('#editorialForm button[type=submit]').click();
  assert.match(await p.locator('#editorialMessage').textContent(),/保存しました/);
  const snapshot=await p.evaluate(()=>({notes:window.DOPA_EDITORIAL_NOTES.list(),progress:localStorage.getItem('dopaQuestV5_profile')}));
  assert.equal(snapshot.notes.length,1);assert.equal(snapshot.progress,before);
  await p.locator('#editorialExisting button[data-note-id]').click();
  await p.locator('#editorialStatus').selectOption('withdrawn');
  await p.locator('#editorialForm button[type=submit]').click();
  assert.equal(await p.evaluate(()=>window.DOPA_EDITORIAL_NOTES.list()[0].status),'withdrawn');
  const dl=p.waitForEvent('download');
  await p.locator('#editorialJSON').click();
  assert.match((await dl).suggestedFilename(),/\.json$/);
  await p.locator('#editorialClose').click();
  assert.equal(await p.locator('#editorialOverlay').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await b.close()}
});
test('storage exception reports failure without interrupting wordbook',async()=>{
 const b=await chromium.launch({headless:true});
 try{
  const p=await b.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await p.goto(URL,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  await p.locator('#vocabOpen').click();
  await p.locator('#vocabList button[data-action=editorial]').first().click();
  await p.evaluate(()=>{window.DOPA_EDITORIAL_NOTES.save=()=>{throw Error('QuotaExceeded')}});
  await p.locator('#editorialTypes input[value=other]').check();
  await p.locator('#editorialReason').fill('要確認');
  await p.locator('#editorialForm button[type=submit]').click();
  assert.match(await p.locator('#editorialMessage').textContent(),/保存できませんでした/);
  await p.locator('#editorialClose').click();
  assert.ok(await p.locator('#vocabList').isVisible());
 }finally{await b.close()}
});
