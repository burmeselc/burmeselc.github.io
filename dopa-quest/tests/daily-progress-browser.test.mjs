import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL=process.env.DOPA_TEST_URL||'http://127.0.0.1:8123/dopa-quest/';
async function ready(page){
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.DOPA_DASHBOARD&&!!window.DOPA_DAILY&&!!window.DOPA_FLASH_UI&&!!window.DOPA_SYNC_API?.flashcardRate);
}
test('mobile: new flashcard ratings complete daily milestones, home streak persists after reload',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',x=>errors.push(x.message));
  await ready(page);
  await page.locator('[data-dopa-route="home"]').click();
  assert.match(await page.locator('#dashStreak').textContent(),/0日/);
  assert.equal(await page.locator('#dashMissionRows .dopa-mission').count(),3);
  const initial=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  await page.locator('[data-dopa-route="cards"]').click();
  await page.locator('#flashScope').selectOption('new');
  await page.locator('#flashStart').click();
  for(let i=0;i<5;i++){
   await page.locator('#flashReveal').click();
   await page.locator('[data-flash-rating="good"]').click();
  }
  const after=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  const day=after.dailyStats.days[windowDateKey(after.dailyStats.days)];
  assert.equal(day.uniqueWords.length,5);
  assert.equal(day.rememberedWords.length,5);
  assert.equal(day.missionsClaimed.length,2);
  assert.equal(after.xp-initial.xp,35);
  assert.deepEqual(after.words,initial.words);
  await page.locator('#flashExit').click();
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#dashStreak').textContent(),'1日');
  assert.equal(await page.locator('#dashMissionCount').textContent(),'2 / 3 達成');
  assert.equal(await page.locator('#dashMissionRows .dopa-mission.done').count(),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.reload();
  await page.waitForFunction(()=>!!window.DOPA_DASHBOARD&&!!window.DOPA_FLASH_UI&&!!window.DOPA_SYNC_API?.snapshot);
  const saved=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(saved.dailyStats.days[windowDateKey(saved.dailyStats.days)].uniqueWords.length,5);
  await page.locator('[data-dopa-route="home"]').click();
  assert.equal(await page.locator('#dashStreak').textContent(),'1日');
  assert.equal(await page.locator('#dashMissionCount').textContent(),'2 / 3 達成');
  const copy=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  assert.equal(copy.dailyStats.days[windowDateKey(copy.dailyStats.days)].uniqueWords.length,5);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
function windowDateKey(days){return Object.keys(days)[0]}
test('mobile: quest first attempt populates daily history; retry cannot silently precredit',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ready(page);
  await page.locator('#start').click();
  await page.locator('#choices .choice').first().waitFor({state:'visible'});
  const correct=page.locator('#choices .choice[data-correct="1"]');
  await correct.click();
  const after=await page.evaluate(()=>window.DOPA_SYNC_API.snapshot());
  const today=windowDateKey(after.dailyStats.days);
  assert.equal(after.dailyStats.days[today].questAnswers,1);
  assert.equal(after.dailyStats.days[today].uniqueWords.length,1);
  assert.equal(after.totalQ,1);
  assert.equal(after.dailyStats.days[today].missionsClaimed.length,0);
 }finally{await browser.close()}
});
