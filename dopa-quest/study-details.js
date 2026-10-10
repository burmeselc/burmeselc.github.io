// Read-only, reviewed metadata. Card IDs, glosses, POS and profiles are untouched.
(function(root){
 'use strict';
 const API={
  create(taxonomy,metadata,decks){
   if(taxonomy?.schema!=='dopa-study-taxonomy-v1'||metadata?.schema!=='dopa-study-details-pilot-v1')throw Error('Unsupported detail schema');
   const mediums=new Map(),axes=new Map();
   for(const cat of taxonomy.categories||[])for(const child of cat.children||[]){
    if(child.id.slice(0,2)!==cat.id||mediums.has(child.id))throw Error('Invalid medium category');
    mediums.set(child.id,{...child,major:cat.id,majorLabel:cat.label});
   }
   for(const axis of taxonomy.tag_axes||[])axes.set(axis.axis,new Set(axis.values));
   const cards={shan:new Map(),burmese:new Map()};
   for(const l of ['shan','burmese']){
    const existing=new Map(decks[l].map(x=>[x.id,x]));
    for(const [id,a] of Object.entries(metadata.cards?.[l]||{})){
     const x=existing.get(id);
     if(!x||x[l]!==a.word||x.japanese_core!==a.gloss||!mediums.has(a.medium)||a.review_status!=='gloss-reviewed-pilot')throw Error('Detail does not match reviewed card '+id);
     if(!a.tags||Object.keys(a.tags).some(k=>!axes.has(k)))throw Error('Unknown tag axis');
     for(const axis of axes.keys())if(!Array.isArray(a.tags[axis])||a.tags[axis].some(t=>!axes.get(axis).has(t)))throw Error('Unknown tag value');
     cards[l].set(id,a);
    }
   }
   function annotation(x,l){
    const a=cards[l]?.get(x.id);
    // User-imported replacements and split children never inherit parent details.
    return a&&x[l]===a.word&&x.japanese_core===a.gloss?a:null;
   }
   function matches(x,l,filters={}){
    const medium=filters.medium||'all',tag=filters.tag||'all';
    if(medium==='all'&&tag==='all')return true;
    const a=annotation(x,l);if(!a)return false;
    if(medium!=='all'&&a.medium!==medium)return false;
    if(tag!=='all'){
     const [axis,value]=tag.split(':');
     if(!value||!a.tags[axis]?.includes(value))return false;
    }
    return true;
   }
   return {taxonomy,mediums,annotation,matches};
  }
 };
 root.DOPAStudyDetails=API;
 if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
