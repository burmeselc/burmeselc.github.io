import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
async function ready(page){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.DOPA_FLASH_UI&&!!window.DOPA_SYNC_API?.snapshot);
}
async function dimensions(page,buttonId,scrollId){
 return page.evaluate(({buttonId,scrollId})=>{
  const vp=window.visualViewport;
  const bottom=(vp?.offsetTop||0)+(vp?.height||innerHeight);
  const button=document.getElementById(buttonId),area=document.getElementById(scrollId);
  const br=button.getBoundingClientRect(),sr=area.getBoundingClientRect();
  return {bottom,buttonTop:br.top,buttonBottom:br.bottom,
   scrollHeight:area.scrollHeight,clientHeight:area.clientHeight,
   scrollTop:document.scrollingElement.scrollTop,
   screenHeight:innerHeight,
   hasOverflow:area.scrollHeight>area.clientHeight,
   dockBottom:button.closest('.quest-dock,.flash-action-dock')?.getBoundingClientRect().bottom||0};
 },{buttonId,scrollId});
}
for(const height of [667,844])test('QUEST keeps missed-answer next button visible at '+height+'px without page scrolling',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:375,height},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#slowCorrect').check();
  await page.locator('#start').click();
  await page.locator('#choices .choice').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#dopaNav').isVisible(),false);
  assert.equal(await page.locator('#game').evaluate(el=>getComputedStyle(el).position),'fixed');
  assert.equal(await page.locator('#choices .choice').count(),4);
  await page.locator('#choices .choice[data-correct="0"]').first().click();
  await page.locator('#continueBtn').waitFor({state:'visible'});
  // A synthetically long note cannot displace the next action: only the note scrolls.
  await page.locator('#feedback').evaluate(el=>{
   const e=document.createElement('div');e.className='detail note';
   e.textContent='多義語の補足説明・比較解説。'.repeat(150);
   el.appendChild(e);
  });
  const a=await dimensions(page,'continueBtn','feedback');
  assert.ok(a.hasOverflow,'long explanation should be internally scrollable');
  assert.ok(a.buttonTop>=0&&a.buttonBottom<=a.bottom+1,JSON.stringify(a));
  assert.ok(a.dockBottom<=a.bottom+1,JSON.stringify(a));
  assert.equal(a.scrollTop,0,'page must not scroll while answering');
  await page.locator('#continueBtn').click();
  await page.waitForFunction(()=>document.querySelector('#questDock').classList.contains('hidden'));
  assert.equal(await page.locator('#choices .choice').count(),4);
  const next=await page.locator('#choices').boundingBox();
  assert.ok(next&&next.y+next.height<=height+1,'choices must stay within viewport');
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
for(const height of [667,844])test('Flashcard long back stays scrollable and rating dock visible at '+height+'px',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:375,height},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);
  await page.locator('#flashOpen').click();
  assert.equal(await page.locator('#dopaNav').isVisible(),true,'navigation on setup');
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  assert.equal(await page.locator('#dopaNav').isVisible(),false,'navigation hidden during studying');
  assert.equal(await page.locator('#flashcardPanel').evaluate(el=>getComputedStyle(el).position),'fixed');
  await page.locator('#flashReveal').click();
  await page.locator('#flashFaceNote').evaluate(el=>{
   el.classList.remove('hidden');
   el.textContent='文法的な機能と語義の長い説明。'.repeat(170);
  });
  const d=await dimensions(page,'flashRatings','flashFace');
  assert.ok(d.hasOverflow,'very long gloss must scroll within face');
  assert.ok(d.buttonTop>=0&&d.buttonBottom<=d.bottom+1,JSON.stringify(d));
  assert.equal(d.scrollTop,0,'page stays fixed');
  await page.locator('[data-flash-rating="again"]').click();
  assert.equal(await page.locator('#flashFace').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
