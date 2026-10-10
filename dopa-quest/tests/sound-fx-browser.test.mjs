import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
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
   await page.locator('#sfxVolume').evaluate(el=>{el.value='40';el.dispatchEvent(new Event('input',{bubbles:true}))});
   const value=await page.evaluate(()=>({profile:JSON.parse(localStorage.getItem('dopaQuestV5_profile')),caption:document.querySelector('#sfxVolumeValue').textContent}));
   assert.equal(value.profile.sfxStyle,'flashy');
   assert.equal(value.profile.sfxVolume,40);
   assert.equal(value.caption,'40%');
   for(const sound of ['ok','combo3','combo5','combo10','bossEnter','boss','seal','nemesis','rival','levelup','resultGood','resultLow','bad']){
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

test('one answer cue, separate boss entrance, immediate mute and preserved progress',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const page=await browser.newPage();await page.goto(BASE,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.DOPA_SYNC_API?.snapshot&&window.DOPASound?.play);
   await page.evaluate(()=>{
     window.soundCalls=[];window.stopCalls=0;
     window.DOPASound.play=(kind)=>{window.soundCalls.push(kind);return true};
     window.DOPASound.stop=()=>window.stopCalls++;
   });
   await page.locator('.tab[data-mode="free"]').click();
   await page.locator('#direction').selectOption('toJP');
   await page.locator('#roundSize').selectOption('10');
   await page.locator('#start').click();
   for(let i=0;i<5;i++){
     await page.locator('#choices button:not([disabled])').first().waitFor();
     const before=await page.evaluate(()=>window.soundCalls.length);
     await page.locator('#choices button[data-correct="1"]').click();
     const added=await page.evaluate(before=>window.soundCalls.slice(before),before);
     assert.equal(added.length,1);
     if(i===4)assert.equal(added[0],'boss');
     if(i<4)await page.waitForFunction(()=>document.querySelector('#choices button:not([disabled])'));
   }
   const calls=await page.evaluate(()=>window.soundCalls);
   assert.equal(calls.filter(k=>k==='bossEnter').length,1);
   const before=await page.evaluate(()=>({stops:window.stopCalls,profile:window.DOPA_SYNC_API.snapshot()}));
   await page.locator('#soundBtn').click();
   const after=await page.evaluate(()=>({stops:window.stopCalls,profile:window.DOPA_SYNC_API.snapshot()}));
   assert.ok(after.stops>before.stops);
   assert.deepEqual(after.profile.words,before.profile.words);
 }finally{await browser.close()}
});

test('every preset synthesizes finite, bounded audio with a short tail',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const page=await browser.newPage();await page.goto(BASE,{waitUntil:'domcontentloaded'});
   const source=readFileSync(new URL('../sound-fx.js',import.meta.url),'utf8');
   const measurements=await page.evaluate(async source=>{
     const out=[];
     for(const preset of ['quiet','standard','flashy'])for(const kind of window.DOPASound.patterns){
       const offline=new OfflineAudioContext(1,48000*1.3,48000);
       // Evaluate a fresh engine against the actual browser's offline DSP graph.
       const graph=new Proxy(offline,{get(target,key){
         if(key==='state')return 'running';
         const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
       }});
       const root={AudioContext:class {constructor(){return graph}}};
       const nav={userAgent:'Desktop test',platform:'Linux',maxTouchPoints:0};
       new Function('window','navigator',source)(root,nav);
       if(!root.DOPASound.play(kind,{preset,volume:100}))throw Error('cue refused '+kind);
       const buffer=await offline.startRendering(),samples=buffer.getChannelData(0);
       let peak=0,energy=0,tail=0;
       for(let i=0;i<samples.length;i++){
         if(!Number.isFinite(samples[i]))throw Error('invalid sample');
         peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]*samples[i];
         if(i>48000*1.15)tail=Math.max(tail,Math.abs(samples[i]));
       }
       out.push({kind,preset,peak,energy,tail});
     }
     return out;
   },source);
   assert.equal(measurements.length,39);
   for(const m of measurements){assert.ok(m.peak>0&&m.peak<.3,JSON.stringify(m));assert.ok(m.energy>0);assert.ok(m.tail<.00001,JSON.stringify(m));}
 }finally{await browser.close()}
});
