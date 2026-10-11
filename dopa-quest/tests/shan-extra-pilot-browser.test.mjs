import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

async function openWithFailure(patterns=[]){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const pattern of patterns)await page.route('**/data/'+pattern,route=>route.abort());
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready'));
 return {browser,page,errors};
}

test('mobile: all 8,480 Shan words including 3,000 pilot additions load, and score is retained',async()=>{
 const {browser,page,errors}=await openWithFailure();
 try{
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),8480);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_COUNT),3000);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_READY),true);
  assert.deepEqual(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.loaded),['pilot-1','pack-2']);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/8,480語/);
  assert.equal(await page.locator('#zone option[value="extra"]').count(),1);
  await page.locator('#zone').selectOption('extra');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#roundSize').selectOption('10');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  const ids=await page.locator('#choices button').evaluateAll(buttons=>buttons.map(x=>x.dataset.itemid));
  assert.equal(ids.length,4);
  assert.ok(ids.every(id=>id.startsWith('shn:anki:')));
  await page.locator('#choices button[data-correct="1"]').click();
  const p=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(p.totalQ,1);
  assert.ok(Object.keys(p.words).some(x=>x.startsWith('shn:anki:')));
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('second pack failure preserves original pilot, 5,480 parents and sense cards',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-2.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,senses:window.DOPA_DATA.shan_senses.length}));
  assert.deepEqual(d,{n:6480,count:1000,ready:true,senses:7290});
  assert.deepEqual(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.failed),['pack-2']);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('first pack failure does not prevent independently loading the 2,000-card second pack',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,loaded:window.DOPA_EXTRA_PACK_STATUS.loaded}));
  assert.deepEqual(d,{n:7480,count:2000,ready:true,loaded:['pack-2']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('both packs missing leaves the baseline 5,480-card learning mode usable',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json']);
 try{
  const result=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,
    senses:window.DOPA_DATA.shan_senses.length,available:window.DOPA_EXTRA_READY}));
  assert.deepEqual(result,{n:5480,senses:7290,available:false});
  await page.locator('[data-dopa-route="quest"]').click();
  assert.equal(await page.locator('#zone option[value="extra"]').count(),0);
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  assert.equal(await page.locator('#choices button').count(),4);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('manifest outage retains legacy 1,000-card pilot',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-manifest-v1.json']);
 try{
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),6480);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_COUNT),1000);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.manifest_fallback),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});