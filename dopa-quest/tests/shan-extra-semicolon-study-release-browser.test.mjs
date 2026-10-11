import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('983 semicolon source glosses tagged, 607 provisional categories, 376 review-only',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const data=await page.evaluate(()=>{
   const d=window.DOPA_DATA.shan,e=window.DOPA_DETAIL;
   const out={total:d.length,extra:window.DOPA_EXTRA_COUNT,reviewed:0,categorized:0,uncategorized:0,
    exact:[],summary:e.extraProvisional};
   for(const x of d){
    const a=e.annotation(x,'shan');
    if(!a?.boundary_unverified)continue;
    out.reviewed++;if(a.medium)out.categorized++;else out.uncategorized++;
    if(out.exact.length<3)out.exact.push({rank:x.rank,gloss:x.japanese_core,medium:a.medium,status:a.review_status});
   }
   return out;
  });
  assert.equal(data.total,16985);assert.equal(data.extra,11505);
  assert.deepEqual([data.reviewed,data.categorized,data.uncategorized],[983,607,376]);
  assert.equal(data.summary.count,5932+data.summary.general_review_count+(data.summary.held_review_count||0));
  assert.equal(data.summary.categorized_count,5556+data.summary.general_categorized_count);
  assert.equal(data.summary.approved_senses,false);
  assert.match(await page.locator('#semanticCategoryNotice').textContent(),new RegExp(data.summary.categorized_count.toLocaleString('ja-JP')+'件.*'+(376+data.summary.general_uncategorized_count).toLocaleString('ja-JP')+'件'));
  await page.locator('[data-dopa-route="library"]').click();
  await page.locator('#vocabSearch').fill(data.exact[0].gloss);
  const line=page.locator('#vocabList .vocab-row').first();
  await line.waitFor({state:'visible'});
  assert.match(await line.textContent(),/語義境界未検証/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('absent semicolon shard retains prior 4,949 reviewed without altering decks',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  await page.route(/shan-extra-semicolon-study-release-v1\.json/,r=>r.abort());
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const out=await page.evaluate(()=>({count:window.DOPA_DETAIL?.extraProvisional?.count,
   semicolon:window.DOPA_DETAIL?.extraProvisional?.semicolon_review_count,
   total:window.DOPA_DATA.shan.length}));
  assert.deepEqual(out,{count:4949,semicolon:0,total:16985});
 }finally{await browser.close()}
});

// Every proposed category can temporarily be absent in a machine-review sidecar.
// Rendering those cards must never interrupt gameplay, XP, or auto/explicit advance.
test('unclassified Shan proposals remain playable through successive correct answers',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===16985&&window.DOPA_SYNC_API?.snapshot);
  await page.locator('[data-dopa-route="quest"]').click();
  await page.locator('#zone').selectOption('extra');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#slowCorrect').check();
  await page.evaluate(()=>{
   const e=window.DOPA_DETAIL,original=e.annotation.bind(e);
   e.annotation=(card,lang)=>{
    const a=original(card,lang);
    return lang==='shan'&&a?.provisional_only?
      {...a,medium:null,proposed_medium:null,review_status:'uncategorized-needs-review'}:a;
   };
  });
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  for(let i=0;i<5;i++){
   const choices=page.locator('#choices button:not([disabled])');
   await choices.first().waitFor();
   assert.equal(await choices.count(),4);
   await page.locator('#choices button[data-correct="1"]').click();
   await page.locator('#continueBtn').click();
  }
  assert.equal(await page.evaluate(()=>window.DOPA_SYNC_API.snapshot().totalQ),5);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
