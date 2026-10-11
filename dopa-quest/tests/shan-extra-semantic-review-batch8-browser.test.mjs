import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

test('eighth semantic batch in pack 4 is provisional and unused in mobile Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 const pageErrors=[],unexpected=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('request',r=>{
  if(/shan-extra-semantic-(?:review-8[ab]|review-manifest-v8|cue-rules-v8)\.json/.test(r.url()))unexpected.push(r.url());
 });
 try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
  const state=await page.evaluate(()=>{
   const a=window.DOPA_DATA.shan.find(c=>c.rank===12481);
   const b=window.DOPA_DATA.shan.find(c=>c.rank===12981);
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
    {"id":"shn:anki:05c35f556573424f","shan":"ပၢၼ်လုၵ်ႈဢွၼ်ႇ","gloss":"子供時代、幼少期、思春期前の期間","rank":12481},
    {"id":"shn:anki:0c5f158830b56a95","shan":"လိုတ်ႈလိုတ်ႈ","gloss":"（強意語、မိုၼ်ႈ と共に使用）","rank":12981}
  ]);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/16,985語/);
  assert.deepEqual(unexpected,[]);
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();}
});
