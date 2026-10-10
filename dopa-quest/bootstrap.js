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
  // Sidecar-only semantic categories. Each deck can fall back independently.
  async function loadSemantic(path,schema,deck,expected){
    try{
      const response=await fetch(path,{cache:'no-cache'});
      if(!response.ok)throw Error('category map HTTP '+response.status);
      const obj=await response.json();
      if(obj.schema!==schema||!obj.cards||!obj.labels||
         deck.length!==expected||Object.keys(obj.cards).length!==expected||
         deck.some(x=>!obj.cards[x.id]))throw Error('category map does not match the original vocabulary');
      return obj;
    }catch(e){console.warn('Optional semantic categories disabled for '+path,e);return null}
  }
  const [burmeseSemantic,shanSemantic]=await Promise.all([
    loadSemantic('./data/burmese-categories-v1.json','dopa-semantic-domains-pilot-v1',defaults.burmese,2500),
    loadSemantic('./data/shan-categories-v1.json','dopa-shan-parent-category-pilot-v1',defaults.shan,5480)
  ]);
  window.DOPA_SEMANTIC_LABELS=burmeseSemantic?.labels||{};
  window.DOPA_SEMANTIC_READY=!!burmeseSemantic; // backwards compatibility with Burmese checks
  window.DOPA_SEMANTIC_LABELS_BY_LANG={
    burmese:burmeseSemantic?.labels||{},
    shan:shanSemantic?.labels||{}
  };
  window.DOPA_SEMANTIC_READY_BY_LANG={burmese:!!burmeseSemantic,shan:!!shanSemantic};
  window.DOPA_DATA=merge(defaults,valid(uploaded)?uploaded:null);
  for(const [lang,metadata] of [['burmese',burmeseSemantic],['shan',shanSemantic]]){
    for(const x of window.DOPA_DATA[lang]){
      const annotation=metadata?.cards[x.id];
      if(annotation){
        x.semantic_major=annotation[0];
        x.semantic_status=annotation[1]; // M/H withheld from filtered play, present in all-categories play
      }
    }
  }
  // Experimental, opt-in Shan sense cards. Original shan/burmese arrays and IDs are untouched.
  window.DOPA_SENSE_READY=false;
  try{
    const manifestResponse=await fetch('./data/shan-senses-manifest.json',{cache:'no-cache'});
    if(!manifestResponse.ok)throw Error('sense manifest HTTP '+manifestResponse.status);
    const manifest=await manifestResponse.json();
    if(manifest.schema!=='dopa-shan-sense-lab-v1'||manifest.parent_count!==5480||
       manifest.candidate_count!==7290||manifest.parts?.length!==8)
      throw Error('unexpected sense manifest');
    const fragments=await Promise.all(manifest.parts.map(async (path,i)=>{
      if(path!=='dopa-quest/data/shan-senses-'+(i+1)+'.json')throw Error('invalid sense-part path');
      const r=await fetch('./data/'+path.split('/').pop(),{cache:'no-cache'});
      if(!r.ok)throw Error('sense part HTTP '+r.status);
      return r.json();
    }));
    const expanded=fragments.flat(),parentIds=new Set(defaults.shan.map(x=>x.id));
    if(expanded.length!==7290||
       new Set(expanded.map(x=>x.id)).size!==7290||
       new Set(expanded.map(x=>x.parent_id)).size!==5480||
       expanded.some(x=>!parentIds.has(x.parent_id)||typeof x.japanese_core!=='string'||typeof x.shan!=='string'))
      throw Error('sense inventory does not match Shan vocabulary');
    window.DOPA_DATA.shan_senses=expanded;
    window.DOPA_SENSE_READY=true;
  }catch(e){console.warn('Optional Shan sense lab disabled',e)}
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
  // Optional detailed filters: network or validation failure leaves ordinary play available.
  window.DOPA_DETAIL=null;
  try{
    const [taxonomy,details]=await Promise.all(['study-taxonomy-v1.json','study-details-pilot-v1.json'].map(async name=>{
      const r=await fetch('./data/'+name,{cache:'no-cache'});
      if(!r.ok)throw Error('study details HTTP '+r.status);
      return r.json();
    }));
    window.DOPA_DETAIL=window.DOPAStudyDetails.create(taxonomy,details,defaults);
  }catch(e){console.warn('Optional detailed filters unavailable',e)}
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