#!/usr/bin/env python3
"""Summarize the SEAlang bulk-sweep queue; never claim complete coverage."""
import argparse
import csv
import json
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def make_report(state_path,shards,dictionary):
    state=json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
    results=state.get('results',{})
    counts={}
    for result in results.values():
        counts[result.get('status','unknown')]=counts.get(result.get('status','unknown'),0)+1
    rows=[]
    if dictionary.exists():
        rows=json.loads(dictionary.read_text(encoding='utf-8'))
    total_shards=len(list(shards.glob('*.csv'))) if shards.exists() else 0
    return {
        'as_of_utc':datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'automatic_discovery':True,
        'complete_coverage_verified':False,
        'all_queue_processed':len(state.get('queue',[]))==0 and bool(results),
        'query_count':len(results),
        'query_statuses':counts,
        'pending_queries':len(state.get('queue',[])),
        'distinct_dictionary_records':len(rows),
        'distinct_sealang_source_records':sum(bool(r.get('source_id')) for r in rows),
        'csv_shards':total_shards,
        'blocked_queries':[q for q,r in results.items() if r.get('status')=='blocked'][:200],
        'overflow_depth_limit':[q for q,r in results.items()
                                if r.get('status')=='overflow' and (r.get('children')==0 or r.get('expansion_capped'))][:200],
        'notes':[
            'Searches match substrings; suffix-extension queries do not form a proven disjoint, exhaustive partition.',
            'Even a drained queue is not proof every SEAlang lexical record was retrieved.',
            'For complete coverage request or compare a direct SEAlang dictionary export.',
            'Pronunciation-derived ALA-LC is tentative, not authoritative.'
        ]
    }
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--state',type=Path,default=ROOT/'data/sealang-crawl-state.json')
    ap.add_argument('--shards',type=Path,default=ROOT/'data/sealang-shards')
    ap.add_argument('--dictionary',type=Path,default=ROOT/'dictionary.json')
    ap.add_argument('--output',type=Path,default=ROOT/'data/sweep-progress.json')
    args=ap.parse_args()
    report=make_report(args.state,args.shards,args.dictionary)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items()
                      if k in ('pending_queries','query_count','distinct_dictionary_records',
                               'distinct_sealang_source_records','query_statuses')},ensure_ascii=False))
if __name__=='__main__':main()
