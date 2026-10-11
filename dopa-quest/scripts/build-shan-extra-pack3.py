#!/usr/bin/env python3
"""Reproduce DOPA QUEST Shan additional source-gloss pack 3 from private, audited Anki ledger.

Run from repository root, after creating the 19,637-row ledger using
build-shan-master-ledger.py:

  python3 dopa-quest/scripts/build-shan-extra-pack3.py \
    --ledger /private/shan-anki-master-19637-v1.csv \
    --previous-pack dopa-quest/data/shan-extra-pack-2.json \
    --output dopa-quest/data/shan-extra-pack-3.json

The original Anki text remains private. Language equivalence is NOT established:
this script extracts an explicitly preliminary source-gloss learning inventory.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from pathlib import Path
import runpy

SOURCE_DIGEST = '1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7'
START_RANK = 8481
LIMIT = 2500


def build(rows, prior, limit=LIMIT):
    previous_forms = {x['shan'] for x in prior}
    previous_ids = {x['id'] for x in prior}
    if len(prior) != 2000 or len(previous_forms) != 2000 or len(previous_ids) != 2000:
        raise ValueError('The previously deployed pack-2 inventory must remain unchanged')
    quality = runpy.run_path(str(Path(__file__).with_name('build-shan-extra-pack.py')))
    eligible = [r for r in rows if quality['candidate'](r) and r['shan_nfc'] not in previous_forms]
    eligible.sort(key=lambda r: int(r['source_row']))
    if len(eligible) < limit:
        raise ValueError('Insufficient eligible unpublished Shan headwords for pack 3')
    # Deterministic stratified sampling, not first-N: cover the source's full span.
    indices = [((2*i+1)*len(eligible))//(2*limit) for i in range(limit)]
    if len(set(indices)) != limit:
        raise ValueError('Sampling index collision')
    result = []
    for index in indices:
        r=eligible[index]
        form=r['shan_nfc']
        digest=hashlib.sha256(('dopa-shan-extra-v2\x00'+form).encode('utf8')).hexdigest()[:16]
        result.append({
            'id': 'shn:anki:'+digest,
            'shan':form,
            'japanese_core': quality['clean_gloss'](r['japanese_candidate_unverified']),
            'game_pos':r['pos_in_source'],
            'rank':START_RANK+len(result),
            'source_row':int(r['source_row']),
            'source_serial':int(r['source_serial']),
            'source_file':'anki_shan_jpn.csv',
            'source_definition':r['source_definition_raw'],
            'review_status':'source-gloss-pilot',
            'semantic_status':'U',
            'game_include':1,
        })
    if len(result)!=limit or len({r['shan'] for r in result})!=limit or len({r['id'] for r in result})!=limit:
        raise ValueError('Pack 3 cardinality or uniqueness failure')
    if previous_forms.intersection(x['shan'] for x in result) or previous_ids.intersection(x['id'] for x in result):
        raise ValueError('Pack 3 would replace a previously published Shan card')
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger',required=True)
    parser.add_argument('--previous-pack',default='dopa-quest/data/shan-extra-pack-2.json')
    parser.add_argument('--output',default='dopa-quest/data/shan-extra-pack-3.json')
    a=parser.parse_args()
    with Path(a.ledger).open(encoding='utf-8-sig',newline='') as file:
        rows=list(csv.DictReader(file))
    if len(rows)!=19637:
        raise ValueError('Anki source ledger row count changed')
    prior=json.loads(Path(a.previous_pack).read_text(encoding='utf-8'))
    cards=build(rows,prior)
    out=Path(a.output)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(cards,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({
        'count':len(cards),'output':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
        'first_source_row':cards[0]['source_row'],'last_source_row':cards[-1]['source_row'],
        'source_file_sha256':SOURCE_DIGEST,'remaining_new_unpublished_forms':7216,
    },ensure_ascii=False))


if __name__=='__main__':
    main()