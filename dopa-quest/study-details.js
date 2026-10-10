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
  // Optional source-gloss cross-checked batches fill former holds without changing original IDs.
  extendReviewBatch(taxonomy,base,batch,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||batch?.schema!=='dopa-study-review-batch-v1'||
      batch.scope!=='legacy-major-12-literature-history-held-proposals'||
      batch.production_applied!==false||batch.original_cards_modified!==0)
     throw Error('Unsupported review batch');
   const mediums=new Map((taxonomy.categories||[]).flatMap(c=>c.children.map(m=>[m.id,c.id])));
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const next={...base,cards:{burmese:{...base.cards.burmese},shan:{...base.cards.shan}},
    coverage:{...base.coverage},counts:{...base.counts},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],shan:[...(base.choice_conflicts?.shan||[])]}};
   for(const lang of ['burmese','shan']){
    const original=new Map(decks[lang].map(x=>[x.id,x]));
    const rows=batch.cards?.[lang],expected=batch.counts?.[lang];
    if(!Array.isArray(rows)||!expected||rows.length!==(lang==='burmese'?9:7)||
       expected.total!==rows.length||!semantic?.[lang]?.cards)throw Error('Invalid review batch inventory');
    let added=0;const seen=new Set(),byGloss=new Map();
    for(const r of rows){
     const x=original.get(r.id),legacy=semantic[lang].cards[r.id];
     if(seen.has(r.id)||!x||base.cards[lang][r.id]||
        x[lang]!==r.word||x.japanese_core!==r.gloss||x.english!==r.english||
        legacy?.[0]!=='12'||!['P','R'].includes(legacy?.[1]))
       throw Error('Stale review batch entry '+r.id);
     seen.add(r.id);
     if(r.status==='needs-source-review'){
      if(r.medium!==null||r.tags!==null||!r.reason)throw Error('Invalid held review batch entry');
      continue;
     }
     if(r.status!=='gloss-reviewed-pilot-candidate'||!['12.05','12.06'].includes(r.medium)||
        mediums.get(r.medium)!=='12'||!r.tags||Object.keys(r.tags).length!==axes.size)
      throw Error('Invalid review batch candidate');
     for(const [axis,allowed] of axes){
      const values=r.tags[axis];
      if(!Array.isArray(values)||new Set(values).size!==values.length||
         values.some(v=>!allowed.has(v)))throw Error('Invalid review batch tag');
     }
     next.cards[lang][r.id]={word:r.word,gloss:r.gloss,medium:r.medium,
      tags:r.tags,review_status:'gloss-reviewed-pilot',evidence:r.gloss};
     next.medium_counts[lang][r.medium]=(next.medium_counts[lang][r.medium]||0)+1;
     const ids=byGloss.get(r.gloss)||[];ids.push(r.id);byGloss.set(r.gloss,ids);
     added++;
    }
    if(added!==expected.candidates||rows.length-added!==expected.held)
     throw Error('Review batch count mismatch');
    for(const ids of byGloss.values())if(ids.length>1)next.choice_conflicts[lang].push({
     ids,reason:'同じ日本語定義をもつ文学・歴史語は互ひの誤答にしない。'});
    next.coverage[lang]={...base.coverage[lang],
     classified:base.coverage[lang].classified+added,
     review_pending:base.coverage[lang].review_pending-added};
    if(next.coverage[lang].review_pending<0)throw Error('Review batch exceeds held inventory');
    next.counts[lang]=Object.keys(next.cards[lang]).length;
   }
   return next;
  },
  // A reviewed overlay may correct a major-domain assignment without rewriting old maps or cards.
  extendMajorCorrections(taxonomy,base,batch,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||
      batch?.schema!=='dopa-major-correction-review-v1'||
      batch.scope!=='known-33-legacy-major-mismatches'||
      batch.production_applied!==false||batch.legacy_major_map_changed!==false||
      batch.original_cards_modified!==0)
    throw Error('Unsupported major correction batch');
   const mediums=new Map((taxonomy.categories||[]).flatMap(cat=>cat.children.map(x=>[x.id,cat.id])));
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const next={...base,cards:{burmese:{...base.cards.burmese},shan:{...base.cards.shan}},
    coverage:{...base.coverage},counts:{...base.counts},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],shan:[...(base.choice_conflicts?.shan||[])]},
    major_corrections:{burmese:{...(base.major_corrections?.burmese||{})},
     shan:{...(base.major_corrections?.shan||{})}}};
   const expected={burmese:15,shan:18};
   for(const lang of ['burmese','shan']){
    const rows=batch.cards?.[lang],counts=batch.counts?.[lang];
    if(!Array.isArray(rows)||rows.length!==expected[lang]||!counts||
       rows.length!==counts.total||!semantic?.[lang]?.cards)
      throw Error('Incomplete major correction inventory '+lang);
    const originals=new Map(decks[lang].map(x=>[x.id,x]));
    const seen=new Set(),glosses=new Map();let added=0;
    for(const r of rows){
     const card=originals.get(r.id),legacy=semantic[lang].cards[r.id];
     if(!card||seen.has(r.id)||base.cards[lang][r.id]||next.major_corrections[lang][r.id]||
        card[lang]!==r.word||card.japanese_core!==r.gloss||card.english!==r.english||
        legacy?.[0]!==r.existing_major||!['P','R'].includes(legacy?.[1]))
      throw Error('Stale major correction entry '+r.id);
     seen.add(r.id);
     if(r.status==='needs-source-review'){
      if(r.proposed_medium!==null||r.tags!==null||!r.reason)
       throw Error('Invalid held major correction');
      continue;
     }
     const dest=mediums.get(r.proposed_medium);
     if(r.status!=='gloss-reviewed-pilot-candidate'||!dest||dest===r.existing_major||
        !r.tags||Object.keys(r.tags).length!==axes.size)
      throw Error('Invalid major correction candidate');
     for(const [axis,values] of axes){
      const tags=r.tags[axis];
      if(!Array.isArray(tags)||new Set(tags).size!==tags.length||
         tags.some(v=>!values.has(v)))throw Error('Invalid major correction tag');
     }
     next.cards[lang][r.id]={word:r.word,gloss:r.gloss,medium:r.proposed_medium,
      tags:r.tags,review_status:'gloss-reviewed-pilot',evidence:r.gloss};
     next.major_corrections[lang][r.id]={from:r.existing_major,to:dest};
     next.medium_counts[lang][r.proposed_medium]=(next.medium_counts[lang][r.proposed_medium]||0)+1;
     const list=glosses.get(r.gloss)||[];list.push(r.id);glosses.set(r.gloss,list);
     added++;
    }
    if(added!==counts.candidates||rows.length-added!==counts.held)
     throw Error('Major correction counts mismatch');
    for(const ids of glosses.values())if(ids.length>1)next.choice_conflicts[lang].push({
      ids,reason:'同一定義を持つ大分類補正語を誤答にしない。'});
    next.coverage[lang]={...base.coverage[lang],
     classified:base.coverage[lang].classified+added,
     review_pending:base.coverage[lang].review_pending-added};
    if(next.coverage[lang].review_pending<0)throw Error('Invalid remaining major correction holds');
    next.counts[lang]=Object.keys(next.cards[lang]).length;
   }
   return next;
  },
  // Extends existing reviewed metadata with exact source-matched geographic and language names.
  extendPlaceLanguage(taxonomy,base,batch,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||
      batch?.schema!=='dopa-place-language-review-v1'||
      batch.scope!=='selected-existing-09-13-held-parent-cards'||
      batch.production_applied!==false||batch.original_cards_modified!==0)
     throw Error('Unsupported place-language batch');
   const mediums=new Map((taxonomy.categories||[]).flatMap(cat=>cat.children.map(m=>[m.id,cat.id])));
   if(mediums.get('09.05')!=='09'||mediums.get('13.05')!=='13')
     throw Error('Missing place/language categories');
   const small=new Map([['09.05.01','09.05'],['09.05.02','09.05'],['09.05.03','09.05']]);
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const next={...base,cards:{burmese:{...base.cards.burmese},shan:{...base.cards.shan}},
    coverage:{...base.coverage},counts:{...base.counts},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],
     shan:[...(base.choice_conflicts?.shan||[])]}};
   for(const lang of ['burmese','shan']){
    const records=batch.cards?.[lang],expected=lang==='burmese'?59:27;
    if(!Array.isArray(records)||records.length!==expected||
       batch.counts?.[lang]!==expected||!semantic?.[lang]?.cards)
     throw Error('Invalid place-language count '+lang);
    const originals=new Map(decks[lang].map(x=>[x.id,x])),seen=new Set();
    const byGloss=new Map();
    for(const r of records){
     const x=originals.get(r.id),sem=semantic[lang].cards[r.id];
     if(!x||seen.has(r.id)||base.cards[lang][r.id]||
        x[lang]!==r.word||x.japanese_core!==r.gloss||x.english!==r.english||
        sem?.[0]!==r.legacy_major||!['P','R'].includes(sem?.[1])||
        r.review_status!=='gloss-reviewed-pilot-candidate'||
        mediums.get(r.medium)!==r.legacy_major||
        !['09.05','13.05'].includes(r.medium)||
        (r.medium==='09.05'&&small.get(r.proposed_small)!=='09.05')||
        (r.medium==='13.05'&&r.proposed_small!==null))
       throw Error('Stale place-language card '+r.id);
     seen.add(r.id);
     if(!r.tags||Object.keys(r.tags).length!==axes.size)
       throw Error('Invalid place-language tag axes');
     for(const [axis,allowed] of axes){
      const vals=r.tags[axis];
      if(!Array.isArray(vals)||new Set(vals).size!==vals.length||
         vals.some(v=>!allowed.has(v)))throw Error('Invalid place-language tag '+r.id);
     }
     next.cards[lang][r.id]={word:r.word,gloss:r.gloss,medium:r.medium,tags:r.tags,
      review_status:'gloss-reviewed-pilot',evidence:r.gloss};
     next.medium_counts[lang][r.medium]=(next.medium_counts[lang][r.medium]||0)+1;
     const matches=byGloss.get(r.gloss)||[];matches.push(r.id);byGloss.set(r.gloss,matches);
    }
    for(const [gloss,ids] of byGloss)if(ids.length>1)next.choice_conflicts[lang].push({
     ids,reason:'同一訳語の地名・言語名は誤答の候補にしない。'});
    const alias=batch.alias_groups?.[lang];
    if(!Array.isArray(alias))throw Error('Missing place-language aliases');
    for(const ids of alias){
     if(!Array.isArray(ids)||ids.length<2||new Set(ids).size!==ids.length||
        ids.some(id=>!seen.has(id)))
      throw Error('Invalid place-language alias group');
     next.choice_conflicts[lang].push({ids,reason:'別称・旧称など同一地名の重複解答を防ぐ。'});
    }
    const previous=base.coverage[lang];
    if(!previous||previous.review_pending<expected)
      throw Error('Review coverage exhausted');
    next.coverage[lang]={...previous,classified:previous.classified+expected,
     review_pending:previous.review_pending-expected};
    next.counts[lang]=Object.keys(next.cards[lang]).length;
   }
   return next;
  },
  // Eleven strictly source-matched held meanings; unresolved senses stay out of play.
  extendNextHeld(taxonomy,base,batch,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||
      batch?.schema!=='dopa-held-next-pilot-v1'||
      batch.scope!=='original-held-09-13-pr25-audited'||
      batch.original_decks_unchanged!==true||
      batch.original_dictionary_verified!==false||
      batch.optional_runtime_pilot!==true||
      batch.counts?.audited!==15||batch.counts?.classified!==11||
      batch.counts?.held!==4||batch.counts?.burmese!==6||batch.counts?.shan!==5)
    throw Error('Unsupported next held pilot');
   if((base.counts?.burmese||0)+(base.counts?.shan||0)!==4131||
      (base.coverage?.burmese?.review_pending||0)+
      (base.coverage?.shan?.review_pending||0)!==2337)
    throw Error('Next held pilot requires the published 86-card overlay');
   const mediums=new Map((taxonomy.categories||[]).flatMap(
    cat=>cat.children.map(m=>[m.id,cat.id])));
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const allowed=new Set(['09.04','09.05','13.01','13.05']);
   const all=[...(batch.cards?.burmese||[]),...(batch.cards?.shan||[]),
    ...(batch.deferred||[])],seen=new Set();
   if(all.length!==15||!Array.isArray(batch.cards?.burmese)||
      !Array.isArray(batch.cards?.shan)||!Array.isArray(batch.deferred)||
      batch.cards.burmese.length!==6||batch.cards.shan.length!==5||
      batch.deferred.length!==4)throw Error('Next held pilot inventory mismatch');
   const original={burmese:new Map(decks.burmese.map(x=>[x.id,x])),
    shan:new Map(decks.shan.map(x=>[x.id,x]))};
   // Source/coverage/tag checks finish before any returned metadata can change.
   for(const lang of ['burmese','shan']){
    const rows=[...batch.cards[lang],...batch.deferred.filter(
     x=>x.id.startsWith(lang==='shan'?'shn:':'bur:'))];
    for(const r of rows){
     const source=original[lang].get(r.id),major=semantic?.[lang]?.cards?.[r.id];
     if(seen.has(r.id)||!source||base.cards?.[lang]?.[r.id]||
        source[lang]!==r.word||source.japanese_core!==r.gloss||
        source.english!==r.english||major?.[0]!==r.legacy_major||
        !['P','R'].includes(major?.[1])||r.original_dictionary_verified!==false)
      throw Error('Stale next held card '+r.id);
     seen.add(r.id);
     if(r.review_status==='needs-source-review'){
      if(r.medium!==null||r.tags!==null||!r.reason||
         !batch.deferred.includes(r))throw Error('Invalid next held deferred entry');
      continue;
     }
     if(r.review_status!=='gloss-reviewed-pilot-candidate'||
        !allowed.has(r.medium)||mediums.get(r.medium)!==r.legacy_major||
        batch.deferred.includes(r)||!r.tags||
        Object.keys(r.tags).length!==axes.size)
      throw Error('Invalid next held pilot entry '+r.id);
     for(const [axis,values] of axes){
      const row=r.tags[axis];
      if(!Array.isArray(row)||row.length!==new Set(row).size||
         row.some(v=>!values.has(v)))throw Error('Invalid next held tag '+r.id);
     }
    }
   }
   const expected={'09.04':8,'09.05':1,'13.01':1,'13.05':1};
   const distribution=Object.fromEntries(Object.keys(expected).map(k=>[k,0]));
   for(const lang of ['burmese','shan'])for(const row of batch.cards[lang])
    distribution[row.medium]++;
   if(Object.keys(batch.medium_counts||{}).length!==4||
      Object.keys(expected).some(k=>batch.medium_counts?.[k]!==expected[k]||
       distribution[k]!==expected[k]))
    throw Error('Invalid next held category totals');
   if(seen.size!==15)throw Error('Next held pilot duplicates');
   const next={...base,cards:{burmese:{...base.cards.burmese},shan:{...base.cards.shan}},
    counts:{...base.counts},coverage:{...base.coverage},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],
     shan:[...(base.choice_conflicts?.shan||[])]}};
   for(const lang of ['burmese','shan']){
    const added=new Set();
    for(const r of batch.cards[lang]){
     next.cards[lang][r.id]={word:r.word,gloss:r.gloss,medium:r.medium,
      tags:r.tags,review_status:'gloss-reviewed-pilot',evidence:r.gloss};
     next.medium_counts[lang][r.medium]=(next.medium_counts[lang][r.medium]||0)+1;
     added.add(r.id);
    }
    // Same Japanese answers, including previously classified ones, cannot
    // occur as incorrect distractors against the new card.
    const byGloss=new Map();
    for(const [id,r] of Object.entries(next.cards[lang])){
     if(!byGloss.has(r.gloss))byGloss.set(r.gloss,[]);
     byGloss.get(r.gloss).push(id);
    }
    for(const ids of byGloss.values())if(ids.length>1&&ids.some(id=>added.has(id)))
     next.choice_conflicts[lang].push({ids,reason:'同一訳語を相互の誤答にしない。'});
    const prev=base.coverage[lang];
    next.coverage[lang]={...prev,classified:prev.classified+added.size,
     review_pending:prev.review_pending-added.size};
    if(next.coverage[lang].review_pending<0||
       next.coverage[lang].classified+next.coverage[lang].review_pending!==prev.scope_candidates)
     throw Error('Next held coverage mismatch');
    next.counts[lang]=Object.keys(next.cards[lang]).length;
   }
   return next;
  },
  // Batch pilot: 34 bilingual-gloss-aligned existing cards; never source-dictionary attested.
  extendBulkGloss(taxonomy,base,batch,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||
      batch?.schema!=='dopa-bulk-gloss-reviewed-pilot-v1'||
      batch?.independent_dictionary_verified!==false||
      batch?.source_main!=='c97e2657adee476a8ef35019bab2dbccce3c1842'||
      batch?.counts?.total!==34||batch?.counts?.burmese!==21||
      batch?.counts?.shan!==13)
    throw Error('Unsupported bulk gloss pilot');
   if(base?.counts?.burmese!==1786||base?.counts?.shan!==2356||
      base.coverage?.burmese?.review_pending+base.coverage?.shan?.review_pending!==2326)
    throw Error('Bulk overlay requires the previous 4142-card review');
   const mediumMajors=new Map((taxonomy.categories||[]).flatMap(c=>
    c.children.map(m=>[m.id,c.id])));
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const byLanguage={},seen=new Set();
   for(const lang of ['burmese','shan']){
    const n=lang==='burmese'?21:13,rows=batch.cards?.[lang];
    if(!Array.isArray(rows)||rows.length!==n)throw Error('Bulk language count mismatch '+lang);
    const originals=new Map(decks[lang].map(x=>[x.id,x]));
    for(const row of rows){
     const source=originals.get(row.id),cat=semantic?.[lang]?.cards?.[row.id];
     if(seen.has(row.id)||!source||base.cards?.[lang]?.[row.id]||
        row.original_dictionary_verified!==false||
        row.review_status!=='gloss-reviewed-pilot-candidate'||
        row.legacy_major!==cat?.[0]||!['P','R'].includes(cat?.[1])||
        row.legacy_major!==mediumMajors.get(row.medium)||
        source[lang]!==row.word||source.japanese_core!==row.gloss||
        source.english!==row.english)
      throw Error('Stale bulk review row '+row.id);
     seen.add(row.id);
     if(!row.tags||Object.keys(row.tags).length!==axes.size)
      throw Error('Invalid bulk tag axes '+row.id);
     for(const [axis,allowed] of axes){
      const values=row.tags[axis];
      if(!Array.isArray(values)||new Set(values).size!==values.length||
         values.some(v=>!allowed.has(v)))
       throw Error('Invalid bulk tag '+row.id);
     }
    }
    byLanguage[lang]=rows;
   }
   if(seen.size!==34)throw Error('Bulk duplicate IDs');
   const next={...base,cards:{burmese:{...base.cards.burmese},shan:{...base.cards.shan}},
    counts:{...base.counts},coverage:{...base.coverage},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],
     shan:[...(base.choice_conflicts?.shan||[])]}};
   for(const lang of ['burmese','shan']){
    const newIds=new Set();
    for(const row of byLanguage[lang]){
     next.cards[lang][row.id]={word:row.word,gloss:row.gloss,medium:row.medium,
      tags:row.tags,review_status:'gloss-reviewed-pilot',evidence:row.gloss};
     next.medium_counts[lang][row.medium]=(next.medium_counts[lang][row.medium]||0)+1;
     newIds.add(row.id);
    }
    const byGloss=new Map();
    for(const [id,entry] of Object.entries(next.cards[lang])){
     const ids=byGloss.get(entry.gloss)||[];ids.push(id);byGloss.set(entry.gloss,ids);
    }
    for(const ids of byGloss.values())if(ids.length>1&&ids.some(id=>newIds.has(id)))
     next.choice_conflicts[lang].push({ids,reason:'同義の日本語訳を互いの誤答にしない'});
    const prev=base.coverage[lang];
    next.coverage[lang]={...prev,classified:prev.classified+newIds.size,
     review_pending:prev.review_pending-newIds.size};
    if(next.coverage[lang].review_pending<0||
       next.coverage[lang].classified+next.coverage[lang].review_pending!==prev.scope_candidates)
     throw Error('Bulk coverage mismatch');
    next.counts[lang]=Object.keys(next.cards[lang]).length;
   }
   return next;
  },
  // Reviewed in a broad first-pass sweep against saved bilingual glosses.
  // Provisional semantic routing, NOT independently checked lexical attestation.
  extendRapidCurated(taxonomy,base,batch,decks,semantic){
   if(base?.schema!=='dopa-study-details-pilot-v1'||
      batch?.schema!=='dopa-rapid-curated-batch3-v1'||
      batch?.source_main!=='174a29cedbfe77d6aa0343f6345833e9e32408f7'||
      batch.original_dictionary_verified!==false||
      batch.existing_cards_modified!==0||
      batch.counts?.proposals!==244||
      batch.counts?.classified!==184||
      batch.counts?.burmese!==26||
      batch.counts?.shan!==158||
      batch.counts?.deferred!==60||
      batch.counts?.major_corrections!==131)
    throw Error('Unsupported rapid curated batch');
   if(base?.counts?.burmese!==1807||base?.counts?.shan!==2369||
      base.coverage?.burmese?.review_pending+base.coverage?.shan?.review_pending!==2292)
    throw Error('Rapid batch requires 4176 previously classified parents');
   const mediumMajor=new Map((taxonomy.categories||[]).flatMap(
    c=>(c.children||[]).map(m=>[m.id,c.id])));
   const axes=new Map((taxonomy.tag_axes||[]).map(a=>[a.axis,new Set(a.values)]));
   const indexed={burmese:new Map(decks.burmese.map(x=>[x.id,x])),
    shan:new Map(decks.shan.map(x=>[x.id,x]))};
   const approved=new Set(),all=new Set(),counts={},byLang={burmese:[],shan:[]};
   // Fail closed: inspect all rows and rejected pattern matches before constructing output.
   for(const lang of ['burmese','shan']){
    const list=batch.cards?.[lang],size=lang==='burmese'?26:158;
    if(!Array.isArray(list)||list.length!==size)
     throw Error('Rapid batch language total mismatch');
    for(const row of list){
     const source=indexed[lang].get(row.id),sem=semantic?.[lang]?.cards?.[row.id];
     if(approved.has(row.id)||!source||base.cards?.[lang]?.[row.id]||
        !mediumMajor.has(row.medium)||sem?.[0]!==row.legacy_major||
        !['P','R'].includes(sem?.[1])||
        row.major_correction!==(row.legacy_major!==mediumMajor.get(row.medium))||
        row.original_dictionary_verified!==false||
        row.review_status!=='gloss-reviewed-pilot-candidate'||
        source[lang]!==row.word||source.japanese_core!==row.gloss||
        source.english!==row.english||
        !row.tags||Object.keys(row.tags).length!==axes.size)
      throw Error('Stale rapid review card '+row.id);
     for(const [axis,values] of axes){
      const tags=row.tags[axis];
      if(!Array.isArray(tags)||new Set(tags).size!==tags.length||
         tags.some(v=>!values.has(v)))
       throw Error('Invalid rapid review tag '+row.id);
     }
     approved.add(row.id);all.add(row.id);byLang[lang].push(row);
     counts[row.medium]=(counts[row.medium]||0)+1;
    }
   }
   if(approved.size!==184||
      Object.keys(counts).length!==Object.keys(batch.medium_counts||{}).length||
      Object.entries(counts).some(([m,n])=>batch.medium_counts[m]!==n)||
      Object.entries(batch.medium_counts||{}).some(([m,n])=>counts[m]!==n))
    throw Error('Invalid rapid review medium distribution');
   let corrections=0;
   for(const lang of ['burmese','shan'])
    corrections+=byLang[lang].filter(r=>r.major_correction).length;
   if(corrections!==131)throw Error('Rapid major correction count mismatch');
   if(!Array.isArray(batch.deferred_keyword_candidates)||
      batch.deferred_keyword_candidates.length!==60)
    throw Error('Incomplete rapid keyword review');
   for(const row of batch.deferred_keyword_candidates){
    const lang=row.id?.startsWith('bur:')?'burmese':row.id?.startsWith('shn:')?'shan':null;
    if(!lang||all.has(row.id)||!indexed[lang].has(row.id)||
       base.cards[lang][row.id]||row.decision!=='hold'||
       typeof row.reason!=='string'||!row.reason||
       row.independent_dictionary_verified!==false)
     throw Error('Stale deferred keyword card '+row.id);
    all.add(row.id);
   }
   if(all.size!==244)throw Error('Rapid batch has duplicate or missing source rows');
   const next={...base,cards:{burmese:{...base.cards.burmese},
      shan:{...base.cards.shan}},counts:{...base.counts},
    coverage:{...base.coverage},
    medium_counts:{burmese:{...base.medium_counts.burmese},shan:{...base.medium_counts.shan}},
    major_corrections:{burmese:{...(base.major_corrections?.burmese||{})},
     shan:{...(base.major_corrections?.shan||{})}},
    choice_conflicts:{burmese:[...(base.choice_conflicts?.burmese||[])],
     shan:[...(base.choice_conflicts?.shan||[])]}};
   for(const lang of ['burmese','shan']){
    const newIds=new Set();
    for(const row of byLang[lang]){
     next.cards[lang][row.id]={word:row.word,gloss:row.gloss,medium:row.medium,
      tags:row.tags,review_status:'gloss-reviewed-pilot',evidence:row.gloss};
     next.medium_counts[lang][row.medium]=(next.medium_counts[lang][row.medium]||0)+1;
     if(row.major_correction){
      if(next.major_corrections[lang][row.id])
       throw Error('Duplicate major correction '+row.id);
      next.major_corrections[lang][row.id]={from:row.legacy_major,
       to:mediumMajor.get(row.medium)};
     }
     newIds.add(row.id);
    }
    const glosses=new Map();
    for(const [id,r] of Object.entries(next.cards[lang])){
     const group=glosses.get(r.gloss)||[];group.push(id);glosses.set(r.gloss,group);
    }
    for(const ids of glosses.values())if(ids.length>1&&ids.some(id=>newIds.has(id)))
     next.choice_conflicts[lang].push({ids,reason:'同一日本語訳を相互に誤答として提示しない'});
    const previous=base.coverage[lang];
    next.coverage[lang]={...previous,
     classified:previous.classified+newIds.size,
     review_pending:previous.review_pending-newIds.size};
    if(next.coverage[lang].review_pending<0||
       next.coverage[lang].classified+next.coverage[lang].review_pending!==previous.scope_candidates)
     throw Error('Rapid batch coverage mismatch');
    next.counts[lang]=Object.keys(next.cards[lang]).length;
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
   const corrected={shan:new Map(),burmese:new Map()};
   for(const lang of ['shan','burmese']){
    for(const [id,value] of Object.entries(metadata.major_corrections?.[lang]||{})){
     const annotation=cards[lang].get(id),source=decks[lang].find(x=>x.id===id);
     if(!annotation||!source||!value||value.from===value.to||
        value.to!==annotation.medium.slice(0,2)||
        (source.semantic_major&&source.semantic_major!==value.from)||
        (source.semantic_status&&!['P','R'].includes(source.semantic_status)))
      throw Error('Invalid effective major correction '+id);
     corrected[lang].set(id,value);
    }
   }
   function majorFor(x,l){
    const correction=corrected[l]?.get(x.id);
    return correction&&annotation(x,l)?correction.to:x.semantic_major;
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
   return {taxonomy,mediums,annotation,matches,canContrast,majorFor,coverage:metadata.coverage||{}};
  }
 };
 root.DOPAStudyDetails=API;
 if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
