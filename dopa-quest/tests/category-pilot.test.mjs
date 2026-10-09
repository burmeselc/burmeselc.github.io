import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('../',import.meta.url);
const deck=JSON.parse(readFileSync(new URL('data/burmese.json',here),'utf8'));
const sem=JSON.parse(readFileSync(new URL('data/burmese-categories-v1.json',here),'utf8'));
const game=readFileSync(new URL('game.js',here),'utf8');
const bootstrap=readFileSync(new URL('bootstrap.js',here),'utf8');
const html=readFileSync(new URL('index.html',here),'utf8');
const values=Object.values(sem.cards);
test('unchanged parent count, identity, and schema',()=>{
 assert.equal(deck.length,2500);
 assert.equal(new Set(deck.map(x=>x.id)).size,2500);
 assert.equal(Object.keys(sem.cards).length,2500);
 assert.equal(sem.schema,'dopa-semantic-domains-pilot-v1');
 assert.ok(deck.every(x=>sem.cards[x.id]));
 assert.ok(deck.every(x=>!Object.hasOwn(x,'semantic_major'))); // labels are in the sidecar only
});
test('category/status invariants',()=>{
 assert.equal(Object.keys(sem.labels).length,18);
 assert.ok(values.every(([c,s])=>sem.labels[c]&&['M','R','P'].includes(s)));
 assert.equal(values.filter(x=>x[1]==='M').length,239);
 assert.ok(Object.keys(sem.labels).every(c=>deck.some(x=>sem.cards[x.id][0]===c && sem.cards[x.id][1]!=='M')));
});
test('unassigned multi-sense entries are not category-specific targets',()=>{
 const s=game.indexOf('function domainEligible(');
 const e=game.indexOf('\nfunction updateSemanticCategories()',s);
 assert.ok(s>=0&&e>s);
 let selected='06';
 const domainEligible=new Function('$',game.slice(s,e)+';return domainEligible;')(
  id=>id==='semanticCategory'?{value:selected}:null
 );
 const single=deck.find(x=>sem.cards[x.id][0]==='06'&&sem.cards[x.id][1]!=='M');
 const multi=deck.find(x=>sem.cards[x.id][1]==='M');
 assert.equal(domainEligible({...single,semantic_major:'06',semantic_status:'P'},'burmese'),true);
 assert.equal(domainEligible({...single,semantic_major:'06',semantic_status:'P'},'shan'),true);
 assert.equal(domainEligible({...multi,semantic_major:sem.cards[multi.id][0],semantic_status:'M'},'burmese'),false);
 selected='all';
 assert.equal(domainEligible({...multi,semantic_major:sem.cards[multi.id][0],semantic_status:'M'},'burmese'),true);
});
test('legacy progress keys and original game modes remain intact',()=>{
 assert.match(game,/const KEY='dopaQuestV5_profile'/);
 assert.match(game,/P\.words\[x\.id\]/);
 assert.match(game,/function distractors\(/);
 assert.match(game,/function updateSemanticCategories\(/);
 assert.match(bootstrap,/window\.DOPA_SEMANTIC_READY/);
 assert.match(html,/id="semanticCategory"/);
 assert.match(game,/S\.pool=|pool:\(\$\('lang'\)/);
});
