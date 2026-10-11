#!/usr/bin/env python3
"""Reproduce DOPA QUEST Shan optional source-gloss pack 5 from private ledger.

Example (repository root):

  python3 dopa-quest/scripts/build-shan-extra-pack5.py \
    --ledger /private/shan-anki-master-19637-v1.csv \
    --pack-2 dopa-quest/data/shan-extra-pack-2.json \
    --pack-3 dopa-quest/data/shan-extra-pack-3.json \
    --pack-4 dopa-quest/data/shan-extra-pack-4.json \
    --output dopa-quest/data/shan-extra-pack-5.json

Private Anki CSV and private 19,637-line audit ledger must not be committed.
All glosses are tentative source-only extracts, NOT semantic/linguistic review.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from pathlib import Path
import runpy

SOURCE_SHA256 = '1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7'
PREVIOUS = {
    2: (2000, 'b4fbc629bb3767631a96ad60fd87edb7b5d8503bc936fe7576d34eb4b4932fbb'),
    3: (2500, '0b54206226499ec2808d95f171cb6784f0df5fa3eb3adddbe9a2af939a690423'),
    4: (2500, 'ff5bc29cc86151889735c279fb9ccb2d24ea4ea5d1fda7dda25ff1ba3f11508e'),
}
START_RANK=13481
LIMIT=2500


def build(rows, previous, limit=LIMIT):
    prior=[card for group in previous for card in group]
    prior_forms={card['shan'] for card in prior}
    prior_ids={card['id'] for card in prior}
    if len(prior)!=7000 or len(prior_forms)!=7000 or len(prior_ids)!=7000:
        raise ValueError('Published pack 2-4 identities or cardinality changed')
    util=runpy.run_path(str(Path(__file__).with_name('build-shan-extra-pack.py')))
    clean_gloss=util['clean_gloss']
    eligible=[r for r in rows if util['candidate'](r) and r['shan_nfc'] not in prior_forms]
    eligible.sort(key=lambda r:int(r['source_row']))
    if len(eligible)<limit:
        raise ValueError(f'Insufficient clean unpublished source rows: {len(eligible)}')
    # Deterministic uniform spread through entire unselected source. Neither
    # source serial nor absolute input order is used as a card identity.
    indices=[((2*i+1)*len(eligible))//(2*limit) for i in range(limit)]
    if len(set(indices))!=limit:
        raise ValueError('Selection indices collided')
    result=[]
    for index in indices:
        row=eligible[index]
        form=row['shan_nfc']
        digest=hashlib.sha256(('dopa-shan-extra-v2\x00'+form).encode('utf-8')).hexdigest()[:16]
        result.append({
            'id':'shn:anki:'+digest,
            'shan':form,
            'japanese_core':clean_gloss(row['japanese_candidate_unverified']),
            'game_pos':row['pos_in_source'],
            'rank':START_RANK+len(result),
            'source_row':int(row['source_row']),
            'source_serial':int(row['source_serial']),
            'source_file':'anki_shan_jpn.csv',
            'source_definition':row['source_definition_raw'],
            'review_status':'source-gloss-pilot',
            'semantic_status':'U',
            'game_include':1,
        })
    forms={x['shan'] for x in result}
    ids={x['id'] for x in result}
    if len(result)!=limit or len(forms)!=limit or len(ids)!=limit:
        raise ValueError('Duplicate form or ID within fifth pack')
    if forms & prior_forms or ids & prior_ids:
        raise ValueError('Fifth pack would overwrite an existing card')
    return result,len(eligible)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger',required=True)
    for i in PREVIOUS:
        parser.add_argument(f'--pack-{i}',default=f'dopa-quest/data/shan-extra-pack-{i}.json')
    parser.add_argument('--output',default='dopa-quest/data/shan-extra-pack-5.json')
    a=parser.parse_args()
    with Path(a.ledger).open(encoding='utf-8-sig',newline='') as fh:
        rows=list(csv.DictReader(fh))
    if len(rows)!=19637:
        raise ValueError('Private audited Anki ledger row count changed')
    previous=[]
    for i,(n,digest) in PREVIOUS.items():
        p=Path(getattr(a,f'pack_{i}'))
        if hashlib.sha256(p.read_bytes()).hexdigest()!=digest:
            raise ValueError(f'Published pack {i} bytes changed')
        data=json.loads(p.read_text(encoding='utf-8'))
        if len(data)!=n:
            raise ValueError(f'Published pack {i} count changed')
        previous.append(data)
    cards,eligible_count=build(rows,previous)
    out=Path(a.output)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(cards,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({
        'count':len(cards),'output':str(out),
        'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
        'source_sha256':SOURCE_SHA256,
        'first_source_row':cards[0]['source_row'],
        'last_source_row':cards[-1]['source_row'],
        'remaining_eligible_clean':eligible_count-len(cards),
        'remaining_unpublished_unique_forms':4716-len(cards),
    },ensure_ascii=False))

if __name__=='__main__':
    main()
