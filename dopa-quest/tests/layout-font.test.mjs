import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));

test('Padauk Shan/Myanmar subsets are WOFF2 fonts in regular and bold',()=>{
 for(const weight of [400,700]){
  const font=read('fonts/padauk-myanmar-'+weight+'.woff2');
  assert.equal(font.subarray(0,4).toString('ascii'),'wOF2');
  assert.ok(font.length>20000);
 }
});

test('offline shell includes locally hosted fonts',()=>{
 const worker=read('service-worker.js').toString();
 for(const weight of [400,700])
  assert.ok(worker.includes("'./fonts/padauk-myanmar-"+weight+".woff2'"));
 assert.ok(worker.includes('webmanifest|woff2'));
});

test('QUEST layout width is content independent, Shan script is language tagged',()=>{
 const html=read('index.html').toString();
 const game=read('game.js').toString();
 const flash=read('flashcards-ui.js').toString();
 assert.ok(html.includes('#game>.arena{width:100%'));
 assert.ok(html.includes('#prompt:lang(shn)'));
 assert.ok(html.includes('@font-face{font-family:"DopaPadauk"'));
 assert.ok(game.includes("('prompt').lang="));
 assert.ok(game.includes('b.lang=q.dir'));
 assert.ok(flash.includes("('flashFaceWord').lang="));
});
