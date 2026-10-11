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

test('mobile: all 16,985 Shan words including 11,505 pilot additions load, and score is retained',async()=>{
 const {browser,page,errors}=await openWithFailure();
 try{
  assert.equal(await page.evaluate(()=>window.DOPA_DATA.shan.length),16985);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_COUNT),11505);
  assert.equal(await page.evaluate(()=>window.DOPA_EXTRA_READY),true);
  assert.deepEqual(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.loaded),['pilot-1','pack-2','pack-3','pack-4','pack-5','pack-6']);
  await page.locator('[data-dopa-route="quest"]').click();
  assert.match(await page.locator('#dataBadge').textContent(),/16,985語/);
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

test('second pack failure preserves the other five optional packs and sense cards',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-2.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,senses:window.DOPA_DATA.shan_senses.length}));
  assert.deepEqual(d,{n:14985,count:9505,ready:true,senses:7290});
  assert.deepEqual(await page.evaluate(()=>window.DOPA_EXTRA_PACK_STATUS.failed),['pack-2']);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('first pack failure does not prevent loading the five later packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,loaded:window.DOPA_EXTRA_PACK_STATUS.loaded}));
  assert.deepEqual(d,{n:15985,count:10505,ready:true,loaded:['pack-2','pack-3','pack-4','pack-5','pack-6']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('third pack failure preserves original and remaining optional packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-3.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    ready:window.DOPA_EXTRA_READY,loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:14485,count:9005,ready:true,loaded:['pilot-1','pack-2','pack-4','pack-5','pack-6'],failed:['pack-3']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('first and second missing still loads third through sixth packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:13985,count:8505,loaded:['pack-3','pack-4','pack-5','pack-6'],failed:['pilot-1','pack-2']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('fourth pack failure leaves all other packs working',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-4.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:14485,count:9005,loaded:['pilot-1','pack-2','pack-3','pack-5','pack-6'],failed:['pack-4']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('only fourth pack available still loads 2,500 new cards',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-5.json','shan-extra-pack-6.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:7980,count:2500,loaded:['pack-4'],failed:['pilot-1','pack-2','pack-3','pack-5']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('fifth pack failure preserves original and remaining optional packs',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-5.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:14485,count:9005,loaded:['pilot-1','pack-2','pack-3','pack-4','pack-6'],failed:['pack-5']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('only fifth pack is available: 2,500 new words still load',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-4.json','shan-extra-pack-6.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:7980,count:2500,loaded:['pack-5'],failed:['pilot-1','pack-2','pack-3','pack-4']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('sixth pack failure preserves the original 15,980-card deployment',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pack-6.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:15980,count:10500,loaded:['pilot-1','pack-2','pack-3','pack-4','pack-5'],failed:['pack-6']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('sixth pack alone loads 1,005 cards if all earlier packs fail',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-4.json','shan-extra-pack-5.json']);
 try{
  const d=await page.evaluate(()=>({n:window.DOPA_DATA.shan.length,count:window.DOPA_EXTRA_COUNT,
    loaded:window.DOPA_EXTRA_PACK_STATUS.loaded,failed:window.DOPA_EXTRA_PACK_STATUS.failed}));
  assert.deepEqual(d,{n:6485,count:1005,loaded:['pack-6'],failed:['pilot-1','pack-2','pack-3','pack-4','pack-5']});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

test('all six packs missing leaves the baseline 5,480-card learning mode usable',async()=>{
 const {browser,page,errors}=await openWithFailure(['shan-extra-pilot-1.json','shan-extra-pack-2.json','shan-extra-pack-3.json','shan-extra-pack-4.json','shan-extra-pack-5.json','shan-extra-pack-6.json']);
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