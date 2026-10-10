import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file = path => readFileSync(new URL('../'+path, import.meta.url));
const html = file('index.html').toString('utf8');
const manifest = JSON.parse(file('manifest.webmanifest').toString('utf8'));
const worker = file('service-worker.js').toString('utf8');

test('manifest and iPhone install metadata use the DOPA QUEST subdirectory',()=>{
  assert.equal(manifest.id,'./');
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.theme_color,'#060813');
  assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon\.png">/);
  assert.match(html,/apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html,/navigator\.serviceWorker\.register\('\.\/service-worker\.js', \{scope:'\.\/'\}\)/);
});

test('installed icons are valid opaque PNG files at their declared sizes',()=>{
  for(const [name,dimension] of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]){
    const png=file('icons/'+name);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),dimension);
    assert.equal(png.readUInt32BE(20),dimension);
    assert.equal(png[25],3,'PNG uses an opaque indexed palette');
  }
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
});

test('offline cache is scope-limited, network-first, and leaves saved progress untouched',()=>{
  assert.match(worker,/request\.method !== 'GET'/);
  assert.match(worker,/url\.origin !== scope\.origin/);
  assert.match(worker,/url\.pathname\.startsWith\(scope\.pathname\)/);
  assert.match(worker,/const response = await fetch\(request\)/);
  assert.match(worker,/const cached = await caches\.match\(request\)/);
  assert.doesNotMatch(worker,/localStorage|indexedDB|firestore\.collection|\.postMessage\(/);
  assert.match(worker,/html\|js\|json\|png\|webmanifest/);
});
