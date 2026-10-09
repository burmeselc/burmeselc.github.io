// Load author-owned default decks. Optional user imports merge locally by stable card ID.
(async()=>{
  const $=id=>document.getElementById(id),status=$('cloudStatus'),badge=$('dataBadge');
  const DEMO={
    shan:[
      {id:'demo-sh1',shan:'ၵိၼ်',japanese_core:'食べる',game_pos:'動詞',rank:1},
      {id:'demo-sh2',shan:'ၵႂႃႇ',japanese_core:'行く',game_pos:'動詞',rank:2},
      {id:'demo-sh3',shan:'မႃး',japanese_core:'来る',game_pos:'動詞',rank:3},
      {id:'demo-sh4',shan:'ႁၼ်',japanese_core:'見る',game_pos:'動詞',rank:4},
      {id:'demo-sh5',shan:'ၼွၼ်း',japanese_core:'寝る',game_pos:'動詞',rank:5},
      {id:'demo-sh6',shan:'ၼမ်ႉ',japanese_core:'水',game_pos:'名詞',rank:6},
      {id:'demo-sh7',shan:'ၵူၼ်း',japanese_core:'人',game_pos:'名詞',rank:7},
      {id:'demo-sh8',shan:'ႁိူၼ်း',japanese_core:'家',game_pos:'名詞',rank:8}
    ],
    burmese:[
      {id:'demo-bu1',burmese:'စား',japanese_core:'食べる',game_pos:'動詞'},
      {id:'demo-bu2',burmese:'သွား',japanese_core:'行く',game_pos:'動詞'},
      {id:'demo-bu3',burmese:'လာ',japanese_core:'来る',game_pos:'動詞'},
      {id:'demo-bu4',burmese:'မြင်',japanese_core:'見る',game_pos:'動詞'},
      {id:'demo-bu5',burmese:'အိပ်',japanese_core:'寝る',game_pos:'動詞'},
      {id:'demo-bu6',burmese:'ရေ',japanese_core:'水',game_pos:'名詞'},
      {id:'demo-bu7',burmese:'လူ',japanese_core:'人',game_pos:'名詞'},
      {id:'demo-bu8',burmese:'အိမ်',japanese_core:'家',game_pos:'名詞'}
    ]
  };
  function openDb(){return new Promise((resolve,reject)=>{
    const req=indexedDB.open('dopa-vocab-store',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('decks');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  })}
  async function store(write,v){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('decks',write?'readwrite':'readonly');
      const req=write?tx.objectStore('decks').put(v,'active'):tx.objectStore('decks').get('active');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>db.close();
    });
  }
  const valid=o=>o&&Array.isArray(o.shan)&&Array.isArray(o.burmese)&&
    o.shan.every(x=>typeof x.id==='string'&&typeof x.shan==='string')&&
    o.burmese.every(x=>typeof x.id==='string'&&typeof x.burmese==='string');
  let uploaded=null,defaults=DEMO,usingDemo=false;
  try {
    const paths=['./data/shan-1.json','./data/shan-2.json','./data/burmese.json'];
    const parts=await Promise.all(paths.map(async path=>{
      const response=await fetch(path,{cache:'no-cache'});
      if(!response.ok)throw Error(path+' HTTP '+response.status);
      return response.json();
    }));
    defaults={shan:[...parts[0],...parts[1]],burmese:parts[2]};
    if(defaults.shan.length!==5480||defaults.burmese.length!==2500||!valid(defaults))
      throw Error('既定デッキの整合性エラー');
  } catch(err) {
    usingDemo=true;
    console.error('Failed to load built-in wordlists',err);
    status.textContent='既定デッキの取得に失敗しました。ネット接続を確認して再読込してください。現在はデモ語彙です。';
  }
  try{uploaded=await store(false)}catch(e){console.warn('Imported deck storage unavailable',e)}
  const merge=(base,custom)=>({
    shan:Array.from(new Map([...base.shan,...(custom?.shan||[])].map(x=>[x.id,x])).values()),
    burmese:Array.from(new Map([...base.burmese,...(custom?.burmese||[])].map(x=>[x.id,x])).values())
  });
  // Semantic-domain pilot is read-only metadata; failure never prevents vocabulary loading.
  let semantic=null;
  try{
    const response=await fetch('./data/burmese-categories-v1.json',{cache:'no-cache'});
    if(!response.ok)throw Error('category map HTTP '+response.status);
    const obj=await response.json();
    if(obj.schema!=='dopa-semantic-domains-pilot-v1'||!obj.cards||!obj.labels||
       Object.keys(obj.cards).length!==2500||
       defaults.burmese.length!==2500||defaults.burmese.some(x=>!obj.cards[x.id]))
      throw Error('category map does not match the original Burmese deck');
    semantic=obj;
  }catch(e){console.warn('Semantic-domain pilot disabled:',e)}
  window.DOPA_SEMANTIC_LABELS=semantic?.labels||{};
  window.DOPA_SEMANTIC_READY=!!semantic;
  window.DOPA_DATA=merge(defaults,valid(uploaded)?uploaded:null);
  for(const x of window.DOPA_DATA.burmese){
    const annotation=semantic?.cards[x.id];
    if(annotation){
      x.semantic_major=annotation[0];
      x.semantic_status=annotation[1]; // M = multiple senses, excluded from category-specific play
    }
  }
  badge.textContent=`シャン語 ${window.DOPA_DATA.shan.length.toLocaleString()}語 / ビルマ語 ${window.DOPA_DATA.burmese.length.toLocaleString()}語`+
    (usingDemo?'（デモ）':valid(uploaded)?'（既定＋追加分）':'（既定デッキ）');
  $('vocabLoad').textContent='デッキを追加・更新';
  $('vocabLoad').onclick=()=>$('vocabFile').click();
  $('vocabFile').onchange=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try {
      if(f.size>15000000)throw Error('語彙JSONは15MBまで');
      const obj=JSON.parse(await f.text());
      if(!valid(obj))throw Error('shan/burmese配列を持つ統合JSONが必要です');
      if(new Set([...obj.shan,...obj.burmese].map(x=>x.id)).size!==obj.shan.length+obj.burmese.length)
        throw Error('語彙IDの重複があります');
      const combined=merge(valid(uploaded)?uploaded:{shan:[],burmese:[]},obj);
      await store(true,combined);
      alert(`追加・更新しました（シャン語 ${combined.shan.length}語／ビルマ語 ${combined.burmese.length}語）。画面を再読込します。`);
      location.reload();
    } catch(err){alert('語彙の保存に失敗しました：'+err.message)}
    finally{e.target.value=''}
  };
  const game=document.createElement('script');game.src='./game.js';
  game.onerror=()=>{status.textContent='ゲーム本体を読み込めませんでした。'};
  game.onload=()=>{
    // Preview/CDN origins must never run production cloud sign-in or sync.
    if(window.DOPA_FIREBASE_CONFIG?.projectId&&location.hostname==='burmeselc.github.io'){
      const s=document.createElement('script');s.type='module';s.src='./cloud-sync.js';
      s.onerror=()=>{status.textContent='クラウド機能を読込めません。端末内保存は有効です。'};
      document.body.appendChild(s);
    }else{
      for(const id of ['cloudLogin','cloudLogout','cloudSync'])$(id).disabled=true;
    }
  };
  document.body.appendChild(game);
})();