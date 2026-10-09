import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const shan=[...JSON.parse(readFileSync(new URL('data/shan-1.json',root),'utf8')),...JSON.parse(readFileSync(new URL('data/shan-2.json',root),'utf8'))];
const sem=JSON.parse(readFileSync(new URL('data/shan-categories-v1.json',root),'utf8'));
const bur=JSON.parse(readFileSync(new URL('data/burmese.json',root),'utf8'));
const burSem=JSON.parse(readFileSync(new URL('data/burmese-categories-v1.json',root),'utf8'));
const game=readFileSync(new URL('game.js',root),'utf8');
const bootstrap=readFileSync(new URL('bootstrap.js',root),'utf8');
test('original Shan IDs remain stable and covered by sidecar',()=>{
 assert.equal(shan.length,5480);
 assert.equal(new Set(shan.map(x=>x.id)).size,5480);
 assert.equal(sem.schema,'dopa-shan-parent-category-pilot-v1');
 assert.equal(Object.keys(sem.cards).length,5480);
 assert.ok(shan.every(x=>sem.cards[x.id]&&!Object.hasOwn(x,'semantic_major')));
});
test('same 18 major classes and explicit withheld statuses',()=>{
 assert.deepEqual(sem.labels,burSem.labels);
 const count={P:0,M:0,H:0},pool={};
 for(const [id,[category,status]] of Object.entries(sem.cards)){
   assert.ok(['P','M','H'].includes(status),id);
   count[status]++;
   if(status==='P'){assert.ok(sem.labels[category],id);pool[category]=(pool[category]||0)+1}
   else assert.equal(category,'',id);
 }
 assert.deepEqual(count,{P:4207,M:1242,H:31});
 assert.equal(Object.keys(pool).length,18);
 assert.ok(Object.values(pool).every(n=>n>=4));
 assert.equal(bur.length,2500);
 assert.equal(Object.keys(burSem.cards).length,2500);
});
test('Shan domain selection excludes out-of-domain and ambiguous candidates',()=>{
 const a=game.indexOf('function domainEligible('),b=game.indexOf('\nfunction updateSemanticCategories()',a);
 assert.ok(a>=0&&b>a);
 let selected='06';
 const elig=new Function('$','DOMAIN_READY_BY_LANG',game.slice(a,b)+';return domainEligible;')(
  id=>id==='semanticCategory'?{get value(){return selected;}}:null,{shan:true,burmese:true});
 const word=shan.find(x=>sem.cards[x.id][0]==='06'&&sem.cards[x.id][1]==='P');
 assert.equal(elig({...word,semantic_major:'06',semantic_status:'P'},'shan'),true);
 assert.equal(elig({...word,semantic_major:'17',semantic_status:'P'},'shan'),false);
 assert.equal(elig({...word,semantic_major:'06',semantic_status:'M'},'shan'),false);
 assert.equal(elig({...word,semantic_major:'06',semantic_status:'H'},'shan'),false);
 selected='all';assert.equal(elig({...word,semantic_major:'06',semantic_status:'M'},'shan'),true);
 assert.match(bootstrap,/window\.DOPA_SEMANTIC_READY_BY_LANG/);
 assert.match(game,/activeDeck\(\$\('lang'\)\.value\)/);
});
test('legacy progress storage key and card identity unchanged',()=>{
 assert.match(game,/const KEY='dopaQuestV5_profile'/);
 assert.match(game,/P\.words\[x\.id\]/);
 assert.match(bootstrap,/window\.DOPA_DATA=merge/);
});
