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
  await page.locator('#studyDetailControls > summary').click();
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
  await page.locator('#studyDetailControls > summary').click();
  await page.locator('#semanticMedium').selectOption('11.04');
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
  await page.locator('#studyDetailControls > summary').click();
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

test('review list reveals reviewed definitions and refreshes with the filters',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await ready(page);
  await page.locator('#lang').selectOption('burmese');
  await page.locator('#studyDetailControls summary').first().click();
  await page.locator('#studyDetailReview summary').click();
  assert.match(await page.locator('#studyDetailReviewSummary').textContent(),/1685件/);
  assert.equal(await page.locator('#studyDetailReviewList > div').count(),20);
  await page.locator('#studyDetailReviewMore').click();
  assert.equal(await page.locator('#studyDetailReviewList > div').count(),40);
  await page.locator('#semanticMedium').selectOption('06.02');
  assert.equal(await page.locator('#studyDetailReviewList > div').count(),17);
  assert.equal(await page.locator('#studyDetailReviewMore').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.evaluate(()=>Object.keys(window.DOPA_SYNC_API.snapshot().words).length),0);
  await page.screenshot({path:'dopa-study-details-review-mobile.png',fullPage:true});
 }finally{await browser.close()}
});
for(const lang of ['shan','burmese'])test(lang+' expanded cooking category stays within its selected scope',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await ready(page);
  await page.locator('#lang').selectOption(lang);
  await page.locator('#studyDetailControls > summary').click();
  await page.locator('#semanticMedium').selectOption('06.03');
  await page.locator('#direction').selectOption('fromJP');
  await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
  assert.equal(await page.locator('#choices button').evaluateAll((bs,l)=>bs.every(b=>{
   const x=window.DOPA_DATA[l].find(x=>x.id===b.dataset.itemid);
   return window.DOPA_DETAIL.annotation(x,l)?.medium==='06.03';
  }),lang),true);
 }finally{await browser.close()}
});
test('loaded detail engine blocks annotated television synonyms in both directions',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await ready(page);
  const valid=await page.evaluate(()=>{
   const pool=window.DOPA_DATA.burmese,a=pool.find(x=>x.id==='bur:1398089095013'),b=pool.find(x=>x.id==='bur:1519420764107');
   return ['toJP','fromJP'].every(dir=>!window.distractors(a,pool,'burmese',dir).some(x=>x.id===b.id)&&!window.distractors(b,pool,'burmese',dir).some(x=>x.id===a.id));
  });assert.equal(valid,true);
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' animal scope '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await ready(page);
  await page.locator('#lang').selectOption(lang);
  await page.locator('#studyDetailControls > summary').click();
  await page.locator('#semanticMedium').selectOption('02.01');
  await page.locator('#semanticTag').selectOption('feature:animal');
  await page.locator('#direction').selectOption(dir);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
  assert.equal(await page.locator('#choices button').evaluateAll((bs,l)=>bs.every(b=>{
   const x=window.DOPA_DATA[l].find(x=>x.id===b.dataset.itemid);
   return window.DOPA_DETAIL.matches(x,l,{medium:'02.01',tag:'feature:animal'});
  }),lang),true);
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' clothing and housing scopes '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const medium of ['07.01','08.01']){
   await ready(page);await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption(medium);
   await page.locator('#direction').selectOption(dir);
   assert.match(await page.locator('#studyDetailNotice').textContent(),/17領域/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(lang==='burmese'&&dir==='toJP'&&medium==='07.01')await page.screenshot({path:'dopa-study-details-clothing-mobile.png',fullPage:true});
   await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.equal(await page.locator('#choices button').evaluateAll((bs,args)=>bs.every(b=>{
    const x=window.DOPA_DATA[args.lang].find(x=>x.id===b.dataset.itemid);
    return window.DOPA_DETAIL.matches(x,args.lang,{medium:args.medium});
   }),{lang,medium}),true);
  }
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' feelings and family scopes '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [medium,tag] of [['04.01','semantic_type:state'],['05.02','feature:human']]){
   await ready(page);await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption(medium);
   await page.locator('#semanticTag').selectOption(tag);
   await page.locator('#direction').selectOption(dir);
   assert.match(await page.locator('#studyDetailNotice').textContent(),/17領域/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(lang==='shan'&&dir==='toJP'&&medium==='04.01')await page.screenshot({path:'dopa-study-details-psych-mobile.png',fullPage:true});
   await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.equal(await page.locator('#choices button').evaluateAll((bs,args)=>bs.every(b=>{
    const x=window.DOPA_DATA[args.lang].find(x=>x.id===b.dataset.itemid);
    return window.DOPA_DETAIL.matches(x,args.lang,{medium:args.medium,tag:args.tag});
   }),{lang,medium,tag}),true);
  }
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' law and trade scopes '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [medium,tag] of [['09.03','field:law'],['10.03','field:commerce']]){
   await ready(page);await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption(medium);
   await page.locator('#semanticTag').selectOption(tag);
   await page.locator('#direction').selectOption(dir);
   assert.match(await page.locator('#studyDetailNotice').textContent(),/17領域/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(lang==='burmese'&&dir==='toJP'&&medium==='09.03')await page.screenshot({path:'dopa-study-details-law-mobile.png',fullPage:true});
   await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.equal(await page.locator('#choices button').evaluateAll((bs,args)=>bs.every(b=>{
    const x=window.DOPA_DATA[args.lang].find(x=>x.id===b.dataset.itemid);
    return window.DOPA_DETAIL.matches(x,args.lang,{medium:args.medium,tag:args.tag});
   }),{lang,medium,tag}),true);
  }
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' religion and music scopes '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [medium,tag] of [['12.01','field:religion'],['12.03','field:music']]){
   await ready(page);await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption(medium);
   await page.locator('#semanticTag').selectOption(tag);
   await page.locator('#direction').selectOption(dir);
   assert.match(await page.locator('#studyDetailNotice').textContent(),/17領域/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(lang==='burmese'&&dir==='toJP'&&medium==='12.01')await page.screenshot({path:'dopa-study-details-religion-mobile.png',fullPage:true});
   await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.equal(await page.locator('#choices button').evaluateAll((bs,args)=>bs.every(b=>{
    const x=window.DOPA_DATA[args.lang].find(x=>x.id===b.dataset.itemid);
    return window.DOPA_DETAIL.matches(x,args.lang,{medium:args.medium,tag:args.tag});
   }),{lang,medium,tag}),true);
  }
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' time and evaluation scopes '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [medium,tag] of [['14.01','feature:temporal'],['15.04','feature:evaluative']]){
   await ready(page);await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption(medium);
   await page.locator('#semanticTag').selectOption(tag);
   await page.locator('#direction').selectOption(dir);
   assert.match(await page.locator('#studyDetailNotice').textContent(),/17領域/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(lang==='burmese'&&dir==='toJP'&&medium==='14.01')await page.screenshot({path:'dopa-study-details-time-mobile.png',fullPage:true});
   await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.equal(await page.locator('#choices button').evaluateAll((bs,args)=>bs.every(b=>{
    const x=window.DOPA_DATA[args.lang].find(x=>x.id===b.dataset.itemid);
    return window.DOPA_DETAIL.matches(x,args.lang,{medium:args.medium,tag:args.tag});
   }),{lang,medium,tag}),true);
  }
 }finally{await browser.close()}
});

for(const lang of ['shan','burmese'])for(const dir of ['toJP','fromJP'])test(lang+' motion and grammar scopes '+dir,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  for(const [medium,tag] of [['16.01','feature:motion'],['17.01','semantic_type:grammatical_function']]){
   await ready(page);await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption(medium);
   await page.locator('#semanticTag').selectOption(tag);
   await page.locator('#direction').selectOption(dir);
   assert.match(await page.locator('#studyDetailNotice').textContent(),/17領域/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(lang==='burmese'&&dir==='toJP'&&medium==='17.01')await page.screenshot({path:'dopa-study-details-grammar-mobile.png',fullPage:true});
   await page.locator('#start').click();await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.equal(await page.locator('#choices button').evaluateAll((bs,args)=>bs.every(b=>{
    const x=window.DOPA_DATA[args.lang].find(x=>x.id===b.dataset.itemid);
    return window.DOPA_DETAIL.matches(x,args.lang,{medium:args.medium,tag:args.tag});
   }),{lang,medium,tag}),true);
  }
 }finally{await browser.close()}
});

test('reviewed category 18 can make four choices in both languages without changing history on filter',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const lang of ['burmese','shan']){
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await ready(page);
   assert.equal(await page.evaluate(()=>window.DOPA_DETAIL?.coverage?.[window.document.querySelector('#lang').value]?.major_ids?.at(-1)),'18');
   await page.locator('#lang').selectOption(lang);
   await page.locator('#studyDetailControls > summary').click();
   await page.locator('#semanticMedium').selectOption('18.04');
   assert.equal(await page.evaluate(()=>Object.keys(window.DOPA_SYNC_API.snapshot().words).length),0);
   await page.locator('#start').click();
   await page.locator('#game:not(.hidden)').waitFor();
   await page.waitForFunction(()=>document.querySelectorAll('#choices button').length===4);
   const answerIds=await page.locator('#choices button').evaluateAll(buttons=>buttons.map(x=>x.dataset.itemid));
   assert.equal(new Set(answerIds).size,4);
   assert.ok(await page.evaluate(l=>document.querySelectorAll('#choices button').length===4&&
    [...document.querySelectorAll('#choices button')].every(b=>{
     const x=window.DOPA_DATA[l].find(item=>item.id===b.dataset.itemid);
     return x&&window.DOPA_DETAIL.annotation(x,l)?.medium==='18.04';
    }),lang));
   await page.close();
  }
 }finally{await browser.close()}
});
