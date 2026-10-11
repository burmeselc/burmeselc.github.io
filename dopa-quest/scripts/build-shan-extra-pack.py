#!/usr/bin/env python3
"""Deterministic second DOPA QUEST Shan source-gloss pilot (read-only input).

Run from repository root:
  python3 dopa-quest/scripts/build-shan-extra-pack.py \
    --ledger /private/shan-anki-master-19637-v1.csv \
    --output dopa-quest/data/shan-extra-pack-2.json

The ledger is a reproducible copy of the author's own Anki source. It stays
outside the public repository. Source rows and serials are provenance, never IDs.
This tool does not assert linguistic or category review; review_status is explicit.
"""
import argparse
import bisect
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import re
import unicodedata

SOURCE_DIGEST = '1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7'
GAME_POS = {'名詞', '動詞', '形容詞', '副詞', '代名詞', '前置詞', '接続詞', '助詞', '感動詞', '助数詞', '数詞'}
BROKEN_GLOSS = re.compile(r'\[\[|\[[A-Za-z][^\]]*\]|\b(?:English|Burmese|Pali)\b')
NOT_A_HEADWORD = re.compile(r'[A-Za-z一-鿿ぁ-ゟ゠-ヿ]')


def clean_gloss(gloss):
    """Remove English *etymology* labels but never invent a Japanese meaning."""
    gloss = gloss.strip()
    gloss = re.sub(r'\s*[（(]語源等：[A-Za-z\s]+[）)]', '', gloss).strip()
    return gloss


def candidate(row):
    form = row['shan_nfc']
    gloss = clean_gloss(row['japanese_candidate_unverified'])
    return (row['form_relation'] == 'unpublished-new-form-candidate'
        and row['same_headword_source_rows'] == '1'
        and row['variant_reference_flag'] == '0'
        and row['review_state'] == 'source-only-new-form'
        and row['published_extra_flag'] == '0'
        and row['pos_in_source'] in GAME_POS
        and form and form == unicodedata.normalize('NFC', form)
        and not NOT_A_HEADWORD.search(form)
        and 2 <= len(gloss) <= 80
        and not BROKEN_GLOSS.search(gloss)
        and not gloss.startswith(('\"', "'", '「', '『'))
        and '...' not in gloss and '…' not in gloss
        and not re.search(r'【(?:名詞|動詞|形容詞|副詞|助詞|前置詞|接続詞|数詞|代名詞|感動詞)】', gloss)
        and int(row['source_serial']) > 0)


def select_rows(rows, limit=2000):
    """Retain the existing evenly distributed 2,000-row shortlist where clean.

    A flagged ambiguous/formatting row is replaced by its nearest eligible
    neighbour, without shifting the whole selection toward the source beginning.
    """
    shortlisted = [r for r in rows if r['next_pack_candidate'] == '1']
    if len(shortlisted) != 2000 and limit == 2000:
        raise ValueError(f'Original curated shortlist changed: {len(shortlisted)}')
    kept = {int(r['source_row']): r for r in shortlisted if candidate(r)}
    needed = limit - len(kept)
    if needed < 0:
        raise ValueError('Shortlist already exceeds requested size')
    available = [r for r in rows if candidate(r) and int(r['source_row']) not in kept]
    available.sort(key=lambda r:int(r['source_row']))
    ids = [int(r['source_row']) for r in available]
    for missing in (r for r in shortlisted if not candidate(r)):
        if needed == 0: break
        anchor = int(missing['source_row'])
        pos = bisect.bisect_left(ids,anchor)
        possibilities = [j for j in (pos-1,pos) if 0 <= j < len(ids)]
        if not possibilities: raise ValueError('No replacement source row available')
        j = min(possibilities,key=lambda k: (abs(ids[k]-anchor), ids[k]))
        row = available.pop(j)
        key = ids.pop(j)
        kept[key] = row
        needed -= 1
    while needed > 0:
        if not available: raise ValueError('Insufficient clean candidates')
        j = len(available)//2
        row = available.pop(j)
        kept[int(row['source_row'])] = row
        needed -= 1
    return [kept[k] for k in sorted(kept)]


def build(rows, limit=2000):
    selected = []
    used = set()
    for row in select_rows(rows, limit):
        if row['shan_nfc'] in used:
            raise ValueError('unexpected duplicate eligible spelling')
        used.add(row['shan_nfc'])
        digest = hashlib.sha256(('dopa-shan-extra-v2\x00' + row['shan_nfc']).encode('utf8')).hexdigest()[:16]
        selected.append({
            'id': 'shn:anki:' + digest,
            'shan': row['shan_nfc'],
            'japanese_core': clean_gloss(row['japanese_candidate_unverified']),
            'game_pos': row['pos_in_source'],
            'rank': 6481 + len(selected),
            'source_row': int(row['source_row']),
            'source_serial': int(row['source_serial']),
            'source_file': 'anki_shan_jpn.csv',
            'source_definition': row['source_definition_raw'],
            'review_status': 'source-gloss-pilot',
            'semantic_status': 'U',
            'game_include': 1,
        })
    if len(selected) != limit:
        raise ValueError(f'Need {limit} eligible rows, found {len(selected)}')
    if len({x['id'] for x in selected}) != limit or len({x['shan'] for x in selected}) != limit:
        raise ValueError('Duplicate IDs or forms')
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--limit', type=int, default=2000)
    args = parser.parse_args()
    ledger = Path(args.ledger)
    with ledger.open(encoding='utf-8-sig', newline='') as file:
        rows = list(csv.DictReader(file))
    if len(rows) != 19637:
        raise ValueError('Expected 19,637 Anki physical rows, input does not match')
    pack = build(rows, args.limit)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
    print(json.dumps({'count': len(pack), 'output': str(output),
                      'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                      'first_row': pack[0]['source_row'], 'last_row': pack[-1]['source_row']},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()