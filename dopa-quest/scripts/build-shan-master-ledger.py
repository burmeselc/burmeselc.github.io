#!/usr/bin/env python3
"""DOPA QUEST Shan source-row ledger builder; read-only and non-deploying.

Example from repository root:
 python dopa-quest/scripts/build-shan-master-ledger.py \
   --source /path/to/anki_shan_jpn.csv \
   --historic-senses /path/to/DOPA_QUEST_SHN5480_sense_semantic_v4.json \
   --historic-edits /path/to/DOPA_QUEST_SHN5480_category_edits_v4.csv \
   --out /tmp/dopa-ledger

Does not create game cards, change stable IDs, decide semantic equivalence, or
claim independently verified translations. Source line is unique provenance key.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re
import unicodedata

EXPECTED_SHA = '1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7'
BASE = Path(__file__).resolve().parents[1]
SERIAL_RE = re.compile(r'^\s*(\d+)\s*[.:]\s*(.*)$')
POS_RE = re.compile(r'【([^】]{1,30})】')
VARIANT_RE = re.compile(r'別形|異形|異表記|別表記|別綴|異綴|の別名|alternate form|alternative form|variant of|see also', re.I)
GLOSS_EN_RE = re.compile(r'\s+\[(?=(?:【[^】]+】\s*)?[A-Za-z])')
POS_LABELS = ('名詞','動詞','形容詞','副詞','前置詞','代名詞','助数詞','接続詞','感動詞','助詞','接頭辞','接尾辞','数詞','固有名詞')


def nfc(value):
    return unicodedata.normalize('NFC', str(value or '')).strip()


def match_gloss(value):
    return ' '.join(nfc(value).strip('"').split())


def list_json(path):
    o = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    if not isinstance(o, list):
        raise ValueError(f'Expected JSON array: {path}')
    return o


def parse_anki(path):
    rows = []
    for i, physical in enumerate(Path(path).read_text(encoding='utf-8-sig').splitlines(), 1):
        m = SERIAL_RE.match(physical)
        if not m or ',' not in m.group(2):
            raise ValueError(f'Unparseable original line {i}')
        headword, _, definition = m.group(2).partition(',')
        form = nfc(headword)
        raw = definition.strip()
        # The author's numbered source permits CSV quoting inconsistencies.
        # Preserve the source definition before making a deliberately approximate JP extraction.
        plain = raw[1:-1].replace('""','"') if raw.startswith('"') and raw.endswith('"') else raw
        match = POS_RE.search(plain)
        pos = nfc(match.group(1)) if match else ''
        jp = GLOSS_EN_RE.split(plain,1)[0].strip()
        jp = re.sub(r'^【[^】]+】\s*', '', jp).strip()
        jp = jp.rstrip(' "')
        rows.append({'source_row':i, 'source_serial':int(m.group(1)), 'shan':form,
                     'raw_definition':raw, 'japanese_source_candidate':jp,
                     'source_pos':pos, 'source_is_variant_reference':bool(VARIANT_RE.search(plain))})
    return rows


def read_reference_pilot_indexes(path):
    """Optional packed varint source-serial set when running without repo's full 1,000-card pack.

    It can identify published source entries only, not stable published IDs.
    Production IDs must always be joined from shan-extra-pilot-1.json.
    """
    import base64
    data = base64.b64decode(Path(path).read_text(encoding='ascii').strip())
    n = 0; shift = 0; last = 0; result = []
    for b in data:
        n |= (b & 127) << shift
        if b & 128:
            shift += 7
            if shift > 28: raise ValueError('Invalid pilot serial varint')
        else:
            last += n
            result.append(last)
            n = 0; shift = 0
    if shift: raise ValueError('Incomplete pilot serial varint')
    if len(result) != 1000 or len(set(result)) != 1000:
        raise ValueError('Pilot serial index does not contain 1,000 unique serials')
    return set(result)


def main():
    pa = argparse.ArgumentParser(description=__doc__)
    pa.add_argument('--source',required=True)
    pa.add_argument('--out',required=True)
    pa.add_argument('--private-vocab',help='Original v6 private combined vocabulary JSON')
    pa.add_argument('--historic-senses',help='Historic 7,290 candidate semantic JSON')
    pa.add_argument('--historic-edits',help='Historic 399 category corrections CSV')
    pa.add_argument('--current-parent-categories',help='main branch shan-categories-v1.json, preferred')
    pa.add_argument('--pilot',help='main branch shan-extra-pilot-1.json, preferred')
    pa.add_argument('--pilot-serial-index',help='fallback pilot serial index; published IDs remain blank')
    pa.add_argument('--taxonomy',help='main branch study-taxonomy-v1.json')
    pa.add_argument('--allow-other-source', action='store_true', help='disable exact SHA pin after consciously reviewing another source')
    args=pa.parse_args()
    # Within the repository, prefer deployed metadata over old spreadsheet proposals.
    for attr, filename in [('pilot','shan-extra-pilot-1.json'),
                           ('current_parent_categories','shan-categories-v1.json'),
                           ('taxonomy','study-taxonomy-v1.json')]:
        repo_file=BASE/'data'/filename
        if not getattr(args,attr) and repo_file.is_file():setattr(args,attr,str(repo_file))
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    src_bytes=Path(args.source).read_bytes();source_sha=hashlib.sha256(src_bytes).hexdigest()
    if source_sha!=EXPECTED_SHA and not args.allow_other_source:
        raise ValueError(f'Anki source SHA-256 mismatch: {source_sha}; expected {EXPECTED_SHA}')
    rows=parse_anki(args.source)
    if len(rows)!=19637 and not args.allow_other_source:
        raise ValueError('Unexpected Anki source rows')
    if args.private_vocab:
        v=json.loads(Path(args.private_vocab).read_text(encoding='utf-8-sig'))
        parents=v['shan']
    else:
        parents=list_json(BASE/'data/shan-1.json')+list_json(BASE/'data/shan-2.json')
    if len(parents)!=5480:raise ValueError('Original parent count changed')
    by_form=defaultdict(list)
    for p in parents:
        if not p.get('id') or not p.get('shan'): raise ValueError('Parent ID/word missing')
        by_form[nfc(p['shan'])].append(p)
    if len({p['id'] for p in parents})!=5480:raise ValueError('Parent ID collision')
    historical=json.loads(Path(args.historic_senses).read_text(encoding='utf-8-sig')) if args.historic_senses else None
    if historical:
        senses=historical['candidates']
        if len(senses)!=7290:raise ValueError('Historical sense count mismatch')
        sid=lambda x:x['candidate_id'];sj=lambda x:x.get('japanese_candidate','')
        spos=lambda x:x.get('part_of_speech','')
    else:
        senses=[card for i in range(1,9) for card in list_json(BASE/f'data/shan-senses-{i}.json')]
        if len(senses)!=7290:raise ValueError('Current sense candidate count mismatch')
        sid=lambda x:x['id'];sj=lambda x:x.get('japanese_core','')
        spos=lambda x:x.get('game_pos','')
    by_sense_form=defaultdict(list)
    for x in senses:by_sense_form[nfc(x['shan'])].append(x)
    # Current live parent category sidecar is a read-only source of deployment facts.
    cats=json.loads(Path(args.current_parent_categories).read_text(encoding='utf-8-sig')) if args.current_parent_categories else None
    if cats and (cats['schema'] not in ('dopa-shan-parent-category-pilot-v1','dopa-shan-parent-category-staging-v4') or len(cats['cards'])!=5480):
        raise ValueError('Deployed category sidecar invalid')
    edit_rows=[];edit_by_candidate=defaultdict(list)
    if args.historic_edits:
        with open(args.historic_edits,encoding='utf-8-sig',newline='') as f:
            edit_rows=list(csv.DictReader(f))
        for e in edit_rows:edit_by_candidate[e['candidate_id']].append(e)
    if edit_rows and len(edit_rows)!=399:raise ValueError('Unexpected number of historical category corrections')
    taxonomy=json.loads(Path(args.taxonomy).read_text(encoding='utf-8-sig')) if args.taxonomy else None
    mids={child['id'] for parent in taxonomy['categories'] for child in parent['children']} if taxonomy else set()
    if taxonomy and (len(taxonomy['categories'])!=18 or len(mids)!=82):raise ValueError('Taxonomy ID set mismatch')
    pilot=list_json(args.pilot) if args.pilot else []
    pilot_by_serial=defaultdict(list)
    for card in pilot:pilot_by_serial[card['source_serial']].append(card)
    if pilot and (len(pilot)!=1000 or len({c['id'] for c in pilot})!=1000):
        raise ValueError('Pilot pack integrity mismatch')
    fallback_serials=read_reference_pilot_indexes(args.pilot_serial_index) if args.pilot_serial_index else set()
    # Two published serials occur twice in the original numbered source.
    # Resolve them by a second, exact NFC headword check against PR #47.
    fallback_collision_words={1320:'ၵွင်းၵၢင်လင်',7075:'တမ်ၽွင်'}
    if not pilot and not fallback_serials:raise ValueError('Need pilot JSON or fallback serial index')
    serial_duplicated={n for n,k in Counter(r['source_serial'] for r in rows).items() if k>1}
    rows_by_form=defaultdict(list)
    for r in rows: rows_by_form[r['shan']].append(r)
    first_per_form={f:min(z['source_row'] for z in items) for f,items in rows_by_form.items()}
    pair_seen={};ledger=[];status_counts=Counter();form_set=set(rows_by_form)
    for r in rows:
        source_row=r['source_row'];source_serial=r['source_serial'];form=r['shan'];raw=r['raw_definition']
        jp=r['japanese_source_candidate']; pos=r['source_pos']; orig_par=by_form.get(form,[])
        orig_sen=by_sense_form.get(form,[])
        published_match=[c for c in pilot_by_serial.get(source_serial,[]) if nfc(c['shan'])==form and c.get('source_definition')==raw.strip('"')]
        if not published_match:
            # Original file quotation may vary: form+serial is safe only if unique serial.
            published_match=[c for c in pilot_by_serial.get(source_serial,[]) if nfc(c['shan'])==form] if source_serial not in serial_duplicated else []
        is_published=bool(published_match) or (not pilot and source_serial in fallback_serials and (source_serial not in serial_duplicated or fallback_collision_words.get(source_serial)==form))
        published_id=published_match[0]['id'] if len(published_match)==1 else ({(1320,'ၵွင်းၵၢင်လင်'):'shn:anki:bf0cad5a8a5d21e0',(7075,'တမ်ၽွင်'):'shn:anki:52960a237cda6998'}.get((source_serial,form),'') if not pilot else '')
        pair=(form,match_gloss(raw))
        first=pair_seen.setdefault(pair,source_row)
        exact_par=[p['id'] for p in orig_par if match_gloss(p.get('japanese_core'))==match_gloss(jp)]
        exact_sen=[sid(s) for s in orig_sen if match_gloss(sj(s))==match_gloss(jp)]
        historical_sense_exact=[s for s in orig_sen if sid(s) in exact_sen]
        pos_set={nfc(spos(s)) for s in orig_sen if spos(s)}
        pos_diff=bool(orig_sen and pos and pos not in pos_set and pos not in ('未分類','不明'))
        if not form or not raw:relation='hold-incomplete'
        elif first!=source_row:relation='duplicate-source-pair'
        elif is_published:relation='published-extra-1000'
        elif orig_par and (exact_par or exact_sen):relation='existing-gloss-string-exact'
        elif orig_par and pos_diff:relation='existing-form-pos-difference-review'
        elif orig_par:relation='existing-form-sense-or-paraphrase-review'
        else:relation='unpublished-new-form-candidate'
        # This is the *deployed parent* category, not an inherited tag for a new sense.
        deployed_items=[cats['cards'][p['id']] for p in orig_par if cats and p['id'] in cats['cards']]
        deployed_major=deployed_items[0][0] if len(deployed_items)==1 and deployed_items[0][1]=='P' else ''
        deployed_status=';'.join(sorted({v[1] for v in deployed_items}))
        hist_major_options=sorted({str(s.get('semantic_major_proposal','')) for s in historical_sense_exact if s.get('semantic_major_proposal')})
        hist_minor_options=sorted({str(s.get('semantic_small_proposal','')) for s in historical_sense_exact if s.get('semantic_small_proposal')})
        known_minor=[m for m in hist_minor_options if m in mids]
        old_edits=[e for s in historical_sense_exact for e in edit_by_candidate.get(sid(s),[])]
        edit_majs=sorted(set(e['new_major'] for e in old_edits))
        row={
          'source_row':source_row, 'source_row_key':f'anki-row:{source_row}',
          'source_serial_nonunique':source_serial in serial_duplicated,'source_serial':source_serial,
          'shan_nfc':form, 'japanese_candidate_unverified':jp, 'pos_in_source':pos,
          'source_definition_raw':raw, 'source_definition_sha256':hashlib.sha256(raw.encode()).hexdigest(),
          'same_headword_source_rows':len(rows_by_form[form]),'first_source_row_for_headword':first_per_form[form],
          'form_relation':relation, 'evidence_grade':'source-string-only',
          'published_extra_id':published_id,'published_extra_flag':int(is_published),
          'published_id_join_pending':int(is_published and not published_id),
          'original_parent_ids':';'.join(p['id'] for p in orig_par),
          'original_sense_candidate_ids':';'.join(sid(s) for s in orig_sen),
          'exact_gloss_parent_ids':';'.join(exact_par),
          'exact_gloss_sense_ids':';'.join(exact_sen),
          'source_pos_differs_from_old_candidates':int(pos_diff),
          'variant_reference_flag':int(r['source_is_variant_reference']),
          'deployed_parent_major':deployed_major,'deployed_parent_status':deployed_status,
          'historical_exact_sense_major_proposals':';'.join(hist_major_options),
          'historical_exact_sense_medium_proposals_validated':';'.join(known_minor),
          'historical_exact_sense_medium_unmapped':';'.join(set(hist_minor_options)-set(known_minor)),
          'historical_category_edit_proposal_majors':';'.join(edit_majs),
          'category_edit_provenance':'historical-csv-proposal' if old_edits else '',
          'new_sense_confirmed':0,'synonymy_confirmed':0,'variant_target_confirmed':0,
          'semantic_major_for_new_sense':'','semantic_medium_for_new_sense':'',
          'semantic_label_status':'unassigned-until-sense-reviewed' if not orig_par else 'existing-parent-is-not-sense-evidence',
          'review_state': 'published-source-gloss-pilot' if is_published else 'hold-reference' if r['source_is_variant_reference'] else 'requires-review' if orig_par else 'source-only-new-form',
        }
        ledger.append(row);status_counts[relation]+=1
    # Source form partitions are exhaustive; no inferred equivalence in the 11,716 remainder.
    original_forms=set(by_form);published_forms={r['shan_nfc'] for r in ledger if r['published_extra_flag']}
    new_forms=form_set-original_forms
    pending_forms=new_forms-published_forms
    if not args.allow_other_source and (len(form_set),len(new_forms),len(pending_forms),len(published_forms))!=(18196,12716,11716,1000):
        raise ValueError(f'Anki to live-deck cardinality mismatch: {(len(form_set),len(new_forms),len(pending_forms),len(published_forms))}')
    if len(ledger)!=len(rows): raise ValueError('Missing source row from master')
    # Recommend exactly one source row per form; do not create cards or promote to production.
    first_available=[r for r in ledger if r['shan_nfc'] in pending_forms and r['source_row']==first_per_form[r['shan_nfc']]]
    single=[r for r in first_available if r['same_headword_source_rows']==1 and not r['variant_reference_flag']
            and r['pos_in_source'] in POS_LABELS and len(r['japanese_candidate_unverified']) in range(2,81)]
    # Downsample evenly over the sorted source inventory (as in PR #47), then fill by source row.
    selected=[];used=set()
    if len(single)>=2000:
        for i in range(2000):
            k=round(i*(len(single)-1)/1999)
            item=single[k]
            if item['source_row'] not in used:selected.append(item);used.add(item['source_row'])
    if len(selected)<2000:
        for item in single:
            if item['source_row'] not in used:selected.append(item);used.add(item['source_row'])
            if len(selected)>=2000:break
    selected.sort(key=lambda r:r['source_row'])
    for r in selected:r['next_pack_candidate']=1
    for r in ledger:r.setdefault('next_pack_candidate',0)
    def save_csv(path,records,fields=None):
        if fields is None:fields=list(records[0]) if records else []
        with (out/path).open('w',encoding='utf-8-sig',newline='') as f:
            wr=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');wr.writeheader();wr.writerows(records)
    save_csv('shan-anki-master-19637-v1.csv',ledger)
    save_csv('shan-next-pack-shortlist-2000-v1.csv',selected)
    categories=[]
    for p in parents:
        parent_id=p['id'];cat=cats['cards'].get(parent_id,['','']) if cats else ['', '']
        categories.append({'parent_id':parent_id,'shan_nfc':nfc(p['shan']),'published_parent_id_stable':parent_id,
                           'deployed_parent_major':cat[0],'deployed_parent_status':cat[1],
                           'sense_ids':';'.join(sid(s) for s in by_sense_form.get(nfc(p['shan']),[]) if s.get('parent_id')==parent_id),
                           'assignment_note':'P is a tentative parent category; M/H are not assignable new-sense meanings'})
    save_csv('shan-current-5480-parent-crosswalk-v1.csv',categories)
    sensecross=[]
    for s in senses:
        key=sid(s);changes=edit_by_candidate.get(key,[])
        parentcat=cats['cards'].get(s['parent_id'],['','']) if cats else ['','']
        sensecross.append({'sense_id':key,'parent_id':s['parent_id'],'shan_nfc':nfc(s['shan']),
                           'gloss':sj(s),'pos':spos(s),
                           'current_sense_major':s.get('semantic_major',''),
                           'historic_sense_major_proposal':s.get('semantic_major_proposal',''),
                           'historic_sense_medium_proposal':s.get('semantic_small_proposal',''),
                           'historic_medium_in_current_taxonomy':int(s.get('semantic_small_proposal','') in mids) if taxonomy else '',
                           'historical_change_proposal':'|'.join(e['new_major'] for e in changes),
                           'main_parent_major':parentcat[0],'main_parent_status':parentcat[1],
                           'proposal_matches_main_parent':int(bool(changes) and parentcat[1]=='P' and all(e['new_major']==parentcat[0] for e in changes)),
                           'category_provenance':'historical-v4-proposal' if historical else 'current-sense-card',
                           'linguistically_verified':0})
    save_csv('shan-7290-sense-provenance-v1.csv',sensecross)
    if edit_rows:save_csv('shan-historical-category-edits-399-v1.csv',edit_rows)
    pilotcross=[]
    for row in ledger:
        if row['published_extra_flag']:
            pilotcross.append({k:row[k] for k in ('source_row','source_serial','shan_nfc','published_extra_id','published_id_join_pending','japanese_candidate_unverified','source_definition_sha256')})
    save_csv('shan-published-1000-crosswalk-v1.csv',pilotcross)
    counts={'source_rows':len(ledger),'source_distinct_forms':len(form_set),'original_parents':len(parents),
            'original_senses':len(senses),'original_forms_in_anki':len(form_set&original_forms),
            'new_form_candidates_all':len(new_forms),'already_published_new_forms':len(published_forms),
            'new_forms_unpublished':len(pending_forms),'published_rows_joined_ids':sum(bool(r['published_extra_id']) for r in ledger),
            'published_rows_ids_pending_offline':sum(r['published_id_join_pending'] for r in ledger),
            'source_serial_collision_rows':sum(r['source_serial_nonunique'] for r in ledger),
            'source_serial_colliding_values':len(serial_duplicated),
            'multi_entry_source_headwords':sum(1 for f,v in rows_by_form.items() if len(v)>1),
            'single_entry_unpublished_clean_candidates':len(single),
            'next_pack_shortlist':len(selected),'relation_counts':dict(status_counts),
            'historical_category_changes':len(edit_rows),
            'historic_source_only_not_current_main':True,
            'current_parent_categories_available':bool(cats),
            'taxonomy_validated':bool(taxonomy),
            'live_data_modified':False,'source_analyzed_sha256':source_sha}
    report={'schema':'dopa-shan-anki-master-ledger-v1','generated_from_main_sha':'46494662b448fa746207f6ebac43b33e83f3b018',
            'counts':counts,'interpretation':{
              'word_form_identity':'NFC + surrounding-space trim only',
              'source_record_key':'anki-row:<physical source line>; serial is NOT unique',
              'existing_gloss_string_exact':'Only string equality; linguistic identity not established',
              'existing_form_review':'Potential new sense, paraphrase, POS distinction, spelling variation or other; undecided',
              'historical_classification':'Never silently promoted to currently deployed classification',
              'new_sense_category':'Unassigned until independently reviewed',
              'selected_next_pack':'2,000 source-based unapproved candidates, not active cards',
              'pilot_missing_id':'If offline serial fallback was used, rerun in the repository to match all 1,000 existing stable IDs'}}
    (out/'shan-master-summary-v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(counts,ensure_ascii=False,indent=2))

if __name__=='__main__':main()