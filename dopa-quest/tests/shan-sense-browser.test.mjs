import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
test('Shan sense lab opt-in keeps old progress, supports Shan to Japanese and Japanese to Shan split senses',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',x=>errors.push(x.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_SENSE_READY&&window.DOPA_DATA?.shan_senses?.length===7290);
  assert.equal(await page.locator('#shanSenseMode').isDisabled(),false);
  await page.locator('#shanSenseMode').check();
  await page.locator('#semanticCategory').selectOption('17');
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#roundSize').selectOption('10');
  const count=await page.evaluate(()=>window.DOPA_DATA.shan_senses.filter(x=>x.semantic_major==='17'&&x.game_include===1).length);
  assert.ok(count>100);
  const forced=await page.evaluate(()=>{
    const x=window.DOPA_DATA.shan_senses.find(x=>x.sense_split&&x.game_include===1&&x.semantic_major==='17');
    const q=window.qFor(x);
    return {dir:q.dir,typed:q.typed,ambiguousFallback:q.ambiguousFallback,parent:x.parent_id,id:x.id};
  });
  assert.equal(forced.dir,'toJP');
  assert.equal(forced.typed,false);
  assert.equal(forced.ambiguousFallback,false);
  assert.notEqual(forced.parent,forced.id);
  // The spelling may have multiple meanings, but no alternative sense of it
  // may appear among the three distractors in Shan -> Japanese mode.
  const invariant=await page.evaluate(()=>{
    const pool=window.DOPA_DATA.shan_senses.filter(x=>x.semantic_major==='17'&&x.game_include===1);
    const source=pool.find(x=>x.sense_split&&pool.some(y=>y.id!==x.id&&y.shan===x.shan));
    if(!source)return {found:false};
    const alternatives=window.distractors(source,pool,'shan','toJP');
    const choices=[source,...alternatives];
    return {found:true,length:choices.length,spelling:source.shan,
      otherSameSpelling:alternatives.some(x=>x.shan===source.shan),
      uniqueJapanese:new Set(choices.map(x=>x.japanese_core)).size,
      uniqueSpelling:new Set(choices.map(x=>x.shan)).size};
  });
  assert.equal(invariant.found,true);
  assert.equal(invariant.length,4);
  assert.equal(invariant.otherSameSpelling,false);
  assert.equal(invariant.uniqueJapanese,4);
  assert.equal(invariant.uniqueSpelling,4);
  // The reverse mode must also work for split senses: matching Japanese glosses
  // cannot become false Shan choices even when another headword shares the gloss.
  await page.locator('#direction').selectOption('fromJP');
  const reverse=await page.evaluate(()=>{
    const pool=window.DOPA_DATA.shan_senses.filter(x=>x.game_include===1);
    const x=pool.find(c=>c.sense_split&&c.shared_gloss_review===true);
    if(!x)return {found:false};
    const q=window.qFor(x);
    const distractors=window.distractors(x,pool,'shan','fromJP');
    const parts=s=>[...new Set(String(s||'').normalize('NFKC').split(/[；;、，,／\/]/).map(t=>t.replace(/[。．！？!？\s　]+/g,'').trim().toLowerCase()).filter(Boolean))];
    const base=new Set(parts(x.japanese_core));
    return {found:true,dir:q.dir,typed:q.typed,length:distractors.length,
      sameShan:distractors.some(y=>y.shan===x.shan),
      duplicateShan:new Set([x,...distractors].map(y=>y.shan)).size!==distractors.length+1,
      overlappingGloss:distractors.some(y=>parts(y.japanese_core).some(p=>base.has(p)))};
  });
  assert.equal(reverse.found,true);
  assert.equal(reverse.dir,'fromJP');
  assert.equal(reverse.typed,false);
  assert.equal(reverse.length,3);
  assert.equal(reverse.sameShan,false);
  assert.equal(reverse.duplicateShan,false);
  assert.equal(reverse.overlappingGloss,false);
  await page.locator('#direction').selectOption('toJP');
  await page.locator('#start').click();
  await page.locator('#game:not(.hidden)').waitFor();
  for(let n=0;n<5;n++){
   await page.waitForFunction(()=>document.querySelectorAll('#choices button').length===4);
   const opts=await page.locator('#choices button').evaluateAll(buttons=>{
     const byId=new Map(window.DOPA_DATA.shan_senses.map(x=>[x.id,x]));
     return buttons.map(b=>byId.get(b.dataset.itemid));
   });
   assert.equal(opts.length,4);
   assert.ok(opts.every(x=>x.semantic_major==='17'&&x.game_include===1));
   assert.equal(new Set(opts.map(x=>x.shan)).size,4);
   await page.locator('#choices button[data-correct="0"]').first().click();
   await page.locator('#continueBtn').click();
  }
  const prof=await page.evaluate(()=>JSON.parse(localStorage.getItem('dopaQuestV5_profile')||'{}'));
  assert.ok(prof.totalQ>=1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
  await page.waitForFunction(()=>window.DOPA_SENSE_READY===true);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('dopaQuestV5_profile')||'{}'));
  assert.equal(after.totalQ,prof.totalQ);
  await page.locator('#lang').selectOption('burmese');
  assert.equal(await page.locator('#shanSenseMode').isDisabled(),true);
  assert.equal(await page.locator('#semanticCategory option').count(),19);
  await page.screenshot({path:'dopa-shan-sense-lab-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
test('sense inventory failure leaves classic Shan and the 18 category lessons operational',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/shan-senses-manifest.json',route=>route.abort());
   await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.DOPA_SYNC_API?.snapshot);
   await page.waitForFunction(()=>window.DOPA_DATA?.shan?.length===5480);
   assert.equal(await page.locator('#shanSenseMode').isDisabled(),true);
   assert.equal(await page.locator('#semanticCategory option').count(),19);
   await page.locator('#semanticCategory').selectOption('06');
   await page.locator('#direction').selectOption('toJP');
   await page.locator('#start').click();
   await page.locator('#game:not(.hidden)').waitFor();
   assert.equal(await page.locator('#choices button').count(),4);
   assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
