/* Thai lesson-1 filters, independent of local/cloud study history. */
(function(root){
 'use strict';
 async function populate(){
  const select=document.getElementById('thaiSemantic');
  if(!select)return;
  try{
   const data=await Promise.all(['thai-lesson01-pilot.json','thai-lesson02-reviewed.json'].map(async file=>{const res=await fetch('./data/'+file,{cache:'no-cache'});if(!res.ok)throw Error('Thai categories unavailable: '+file);return res.json()}));
   const tags=[...new Set(data.flatMap(d=>(d.cards||[]).map(c=>c.semantic_tag)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
   for(const tag of tags){
    const option=document.createElement('option');option.value=tag;option.textContent=tag;
    select.appendChild(option);
   }
   select.addEventListener('change',()=>{
    document.getElementById('zone')?.dispatchEvent(new Event('change'));
   });
  }catch(e){console.warn('Thai categories not loaded',e)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',populate);
 else populate();
})(window);
