#!/usr/bin/env python3
"""Deterministic fourth DOPA QUEST Shan source-gloss pack from a private audited ledger.

Usage from repository root:

  python3 dopa-quest/scripts/build-shan-extra-pack4.py \
    --ledger /private/shan-anki-master-19637-v1.csv \
    --pack-2 dopa-quest/data/shan-extra-pack-2.json \
    --pack-3 dopa-quest/data/shan-extra-pack-3.json \
    --output dopa-quest/data/shan-extra-pack-4.json

The original Anki CSV and reviewed audit ledger are kept private. The output
retains unverified source glosses and does not imply 18/82 semantic review.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from pathlib import Path
import runpy

SOURCE_DIGEST = '1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7'
PACK_2_DIGEST = 'b4fbc629bb3767631a96ad60fd87edb7b5d8503bc936fe7576d34eb4b4932fbb'
PACK_3_DIGEST = '0b54206226499ec2808d95f171cb6784f0df5fa3eb3adddbe9a2af939a690423'
START_RANK = 10981
LIMIT = 2500


def build(rows, pack2, pack3, limit=LIMIT):
    if len(pack2) != 2000 or len(pack3) != 2500:
        raise ValueError('Deployed previous packs changed')
    prior = pack2 + pack3
    old_forms = {c['shan'] for c in prior}
    old_ids = {c['id'] for c in prior}
    if len(old_forms) != len(prior) or len(old_ids) != len(prior):
        raise ValueError('Duplicate spelling or ID among prior deployed packs')
    quality = runpy.run_path(str(Path(__file__).with_name('build-shan-extra-pack.py')))
    eligible = [r for r in rows if quality['candidate'](r)
                and r['shan_nfc'] not in old_forms]
    eligible.sort(key=lambda r: int(r['source_row']))
    if len(eligible) < limit:
        raise ValueError(f'Only {len(eligible)} clean unused entries available')
    # Evenly cover the full 19,637-row source rather than favor its beginning.
    indices = [((2*i+1)*len(eligible))//(2*limit) for i in range(limit)]
    if len(set(indices)) != limit:
        raise ValueError('Stratified sampling index collision')
    cards = []
    for idx in indices:
        row = eligible[idx]
        form = row['shan_nfc']
        digest = hashlib.sha256(('dopa-shan-extra-v2\x00'+form).encode('utf-8')).hexdigest()[:16]
        cards.append({
            'id': 'shn:anki:'+digest,
            'shan': form,
            'japanese_core': quality['clean_gloss'](row['japanese_candidate_unverified']),
            'game_pos': row['pos_in_source'],
            'rank': START_RANK+len(cards),
            'source_row': int(row['source_row']),
            'source_serial': int(row['source_serial']),
            'source_file': 'anki_shan_jpn.csv',
            'source_definition': row['source_definition_raw'],
            'review_status': 'source-gloss-pilot',
            'semantic_status': 'U',
            'game_include': 1,
        })
    ids = {c['id'] for c in cards}
    forms = {c['shan'] for c in cards}
    if len(ids) != limit or len(forms) != limit or ids & old_ids or forms & old_forms:
        raise ValueError('Pack-4 duplicates an ID or headword')
    return cards, len(eligible)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--pack-2', default='dopa-quest/data/shan-extra-pack-2.json')
    parser.add_argument('--pack-3', default='dopa-quest/data/shan-extra-pack-3.json')
    parser.add_argument('--output', default='dopa-quest/data/shan-extra-pack-4.json')
    args=parser.parse_args()
    with Path(args.ledger).open(encoding='utf-8-sig', newline='') as f:
        rows=list(csv.DictReader(f))
    if len(rows)!=19637:
        raise ValueError('Anki source ledger row count changed')
    if hashlib.sha256(Path(args.pack_2).read_bytes()).hexdigest()!=PACK_2_DIGEST:
        raise ValueError('Previous pack-2 bytes unexpectedly changed')
    if hashlib.sha256(Path(args.pack_3).read_bytes()).hexdigest()!=PACK_3_DIGEST:
        raise ValueError('Previous pack-3 bytes unexpectedly changed')
    p2=json.loads(Path(args.pack_2).read_text(encoding='utf-8'))
    p3=json.loads(Path(args.pack_3).read_text(encoding='utf-8'))
    cards, eligible_count=build(rows,p2,p3)
    out=Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(cards,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'count':len(cards),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
                      'source_sha256':SOURCE_DIGEST,'first_source_row':cards[0]['source_row'],
                      'last_source_row':cards[-1]['source_row'],'remaining_eligible_clean':eligible_count-len(cards),
                      'remaining_unique_new_forms':4716},ensure_ascii=False))

if __name__=='__main__':
    main()
