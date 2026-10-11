import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';

for(const height of [667,844])test('iPhone '+height+' Settings groups retain the old backup, cloud and sound actions',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:375,height},isMobile:true,hasTouch:true,acceptDownloads:true});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('dopa-ui-ready')&&!!window.DOPA_SYNC_API?.snapshot);
  const original=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  await page.locator('#dopaSettingsOpen').click();
  assert.equal(await page.locator('#dopaSettings').isVisible(),true);
  for(const [group,ids] of [
   ['dopaSettingsAccount',['dopa-v6','cloudLogin','cloudLogout']],
   ['dopaSettingsSync',['cloudStatus','cloudSync','cloudRecover','cloudConflict','cloudChooseRemote','cloudChooseLocal']],
   ['dopaSettingsBackup',['backupBtn','loadBtn','loadFile']],
   ['dopaSettingsVocabulary',['dataBadge','vocabLoad','vocabFile']],
   ['dopaSettingsSound',['soundBtn','soundSettings','sfxPreset','sfxVolume']]
  ]){
   assert.equal(await page.locator('#'+group).isVisible(),true,group);
   for(const id of ids){
    const element=page.locator('#'+id);
    assert.equal(await element.count(),1,id);
    assert.equal(await element.evaluate((el,ancestorId)=>!!el.closest('#'+ancestorId),group),true,id+' parent');
   }
  }
  assert.equal(await page.locator('#cloudConflict').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Real export and the existing file chooser must still operate after DOM moves.
  const downloadWait=page.waitForEvent('download');
  await page.locator('#backupBtn').click();
  const exportFile=await downloadWait;
  assert.equal(exportFile.suggestedFilename(),'dopa_quest_v6_progress.json');
  const chooserWait=page.waitForEvent('filechooser');
  await page.locator('#loadBtn').click();
  const fileChooser=await chooserWait;
  const payload=Buffer.from(JSON.stringify({format:'DOPA_QUEST_V5',profile:original}));
  await fileChooser.setFiles({name:'safe-backup.json',mimeType:'application/json',buffer:payload});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('進捗を読み込みました'));
  assert.equal(await page.locator('#dopaSettings').isVisible(),true);
  assert.equal(await page.locator('#setup').isVisible(),false);
  const restored=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  for(const key of ['words','flashcards','vocabularyLibrary','dailyStats'])
   assert.deepEqual(restored[key],original[key],key+' after load');
  const sound=page.locator('#soundSettings');
  await sound.locator('summary').click();
  const initial=await page.locator('#sfxPreset').inputValue();
  await page.locator('#soundBtn').click();
  assert.notEqual(await page.locator('#sfxPreset').inputValue(),initial);
  await page.locator('#soundBtn').click();
  assert.equal(await page.locator('#sfxPreset').inputValue(),initial);
  // Conflict choices stay accessible without invoking a real remote sync.
  await page.evaluate(()=>document.querySelector('#cloudConflict').classList.remove('hidden'));
  assert.equal(await page.locator('#cloudChooseRemote').isVisible(),true);
  assert.equal(await page.locator('#cloudChooseLocal').isVisible(),true);
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#dopaDashboard').isVisible(),true);
  assert.equal(await page.locator('#dopaSettings').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
