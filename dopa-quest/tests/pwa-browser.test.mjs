import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

test('PWA reloads its full parent decks offline without losing browser storage', {timeout:90000}, async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({
   viewport:{width:375,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'
  });
  const page=await context.newPage();
  await page.goto(BASE+(BASE.includes('?')?'&':'?')+'pwa-test=1',{waitUntil:'load'});
  await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===15980 && window.DOPA_DATA?.burmese?.length===2500,
    null,{timeout:60000});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
  await page.evaluate(()=>localStorage.setItem('dopa-pwa-offline-regression','preserved'));
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===15980 && window.DOPA_DATA?.burmese?.length===2500,
    null,{timeout:30000});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('dopa-pwa-offline-regression')),'preserved');
  assert.doesNotMatch(await page.locator('#dataBadge').innerText(),/デモ/);
  assert.equal(await page.locator('#dopaNav').isVisible(),true);
  await context.setOffline(false);
  await context.close();
 } finally { await browser.close(); }
});
