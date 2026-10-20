#!/usr/bin/env python3
"""Build dictionary.json from editor seed plus a properly licensed CSV.
CSV headers: thai,meaning[,ipa,source,alalc,verified].
Unverified generated spellings are never labeled reviewed.
"""
import argparse
import csv
import json
import pathlib
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from romanize import guess_word,normalize_thai
from ipa_candidates import candidate_from_ipa

BASE=pathlib.Path(__file__).resolve().parents[1]

def make_entries(seed_path,source_path=None):
    entries=[]
    for row in json.loads(seed_path.read_text(encoding='utf-8')):
        entries.append({'thai':normalize_thai(row['thai']),'alalc':row['alalc'],
        'meaning':row.get('meaning',''),'ipa':row.get('ipa',''),
        'source':row.get('source','editor seed'),'status':row.get('status','tentative')})
    if source_path:
        sources=sorted(source_path.glob('*.csv')) if source_path.is_dir() else [source_path]
        for csv_path in sources:
            with csv_path.open(newline='',encoding='utf-8-sig') as f:
                for row in csv.DictReader(f):
                    thai=normalize_thai(row.get('thai') or '')
                    if not thai:continue
                    supplied=(row.get('alalc') or '').strip()
                    verified=(row.get('verified') or '').strip().lower() in ('1','true','yes')
                    by_spelling=guess_word(thai)
                    by_ipa=candidate_from_ipa((row.get('ipa') or '').strip())
                    roman=supplied or by_spelling or by_ipa or ''
                    method='manual' if supplied else ('spelling' if by_spelling else ('ipa' if by_ipa else ''))
                    senses=[]
                    try:
                        senses=json.loads(row.get('senses_json') or '[]')
                        if not isinstance(senses,list):senses=[]
                    except json.JSONDecodeError:
                        senses=[]
                    evidence='agreement' if by_spelling and by_ipa and by_spelling==by_ipa else (
                        'conflict' if by_spelling and by_ipa else (
                        'spelling_only' if by_spelling else ('pronunciation_only' if by_ipa else 'missing')))
                    entries.append({'thai':thai,'alalc':roman,
                    'meaning':(row.get('meaning') or '').strip(),'ipa':(row.get('ipa') or '').strip(),
                    'pron_display':(row.get('pron_display') or '').strip(),
                    'pos':(row.get('pos') or '').strip(),'senses':senses,
                    'web_rank':(row.get('web_rank') or '').strip(),
                    'lexical_level':(row.get('lexical_level') or 'entry').strip(),
                    'source':(row.get('source') or 'SEAlang Thai').strip(),
                    'source_id':(row.get('source_id') or '').strip(),
                    'source_query':(row.get('query') or '').strip(),
                    'roman_method':method,'roman_evidence':evidence,
                    'status':'reviewed' if supplied and verified else ('tentative' if roman else 'unresolved')})
    merged={}
    def richness(row):
        return (int(row.get('status')=='reviewed')*100,
                int(bool(row.get('senses')))*20,
                int(bool(row.get('pron_display')))*5,
                len(row.get('ipa','')))
    for item in entries:
        key=('source',item['source_id']) if item.get('source_id') else (
            'seed',item['thai'],item['alalc'],item['meaning'])
        if key not in merged or richness(item)>richness(merged[key]):
            merged[key]=item
    return sorted(merged.values(),key=lambda e:(e['thai'],e['alalc'],e['meaning']))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source',type=pathlib.Path)
    ap.add_argument('--out',type=pathlib.Path,default=BASE/'dictionary.json')
    args=ap.parse_args()
    if args.source and not args.source.exists():ap.error('source path does not exist')
    items=make_entries(BASE/'data/seed.json',args.source)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Wrote',len(items),'entries', {s:sum(e['status']==s for e in items)
        for s in ('reviewed','tentative','unresolved')})

if __name__=='__main__':main()
