#!/usr/bin/env python3
"""Permission-based, rate-limited SEAlang Thai dictionary HTML collector.

No network calls without --run --permission-confirmed.
URL template and actual result selectors MUST be verified before use.
A former authorization to download Shan data does not automatically authorize
publishing Thai definitions in a public GitHub Pages repository.
"""
import argparse,csv,hashlib,json,random,re,sys,time
from pathlib import Path
from urllib.parse import quote,urlparse
from urllib.robotparser import RobotFileParser

ROOT=Path(__file__).resolve().parents[1]
THAI_INITIALS='กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮเแโใไ'

def planned_urls(template,limit):
    if template.count('{query}')!=1:raise ValueError('Exactly one {query} placeholder is required.')
    info=urlparse(template)
    if info.scheme!='https' or info.hostname not in ('sealang.net','www.sealang.net'):
        raise ValueError('Only HTTPS URL templates at sealang.net are accepted.')
    return [(ch+'.*',template.replace('{query}',quote(ch+'.*',safe='')))
            for ch in THAI_INITIALS[:limit]]

def collect(a):
    urls=planned_urls(a.url_template,a.max_requests)
    print('Plan: %d queries, >= %s seconds between requests.'%(len(urls),a.delay))
    for pattern,url in urls[:5]:print('  ',pattern,url)
    if not a.run:
        print('DRY RUN: no network calls were made.')
        return
    if not a.permission_confirmed:
        raise SystemExit('--permission-confirmed must be supplied to fetch.')
    try:import requests
    except ImportError:raise SystemExit('pip install requests')
    a.directory.mkdir(parents=True,exist_ok=True)
    manifest=a.directory/'manifest.jsonl'
    done=set()
    if manifest.exists():
        for line in manifest.read_text(encoding='utf-8').splitlines():
            try:
                record=json.loads(line)
                if record.get('status')=='ok':done.add(record['pattern'])
            except (ValueError,KeyError):pass
    agent='ThaiALALC-ResearchBot/0.1 (manual, permission-based)'
    robots=RobotFileParser()
    robots.set_url('https://sealang.net/robots.txt')
    try:robots.read()
    except Exception as e:raise SystemExit('robots.txt unavailable; refusing collection: '+str(e))
    session=requests.Session()
    session.headers.update({'User-Agent':agent,'Accept':'text/html'})
    completed=0
    for pattern,url in urls:
        if pattern in done:continue
        if not robots.can_fetch(agent,url):
            raise SystemExit('Blocked by robots.txt: '+url)
        if completed:time.sleep(a.delay+random.uniform(0,1.5))
        try:response=session.get(url,timeout=(10,30),allow_redirects=False)
        except requests.RequestException as e:
            print('Request failed; stop without retry:',e,file=sys.stderr);break
        if response.status_code!=200:
            print('HTTP',response.status_code,'stopping without retry',file=sys.stderr);break
        if len(response.content)>a.max_bytes or 'html' not in response.headers.get('Content-Type','').lower():
            print('Unexpected response size/type; stopping',file=sys.stderr);break
        name=hashlib.sha256(pattern.encode('utf-8')).hexdigest()[:14]+'.html'
        (a.directory/name).write_bytes(response.content)
        with manifest.open('a',encoding='utf-8') as f:
            f.write(json.dumps({'pattern':pattern,'url':url,'status':'ok','file':name,
                                'bytes':len(response.content)},ensure_ascii=False)+'\n')
        print('Collected',pattern,len(response.content),'bytes')
        completed+=1
    print('Downloaded pages this run:',completed)

def parse_results(a):
    try:from bs4 import BeautifulSoup
    except ImportError:raise SystemExit('pip install beautifulsoup4')
    if not (a.entry_selector and a.thai_selector and a.meaning_selector):
        raise SystemExit('CSS selectors required, based on inspected SEAlang results HTML.')
    rows=[]
    for path in sorted(a.directory.glob('*.html')):
        soup=BeautifulSoup(path.read_bytes(),'html.parser')
        for item in soup.select(a.entry_selector):
            word=item.select_one(a.thai_selector)
            gloss=item.select_one(a.meaning_selector)
            ipa=item.select_one(a.ipa_selector) if a.ipa_selector else None
            if not word or not gloss:continue
            thai=' '.join(word.stripped_strings)
            if not re.search(r'[\u0e00-\u0e7f]',thai) or len(thai)>160:continue
            rows.append({'thai':thai,'meaning':' '.join(gloss.stripped_strings),
                         'ipa':' '.join(ipa.stripped_strings) if ipa else '',
                         'source':'SEAlang Thai; '+path.name})
    unique=list({(r['thai'],r['meaning'],r['ipa']):r for r in rows}.values())
    a.export.parent.mkdir(parents=True,exist_ok=True)
    with a.export.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['thai','meaning','ipa','source'])
        w.writeheader();w.writerows(unique)
    print('Extracted',len(unique),'candidate rows (review before publishing):',a.export)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    g=p.add_mutually_exclusive_group()
    g.add_argument('--run',action='store_true')
    g.add_argument('--dry-run',action='store_true')
    g.add_argument('--parse-only',action='store_true')
    p.add_argument('--permission-confirmed',action='store_true')
    p.add_argument('--url-template',default='')
    p.add_argument('--max-requests',type=int,default=20)
    p.add_argument('--delay',type=float,default=10.0)
    p.add_argument('--max-bytes',type=int,default=8000000)
    p.add_argument('--directory',type=Path,default=ROOT/'data/sealang-html')
    p.add_argument('--export',type=Path,default=ROOT/'data/sealang-export.csv')
    p.add_argument('--entry-selector')
    p.add_argument('--thai-selector')
    p.add_argument('--meaning-selector')
    p.add_argument('--ipa-selector')
    a=p.parse_args()
    if not 1<=a.max_requests<=100:p.error('max-requests must be between 1 and 100.')
    if a.delay<7:p.error('Minimum delay is 7 seconds.')
    if a.parse_only:parse_results(a)
    else:
        try:collect(a)
        except ValueError as e:p.error(str(e))
if __name__=='__main__':main()
