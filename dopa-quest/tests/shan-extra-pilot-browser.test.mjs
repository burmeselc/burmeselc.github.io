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

test('mobile: all 15,980 Shan words including 10,500 pilot additions load, and score is retained',async()=>{
 const {browser,page,errors}=await openWithFailure();
 try{
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),15980);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_COUNT),10500);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_READY),true);
  assert.deepEqual(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.loaded),['pilot-1','pack-2','pack-3','pack-4','pack-5']);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/15,980語/);
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

test('second pack failure preserves the first, third, fourth and fifth packs and sense cards',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-2.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,senses:window.DOPA_DATA.shan_senses.length}));
  assert.deepEqual(d,{n:13980,count:8500,ready:true,senses:7290});
  assert.deepEqual(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.failed),['pack-2']);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('first pack failure does not prevent loading all four later packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,loaded:window.DOPA_EXTRA_PACK_STATUS.loaded}));
  assert.deepEqual(d,{n:14980,count:9500,ready:true,loaded:['pack-2','pack-3','pack-4','pack-5']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('third pack failure preserves old, fourth and fifth packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-3.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:13480,count:8000,ready:true,loaded:['pilot-1','pack-2','pack-4','pack-5'],failed:['pack-3']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('first and second missing still loads third through fifth packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:12980,count:7500,loaded:['pack-3','pack-4','pack-5'],failed:['pilot-1','pack-2']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('fourth pack failure leaves all other packs working',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-4.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:13480,count:8000,loaded:['pilot-1','pack-2','pack-3','pack-5'],failed:['pack-4']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('only fourth pack available still loads 2,500 new cards',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-5.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:7980,count:2500,loaded:['pack-4'],failed:['pilot-1','pack-2','pack-3','pack-5']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('fifth pack failure preserves the previously published 13,480-card game',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-5.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:13480,count:8000,loaded:['pilot-1','pack-2','pack-3','pack-4'],failed:['pack-5']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('only fifth pack is available: 2,500 new words still load',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-4.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:7980,count:2500,loaded:['pack-5'],failed:['pilot-1','pack-2','pack-3','pack-4']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('all five packs missing leaves the baseline 5,480-card learning mode usable',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-4.json','shan-extra-pack-5.json']);
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