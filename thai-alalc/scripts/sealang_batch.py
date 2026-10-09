#!/usr/bin/env python3
"""Conservative SEAlang Thai public API collector.

This script performs NO requests without --run --permission-confirmed.
It observes robots.txt (20-second crawl delay on 2026-10-09), stops at first
network or size error, and extracts source-specific sense/gloss records.
It does not claim that a regex-prefix result covers the whole dictionary.
"""
from __future__ import annotations
import argparse,csv,hashlib,json,re,sys,time
from pathlib import Path
from urllib import request,parse,robotparser,error
from html.parser import HTMLParser

ROOT=Path(__file__).resolve().parents[1]
API='http://sealang.net/api/api.pl'
ROBOTS='http://sealang.net/robots.txt'
USER_AGENT='ThaiALALC-Research/0.2 (+burmeselc.github.io; permission-confirmed)'
INITIALS='กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮฤฦเแโใไ'

def planned_query_urls(queries):
    return [(q,API+'?'+parse.urlencode({'service':'dictionary','lang':'Thai','query':q}))
            for q in queries]

def base_queries(limit):
    return [char+'.*' for char in INITIALS[:limit]]

def report_count(raw:str):
    match=re.search(r'([\d,]+)\s+items?\s+found',raw,re.I)
    return int(match.group(1).replace(',','')) if match else None

def extract_entries(raw:str,search:str):
    """Return flattened, source-attributed dictionary entries from API XHTML."""
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(raw,'html.parser')
    results=[]
    for block in soup.find_all(['entry','subentry']):
        form=block.find('formx',recursive=False)
        head=form.find('orth',attrs={'type':'head'}) if form else None
        if not head:continue
        thai=head.get_text(' ',strip=True)
        if not re.search('[\u0e00-\u0e7f]',thai) or len(thai)>160:continue
        pron=form.find('pron')
        ipa=pron.get('written','') if pron else ''
        if not ipa and pron:ipa=pron.get_text(' ',strip=True)
        source_id=form.get('id','') or ''
        senses=[]
        for sense in block.find_all('sense',recursive=False):
            definition=sense.find('def')
            if not definition:continue
            gloss=definition.get_text(' ',strip=True)
            if not gloss:continue
            pos=sense.find('pos')
            pos_str=pos.get_text(' ',strip=True) if pos else ''
            senses.append((pos_str+': ' if pos_str else '')+gloss)
        if not senses:continue
        meaning='; '.join(dict.fromkeys(senses))
        if len(meaning)>3000:meaning=meaning[:3000]+'…'
        entry_type=block.name
        results.append({'thai':thai,'meaning':meaning,'ipa':ipa,
                        'source':'SEAlang Thai ('+source_id+')',
                        'source_id':source_id,'entry_type':entry_type,'search':search})
    return results

def process_files(directory,export):
    combined=[]
    for file in sorted(directory.glob('*.html')):
        raw=file.read_text(encoding='utf-8')
        combined.extend(extract_entries(raw,file.name))
    unique={}
    for entry in combined:
        k=(entry['thai'],entry['source_id'],entry['meaning'],entry['ipa'])
        unique.setdefault(k,entry)
    export.parent.mkdir(parents=True,exist_ok=True)
    with export.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=['thai','meaning','ipa','source','source_id','entry_type','search'])
        writer.writeheader()
        writer.writerows(unique.values())
    return len(unique)

def collect(args):
    queries=[x.strip() for x in args.queries.split(';') if x.strip()] if args.queries else base_queries(args.max_requests)
    if len(queries)>args.max_requests:raise SystemExit('Query count exceeds --max-requests.')
    plan=planned_query_urls(queries)
    print('Planned searches:',len(plan),'; first:',', '.join(queries[:5]),flush=True)
    if not args.run:
        print('DRY RUN (no requests).',flush=True);return
    if not args.permission_confirmed:
        raise SystemExit('Explicit --permission-confirmed required for collection.')
    parser=robotparser.RobotFileParser(ROBOTS)
    try:parser.read()
    except Exception as exc:raise SystemExit('Could not obtain robots.txt: '+str(exc))
    delay=max(20,float(parser.crawl_delay(USER_AGENT) or 0),args.delay)
    args.directory.mkdir(parents=True,exist_ok=True)
    manifest=args.directory/'manifest.jsonl'
    completed=set()
    if manifest.exists():
        for line in manifest.read_text(encoding='utf-8').splitlines():
            try:
                record=json.loads(line)
                if record.get('ok'):completed.add(record['query'])
            except (ValueError,KeyError):pass
    last_request=0.0
    for query,url in plan:
        if query in completed:
            print('Already collected',query,flush=True);continue
        if not parser.can_fetch(USER_AGENT,url):raise SystemExit('Disallowed by robots.txt: '+url)
        wait=delay-(time.monotonic()-last_request)
        if wait>0:time.sleep(wait)
        print('Querying',repr(query),flush=True)
        last_request=time.monotonic()
        req=request.Request(url,headers={'User-Agent':USER_AGENT,'Accept':'text/html'})
        try:
            with request.urlopen(req,timeout=50) as res:
                if res.status!=200:raise ValueError('Non-200 status: '+str(res.status))
                body=res.read(args.max_bytes+1)
        except (error.URLError,TimeoutError,ValueError) as exc:
            print('STOP: request failure (no retry):',repr(exc),file=sys.stderr,flush=True);break
        if len(body)>args.max_bytes:
            print('STOP: oversized result for',query,file=sys.stderr,flush=True);break
        raw=body.decode('utf-8','replace')
        if '<entry' not in raw and '<subentry' not in raw:
            print('WARNING: no dictionary elements for',query,flush=True)
        number=report_count(raw)
        name=hashlib.sha256(query.encode()).hexdigest()[:16]+'.html'
        (args.directory/name).write_text(raw,encoding='utf-8')
        from bs4 import BeautifulSoup
        soup=BeautifulSoup(raw,'html.parser')
        elements=len(soup.find_all(['entry','subentry']))
        if number is not None and number>elements:
            print('WARNING: reported',number,'items but',elements,'entry elements. Search may be truncated.',flush=True)
        with manifest.open('a',encoding='utf-8') as f:
            f.write(json.dumps({'query':query,'url':url,'ok':True,'file':name,
                                'reported_count':number,'elements':elements,
                                'size':len(body)},ensure_ascii=False)+'\n')
        print('Downloaded',query,'reported',number,'elements',elements,'bytes',len(body),flush=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run',action='store_true')
    p.add_argument('--permission-confirmed',action='store_true')
    p.add_argument('--parse-only',action='store_true')
    p.add_argument('--queries',default='',help='semicolon-delimited explicit regex expressions')
    p.add_argument('--max-requests',type=int,default=1)
    p.add_argument('--delay',type=float,default=20)
    p.add_argument('--max-bytes',type=int,default=12000000)
    p.add_argument('--directory',type=Path,default=ROOT/'data/sealang-html')
    p.add_argument('--export',type=Path,default=ROOT/'data/sealang-export.csv')
    args=p.parse_args()
    if not 1<=args.max_requests<=100:p.error('max-requests: 1..100')
    if args.delay<20:p.error('Minimum delay is 20 seconds per robots.txt.')
    if args.parse_only:
        print('Exported',process_files(args.directory,args.export),'records to',args.export)
    else:collect(args)

if __name__=='__main__':main()
