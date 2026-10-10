import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('Chromium mobile sound settings preview, persistence and classic Shan gameplay',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.DOPA_SYNC_API?.snapshot&&window.DOPASound?.play);
   await page.locator('#soundSettings summary').click();
   await page.locator('#sfxPreset').selectOption('flashy');
   await page.locator('#sfxVolume').fill('40');
   await page.locator('#sfxVolume').dispatchEvent('input');
   const value=await page.evaluate(()=>({profile:JSON.parse(localStorage.getItem('dopaQuestV5_profile')),caption:document.querySelector('#sfxVolumeValue').textContent}));
   assert.equal(value.profile.sfxStyle,'flashy');
   assert.equal(value.profile.sfxVolume,40);
   assert.equal(value.caption,'40%');
   for(const sound of ['ok','combo3','combo5','combo10','boss','seal','nemesis','resultGood','bad']){
     await page.locator('[data-sfx-preview="'+sound+'"]').click();
   }
   await page.locator('#soundBtn').click();
   assert.equal(await page.locator('#sfxPreset').inputValue(),'off');
   await page.locator('#soundBtn').click();
   assert.equal(await page.locator('#sfxPreset').inputValue(),'flashy');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.DOPA_SYNC_API?.snapshot&&window.DOPASound?.play);
   assert.equal(await page.locator('#sfxPreset').inputValue(),'flashy');
   assert.equal(await page.locator('#sfxVolume').inputValue(),'40');
   assert.equal(await page.locator('#semanticCategory option').count(),19);
   await page.locator('#direction').selectOption('toJP');
   await page.locator('#start').click();
   await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.deepEqual(errors,[]);
   await page.locator('#soundBtn').click();
   await page.screenshot({path:'dopa-sfx-mobile-preview.png',fullPage:true});
 }finally{await browser.close()}
});
test('iOS UA without audioSession produces no audio context instead of risking interruption',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
   const page=await ctx.newPage();
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.DOPASound?.play);
   const result=await page.evaluate(()=>{
     const state=window.DOPASound.status(),hasSession=!!navigator.audioSession;
     return {state,hasSession,played:window.DOPASound.play('ok',{preset:'flashy',volume:50})};
   });
   if(!result.hasSession){
     assert.equal(result.played,false);
     assert.match(result.state,/音楽/);
   }
 }finally{await browser.close()}
});
