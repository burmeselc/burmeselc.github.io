import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
async function ready(page){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
}
for(const lang of ['burmese','shan'])for(const dir of ['toJP','fromJP'])test(lang+' medium + tag four choices '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await page.locator('#lang').selectOption(lang);
  await page.locator('#studyDetailControls summary').click();
  await page.locator('#semanticMedium').selectOption('03.01');
  await page.locator('#semanticTag').selectOption('feature:body_part');
  await page.locator('#direction').selectOption(dir);
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#slowCorrect').check();
  // Opening/selecting filters creates no credited progress.
  assert.equal(await page.evaluate(()=>Object.keys(window.DOPA_SYNC_API.snapshot().words).length),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(lang==='burmese'&&dir==='toJP')await page.screenshot({path:'dopa-study-details-mobile.png',fullPage:true});
  await page.locator('#start').click();
  for(let i=0;i<3;i++){
   await page.waitForFunction(()=>document.querySelectorAll('#choices button').length===4);
   const choices=await page.locator('#choices button').evaluateAll((buttons,l)=>{
    const byId=new Map(window.DOPA_DATA[l].map(x=>[x.id,x]));
    return buttons.map(b=>{const x=byId.get(b.dataset.itemid),a=window.DOPA_DETAIL.annotation(x,l);return {id:x.id,word:x[l],medium:a.medium,tags:a.tags.feature};});
   },lang);
   assert.equal(new Set(choices.map(x=>x.word)).size,4);
   assert.ok(choices.every(x=>x.medium==='03.01'&&x.tags.includes('body_part')));
   await page.locator('#choices button[data-correct="1"]').click();
   await page.locator('#continueBtn').waitFor();
   await page.locator('#continueBtn').click();
  }
  const saved=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.ok(Object.keys(saved.words).length>=1);
  assert.ok(Object.keys(saved.words).every(id=>id.startsWith(lang==='shan'?'shn:':'bur:')));
  await page.reload();await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  assert.equal(await page.locator('#semanticMedium').inputValue(),'all');
  assert.equal(await page.evaluate(()=>window.DOPA_SYNC_API.snapshot().totalQ),saved.totalQ);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('sparse medium blocks launch; clearing filters restores all vocabulary',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await ready(page);
  await page.locator('#studyDetailControls summary').click();
  await page.locator('#semanticMedium').selectOption('06.02');
  await page.locator('.tab[data-mode="due"]').click();
  await page.locator('#start').click();
  assert.match(await page.locator('#toast').textContent(),/期限到来の復習語/);
  await page.locator('.tab[data-mode="campaign"]').click();
  await page.locator('#start').click();
  assert.equal(await page.locator('#game').isVisible(),false);
  assert.match(await page.locator('#toast').textContent(),/四択に十分/);
  assert.equal(await page.evaluate(()=>Object.keys(window.DOPA_SYNC_API.snapshot().words).length),0);
  await page.locator('#clearStudyDetails').click();
  assert.equal(await page.locator('#semanticMedium').inputValue(),'all');
  await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
 }finally{await browser.close()}
});
test('major/language/sense switching never leaves incompatible active filters',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await ready(page);
  await page.locator('#studyDetailControls summary').click();
  await page.locator('#semanticMedium').selectOption('03.01');
  await page.locator('#semanticTag').selectOption('feature:body_part');
  await page.locator('#semanticCategory').selectOption('06');
  assert.equal(await page.locator('#semanticMedium').inputValue(),'all');
  assert.equal(await page.locator('#semanticTag').inputValue(),'all');
  await page.locator('#semanticMedium').selectOption('06.01');
  await page.locator('#lang').selectOption('burmese');
  assert.equal(await page.locator('#semanticMedium').inputValue(),'all');
  await page.locator('#lang').selectOption('shan');
  await page.locator('#semanticMedium').selectOption('03.01');
  await page.locator('#shanSenseMode').check();
  assert.equal(await page.locator('#semanticMedium').inputValue(),'all');
  await page.locator('#semanticMedium').selectOption('03.01');
  await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
  const valid=await page.locator('#choices button').evaluateAll(bs=>bs.every(b=>{
   const x=window.DOPA_DATA.shan_senses.find(x=>x.id===b.dataset.itemid);
   return window.DOPA_DETAIL.annotation(x,'shan')?.medium==='03.01';
  }));
  assert.equal(await page.locator('#choices button').count(),4);assert.equal(valid,true);
 }finally{await browser.close()}
});
for(const path of ['study-details-pilot-v1.json','study-taxonomy-v1.json'])test('missing '+path+' keeps ordinary game playable',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/'+path,route=>route.abort());await ready(page);
  assert.equal(await page.locator('#semanticMedium').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),5480);
  await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
