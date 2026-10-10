import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{create}=require('../study-details.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const taxonomy=load('study-taxonomy-v1.json'),details=load('study-details-pilot-v1.json');
const decks={burmese:load('burmese.json'),shan:[...load('shan-1.json'),...load('shan-2.json')]};
const engine=create(taxonomy,details,decks),clone=x=>structuredClone(x);
test('pilot has 3141 exact reviewed existing IDs and 77 stable middle categories',()=>{
 assert.equal(engine.mediums.size,77);
 assert.equal(Object.keys(details.cards.burmese).length,1404);
 assert.equal(Object.keys(details.cards.shan).length,1737);
 for(const l of ['shan','burmese']){
  const majors=load(l+'-categories-v1.json').cards;
  for(const x of decks[l]){
   const a=engine.annotation(x,l);if(!a)continue;
   assert.equal(a.evidence,x.japanese_core);
   assert.equal(a.medium.slice(0,2),majors[x.id][0]);
   assert.ok(['P','R'].includes(majors[x.id][1]));
  }
 }
 assert.equal(details.new_cards_created,0);
 assert.equal(details.original_dictionary_verified,false);
});
test('no filters retain every old card, including unclassified entries',()=>{
 for(const l of ['shan','burmese'])assert.ok(decks[l].every(x=>engine.matches(x,l)));
});
test('medium and cross-cutting tags intersect; POS is never a tag substitute',()=>{
 const body=decks.burmese.filter(x=>engine.matches(x,'burmese',{medium:'03.01',tag:'feature:body_part'}));
 assert.equal(body.length,50);
 assert.equal(decks.burmese.filter(x=>engine.matches(x,'burmese',{medium:'03.01',tag:'feature:consumable'})).length,0);
 assert.ok(body.every(x=>x.japanese_core===engine.annotation(x,'burmese').gloss));
});
test('stale imported definitions and child cards do not inherit annotations',()=>{
 const x=decks.burmese.find(x=>engine.annotation(x,'burmese'));
 assert.equal(engine.annotation({...x,japanese_core:'別の意味'},'burmese'),null);
 assert.equal(engine.annotation({...x,burmese:'別語'},'burmese'),null);
 assert.equal(engine.annotation({...x,id:x.id+':sense:2',parent_id:x.id},'burmese'),null);
 assert.equal(engine.annotation({...x,game_pos:'訂正済み品詞'},'burmese')?.medium,engine.annotation(x,'burmese').medium);
});
test('bad metadata fails closed without modifying decks or old categories',()=>{
 const before=JSON.stringify(decks),bad=clone(details);
 bad.cards.burmese[Object.keys(bad.cards.burmese)[0]].gloss='changed';
 assert.throws(()=>create(taxonomy,bad,decks),/does not match/);
 const badTag=clone(details);
 badTag.cards.shan[Object.keys(badTag.cards.shan)[0]].tags.feature.push('invented');
 assert.throws(()=>create(taxonomy,badTag,decks),/Unknown tag/);
 assert.equal(JSON.stringify(decks),before);
});
// Execute the actual collision filter used by the game, including sparse categories.
const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=game.indexOf('function distractors('),end=game.indexOf('\nfunction beep(',start);
const getDistractors=new Function('window','orig','jp','glossOverlap','pos','indexOf','shuffle','rivalsFor','byId',game.slice(start,end)+';return distractors;')(
 {DOPA_DETAIL:engine},(x,l)=>x[l],x=>x.japanese_core,
 (a,b)=>{const parts=s=>s.normalize('NFKC').split(/[；;、，,／/]/).map(x=>x.replace(/[。．！？!？\s　]+/g,'').toLowerCase()).filter(Boolean);return parts(a.japanese_core).some(p=>parts(b.japanese_core).includes(p));},
 x=>x.game_pos,(x,l)=>Number(l==='shan'?x.rank:x.order),x=>x,()=>[],{}
);
test('reviewed middle categories provide non-colliding four choices in both directions',()=>{
 for(const l of ['shan','burmese'])for(const medium of ['01.01','01.02','01.03','02.01','02.02','03.01','04.01','04.02','04.04','05.01','05.02','05.03','05.04','06.01','07.01','08.01','08.02','09.01','09.02','09.03','09.04','10.01','10.02','10.03','10.04','11.03','12.01','12.02','12.03','12.04','13.01','13.02','13.03','13.04','14.01','14.02','14.03','14.04','15.01','15.02','15.03','15.04']){
  const pool=decks[l].filter(x=>engine.matches(x,l,{medium}));
  assert.ok(pool.length>=4);
  for(const item of pool)for(const dir of ['toJP','fromJP']){
   const choices=[item,...getDistractors(item,pool,l,dir)];
   assert.equal(choices.length,4,l+medium+item.id);
   assert.equal(new Set(choices.map(x=>x[l])).size,4);
   assert.ok(choices.every(x=>engine.matches(x,l,{medium})));
  }
 }
});
test('sparse medium cannot provide four choices and must not borrow other domains',()=>{
 const pool=decks.shan.filter(x=>engine.matches(x,'shan',{medium:'11.04'}));
 assert.equal(pool.length,3);assert.equal(getDistractors(pool[0],pool,'shan','toJP').length,2);
 assert.match(game,/四択に十分な語がありません/);
});

test('explicit reviewed synonym conflicts prevent alternative correct television answers',()=>{
 const first=decks.burmese.find(x=>x.id==='bur:1398089095013'),old=decks.burmese.find(x=>x.id==='bur:1519420764107');
 assert.equal(engine.canContrast(first,old,'burmese'),false);
 const pool=decks.burmese.filter(x=>engine.matches(x,'burmese',{medium:'11.04'}));
 for(const dir of ['toJP','fromJP']){
  assert.ok(!getDistractors(first,pool,'burmese',dir).some(x=>x.id===old.id));
  assert.ok(!getDistractors(old,pool,'burmese',dir).some(x=>x.id===first.id));
 }
 assert.equal(engine.canContrast(first,{...old,japanese_core:'新しい意味'},'burmese'),true);
});

test('fifteen-domain initial review accounts for every eligible legacy card without declaring holds resolved',()=>{
 for(const l of ['shan','burmese']){
  const c=details.coverage[l];assert.equal(c.untriaged,0);
  assert.equal(c.scope_candidates,c.classified+c.review_pending);
  assert.equal(c.classified,Object.keys(details.cards[l]).length);
 }
 assert.equal(details.coverage.shan.scope_candidates+details.coverage.burmese.scope_candidates,4951);
 assert.equal(details.coverage.shan.review_pending+details.coverage.burmese.review_pending,1810);
});

test('etymology annotation does not turn two sapphire cards into different answers',()=>{
 const a=decks.shan.find(x=>x.id==='shn:1783945288004'),b=decks.shan.find(x=>x.id==='shn:1783945288748');
 assert.equal(engine.canContrast(a,b,'shan'),false);
 const pool=decks.shan.filter(x=>engine.matches(x,'shan',{medium:'01.01'}));
 for(const dir of ['toJP','fromJP'])assert.ok(!getDistractors(a,pool,'shan',dir).some(x=>x.id===b.id));
});

test('a sparse grooming category cannot borrow clothing or housing distractors',()=>{
 const pool=decks.shan.filter(x=>engine.matches(x,'shan',{medium:'07.03'}));
 assert.equal(pool.length,1);
 assert.equal(getDistractors(pool[0],pool,'shan','toJP').length,0);
 assert.equal(details.cards.shan['shn:1783945289096'],undefined);
 assert.equal(details.cards.burmese['bur:1395615743556'],undefined);
});

test('usage tags distinguish explicit restrictions from a merely usual collocation',()=>{
 const restricted=decks.shan.find(x=>x.id==='shn:1783945285305');
 const usual=decks.shan.find(x=>x.id==='shn:1783945289314');
 const formal=decks.shan.find(x=>x.id==='shn:1783945285372');
 assert.ok(engine.matches(restricted,'shan',{tag:'usage:bound_usage'}));
 assert.ok(!engine.matches(usual,'shan',{tag:'usage:bound_usage'}));
 assert.ok(engine.matches(formal,'shan',{tag:'usage:formal'}));
});
test('kinship mixed with nonkinship address does not inherit a narrow family annotation',()=>{
 const x=decks.shan.find(x=>x.japanese_core==='祖父；おじいさん（年配男性への尊称）');
 assert.ok(x);assert.equal(engine.annotation(x,'shan'),null);
 assert.equal(engine.matches(x,'shan',{medium:'05.02'}),false);
 assert.equal(engine.matches(x,'shan'),true);
});

test('production does not imply agriculture and per-sense rarity does not apply to a whole parent',()=>{
 for(const id of ['shn:1783945287121','shn:1783945288424']){
  const x=decks.shan.find(x=>x.id===id);assert.ok(engine.annotation(x,'shan'));
  assert.equal(engine.matches(x,'shan',{tag:'field:agriculture'}),false);
 }
 const craft=decks.shan.find(x=>x.id==='shn:1783945288732');
 assert.ok(engine.matches(craft,'shan',{tag:'field:craft'}));
 const repayment=decks.shan.find(x=>x.id==='shn:1783945287002');
 assert.equal(engine.annotation(repayment,'shan'),null);
 assert.ok(engine.matches(repayment,'shan'));
});

test('religious and general parent meanings stay held; Pali translation is not itself religion',()=>{
 for(const [lang,id] of [['burmese','bur:1409404167752'],['burmese','bur:1479418868657'],['shan','shn:1783945284047'],['shan','shn:1783945284735'],['shan','shn:1783945288690']]){
  const x=decks[lang].find(x=>x.id===id);assert.ok(x);
  assert.equal(engine.annotation(x,lang),null);assert.ok(engine.matches(x,lang));
 }
 const commentary=decks.shan.find(x=>x.id==='shn:1783945287035');
 const translation=decks.shan.find(x=>x.id==='shn:1783945288822');
 assert.ok(engine.matches(commentary,'shan',{tag:'field:religion'}));
 assert.ok(engine.matches(translation,'shan',{medium:'13.03',tag:'field:linguistics'}));
 assert.equal(engine.matches(translation,'shan',{tag:'field:religion'}),false);
});
test('language records preserve letters and explicit register without guessing from POS',()=>{
 const letter=decks.burmese.find(x=>x.id==='bur:1512609954621');
 assert.ok(engine.matches(letter,'burmese',{medium:'13.02',tag:'field:linguistics'}));
 const address=decks.shan.find(x=>x.id==='shn:1783945287158');
 const vulgar=decks.shan.find(x=>x.id==='shn:1783945287879');
 const song=decks.shan.find(x=>x.id==='shn:1783945285748');
 assert.ok(engine.matches(address,'shan',{medium:'13.01',tag:'usage:polite'}));
 assert.ok(engine.matches(vulgar,'shan',{medium:'13.01',tag:'usage:vulgar'}));
 assert.ok(engine.matches(song,'shan',{medium:'12.03',tag:'field:music'}));
 assert.equal(engine.matches(song,'shan',{tag:'field:religion'}),false);
});

test("equivalent number forms cannot become one another's distractors in either direction",()=>{
 for(const [lang,aId,bId] of [['burmese','bur:1387848732838','bur:1388200652785'],['shan','shn:1783945284809','shn:1783945286984']]){
  const a=decks[lang].find(x=>x.id===aId),b=decks[lang].find(x=>x.id===bId);
  const pool=decks[lang].filter(x=>engine.matches(x,lang,{medium:'14.03'}));
  assert.ok(a&&b);assert.equal(engine.canContrast(a,b,lang),false);
  for(const dir of ['toJP','fromJP']){
   assert.ok(!getDistractors(a,pool,lang,dir).some(x=>x.id===bId));
   assert.ok(!getDistractors(b,pool,lang,dir).some(x=>x.id===aId));
  }
 }
});
test('physical and figurative parents stay held, while calendar, number and sacred appearance remain distinct',()=>{
 for(const [lang,id] of [['burmese','bur:1396908311292'],['burmese','bur:1409403340059'],['burmese','bur:1404084354159'],['shan','shn:1783945285127'],['shan','shn:1783945287596'],['shan','shn:1783945287280']]){
  const x=decks[lang].find(x=>x.id===id);assert.ok(x);
  assert.equal(engine.annotation(x,lang),null);assert.ok(engine.matches(x,lang));
 }
 const sacred=decks.burmese.find(x=>x.id==='bur:1409400300134');
 assert.ok(engine.matches(sacred,'burmese',{medium:'15.02',tag:'field:religion'}));
 const number=decks.burmese.find(x=>x.id==='bur:1389833619388');
 assert.ok(engine.matches(number,'burmese',{medium:'14.03'}));
 assert.equal(engine.matches(number,'burmese',{tag:'usage:bound_usage'}),false);
 const timePool=decks.shan.filter(x=>engine.matches(x,'shan',{medium:'14.01',tag:'feature:temporal'}));
 assert.ok(timePool.length>80);
 assert.ok(timePool.every(x=>engine.annotation(x,'shan').medium==='14.01'));
});
