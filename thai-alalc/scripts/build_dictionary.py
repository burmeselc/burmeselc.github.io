#!/usr/bin/env python3
"""Build a growing Thai ↔ ALA-LC candidate dictionary from permitted SEAlang CSV.

Preserves existing records when the public dictionary is regenerated.
IPA-derived spellings are tentative; no automatic output is "reviewed".
"""
import argparse,csv,json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from romanize import guess_word,normalize_thai
from ipa_candidates import candidate_from_ipa

BASE=pathlib.Path(__file__).resolve().parents[1]
STATUS={'reviewed':0,'tentative':1,'unresolved':2}

def normalized(row):
    x={k:row.get(k,'') for k in ('thai','alalc','meaning','ipa','source','source_id','entry_type','status','roman_method')}
    x['thai']=normalize_thai(x['thai'])
    x['status']=x['status'] if x['status'] in STATUS else 'unresolved'
    return x

def make_entries(seed_path,source_path=None,previous_path=None):
    entries=[]
    if previous_path is not None and previous_path.exists():
        entries.extend(normalized(row) for row in json.loads(previous_path.read_text(encoding='utf-8')))
    entries.extend(normalized({**row,'status':row.get('status','tentative'),'roman_method':row.get('roman_method','curated')})
                   for row in json.loads(seed_path.read_text(encoding='utf-8')))
    if source_path:
        with source_path.open(newline='',encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                thai=normalize_thai(row.get('thai') or '')
                if not thai:continue
                ipa=(row.get('ipa') or '').strip()
                supplied=(row.get('alalc') or '').strip()
                verified=(row.get('verified') or '').strip().lower() in ('1','true','yes')
                by_spelling=guess_word(thai)
                by_ipa=candidate_from_ipa(ipa)
                roman=supplied or by_spelling or by_ipa or ''
                method='manual' if supplied else ('spelling' if by_spelling else ('ipa' if by_ipa else ''))
                entries.append(normalized({'thai':thai,'alalc':roman,
                'meaning':(row.get('meaning') or '').strip(),'ipa':ipa,
                'source':(row.get('source') or 'SEAlang Thai API').strip(),
                'source_id':(row.get('source_id') or '').strip(),
                'entry_type':(row.get('entry_type') or '').strip(),
                'status':'reviewed' if supplied and verified else ('tentative' if roman else 'unresolved'),
                'roman_method':method}))
    merged={}
    for entry in entries:
        if not entry['thai']:continue
        key=(entry['thai'],entry['source_id'] or entry['source'],entry['meaning'])
        old=merged.get(key)
        if old is None or (STATUS[entry['status']],bool(entry['alalc'])==False)<(STATUS[old['status']],bool(old['alalc'])==False):
            merged[key]=entry
    return sorted(merged.values(),key=lambda e:(e['thai'],e['source_id'],e['alalc'],e['meaning']))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source',type=pathlib.Path)
    ap.add_argument('--out',type=pathlib.Path,default=BASE/'dictionary.json')
    ap.add_argument('--previous',type=pathlib.Path,
                    help='Existing dictionary to preserve; defaults to thai-alalc/dictionary.json')
    args=ap.parse_args()
    if args.source and not args.source.exists():ap.error('source CSV does not exist')
    previous=args.previous or BASE/'dictionary.json'
    items=make_entries(BASE/'data/seed.json',args.source,previous)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Wrote',len(items),'entries', {s:sum(e['status']==s for e in items)
        for s in ('reviewed','tentative','unresolved')})
    print('Romanization methods:',{m:sum(e['roman_method']==m for e in items)
        for m in sorted(set(e['roman_method'] for e in items))})

if __name__=='__main__':main()
