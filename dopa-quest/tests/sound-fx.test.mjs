import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const script=readFileSync(new URL('sound-fx.js',root),'utf8');
const game=readFileSync(new URL('game.js',root),'utf8');
const html=readFileSync(new URL('index.html',root),'utf8');
function harness({ios=false,audioSession=false}={}){
 const state={created:0,oscillators:0,setters:[],sequence:[]},nav={
   userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X)':'Mozilla/5.0 (X11; Linux x86_64)',
   platform:ios?'iPhone':'Linux x86_64',maxTouchPoints:ios?5:0
 };
 if(audioSession){let val='auto';nav.audioSession={get type(){return val},set type(v){state.setters.push(v);state.sequence.push('set:'+v);val=v}}}
 const connect=()=>{};
 function audioParam(v=0){return {value:v,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}}
 class FakeAudio{
   constructor(){state.created++;state.sequence.push('constructAudioContext');this.currentTime=0;this.state='running';this.destination={}}
   createGain(){return {gain:audioParam(),connect}}
   createDynamicsCompressor(){return {threshold:audioParam(),knee:audioParam(),ratio:audioParam(),attack:audioParam(),release:audioParam(),connect}}
   createOscillator(){state.oscillators++;return {frequency:audioParam(),connect,start(){},stop(){}}}
   resume(){return Promise.resolve()}
 }
 const scope={window:{AudioContext:FakeAudio},navigator:nav,Math,Date,Set};
 vm.runInNewContext(script,scope);
 return {fx:scope.window.DOPASound,state,nav};
}
test('all required short gaming sound events exist',()=>{
 const h=harness();
 assert.deepEqual([...h.fx.patterns].sort(),['ok','bad','combo3','combo5','combo10','boss','seal','nemesis','levelup','rival','resultGood','resultLow'].sort());
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
