import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

test('fifth semantic batch remains strictly read-only in mobile Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 const badRequests=[],pageErrors=[];
 page.on('request',r=>{
  if(/shan-extra-semantic-(?:review-5[ab]|review-manifest-v5|cue-rules-v5)\.json/.test(r.url()))badRequests.push(r.url());
 });
 page.on('pageerror',e=>pageErrors.push(e.message));
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const state=await page.evaluate(()=>{
   const target=window.DOPA_DATA.shan.find(c=>c.rank===9481);
   return {
    total:window.DOPA_DATA.shan.length,
    additions:window.DOPA_EXTRA_COUNT,
    packs:window.DOPA_EXTRA_PACK_STATUS.loaded,
    original:{id:target?.id,shan:target?.shan,gloss:target?.japanese_core,rank:target?.rank}
   };
  });
  assert.equal(state.total,16985);
  assert.equal(state.additions,11505);
  assert.deepEqual(state.packs,['pilot-1','pack-2','pack-3','pack-4','pack-5','pack-6']);
  assert.deepEqual(state.original,{id:'shn:anki:c33fd04b127b1210',shan:'တုမ်ႁူဝ်',gloss:'頭を寄せ合う（同じ本を読んだり、同じ皿から食べたりする様子）',rank:9481});
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/16,985語/);
  assert.deepEqual(badRequests,[]);
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();}
});
