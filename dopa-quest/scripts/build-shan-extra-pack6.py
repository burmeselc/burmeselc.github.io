#!/usr/bin/env python3
"""Publish ALL remaining strictly-clean new single-entry Shan forms as pilot pack 6.

From repo root (private audit ledger must never be committed):
  python3 dopa-quest/scripts/build-shan-extra-pack6.py \
    --ledger /private/shan-anki-master-19637-v1.csv \
    --pack-2 dopa-quest/data/shan-extra-pack-2.json \
    --pack-3 dopa-quest/data/shan-extra-pack-3.json \
    --pack-4 dopa-quest/data/shan-extra-pack-4.json \
    --pack-5 dopa-quest/data/shan-extra-pack-5.json \
    --output dopa-quest/data/shan-extra-pack-6.json

This preserves original cards and does not assert independent linguistic review.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from pathlib import Path
import runpy

SOURCE_SHA256 = '1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7'
PRIOR = {
    2: (2000,'b4fbc629bb3767631a96ad60fd87edb7b5d8503bc936fe7576d34eb4b4932fbb'),
    3: (2500,'0b54206226499ec2808d95f171cb6784f0df5fa3eb3adddbe9a2af939a690423'),
    4: (2500,'ff5bc29cc86151889735c279fb9ccb2d24ea4ea5d1fda7dda25ff1ba3f11508e'),
    5: (2500,'10862ca31b4c78f1db20b08e14717b3bbf525d7bfdb4891f8eb7844a865f04f1'),
}
START_RANK = 15981
EXPECTED_COUNT = 1005

def build(rows, previous):
    prior = [c for chunk in previous for c in chunk]
    prior_forms = {c['shan'] for c in prior}
    prior_ids = {c['id'] for c in prior}
    if len(prior) != 9500 or len(prior_forms) != 9500 or len(prior_ids) != 9500:
        raise ValueError('Previously published pack 2–5 IDs, forms or counts changed')
    helper = runpy.run_path(str(Path(__file__).with_name('build-shan-extra-pack.py')))
    clean = helper['clean_gloss']
    rows = sorted((r for r in rows if helper['candidate'](r) and r['shan_nfc'] not in prior_forms),
                  key=lambda r: int(r['source_row']))
    if len(rows) != EXPECTED_COUNT:
        raise ValueError(f'Strictly-clean remainder changed: {len(rows)}, expected {EXPECTED_COUNT}. Investigate rather than silently discard records.')
    cards = []
    for r in rows:
        form = r['shan_nfc']
        ident = 'shn:anki:' + hashlib.sha256(('dopa-shan-extra-v2\x00' + form).encode('utf8')).hexdigest()[:16]
        cards.append({
            'id':ident,'shan':form,'japanese_core':clean(r['japanese_candidate_unverified']),
            'game_pos':r['pos_in_source'],'rank':START_RANK+len(cards),
            'source_row':int(r['source_row']),'source_serial':int(r['source_serial']),
            'source_file':'anki_shan_jpn.csv','source_definition':r['source_definition_raw'],
            'review_status':'source-gloss-pilot','semantic_status':'U','game_include':1,
        })
    if len({x['shan'] for x in cards}) != EXPECTED_COUNT or len({x['id'] for x in cards}) != EXPECTED_COUNT:
        raise ValueError('Duplicated candidate form or hash ID')
    if any(x['shan'] in prior_forms or x['id'] in prior_ids for x in cards):
        raise ValueError('Published card ID/form reused')
    return cards

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ledger',required=True)
    for i in PRIOR: p.add_argument(f'--pack-{i}',default=f'dopa-quest/data/shan-extra-pack-{i}.json')
    p.add_argument('--output',default='dopa-quest/data/shan-extra-pack-6.json')
    args=p.parse_args()
    with Path(args.ledger).open(encoding='utf-8-sig',newline='') as src:
        rows=list(csv.DictReader(src))
    if len(rows) != 19637: raise ValueError('Source row count changed')
    prior=[]
    for i,(n,sha) in PRIOR.items():
        path=Path(getattr(args,f'pack_{i}'))
        if hashlib.sha256(path.read_bytes()).hexdigest()!=sha:
            raise ValueError(f'Original published pack {i} bytes changed')
        chunk=json.loads(path.read_text(encoding='utf8'))
        if len(chunk)!=n: raise ValueError(f'Original pack {i} count changed')
        prior.append(chunk)
    cards=build(rows,prior)
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(cards,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    print(json.dumps({'count':len(cards),'output':str(output),
                      'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                      'source_sha256':SOURCE_SHA256,
                      'first_source_row':cards[0]['source_row'],
                      'last_source_row':cards[-1]['source_row'],
                      'strict_clean_unpublished_remaining':0,
                      'new_unique_headwords_needing_review':1211},ensure_ascii=False))
if __name__=='__main__':main()
