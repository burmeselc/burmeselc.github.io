import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const root = new URL('../',import.meta.url);
const read = file => readFileSync(new URL(file,root),'utf8');
const paths = [
  'thai-lesson01-pilot.json','thai-lesson02-reviewed.json','thai-lesson03-reviewed.json'
];
const lessons = paths.map(file => JSON.parse(read('data/'+file)));

test('Thai lessons 1-3 have 55 + 80 + 184 stable, unique cards',() => {
  const counts=[55,80,184];
  const seen=new Set();
  lessons.forEach((lesson,i) => {
    assert.equal(lesson.schema,'dopa-thai-pilot-v1');
    assert.equal(lesson.cards.length,counts[i]);
    const n=String(i+1).padStart(2,'0');
    for(const card of lesson.cards){
      assert.match(card.id,new RegExp('^TH-L'+n+'-\\d{3}$'));
      assert.equal(card.lesson,n);
      assert.ok(!seen.has(card.id),'duplicate card ID '+card.id);
      seen.add(card.id);
      assert.ok(card.thai && card.japanese && card.semantic_tag && card.priority);
      assert.ok(['A','B','C'].includes(card.priority));
      assert.match(card.visual_review,/^user_confirmed_\d{4}-\d{2}-\d{2}$/);
    }
  });
  assert.equal(seen.size,319);
});

test('lesson 3 preserves page order and only four non-spoken grammar patterns lack readings',() => {
  const cards=lessons[2].cards;
  for(let i=0;i<cards.length;i++){
    const c=cards[i];
    assert.equal(c.id,'TH-L03-'+String(i+1).padStart(3,'0'));
    assert.ok(Number.isInteger(Number(c.source_page)));
    assert.ok(Number.isInteger(Number(c.source_order)));
    assert.ok(c.section && c.source && c.reading_status !== undefined);
    assert.equal(c.verification,'user_confirmed_manual_visual_review');
    if(i){
      const last=cards[i-1];
      assert.ok(Number(c.source_page)>Number(last.source_page)||
        Number(c.source_page)===Number(last.source_page) &&
        Number(c.source_order)>Number(last.source_order),'source page order');
    }
  }
  const missing=cards.filter(c=>!c.romanization_draft);
  assert.deepEqual(missing.map(c=>c.id),
    ['TH-L03-090','TH-L03-098','TH-L03-105','TH-L03-111']);
  assert.ok(missing.every(c=>c.card_type==='pattern'&&
    c.reading_status==='not_in_textbook_as_unit'));
});

test('Thai lesson 3 is connected to UI, loader, category filters and offline cache',() => {
  const boot=read('bootstrap.js'),index=read('index.html');
  const controls=read('thai-controls.js'),worker=read('service-worker.js');
  const game=read('game.js'),flash=read('flashcards-ui.js');
  assert.ok(boot.includes("['03','thai-lesson03-reviewed.json',184]"));
  assert.ok(controls.includes("'thai-lesson03-reviewed.json'"));
  assert.ok(worker.includes("'./data/thai-lesson03-reviewed.json'"));
  assert.ok(index.includes('<option value="03">第3課</option>'));
  assert.ok(index.includes('<option value="number">'));
  assert.ok(index.includes('<option value="pattern">'));
  assert.ok(game.includes("&&x.romanization_draft?x.romanization_draft:orig(x,l)"));
  assert.ok(flash.includes("&&current.romanization_draft?current.romanization_draft:original(current,session.lang)"));
});
