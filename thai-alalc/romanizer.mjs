/**
 * Conservative, rule-first Thai → ALA-LC 2011 candidate generator.
 * Source: https://www.loc.gov/catdir/cpso/romanization/thai.pdf
 * The 2011 ALA-LC word-division rules require lexical/semantic judgment:
 * rule-generated candidates are deliberately marked provisional.
 */
export const INITIAL = Object.freeze({
  'ก':'k','ข':'kh','ฃ':'kh','ค':'kh','ฅ':'kh','ฆ':'kh','ง':'ng',
  'จ':'čh','ฉ':'ch','ช':'ch','ซ':'s','ฌ':'ch','ญ':'y',
  'ฎ':'d','ฏ':'t','ฐ':'th','ฑ':'th','ฒ':'th','ณ':'n',
  'ด':'d','ต':'t','ถ':'th','ท':'th','ธ':'th','น':'n',
  'บ':'b','ป':'p','ผ':'ph','ฝ':'f','พ':'ph','ฟ':'f','ภ':'ph',
  'ม':'m','ย':'y','ร':'r','ล':'l','ว':'w','ศ':'s','ษ':'s',
  'ส':'s','ห':'h','ฬ':'l','อ':'‘','ฮ':'h'
});
export const FINAL = Object.freeze({
  'ก':'k','ข':'k','ฃ':'k','ค':'k','ฅ':'k','ฆ':'k','ง':'ng',
  'จ':'t','ฉ':'t','ช':'t','ซ':'t','ฌ':'t','ญ':'n',
  'ฎ':'t','ฏ':'t','ฐ':'t','ฑ':'t','ฒ':'t','ณ':'n',
  'ด':'t','ต':'t','ถ':'t','ท':'t','ธ':'t','น':'n',
  'บ':'p','ป':'p','ผ':'p','ฝ':'p','พ':'p','ฟ':'p','ภ':'p',
  'ม':'m','ร':'n','ล':'n','ศ':'t','ษ':'t','ส':'t','ฬ':'n'
});
const TONES=/[่้๊๋]/gu;
const CLUSTERS=new Set(['กร','กล','กว','ขร','ขล','ขว','คร','คล','คว','ตร','ปร','ปล','พร','พล','ผล','บร','บล','ดร','ฟร','ฟล','สร']);
const THAI_CHAR=/[\u0e00-\u0e7f]/u;
const THAI_RUN=/[\u0e00-\u0e5b]+/gu;
const SILENT_LEADER=new Set(['ง','ญ','น','ม','ย','ร','ล','ว']);
const PRE='เแโใไ';
const MARK=/[ะาำัิีึืุู็]/u;
const DIGITS='๐๑๒๓๔๕๖๗๘๙';
const OVERRIDES=Object.freeze({
 'กรรม': 'kam', 'ธรรม':'tham', 'สวรรค์':'sawan'
});
const sliceStart=(s,v)=>s.startsWith(v)?s.slice(v.length):null;

function decodeSyllable(raw) {
  if(!raw || /[\sฯๆ๐-๙]/u.test(raw))return null;
  let s=raw.replace(TONES,'');
  let warning=[];
  // Final ์ suppresses the preceding consonant; larger silent sequences still
  // require lexical knowledge and are left unresolved.
  if(/[ก-ฮ]์$/u.test(s)){
    s=s.slice(0,-2);warning.push('語末の黙字を省略（確認推奨）');
  }
  if(s.includes('์') || !s) return null;
  if(s.includes('รร'))return null;
  let prefix='';
  if(PRE.includes(s[0])){prefix=s[0];s=s.slice(1);}
  if(!s || !(s[0] in INITIAL))return null;
  let initial=s[0];s=s.slice(1);
  if(initial==='ห' && SILENT_LEADER.has(s[0])){
    initial=s[0];s=s.slice(1);warning.push('導音 ห を省略');
  }else if(initial==='อ' && s[0]==='ย'){
    initial='ย';s=s.slice(1);warning.push('導音 อ を省略');
  }else if(s[0] && CLUSTERS.has(initial+s[0])){
    initial+=s[0];s=s.slice(1);
  }else if(initial==='ท' && s[0]==='ร'){
    initial='ทร';s=s.slice(1);warning.push('ทร の音価を要確認');
  }
  if(initial==='ฑ')warning.push('ฑ の th/d は発音による');
  const beginning=initial==='ทร'?'s':Array.from(initial).map(x=>INITIAL[x]).join('');
  let vowel=null, remainder=s, inferred=false;
  // First recognise written vowels and diphthongs; longest alternatives first.
  const patterns=prefix==='เ'?[
    ['ียว','īeo'],['ียะ','ia'],['ีย','īa'],
    ['ือย','ư̄ai'],['ือะ','ưa'],['ือ','ư̄a'],
    ['็ว','eo'],['าะ','ǫ'],['อะ','œ'],
    ['าว','āo'],['า','ao'],['ิ','œ̄'],['อ','œ̄'],['็','e'],['ะ','e'],
    ['ย','œ̄i'],['ว','ēo'],['','ē']
  ]:prefix==='แ'?[
    ['็ว','ǣo'],['ะ','æ'],['็','æ'],['ว','ǣo'],['','ǣ']
  ]:prefix==='โ'?[
    ['ะ','o'],['','ō']
  ]:prefix==='ไ'||prefix==='ใ'?[
    ['ย','ai'],['','ai']
  ]:[
    ['ัวะ','ua'],['ัว','ūa'],['อวย','ūai'],['าย','āi'],
    ['าว','āo'],['ออย','ǭi'],['อย','ǭi'],
    ['ุย','ui'],['ิว','iu'],['ำ','am'],
    ['า','ā'],['ิ','i'],['ี','ī'],['ึ','ư'],['ื','ư̄'],
    ['ุ','u'],['ู','ū'],['ะ','a'],['ั','a'],
    ['ว','ūa'],['อ','ǭ']
  ];
  // If a written vowel occurs, consume it and analyse any final consonant.
  for(const [spelling,roman] of patterns){
    if(!spelling)continue;
    const r=sliceStart(s,spelling);
    if(r===null)continue;
    vowel=roman;remainder=r;break;
  }
  if(vowel===null){
    if(prefix){
      const fallback=patterns.find(x=>x[0]==='');
      if(!fallback)return null;
      vowel=fallback[1];remainder=s;
    }else if(s.length===1 && (s in FINAL)){
      vowel=s==='ร'?'ǭ':'o';
      inferred=true;warning.push('無表記母音の推定');
    }else if(!s){
      vowel='a';inferred=true;warning.push('無表記母音の推定');
    }else{return null;}
  }
  if(remainder && !(remainder.length===1 && remainder in FINAL))return null;
  // If the vowel was inferred for a closed syllable, s is the final consonant.
  const coda=remainder ? FINAL[remainder] : '';
  if(inferred && !coda && s) return null;
  if(!inferred && prefix==='เ' && remainder==='ว' && vowel==='ē') {
    return {roman:beginning+'ēo',uncertain:warning.length>0,notes:warning};
  }
  if(inferred || warning.length) return {roman:beginning+vowel+coda,uncertain:true,notes:warning};
  return {roman:beginning+vowel+coda,uncertain:false,notes:[]};
}

/** Returns one candidate for a *complete* orthographic syllable, or null. */
export function romanizeSyllable(raw) {
  if(OVERRIDES[raw])return {roman:OVERRIDES[raw],uncertain:true,notes:['รร または黙字を含む規則例（確認推奨）']};
  return decodeSyllable(raw);
}
function indexReviewed(dictionary) {
  const result=new Map();
  for(const e of dictionary){
    if(!e?.thai||!e.alalc||e.status!=='reviewed')continue;
    const key=e.thai[0];
    if(!result.has(key))result.set(key,[]);
    result.get(key).push(e);
  }
  for(const arr of result.values())arr.sort((a,b)=>b.thai.length-a.thai.length);
  return result;
}
function segmentThaiRun(run,reviewed) {
  // Work from right to left: avoids recursion overflow on long pasted records.
  const solutions=Array(run.length+1).fill(null);
  solutions[run.length]={cost:0,pieces:[]};
  for(let i=run.length-1;i>=0;i--){
    let best=null;
    const consider=(piece,len,price)=>{
      const next=solutions[i+len];
      if(!next)return;
      const candidate={cost:price+next.cost,pieces:[piece,...next.pieces]};
      if(!best||candidate.cost<best.cost)best=candidate;
    };
    for(const e of reviewed.get(run[i])||[]){
      if(!run.startsWith(e.thai,i))continue;
      consider({thai:e.thai,roman:e.alalc,origin:'dictionary',uncertain:false,
        notes:[],meaning:e.meaning||''},e.thai.length,0.02);
    }
    for(let len=1;len<=Math.min(run.length-i,12);len++){
      const raw=run.slice(i,i+len),guess=romanizeSyllable(raw);
      if(!guess)continue;
      consider({thai:raw,roman:guess.roman,origin:'rule',uncertain:guess.uncertain,
        notes:guess.notes},len,(guess.uncertain?1.65:1.10)+(len===1?0.2:0));
    }
    if(THAI_CHAR.test(run[i])){
      consider({thai:run[i],roman:run[i],origin:'unresolved',uncertain:true,
        notes:['綴りを解析できません']},1,7.5);
    }else{
      consider({thai:run[i],roman:run[i],origin:'literal',uncertain:false,notes:[]},1,0.1);
    }
    solutions[i]=best;
  }
  const parts=solutions[0].pieces;
  // Adjacent unresolved characters are one meaningful correction target.
  const merged=[];
  for(const piece of parts){
    const prev=merged[merged.length-1];
    if(prev?.origin==='unresolved' && piece.origin==='unresolved'){
      prev.thai+=piece.thai;prev.roman+=piece.roman;
    }else merged.push(piece);
  }
  return merged;
}
function romanizeOneLine(text,reviewed) {
  const tokens=[];
  for(let i=0;i<text.length;){
    const cp=text[i];
    if(!THAI_CHAR.test(cp)){
      let j=i+1;while(j<text.length&&!THAI_CHAR.test(text[j]))j++;
      tokens.push({thai:text.slice(i,j),roman:text.slice(i,j),origin:'literal',uncertain:false,notes:[]});
      i=j;continue;
    }
    if(DIGITS.includes(cp)){
      tokens.push({thai:cp,roman:String(DIGITS.indexOf(cp)),origin:'rule',uncertain:false,notes:[]});i++;continue;
    }
    if(text.startsWith('ฯลฯ',i)){
      tokens.push({thai:'ฯลฯ',roman:'la',origin:'rule',uncertain:false,notes:[]});i+=3;continue;
    }
    if(cp==='ฯ'){tokens.push({thai:cp,roman:' … ',origin:'rule',uncertain:false,notes:[]});i++;continue;}
    if(cp==='ๆ'){
      const prev=[...tokens].reverse().find(t=>t.origin!=='literal');
      tokens.push({thai:cp,roman:prev?.roman||'ๆ',origin:prev?'rule':'unresolved',
        uncertain:!prev,notes:prev?['反復記号により直前の音節を反復']:['反復対象が不明']});i++;continue;
    }
    let j=i;while(j<text.length&&THAI_CHAR.test(text[j])&&!DIGITS.includes(text[j])
       &&!['ฯ','ๆ'].includes(text[j]))j++;
    if(j===i){tokens.push({thai:cp,roman:cp,origin:'unresolved',uncertain:true,notes:['未対応記号']});i++;continue;}
    tokens.push(...segmentThaiRun(text.slice(i,j),reviewed));i=j;
  }
  return tokens;
}
export function romanizeThai(text,dictionary=[]) {
  const input=String(text??'').normalize('NFC');
  const reviewed=indexReviewed(dictionary);
  const tokens=romanizeOneLine(input,reviewed);
  // Word-division after neighboring candidate segments is a provisional default.
  let previous=null;
  for(const token of tokens){
    token.spaceBefore=Boolean(previous && token.origin!=='literal' && previous.origin!=='literal' &&
      token.origin!=='unresolved' && previous.origin!=='unresolved');
    if(token.spaceBefore){
      token.uncertain=true;
      token.notes=[...token.notes,'語境界は暫定（ALA-LC分かち書き要確認）'];
    }
    previous=token;
  }
  const textOutput=tokens.map(t=>(t.spaceBefore?' ':'')+
     (t.origin==='unresolved'?'〔未解析：'+t.thai+'〕':t.roman)).join('');
  return {tokens,text:textOutput,
    guessed:tokens.filter(t=>t.origin==='rule').length,
    unresolved:tokens.filter(t=>t.origin==='unresolved').length,
    reviewed:tokens.filter(t=>t.origin==='dictionary').length,
    needsReview:tokens.filter(t=>t.uncertain).length};
}
