import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

test('sixth semantic batch across pack 3 / 4 is provisional and unused in mobile Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 const pageErrors=[],unexpected=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('request',r=>{
  if(/shan-extra-semantic-(?:review-6[ab]|review-manifest-v6|cue-rules-v6)\.json/.test(r.url()))unexpected.push(r.url());
 });
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const state=await page.evaluate(()=>{
   const a=window.DOPA_DATA.shan.find(c=>c.rank===10481);
   const b=window.DOPA_DATA.shan.find(c=>c.rank===10981);
   return {
    total:window.DOPA_DATA.shan.length,
    additions:window.DOPA_EXTRA_COUNT,
    packs:window.DOPA_EXTRA_PACK_STATUS.loaded,
    boundary:[
      {id:a?.id,shan:a?.shan,gloss:a?.japanese_core,rank:a?.rank},
      {id:b?.id,shan:b?.shan,gloss:b?.japanese_core,rank:b?.rank}
    ]
   };
  });
  assert.equal(state.total,16985);
  assert.equal(state.additions,11505);
  assert.deepEqual(state.packs,['pilot-1','pack-2','pack-3','pack-4','pack-5','pack-6']);
  assert.deepEqual(state.boundary,[
    {id:'shn:anki:dedf0d6a02714c89',shan:'လိုတ်းလၢတ်ႇ',gloss:'急ぐ、せかせかする',rank:10481},
    {id:'shn:anki:e1cbf6a819379f2a',shan:'ၵင်ႇလင်ႇ',gloss:'落ち着きがない、理由なく動き回る',rank:10981}
  ]);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/16,985語/);
  assert.deepEqual(unexpected,[]);
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();}
});
