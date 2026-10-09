#!/usr/bin/env python3
"""Collect SEAlang Thai API entries into CSV shards with provenance.

This is an explicit, throttled batch collector for authorised academic reuse.
It neither calls SEAlang in normal website operation nor requires a local PC.
"""
import argparse
import csv
import hashlib
import json
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup

BASE=Path(__file__).resolve().parents[1]
API="https://sealang.net/api/api.pl"
HEADERS={"User-Agent":"ThaiALALC-AcademicLexicon/0.2 (approved reuse; GitHub research project)"}
FIELDNAMES=["thai","meaning","ipa","source","source_id","query"]
THAI_RE=re.compile(r"[\u0E00-\u0E7F]")
COUNT_RE=re.compile(r"(\d[\d,]*)\s+items\s+found",re.I)
CHARS="กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮเแโใไ"

def parse_document(data:bytes,query:str):
    soup=BeautifulSoup(data,"html.parser")
    text=soup.get_text(" ",strip=True)
    m=COUNT_RE.search(text)
    estimated=int(m.group(1).replace(",","")) if m else None
    rows=[]
    for tag in soup.find_all(["entry","subentry"]):
        head=tag.find("orth",attrs={"type":"head"})
        info=tag.find("formx")
        if head is None or info is None:continue
        thai=head.get_text(" ",strip=True)
        if not THAI_RE.search(thai) or len(thai)>180:continue
        pron=info.find("pron")
        ipa=pron.get("written","").strip() if pron else ""
        if pron is not None and not ipa:ipa=pron.get_text(" ",strip=True)
        senses=tag.find_all("def")
        meanings=list(dict.fromkeys(x.get_text(" ",strip=True) for x in senses
                                    if x.get_text(" ",strip=True)))
        if not meanings:continue
        source_id=info.get("id","").strip()
        prefix=source_id.split(":",1)[0] if source_id else "unknown"
        rows.append({"thai":thai,"meaning":"; ".join(meanings),
                     "ipa":ipa,"source":"SEAlang Thai / "+prefix,
                     "source_id":source_id,"query":query})
    seen=set();unique=[]
    for row in rows:
        key=row["source_id"] or (row["thai"],row["meaning"],row["ipa"])
        if key not in seen:
            seen.add(key);unique.append(row)
    return unique,estimated

def make_url(query:str):
    return API+"?"+urllib.parse.urlencode(
        {"service":"dictionary","lang":"Thai","query":query})

def request_url(url,ctx,max_bytes):
    request=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(request,timeout=35,context=ctx) as response:
        if response.status!=200:raise RuntimeError(f"HTTP {response.status}")
        if "text/html" not in response.headers.get("Content-Type","").lower():
            raise RuntimeError("Unexpected response content type")
        content=response.read(max_bytes+1)
        if len(content)>max_bytes:raise RuntimeError("Response exceeds byte cap")
        return content

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queries",nargs="+",required=True,
                        help="Thai initial expression(s), e.g. 'ณ.*'")
    parser.add_argument("--directory",type=Path,default=BASE/"data/sealang-shards")
    parser.add_argument("--delay",type=float,default=12.0)
    parser.add_argument("--limit",type=int,default=5)
    parser.add_argument("--max-bytes",type=int,default=8_000_000)
    parser.add_argument("--legacy-tls",action="store_true",
                        help="Only for SEAlang public data: ignore broken legacy TLS certificate")
    parser.add_argument("--permission-confirmed",action="store_true")
    parser.add_argument("--run",action="store_true")
    a=parser.parse_args()
    if not 1<=a.limit<=60:parser.error("1<=limit<=60 required")
    if a.delay<10:parser.error("Delay must be >=10 seconds")
    if not 50000<=a.max_bytes<=12_000_000:parser.error("Byte limit must be within range")
    queries=list(dict.fromkeys(a.queries))[:a.limit]
    for q in queries:print("SEARCH",q,make_url(q))
    if not a.run:
        print("DRY RUN; zero web requests.")
        return
    if not a.permission_confirmed:parser.error("permission-confirmed is mandatory")
    ctx=ssl._create_unverified_context() if a.legacy_tls else ssl.create_default_context()
    if a.legacy_tls:print("WARNING: legacy SEAlang TLS certificate verification bypass for public data only.")
    # Parse robots instead of using RobotFileParser.read (cannot pass custom TLS context).
    robots_url="https://sealang.net/robots.txt"
    try:
        with urllib.request.urlopen(urllib.request.Request(robots_url,headers=HEADERS),
                                    context=ctx,timeout=30) as rs:
            robots=rs.read(500000).decode("utf-8","replace")
    except Exception as e:
        raise SystemExit("robots.txt could not be checked; stopping: "+str(e))
    rp=RobotFileParser()
    rp.parse(robots.splitlines())
    a.directory.mkdir(parents=True,exist_ok=True)
    succeeded=0
    last=0.
    for q in queries:
        url=make_url(q)
        if not rp.can_fetch(HEADERS["User-Agent"],url):
            raise SystemExit("robots.txt disallows query; stopping: "+q)
        path=a.directory/(hashlib.sha256(q.encode()).hexdigest()[:16]+".csv")
        if path.exists():print("EXISTS",q,path,"skipping");continue
        if last:
            time.sleep(max(0,a.delay-(time.monotonic()-last)))
        last=time.monotonic()
        try:
            raw=request_url(url,ctx,a.max_bytes)
            rows,estimate=parse_document(raw,q)
            if estimate is None and not rows:
                raise RuntimeError("No item-count and no entries: unfamiliar response")
            with path.open("w",encoding="utf-8",newline="") as f:
                w=csv.DictWriter(f,fieldnames=FIELDNAMES);w.writeheader();w.writerows(rows)
            report={"query":q,"reported_count":estimate,"parsed_records":len(rows),
                    "bytes":len(raw),"file":path.name,
                    "sha256":hashlib.sha256(raw).hexdigest()}
            print("RESULT",json.dumps(report,ensure_ascii=False),flush=True)
            succeeded+=1
        except Exception as e:
            print("STOPPING after error:",repr(e),file=sys.stderr,flush=True)
            sys.exit(2)
    print("DONE; successful requests:",succeeded)

if __name__=="__main__":main()
