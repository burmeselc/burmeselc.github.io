import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {attach}=require('../shan-extra-provisional.js');
const load=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const shards=[1,2,3,4].map(n=>load('shan-extra-single-proposals-'+n+'.json'));
const taxonomy=load('study-taxonomy-v1.json');
function setup(){
 const cards=shards.flatMap(x=>x.cards).map(([id,rank,shan,gloss])=>
  ({id,rank,shan,japanese_core:gloss,semantic_status:'U',game_include:1}));
 const legacy={id:'legacy',rank:1,shan:'ၵိၼ်',japanese_core:'食べる',semantic_status:'P'};
 cards.push(legacy);
 const mediums=new Map(taxonomy.categories.flatMap(c=>c.children.map(x=>[x.id,x])));
 const engine={taxonomy,mediums,annotation:()=>null,
  matches:(card,lang,filters)=>filters.medium==='all',
  majorFor:()=>null,canContrast:()=>true,coverage:{}};
 return {cards,legacy,engine};
}
test('all 4,359 released candidates are unverified unique parent cards, never approved senses',()=>{
 const {cards,legacy,engine}=setup(),original=JSON.stringify(cards);
 const overlay=attach(engine,shards,{shan:cards,burmese:[]});
 assert.equal(overlay.extraProvisional.count,4359);
 assert.equal(overlay.extraProvisional.approved_senses,false);
 assert.equal(new Set(shards.flatMap(x=>x.cards.map(y=>y[0]))).size,4359);
 assert.equal(shards.reduce((n,x)=>n+x.source_count,0),11505);
 assert.equal(JSON.stringify(cards),original);
 const card=cards[0],a=overlay.annotation(card,'shan');
 assert.equal(a.review_status,'machine-proposal-unverified');
 assert.equal(a.provisional_only,true);
 assert.equal(card.semantic_status,'U');
 assert.equal(overlay.majorFor(card,'shan'),a.medium.slice(0,2));
 assert.ok(overlay.matches(card,'shan',{medium:a.medium}));
 assert.equal(overlay.matches(card,'shan',{medium:'not-a-category'}),false);
 assert.equal(overlay.annotation(legacy,'shan'),null);
 assert.equal(overlay.annotation({...card,japanese_core:'imported replacement'},'shan'),null);
});
test('partial or tampered data fails closed without modifying source cards',()=>{
 const {cards,engine}=setup();
 assert.throws(()=>attach(engine,shards.slice(0,3),{shan:cards}),/Missing/);
 const bad=structuredClone(shards);bad[0].approved_senses=true;
 assert.throws(()=>attach(engine,bad,{shan:cards}),/Invalid provisional shard/);
 const invalid=structuredClone(shards);invalid[0].cards[0][4]='99.99';
 assert.throws(()=>attach(engine,invalid,{shan:cards}),/Stale provisional source/);
});
