// Read-only, reviewed metadata. Card IDs, glosses, POS and profiles are untouched.
(function(root){
 'use strict';
 const API={
  // Merge the independently reviewed eighteenth domain only when every source card
  // and semantic-major eligibility matches the unchanged built-in decks.
  extendCategory18(taxonomy,base,queue,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||queue?.schema!=='dopa-category18-review-queue-v1'||
      queue.scope!=='legacy-major-18-P-or-R'||queue.production_applied!==false)throw Error('Unsupported category 18 queue');
   const mediums=new Set((taxonomy.categories||[]).find(x=>x.id==='18')?.children?.map(x=>x.id)||[]);
   if(mediums.size!==4||!['18.01','18.02','18.03','18.04'].every(x=>mediums.has(x)))
     throw Error('Category 18 taxonomy changed');
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const next={...base,cards:{burmese:{...base.cards.burmese},shan:{...base.cards.shan}},
    coverage:{...base.coverage},counts:{...base.counts},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],shan:[...(base.choice_conflicts?.shan||[])]}};
   for(const l of ['burmese','shan']){
    const semanticCards=semantic?.[l]?.cards;
    if(!semanticCards)throw Error('Category 18 needs the matching legacy major map');
    const originals=new Map(decks[l].map(x=>[x.id,x]));
    const eligible=new Set(decks[l].filter(x=>semanticCards[x.id]?.[0]==='18'&&
     ['P','R'].includes(semanticCards[x.id][1])).map(x=>x.id));
    const rows=queue.cards?.[l];
    if(!Array.isArray(rows)||rows.length!==eligible.size)throw Error('Incomplete category 18 queue '+l);
    const seen=new Set();let assigned=0;
    for(const r of rows){
     const x=originals.get(r.id);
     if(!eligible.has(r.id)||seen.has(r.id)||base.cards[l][r.id]||
        !x||x[l]!==r.word||x.japanese_core!==r.gloss)throw Error('Stale category 18 entry '+r.id);
     seen.add(r.id);
     if(r.status==='needs-source-review'){
      if(r.medium!==null||typeof r.reason!=='string')throw Error('Invalid held category 18 entry');
      continue;
     }
     if(r.status!=='gloss-reviewed-pilot-candidate'||!mediums.has(r.medium))
       throw Error('Invalid category 18 candidate');
     if(!r.tags||Object.keys(r.tags).length!==axes.size)throw Error('Missing category 18 tag axes');
     for(const [axis,allowed] of axes){
      const values=r.tags[axis];
      if(!Array.isArray(values)||new Set(values).size!==values.length||values.some(v=>!allowed.has(v)))
       throw Error('Invalid category 18 tag');
     }
     next.cards[l][r.id]={word:r.word,gloss:r.gloss,medium:r.medium,
      tags:r.tags,review_status:'gloss-reviewed-pilot',evidence:r.gloss};
     next.medium_counts[l][r.medium]=(next.medium_counts[l][r.medium]||0)+1;
     assigned++;
    }
    if(seen.size!==eligible.size)throw Error('Untriaged category 18 entry');
    const count=queue.counts?.[l];
    if(!count||count.total!==eligible.size||count.candidates!==assigned||
       count.held!==eligible.size-assigned)throw Error('Category 18 count mismatch');
    const previous=base.coverage[l];
    if(previous.major_ids.includes('18'))throw Error('Category 18 already included');
    const major_ids=[...previous.major_ids,'18'];
    next.coverage[l]={...previous,major_ids,scope:'legacy-category-eligible-'+major_ids.join('-'),
     scope_candidates:previous.scope_candidates+eligible.size,classified:previous.classified+assigned,
     review_pending:previous.review_pending+eligible.size-assigned,untriaged:0,
     other_classic_cards:previous.other_classic_cards-eligible.size};
    next.counts[l]=Object.keys(next.cards[l]).length;
   }
   // Exact duplicate Japanese definitions in the provisional subset cannot serve as wrong answers.
   for(const l of ['burmese','shan']){
    const byGloss=new Map();
    for(const row of queue.cards[l]){
     if(!row.medium)continue;
     const ids=byGloss.get(row.gloss)||[];ids.push(row.id);byGloss.set(row.gloss,ids);
    }
    for(const ids of byGloss.values())if(ids.length>1)next.choice_conflicts[l].push({
     ids,reason:'第18領域の同一原定義。誤答選択肢として対置しない。'});
   }
   return next;
  },
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
   const conflicts={shan:new Map(),burmese:new Map()};
   for(const l of ['shan','burmese'])for(const group of metadata.choice_conflicts?.[l]||[]){
    if(!Array.isArray(group.ids)||new Set(group.ids).size<2||group.ids.some(id=>!cards[l].has(id)))throw Error('Invalid choice conflict');
    for(const id of group.ids){
     const set=conflicts[l].get(id)||new Set();
     group.ids.filter(other=>other!==id).forEach(other=>set.add(other));
     conflicts[l].set(id,set);
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
   function canContrast(a,b,l){
    return !(annotation(a,l)&&annotation(b,l)&&conflicts[l].get(a.id)?.has(b.id));
   }
   return {taxonomy,mediums,annotation,matches,canContrast,coverage:metadata.coverage||{}};
  }
 };
 root.DOPAStudyDetails=API;
 if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
