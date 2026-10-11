import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

for(const height of [667,844]){
 test('QUEST has a stable-width Padauk Shan question on '+height+'px iPhone',async()=>{
  const browser=await chromium.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:375,height},isMobile:true,hasTouch:true});
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  await page.locator('[data-dopa-route="quest"]').click();
   await page.waitForFunction(()=>!!window.DOPA_FLASH_UI&&!!window.DOPA_SYNC_API?.snapshot);
   await page.locator('#lang').selectOption('shan');
   await page.locator('#direction').selectOption('toJP');
   await page.locator('#start').click();
   await page.locator('#choices .choice').first().waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.load('700 30px DopaPadauk','ၵႂႃႇၼႆႉ'));
   const result=await page.evaluate(()=>{
    const card=document.querySelector('#card'),arena=document.querySelector('#game>.arena');
    const prompt=document.querySelector('#prompt'),choices=document.querySelector('#choices');
    const size=()=>[card.getBoundingClientRect().width,arena.getBoundingClientRect().width];
    const initial=size();
    prompt.textContent='ၵႂႃႇ';
    document.querySelector('#meta').textContent='1件';
    const short=size();
    prompt.textContent='ၵႂႃႇၼႆႉ'.repeat(50);
    document.querySelector('#meta').textContent='BOSS ×2 · '.repeat(20);
    card.className='card boss';
    const boss=size(),css=getComputedStyle(prompt);
    return {initial,short,boss,font:css.fontFamily,lang:prompt.lang,
      paddingTop:parseFloat(css.paddingTop),lineHeight:parseFloat(css.lineHeight),
      loaded:[...document.fonts].some(f=>f.family==='DopaPadauk'&&f.weight==='700'&&f.status==='loaded'),
      choiceBottom:choices.getBoundingClientRect().bottom,screenHeight:innerHeight,
      pageScroll:document.scrollingElement.scrollTop};
   });
   for(const s of [result.initial,result.short,result.boss]){
     assert.ok(s[0]>330,JSON.stringify(result));
     assert.ok(Math.abs(s[0]-result.initial[0])<1,JSON.stringify(result));
     assert.ok(Math.abs(s[1]-result.initial[1])<1,JSON.stringify(result));
   }
   assert.equal(result.lang,'shn');
   assert.match(result.font,/DopaPadauk/);
   assert.ok(result.loaded,'Padauk webfont should load');
   assert.ok(result.paddingTop>=5&&result.lineHeight>=32,JSON.stringify(result));
   assert.ok(result.choiceBottom<=result.screenHeight+1,JSON.stringify(result));
   assert.equal(result.pageScroll,0);
  }finally{await browser.close()}
 });
}

test('Flashcards select Shan typography only on original-script face',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  await page.locator('[data-dopa-route="quest"]').click();
  await page.waitForFunction(()=>!!window.DOPA_FLASH_UI&&!!window.DOPA_SYNC_API?.snapshot);
  await page.locator('#lang').selectOption('shan');
  await page.locator('#flashOpen').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  assert.equal(await page.locator('#flashFaceWord').getAttribute('lang'),'shn');
  await page.locator('#flashReveal').click();
  assert.equal(await page.locator('#flashFaceWord').getAttribute('lang'),'ja');
 }finally{await browser.close()}
});
