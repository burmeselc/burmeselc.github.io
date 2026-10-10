// DOPA QUEST optional audio arcade. No BGM, no HTMLAudioElement and no remote audio.
(function(root){
  'use strict';
  let audio=null, master=null, compressor=null, lastKind='',lastAt=0;
  const active=new Set();
  const presets=new Set(['off','quiet','standard','flashy']);
  const ios=()=>/iPad|iPhone|iPod/i.test(navigator.userAgent||'')||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const mobile=()=>ios()||/Android|Mobile/i.test(navigator.userAgent||'')||navigator.userAgentData?.mobile===true;
  function musicSafe(){
    // Audio Session API is implemented on recent iOS WebKit but not all browsers.
    // Fail CLOSED on mobile if we cannot request audio that mixes with music.
    try{
      const session=navigator.audioSession;
      if(!session)return !mobile();
      session.type='ambient';
      return session.type==='ambient'&&session.state!=='interrupted';
    }catch(e){return false;}
  }
  function stop(){
    lastKind='';lastAt=0;
    for(const voice of active){
      try{
        voice.env.gain.cancelScheduledValues(audio.currentTime);
        voice.env.gain.setValueAtTime(0,audio.currentTime);
        voice.osc.stop(audio.currentTime);
        voice.osc.disconnect();voice.env.disconnect();
      }catch(e){}
    }
    active.clear();
  }

  function ensureAudio(){
    if(!musicSafe()){stop();return false;}
    const Ctx=root.AudioContext||root.webkitAudioContext;
    if(!Ctx)return false;
    if(!audio){
      audio=new Ctx({latencyHint:'interactive'});
      compressor=audio.createDynamicsCompressor();
      compressor.threshold.value=-18;
      compressor.knee.value=10;
      compressor.ratio.value=5;
      compressor.attack.value=0.003;
      compressor.release.value=0.12;
      master=audio.createGain();
      master.gain.value=0.14;
      compressor.connect(master);master.connect(audio.destination);
    }
    // A constructor or OS interruption may have changed the session.
    if(!musicSafe()||audio.state==='closed'||audio.state==='interrupted'){stop();return false;}
    if(audio.state==='suspended')audio.resume().catch(()=>stop());
    return true;
  }
  // Time-indexed pitches, not recordings: pitches are MIDI notes, times seconds.
  const patterns={
    ok:[[0,76,.12,'sine',.65],[.075,83,.16,'triangle',.55]],
    bad:[[0,55,.11,'sine',.32],[.07,50,.17,'triangle',.25]],
    bossEnter:[[0,43,.10,'triangle',.34],[.12,43,.15,'sine',.30]],
    combo3:[[0,76,.12,'triangle',.42],[.085,80,.14,'triangle',.45],[.18,83,.20,'sine',.52]],
    combo5:[[0,72,.14,'triangle',.40],[.095,76,.15,'triangle',.48],[.19,79,.16,'triangle',.50],[.29,84,.28,'sine',.54]],
    combo10:[[0,72,.12,'triangle',.50],[.09,76,.13,'triangle',.45],[.18,79,.12,'triangle',.50],[.27,84,.14,'triangle',.50],[.38,88,.30,'sine',.62],[.38,76,.30,'triangle',.20]],
    boss:[[0,43,.15,'triangle',.30],[.08,55,.25,'triangle',.39],[.17,62,.28,'triangle',.40],[.28,67,.32,'triangle',.43],[.35,74,.37,'sine',.55]],
    seal:[[0,79,.09,'sine',.40],[.085,83,.09,'sine',.45],[.18,86,.10,'sine',.47],[.30,91,.30,'sine',.50]],
    nemesis:[[0,48,.14,'triangle',.28],[.09,67,.15,'triangle',.4],[.20,72,.20,'triangle',.4],[.31,79,.22,'triangle',.44],[.46,84,.45,'sine',.56]],
    levelup:[[0,67,.09,'triangle',.38],[.09,72,.11,'triangle',.42],[.20,76,.15,'triangle',.45],[.34,79,.22,'sine',.49],[.52,84,.35,'sine',.52]],
    rival:[[0,60,.12,'triangle',.32],[.11,69,.20,'triangle',.44],[.24,76,.26,'sine',.48]],
    resultGood:[[0,72,.15,'triangle',.42],[.15,76,.15,'triangle',.46],[.30,79,.17,'triangle',.49],[.45,84,.46,'sine',.53],[.45,72,.42,'triangle',.22]],
    resultLow:[[0,60,.13,'triangle',.25],[.16,64,.15,'triangle',.30],[.33,67,.25,'sine',.37]]
  };
  function hz(midi){return 440*Math.pow(2,(midi-69)/12)}
  function tone(midi,offset,duration,type,level,now,scale){
    const start=now+offset,osc=audio.createOscillator(),env=audio.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(hz(midi),start);
    // Short rounded onset/tail avoids audible digital clicks.
    env.gain.setValueAtTime(0,start);
    env.gain.linearRampToValueAtTime(Math.max(0.0001,level*scale),start+0.012);
    env.gain.exponentialRampToValueAtTime(0.0001,start+Math.max(0.032,duration));
    const voice={osc,env};active.add(voice);
    osc.onended=()=>{active.delete(voice);osc.disconnect();env.disconnect();};
    osc.connect(env);env.connect(compressor);
    osc.start(start);osc.stop(start+Math.max(0.045,duration)+0.02);
  }
  function play(kind,opts={}){
    const preset=presets.has(opts.preset)?opts.preset:'standard';
    const numeric=Number(opts.volume??30);
    const volume=Number.isFinite(numeric)?Math.max(0,Math.min(100,numeric)):0;
    if(preset==='off'||volume===0){stop();return false;}
    const nowMs=Date.now();
    if(!Object.prototype.hasOwnProperty.call(patterns,kind))return false;
    try{
      if(!ensureAudio())return false;
      if(kind===lastKind&&nowMs-lastAt<85)return false;
      // Replace the previous cue, including its scheduled tail; never stack auditions.
      stop();lastAt=nowMs;lastKind=kind;
      const density=preset==='quiet'?.48:preset==='standard'?.78:1;
      const scale=(volume/100)*density;
      const notes=patterns[kind];
      // Keep the musical resolution in every preset. Quiet is an abbreviated motif.
      const end=Math.max(...notes.map(n=>n[0]));
      const selected=preset==='quiet'&&notes.length>2?
        [notes[0],notes.find(n=>n[0]===end)].map((n,i)=>[i*.10,n[1],Math.min(n[2],.18),n[3],n[4]]):notes;
      const now=audio.currentTime+0.012;
      for(const [t,p,d,w,a] of selected){
        tone(p,t,d,w,a,now,scale);
        // A soft octave bell adds sparkle without extending the cue or raising its main voice.
        if(preset==='flashy'&&kind!=='bad'&&kind!=='bossEnter'&&t===end)
          tone(p+12,t,Math.min(d,.16),'sine',a*.18,now,scale);
      }
      return true;
    }catch(e){stop();return false}
  }
  function status(){
    try{
      const session=navigator.audioSession;
      if(!session&&mobile())return 'このモバイル環境では音楽との共存設定を確認できないため、効果音は自動で無効になります。';
      if(session)return session.type==='ambient'?
        '音楽と混ぜる設定です。Apple Music・Spotifyとの実機共存は未確認です。':
        '試聴時に音楽と混ぜる設定を要求します。指定できない場合は無音になります。';
      return 'ブラウザの効果音を使用します。ほかの音楽との共存は端末で要確認です。';
    }catch(e){return '音楽との共存設定を確認できないため、効果音は無効になります。';}
  }
  root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden)stop();});
  root.DOPASound={play,stop,status,patterns:Object.keys(patterns)};
})(window);
