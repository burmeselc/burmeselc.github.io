import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const script=readFileSync(new URL('sound-fx.js',root),'utf8');
const game=readFileSync(new URL('game.js',root),'utf8');
const html=readFileSync(new URL('index.html',root),'utf8');
function harness({ios=false,audioSession=false}={}){
 const state={created:0,oscillators:0,stops:0,frequencies:[],setters:[],sequence:[]},nav={
   userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X)':'Mozilla/5.0 (X11; Linux x86_64)',
   platform:ios?'iPhone':'Linux x86_64',maxTouchPoints:ios?5:0
 };
 if(audioSession){let val='auto';nav.audioSession={get type(){return val},set type(v){state.setters.push(v);state.sequence.push('set:'+v);val=v}}}
 const connect=()=>{};
 function audioParam(v=0){return {value:v,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}
 class FakeAudio{
   constructor(){state.created++;state.sequence.push('constructAudioContext');this.currentTime=0;this.state='running';this.destination={}}
   createGain(){return {gain:{...audioParam(),cancelScheduledValues(){}},connect,disconnect(){}}}
   createDynamicsCompressor(){return {threshold:audioParam(),knee:audioParam(),ratio:audioParam(),attack:audioParam(),release:audioParam(),connect}}
   createOscillator(){state.oscillators++;return {frequency:{...audioParam(),setValueAtTime(v,t){state.frequencies.push({v,t})}},connect,disconnect(){},start(){},stop(){state.stops++}}}
   resume(){return Promise.resolve()}
 }
 const scope={window:{AudioContext:FakeAudio},navigator:nav,Math,Date,Set};
 vm.runInNewContext(script,scope);
 return {fx:scope.window.DOPASound,state,nav};
}
test('all required short gaming sound events exist',()=>{
 const h=harness();
 assert.deepEqual([...h.fx.patterns].sort(),['ok','bad','combo3','combo5','combo10','bossEnter','boss','seal','nemesis','levelup','rival','resultGood','resultLow'].sort());
 for(const name of h.fx.patterns)assert.equal(typeof name,'string');
});
test('iPhone does not play SFX if ambient audio-session policy cannot be set',()=>{
 const h=harness({ios:true,audioSession:false});
 assert.equal(h.fx.play('ok',{preset:'flashy',volume:40}),false);
 assert.equal(h.state.created,0);
 assert.match(h.fx.status(),/音楽/);
});
test('supported iOS sets ambient BEFORE constructing AudioContext',()=>{
 const h=harness({ios:true,audioSession:true});
 assert.equal(h.fx.play('combo10',{preset:'flashy',volume:40}),true);
 assert.deepEqual(h.state.sequence.slice(0,2),['set:ambient','constructAudioContext']);
 assert.ok(h.state.oscillators>=5);
 assert.equal(h.nav.audioSession.type,'ambient');
});
test('off/zero volume never construct audio context; presets vary note complexity',()=>{
 const off=harness();
 assert.equal(off.fx.play('boss',{preset:'off',volume:80}),false);
 assert.equal(off.fx.play('boss',{preset:'flashy',volume:0}),false);
 assert.equal(off.state.created,0);
 const quiet=harness(),flashy=harness();
 assert.equal(quiet.fx.play('combo10',{preset:'quiet',volume:20}),true);
 assert.equal(flashy.fx.play('combo10',{preset:'flashy',volume:20}),true);
 assert.ok(flashy.state.oscillators>quiet.state.oscillators);
 assert.equal(quiet.state.created,1);
});
test('sound controls use the old profile key and do not break legacy SOUND',()=>{
 assert.match(game,/const KEY='dopaQuestV5_profile'/);
 assert.match(game,/function normalizeSoundPrefs\(/);
 assert.match(game,/P\.sound=P\.sfxStyle!=='off'/);
 assert.match(game,/DOPASound\?\.play/);
 assert.match(game,/beep\('bad'\)/);
 assert.match(game,/beep\(acc>=\.72\?'resultGood':'resultLow'\)/);
 assert.match(html,/id="soundBtn"/);
 assert.match(html,/id="sfxPreset"/);
 assert.match(html,/id="sfxVolume"/);
 assert.match(html,/src="\.\/sound-fx\.js"/);
});

test('all mobile environments fail closed if ambient cannot be confirmed',()=>{
 for(const [ua,platform,touch] of [['Android Chrome','Linux',5],['Desktop Safari','MacIntel',5]]){
   const h=harness();Object.assign(h.nav,{userAgent:ua,platform,maxTouchPoints:touch});
   assert.equal(h.fx.play('ok'),false);assert.equal(h.state.created,0);
 }
 for(const mode of ['getter','setter','ignored','interrupted']){
   const h=harness({ios:true});
   Object.defineProperty(h.nav,'audioSession',{get(){
     if(mode==='getter')throw Error('denied');
     return {get type(){return 'auto'},set type(v){if(mode==='setter')throw Error('denied')},state:mode};
   }});
   assert.equal(h.fx.play('ok'),false);assert.equal(h.state.created,0);
   assert.equal(typeof h.fx.status(),'string');
 }
});
test('mute and replacement cancel scheduled voices; invalid volume never allocates audio',()=>{
 const h=harness();h.fx.play('combo10',{preset:'flashy'});
 const count=h.state.oscillators,stops=h.state.stops;
 h.fx.play('bad');assert.equal(h.state.stops,stops+count+2);
 h.fx.stop();assert.equal(h.state.stops,stops+count+4);
 const invalid=harness();assert.equal(invalid.fx.play('ok',{volume:NaN}),false);assert.equal(invalid.state.created,0);
});
test('standard and quiet retain the ending pitch, flashy adds short bell layers',()=>{
 const standard=harness(),quiet=harness(),flashy=harness();
 standard.fx.play('levelup');quiet.fx.play('levelup',{preset:'quiet'});flashy.fx.play('levelup',{preset:'flashy'});
 const endHz=440*Math.pow(2,(84-69)/12);
 assert.ok(standard.state.frequencies.some(n=>n.v===endHz));assert.ok(quiet.state.frequencies.some(n=>n.v===endHz));
 assert.ok(flashy.state.oscillators>standard.state.oscillators);
});
test('changed ambient policy stops existing voices before any new ones are allocated',()=>{
 const h=harness({ios:true,audioSession:true});h.fx.play('boss');const count=h.state.oscillators,stops=h.state.stops;
 Object.defineProperty(h.nav,'audioSession',{get(){throw Error('policy lost')}});
 assert.equal(h.fx.play('ok'),false);assert.equal(h.state.oscillators,count);assert.equal(h.state.stops,stops+count);
});

test('an interrupted ambient session is rejected before context creation',()=>{
 const h=harness({ios:true,audioSession:true});h.nav.audioSession.state='interrupted';
 assert.equal(h.fx.play('ok'),false);assert.equal(h.state.created,0);
});
