/* DOPA QUEST: strictly provisional, source-preserving Shan extra category sidecar.
   These are unverified machine proposals, not reviewed senses or edited card data. */
(function(root){
 'use strict';
 const SCHEMA='dopa-shan-extra-single-proposals-v1';
 const SECOND_SCHEMA='dopa-shan-extra-multiple-proposals-v1';
 const FINAL65_SCHEMA='dopa-shan-extra-final65-proposals-v1';
 const SEMICOLON_SCHEMA='dopa-shan-extra-semicolon-study-release-v1';
 const GENERAL_SCHEMA='dopa-shan-extra-general-review-v1';
 const HELD_SCHEMA='dopa-shan-extra-held-review-v1';
 const groups=[[1,2,3],[4,5,6],[7,8,9],[10,11,12]];
 const sourceCounts=[3000,3000,3000,2505];
 const expectedSingles=[1560,1029,1014,756];
 function attach(engine,shards,decks,secondPassShard=null,final65Shard=null,semicolonShard=null,generalShard=null,heldShard=null){
  if(!engine||!Array.isArray(shards)||shards.length!==4||!Array.isArray(decks?.shan))
   throw Error('Missing provisional Shan category inputs');
  const byId=new Map(decks.shan.map(card=>[card.id,card]));
  const axes=new Map((engine.taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
  const proposals=new Map(),mediums=engine.mediums;
  for(let i=0;i<shards.length;i++){
   const shard=shards[i];
   if(shard?.schema!==SCHEMA||shard.status!=='machine-proposal-unverified'||
      shard.approved_senses!==false||JSON.stringify(shard.batches)!==JSON.stringify(groups[i])||
      shard.source_count!==sourceCounts[i]||shard.single_count!==expectedSingles[i]||
      !Array.isArray(shard.cards)||shard.cards.length!==expectedSingles[i])
    throw Error('Invalid provisional shard '+(i+1));
   for(const row of shard.cards){
    if(!Array.isArray(row)||row.length!==6)throw Error('Invalid provisional row');
    const [id,rank,shan,gloss,medium,tags]=row;
    const source=byId.get(id);
    if(typeof id!=='string'||proposals.has(id)||!Number.isInteger(rank)||
       rank<5481||rank>16985||!source||source.id!==id||
       source.rank!==rank||source.shan!==shan||source.japanese_core!==gloss||
       source.semantic_status!=='U'||!mediums.has(medium)||
       !tags||typeof tags!=='object'||Array.isArray(tags)||
       Object.keys(tags).length!==axes.size)throw Error('Stale provisional source '+id);
    for(const [axis,accepted] of axes){
     const values=tags[axis];
     if(!Array.isArray(values)||new Set(values).size!==values.length||
        values.some(v=>!accepted.has(v)))throw Error('Invalid provisional tag '+id);
    }
    proposals.set(id,Object.freeze({word:shan,gloss,rank,medium,
      tags,review_status:'machine-proposal-unverified',provisional_only:true}));
   }
  }

  // Independently reviewed multi-cue proposals: additive and optional.
  // A missing or corrupt optional shard must never alter the original 4,359.
  if(secondPassShard!==null){
   const shard=secondPassShard;
   if(shard?.schema!==SECOND_SCHEMA||shard.status!=='machine-proposal-unverified'||
      shard.approved_senses!==false||shard.source_count!==637||
      shard.single_count!==572||shard.held_count!==65||
      !Array.isArray(shard.cards)||shard.cards.length!==572)
    throw Error('Invalid multiple-cue provisional shard');
   for(const row of shard.cards){
    if(!Array.isArray(row)||row.length!==6)throw Error('Invalid multiple-cue provisional row');
    const [id,rank,shan,gloss,medium,tags]=row;
    const source=byId.get(id);
    if(typeof id!=='string'||proposals.has(id)||!Number.isInteger(rank)||
       rank<5481||rank>16985||!source||source.id!==id||
       source.rank!==rank||source.shan!==shan||source.japanese_core!==gloss||
       source.semantic_status!=='U'||!mediums.has(medium)||
       !tags||typeof tags!=='object'||Array.isArray(tags)||
       Object.keys(tags).length!==axes.size)
     throw Error('Stale multiple-cue provisional source '+id);
    for(const [axis,accepted] of axes){
     const values=tags[axis];
     if(!Array.isArray(values)||new Set(values).size!==values.length||
        values.some(v=>!accepted.has(v)))throw Error('Invalid multiple-cue tag '+id);
    }
    proposals.set(id,Object.freeze({word:shan,gloss,rank,medium,
      tags,review_status:'machine-proposal-unverified',provisional_only:true}));
   }
  }
  // Independently re-triaged 18 of 65 previously held records: strictly optional.
  // The remaining 47 are not classified; no source values or sense IDs are created.
  if(final65Shard!==null){
   const shard=final65Shard;
   if(secondPassShard===null||shard?.schema!==FINAL65_SCHEMA||
      shard.status!=='machine-proposal-unverified'||shard.approved_senses!==false||
      shard.source_count!==65||shard.single_count!==18||shard.held_count!==47||
      !Array.isArray(shard.cards)||shard.cards.length!==18)
    throw Error('Invalid final65 provisional shard');
   for(const row of shard.cards){
    if(!Array.isArray(row)||row.length!==6)throw Error('Invalid final65 provisional row');
    const [id,rank,shan,gloss,medium,tags]=row;
    const source=byId.get(id);
    if(typeof id!=='string'||proposals.has(id)||!Number.isInteger(rank)||
       rank<5481||rank>16985||!source||source.id!==id||
       source.rank!==rank||source.shan!==shan||source.japanese_core!==gloss||
       source.semantic_status!=='U'||!mediums.has(medium)||
       !tags||typeof tags!=='object'||Array.isArray(tags)||
       Object.keys(tags).length!==axes.size)
     throw Error('Stale final65 provisional source '+id);
    for(const [axis,accepted] of axes){
     const values=tags[axis];
     if(!Array.isArray(values)||new Set(values).size!==values.length||
        values.some(v=>!accepted.has(v)))throw Error('Invalid final65 tag '+id);
    }
    proposals.set(id,Object.freeze({word:shan,gloss,rank,medium,
      tags,review_status:'machine-proposal-unverified',provisional_only:true}));
   }
  }
  // Provisional semicolon parents are still ONE ORIGINAL CARD each; no sense splitting.
  // No-cue parents receive a visible review flag without an invented category.
  if(semicolonShard!==null){
   const shard=semicolonShard;
   if(final65Shard===null||shard?.schema!==SEMICOLON_SCHEMA||
      shard.status!=='machine-proposal-unverified'||shard.approved_senses!==false||
      shard.source_count!==983||shard.study_entries!==983||
      shard.categorized_with_cue!==607||shard.uncategorized_need_review!==376||
      shard.source_gloss_preserved!==true||shard.sense_split_approved!==false||
      shard.provisional_boundary!=='semicolon-unverified'||
      !Array.isArray(shard.cards)||shard.cards.length!==983)
    throw Error('Invalid semicolon provisional shard');
   let categorized=0;
   for(const row of shard.cards){
    if(!Array.isArray(row)||row.length!==6)throw Error('Invalid semicolon provisional row');
    const [id,rank,shan,gloss,medium,tags]=row,source=byId.get(id);
    if(typeof id!=='string'||proposals.has(id)||!Number.isInteger(rank)||
       rank<5481||rank>16985||!source||source.id!==id||
       source.rank!==rank||source.shan!==shan||source.japanese_core!==gloss||
       source.semantic_status!=='U'||!(medium===null||mediums.has(medium))||
       !tags||typeof tags!=='object'||Array.isArray(tags)||
       Object.keys(tags).length!==axes.size)
      throw Error('Stale semicolon provisional source '+id);
    for(const [axis,accepted] of axes){
     const values=tags[axis];
     if(!Array.isArray(values)||new Set(values).size!==values.length||
        values.some(v=>!accepted.has(v)))throw Error('Invalid semicolon tag '+id);
    }
    if(medium!==null)categorized++;
    proposals.set(id,Object.freeze({word:shan,gloss,rank,medium,tags,
      review_status:'machine-proposal-unverified',provisional_only:true,
      boundary_unverified:true,classification_confidence:'low',
      category_basis:medium===null?'insufficient-cue':'first-explicit-cue'}));
   }
   if(categorized!==607)throw Error('Invalid semicolon categorized count');
  }
  // All unreviewed extra source parents are covered by independent, optional
  // source-preserving metadata. The 47 genuine holds never become approved senses.
  const generalShards=generalShard===null?[]:Array.isArray(generalShard)?generalShard:[generalShard];
  if(generalShards.length>4||generalShards.length===0&&heldShard!==null)
   throw Error('Invalid number of general Shan shards');
  let generalCategorized=0,generalUncategorized=0,generalCount=0;
  for(let i=0;i<generalShards.length;i++){
   const shard=generalShards[i],expected=i===3?1026:1500;
   if(semicolonShard===null||shard?.schema!==GENERAL_SCHEMA||
      shard.status!=='machine-proposal-unverified'||shard.approved_senses!==false||
      shard.reviewed_by_human!==false||shard.source_preserved!==true||
      shard.batch!==i+1||shard.source_count!==expected||shard.cards?.length!==expected||
      shard.categorized_with_cue+shard.uncategorized_need_review!==expected)
    throw Error('Invalid general Shan review shard '+(i+1));
   let localCategorized=0,localUncategorized=0;
   for(const row of shard.cards){
    if(!Array.isArray(row)||row.length!==8)throw Error('Invalid general review row');
    const [id,rank,shan,gloss,medium,confidence,basis,flags]=row,source=byId.get(id);
    if(typeof id!=='string'||proposals.has(id)||!Number.isInteger(rank)||
       rank<5481||rank>16985||!source||source.id!==id||
       source.rank!==rank||source.shan!==shan||source.japanese_core!==gloss||
       source.semantic_status!=='U'||!(medium===null||mediums.has(medium))||
       !['low','none'].includes(confidence)||!Array.isArray(flags)||
       !flags.includes('source-check-pending')||
       (medium===null)!==(confidence==='none')||
       (medium===null)!==flags.includes('category-unassigned')||
       typeof basis!=='string'||basis.length===0)
      throw Error('Stale general review source '+id);
    if(medium===null){generalUncategorized++;localUncategorized++}
    else{generalCategorized++;localCategorized++}
    const tags=Object.fromEntries([...axes].map(([axis])=>[axis,[]]));
    proposals.set(id,Object.freeze({word:shan,gloss,rank,medium,tags,
      review_status:medium===null?'uncategorized-needs-review':'machine-proposal-unverified',
      provisional_only:true,proposed_medium:medium,classification_confidence:confidence,
      category_basis:basis,review_flags:flags,source_check_pending:true}));
    generalCount++;
   }
   if(localCategorized!==shard.categorized_with_cue||
      localUncategorized!==shard.uncategorized_need_review)
    throw Error('Invalid general Shan category counts '+(i+1));
  }
  let heldCount=0;
  if(heldShard!==null){
   if(generalShards.length!==4||heldShard.schema!==HELD_SCHEMA||
      heldShard.status!=='held-unverified'||heldShard.approved_senses!==false||
      heldShard.source_preserved!==true||heldShard.source_count!==47||
      heldShard.category_repair_count!==19||heldShard.meaning_boundary_count!==28||
      heldShard.cards?.length!==47)throw Error('Invalid 47-case hold shard');
   let repairs=0,boundaries=0;
   for(const entry of heldShard.cards){
    const {parent_card_id:id,rank,shan_original:shan,japanese_core_original:gloss,
      review_status:status,proposed_medium:medium,classification_confidence:confidence,
      original_candidates:candidates,review_flags:flags,hold_reason:reason}=entry;
    const source=byId.get(id);
    if(!source||proposals.has(id)||source.id!==id||source.rank!==rank||
       source.shan!==shan||source.japanese_core!==gloss||
       source.semantic_status!=='U'||medium!==null||confidence!=='none'||
       !['held-category-repair','held-sense-boundary'].includes(status)||
       !Array.isArray(candidates)||!Array.isArray(flags)||
       !flags.includes('source-check-pending')||typeof reason!=='string'||
       !candidates.every(c=>mediums.has(c.medium)))
     throw Error('Invalid held Shan parent '+id);
    if(status==='held-category-repair')repairs++;else boundaries++;
    const tags=Object.fromEntries([...axes].map(([axis])=>[axis,[]]));
    proposals.set(id,Object.freeze({word:shan,gloss,rank,medium:null,tags,
      review_status:status,classification_confidence:'none',
      category_basis:'held-uncertain-lexical-boundary',provisional_only:true,
      source_check_pending:true,review_flags:flags,proposed_medium:null,
      held_candidates:candidates,hold_reason:reason,sense_split_approved:false}));
    heldCount++;
   }
   if(repairs!==19||boundaries!==28)throw Error('Invalid held dispositions');
  }
  if(proposals.size!==(4359+(secondPassShard===null?0:572)+(final65Shard===null?0:18)+(semicolonShard===null?0:983)+generalCount+heldCount))
   throw Error('Incomplete Shan provisional proposal set');
  function annotation(card,lang){
   const a=lang==='shan'&&card&&proposals.get(card.id);
   return a&&card.rank===a.rank&&card.shan===a.word&&card.japanese_core===a.gloss?
     a:engine.annotation(card,lang);
  }
  function matches(card,lang,filters={}){
   const medium=filters.medium||'all',tag=filters.tag||'all';
   if(medium==='all'&&tag==='all')return true;
   const a=annotation(card,lang);
   if(!a||medium!=='all'&&a.medium!==medium)return false;
   if(tag!=='all'){
    const [axis,value]=tag.split(':');
    if(!value||!a.tags[axis]?.includes(value))return false;
   }
   return true;
  }
  function majorFor(card,lang){
   const a=annotation(card,lang);
   return a?.provisional_only?(a.medium?a.medium.slice(0,2):null):engine.majorFor(card,lang);
  }
  return {...engine,annotation,matches,majorFor,
    extraProvisional:{count:proposals.size,source_count:11505,
      original_single_count:4359,multiple_review_count:secondPassShard===null?0:572,
      final65_review_count:final65Shard===null?0:18,
      semicolon_review_count:semicolonShard===null?0:983,
      semicolon_categorized_count:semicolonShard===null?0:607,
      semicolon_needs_category_count:semicolonShard===null?0:376,
      general_review_count:generalCount,
      general_categorized_count:generalCategorized,
      general_uncategorized_count:generalUncategorized,
      held_review_count:heldCount,
      held_category_repair_count:heldShard===null?0:19,
      held_meaning_boundary_count:heldShard===null?0:28,
      categorized_count:proposals.size-(semicolonShard===null?0:376)-generalUncategorized-heldCount,
      editorial_review:'machine-proposal-unverified',approved_senses:false}};
 }
 const api={attach};
 root.DOPAExtraProvisional=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
