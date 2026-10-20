#!/usr/bin/env python3
"""Deterministic 100–200 word candidate *consistency audit* (not accuracy).

Two imperfect independent estimates, spelling and SEAlang phonetic conversion,
are compared. Agreement is not proof of an ALA-LC-correct reading. A manually
checked gold sample is required for cataloging accuracy percentages.
"""
import argparse,csv,hashlib,json,sys
from collections import Counter
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from romanize import guess_word
from ipa_candidates import candidate_from_ipa

ROOT=Path(__file__).resolve().parents[1]

def load_records(directory):
    dedup={}
    for file in sorted(directory.glob('*.csv')):
        with file.open(encoding='utf-8-sig',newline='') as f:
            for row in csv.DictReader(f):
                key=row.get('source_id') or (row.get('thai',''),row.get('meaning',''))
                if not row.get('thai'):continue
                old=dedup.get(str(key))
                # Prefer source records which preserve independent senses.
                if old is None or len(row.get('senses_json',''))>len(old.get('senses_json','')):
                    dedup[str(key)]=row
    return list(dedup.values())

def classify(row):
    thai=row['thai']
    spelling=guess_word(thai)
    phonetic=candidate_from_ipa(row.get('ipa',''))
    if spelling and phonetic:
        status='agreement' if spelling.casefold()==phonetic.casefold() else 'disagreement'
    elif spelling:status='spelling_only'
    elif phonetic:status='pronunciation_only'
    else:status='neither'
    return {'thai':thai,'source_id':row.get('source_id',''),
            'pronunciation':row.get('ipa',''),'meaning':row.get('meaning',''),
            'spelling_candidate':spelling,'pronunciation_candidate':phonetic,
            'comparison':status,'web_rank':row.get('web_rank',''),
            'pos':row.get('pos','')}

def audit(records,maximum=150):
    # Stable pseudo-random sample over source IDs, rather than only first results.
    ordered=sorted(records,key=lambda e:hashlib.sha256(
        (e.get('source_id') or e['thai']).encode()).digest())
    sample=[classify(x) for x in ordered[:maximum]]
    summary={'unique_lexical_records':len(records),'sample_size':len(sample),
             'counts':dict(Counter(x['comparison'] for x in sample)),
             'scope':'agreement audit only; not ALA-LC exact-match accuracy',
             'complete_dictionary':False}
    return {'summary':summary,'sample':sample}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--shards',type=Path,default=ROOT/'data/sealang-shards')
    p.add_argument('--output',type=Path,default=ROOT/'data/alalc-candidate-audit.json')
    p.add_argument('--size',type=int,default=150)
    a=p.parse_args()
    if not 1<=a.size<=200:p.error('1<=size<=200 required')
    results=audit(load_records(a.shards),a.size)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',
                        encoding='utf-8')
    print(json.dumps(results['summary'],ensure_ascii=False))
if __name__=='__main__':main()
