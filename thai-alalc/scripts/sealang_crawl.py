#!/usr/bin/env python3
"""Bounded, resumable SEAlang Thai crawler with conservative overflow splitting.

This makes NO completeness claim: the API matches substrings, and the service
does not support standard regex anchors/classes reliably. Child searches are
heuristic, and the queue state explicitly records unproven coverage.
"""
import argparse
import csv
import hashlib
import json
import os
import re
import ssl
import time
import urllib.request
from pathlib import Path
from urllib.robotparser import RobotFileParser

from sealang_api_thai import API,HEADERS,FIELDNAMES,make_url,parse_document,request_url

ROOT=Path(__file__).resolve().parents[1]
# First try Thai consonants and preposed vowels, then diacritic/vowel marks.
# This list is useful for discovery, NOT a proof of a complete regex partition.
FOLLOWING=''.join(chr(n) for n in range(0x0E01,0x0E5C) if chr(n) not in 'ฯๆ๐๑๒๓๔๕๖๗๘๙')
# All common Thai word-initial codepoints: consonants + initial-position vowels.
# Single-character searches are permitted to overflow and will be recorded.
FIRST_CHARS=''.join(chr(n) for n in range(0x0E01,0x0E2F))+'ฤฦเแโใไ'
EMPTY_RE=re.compile(r'Nothing found\.|0\s+items\s+found',re.I)
MAX_QUERY_BUDGET=12000
CAP_RE=re.compile(r'Excessive number of hits\s*\(([\d,]+),\s*limit\s*([\d,]+)\)',re.I)

def shard_path(directory,query):
    return directory/(hashlib.sha256(query.encode('utf-8')).hexdigest()[:16]+'.csv')

def expand_query(query,depth,max_depth):
    """Suffix refinements are only DISCOVERY, never a complete partition."""
    if not query.endswith('.*') or depth>=max_depth:return []
    prefix=query[:-2]
    return [prefix+c+'.*' for c in FOLLOWING]

def new_state():
    return {'version':1,'queue':[],'results':{},'coverage_proven':False,
            'limitations':['SEAlang native-orthography regex matches substrings, not necessarily prefixes.',
            'Anchored end-of-word and character-class syntax did not behave as standard regex.',
            'Suffix-refinement searches do not cover all possible character continuations or words ending at the prefix.',
            'No count of all distinct headwords is available for an exhaustiveness audit.']}

def save_state(path,state):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp')
    tmp.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.replace(tmp,path)

def initialize(state,seeds):
    known=set(state['results'])|{x['query'] for x in state['queue']}
    for q in seeds:
        if q in known:continue
        state['queue'].append({'query':q,'depth':0,'parent':None});known.add(q)

def split_overflow(state,item,hits,limit,max_depth):
    q=item['query']
    children=expand_query(q,item['depth'],max_depth)
    state['results'][q]={'status':'overflow','hits':hits,'limit':limit,
                         'children':len(children),'coverage_proven':False}
    known=set(state['results'])|{x['query'] for x in state['queue']}
    added=0
    for sub in children:
        if sub not in known:
            # Hard ceiling avoids unbounded automatic search expansion.
            if len(known)>=MAX_QUERY_BUDGET:
                state['results'][q]['expansion_capped']=True
                break
            state['queue'].append({'query':sub,'depth':item['depth']+1,'parent':q})
            known.add(sub);added+=1
    return added

def get_robots(ctx):
    with urllib.request.urlopen(
        urllib.request.Request('https://sealang.net/robots.txt',headers=HEADERS),
        context=ctx,timeout=30) as response:
        body=response.read(400000).decode('utf-8','replace')
    parser=RobotFileParser()
    parser.parse(body.splitlines())
    return parser

def crawl(args,request_fn=request_url,robots_fn=get_robots):
    state_path=args.state
    state=json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else new_state()
    initialize(state,(list(args.queries)+[ch+'.*' for ch in FIRST_CHARS])
               if getattr(args,'all_initials',False) else args.queries)
    if not args.run:
        print('DRY RUN:',len(state['queue']),'queued; no network requests')
        return state
    if not args.permission_confirmed:
        raise RuntimeError('Explicit --permission-confirmed is required')
    ctx=ssl._create_unverified_context() if args.legacy_tls else ssl.create_default_context()
    robots=robots_fn(ctx)
    delay=max(20.0,args.delay,float(robots.crawl_delay(HEADERS['User-Agent']) or 0))
    # Persist and honor a stricter service robots directive each invocation.
    args.directory.mkdir(parents=True,exist_ok=True)
    used=0
    previous=None
    while state['queue'] and used<args.max_requests:
        item=state['queue'][0];q=item['query'];url=make_url(q)
        path=shard_path(args.directory,q)
        if path.exists():
            state['results'].setdefault(q,{'status':'cached','file':path.name,
                                           'coverage_proven':False})
            state['queue'].pop(0)
            save_state(state_path,state)
            continue
        if not robots.can_fetch(HEADERS['User-Agent'],url):
            print('ROBOTS BLOCK; remaining query stays queued:',q,flush=True)
            break
        if previous is not None:
            time.sleep(max(0,delay-(time.monotonic()-previous)))
        previous=time.monotonic()
        used+=1
        try:
            raw=request_fn(url,ctx,args.max_bytes)
            cap=CAP_RE.search(raw.decode('utf-8','replace'))
            if cap:
                count=int(cap.group(1).replace(',',''))
                ceiling=int(cap.group(2).replace(',',''))
                state['queue'].pop(0)
                state.pop('errors',None)
                expanded=split_overflow(state,item,count,ceiling,args.max_depth)
                print('OVERFLOW',q,count,'limit',ceiling,'child queries',expanded,flush=True)
            else:
                records,estimated=parse_document(raw,q)
                empty=not records and (estimated==0 or EMPTY_RE.search(raw.decode('utf-8','replace')))
                if estimated is None and not records and not empty:
                    raise ValueError('Unrecognized API response; not an empty dictionary')
                tmp=path.with_suffix('.tmp')
                with tmp.open('w',encoding='utf-8',newline='') as out:
                    writer=csv.DictWriter(out,fieldnames=FIELDNAMES)
                    writer.writeheader();writer.writerows(records)
                os.replace(tmp,path)
                state['queue'].pop(0)
                state.pop('errors',None)
                state['results'][q]={'status':'empty' if empty else 'fetched','reported_hits':estimated,
                                     'parsed_records':len(records),'file':path.name,
                                     'sha256':hashlib.sha256(raw).hexdigest(),
                                     'coverage_proven':False}
                print('FETCHED',q,'hits',estimated,'parsed',len(records),flush=True)
        except Exception as e:
            counts=state.setdefault('error_attempts',{})
            counts[q]=counts.get(q,0)+1
            state['errors']={'query':q,'message':str(e),'attempt':counts[q]}
            # Failed queries are not discarded silently. After three independent
            # scheduled invocations they become blocked and the rest can proceed.
            if counts[q]>=3:
                state['results'][q]={'status':'blocked','reason':str(e),
                                     'attempts':counts[q],'coverage_proven':False}
                state['queue'].pop(0)
            save_state(state_path,state)
            print('STOP (no burst retry):',q,type(e).__name__,str(e),flush=True)
            break
        save_state(state_path,state)
    summary={'requests_this_run':used,'pending':len(state['queue']),
             'completed_queries':sum(x.get('status')=='fetched' for x in state['results'].values()),
             'overflow_queries':sum(x.get('status')=='overflow' for x in state['results'].values()),
             'failed_query':(state.get('errors') or {}).get('query'),
             'expansion_capped':sum(bool(x.get('expansion_capped')) for x in state['results'].values()),
             'coverage_proven':False}
    print('SUMMARY',json.dumps(summary,ensure_ascii=False),flush=True)
    return state

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--queries',nargs='*',default=[],
                   help='Explicit Thai substring search seeds')
    p.add_argument('--all-initials',action='store_true',
                   help='Automatically seed every common Thai word-initial character')
    p.add_argument('--state',type=Path,default=ROOT/'data/sealang-crawl-state.json')
    p.add_argument('--directory',type=Path,default=ROOT/'data/sealang-shards')
    p.add_argument('--max-requests',type=int,default=5)
    p.add_argument('--max-depth',type=int,default=2)
    p.add_argument('--max-bytes',type=int,default=8_000_000)
    p.add_argument('--delay',type=float,default=20.0)
    p.add_argument('--permission-confirmed',action='store_true')
    p.add_argument('--legacy-tls',action='store_true')
    p.add_argument('--run',action='store_true')
    args=p.parse_args()
    if not 1<=args.max_requests<=30:p.error('max-requests must be 1..30')
    if not 0<=args.max_depth<=3:p.error('max-depth must be 0..3')
    if not args.queries and not args.all_initials:p.error('Use --queries or --all-initials')
    if args.delay<20:p.error('minimum delay is 20 seconds')
    if not 50000<=args.max_bytes<=12_000_000:p.error('max-bytes is outside 50KB..12MB')
    for q in args.queries:
        if not re.fullmatch(r'[\u0E01-\u0E5B]{1,8}\.\*',q):
            p.error('Use short literal Thai sequences ending in .* (no untested regex syntax): '+q)
    crawl(args)

if __name__=='__main__':main()
