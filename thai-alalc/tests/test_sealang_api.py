import unittest
import sys
import tempfile
from types import SimpleNamespace
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'scripts'))
from sealang_api_thai import parse_document,make_url
from sealang_crawl import expand_query,split_overflow,new_state,FOLLOWING,FIRST_CHARS,initialize,crawl

EXAMPLE='''<!DOCTYPE html><html><body>2 items found
<entry orthTarget="ณ"><formx id="TDP:6410">
<orth type="head">ณ</orth><span>(<b>WebRank:</b>2)</span><pron written="ná">náʔ</pron></formx>
<sense n="1"><pos>Pp</pos><def>at, in</def></sense>
<sense n="2"><def>element in surnames</def></sense></entry>
<subentry orthTarget="ณ บัดนี้"><formx id="TDP:6414">
<orth type="head">ณ บัดนี้</orth><pron written="ná bàt níi">ná bàt níi</pron></formx>
<sense n="1"><def>at present</def></sense></subentry>
</body></html>'''

class SEAlangParserTests(unittest.TestCase):
    def test_parse_entries(self):
        rows,count=parse_document(EXAMPLE.encode(),'ณ.*')
        self.assertEqual(count,2)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['thai'],'ณ')
        self.assertEqual(rows[0]['meaning'],'at, in; element in surnames')
        self.assertEqual(rows[0]['source_id'],'TDP:6410')
        self.assertEqual(rows[0]['web_rank'],'2')
        self.assertEqual(rows[0]['pos'],'Pp')
        self.assertEqual(len(__import__('json').loads(rows[0]['senses_json'])),2)
        self.assertEqual(__import__('json').loads(rows[0]['senses_json'])[0]['definitions'],['at, in'])
        self.assertEqual(rows[1]['thai'],'ณ บัดนี้')
        self.assertEqual(rows[1]['ipa'],'ná bàt níi')
    def test_no_empty_glosses(self):
        rows,count=parse_document(b'<html>Nothing found <entry><orth type="head">TEST</orth></entry></html>','test')
        self.assertEqual(rows,[])
        self.assertIsNone(count)
    def test_query_hit_cap(self):
        data=b"Content-type: text/html\nExcessive number of hits (14408, limit 2400).  Try again."
        with self.assertRaisesRegex(ValueError,'2400'):
            parse_document(data,'ก.*')
    def test_overflow_queue_resumes_and_preserves_uncertainty(self):
        state=new_state()
        children=split_overflow(state,{'query':'ก.*','depth':0},14408,2400,1)
        self.assertEqual(children,len(FOLLOWING))
        self.assertEqual(state['results']['ก.*']['status'],'overflow')
        self.assertFalse(state['coverage_proven'])
        self.assertTrue(state['queue'][0]['query'].startswith('ก'))
        self.assertEqual(expand_query('ก.*',1,1),[])
    def test_query_split_not_claimed_exhaustive(self):
        state=new_state()
        self.assertTrue(any('not' in x.lower() or 'no ' in x.lower()
                            for x in state['limitations']))
    def test_full_alphabet_seeding_is_deduplicated(self):
        state=new_state()
        initialize(state,[c+'.*' for c in FIRST_CHARS])
        self.assertIn('ก.*',[x['query'] for x in state['queue']])
        self.assertIn('เ.*',[x['query'] for x in state['queue']])
        self.assertEqual(len(state['queue']),len(set(FIRST_CHARS)))
        initialize(state,[c+'.*' for c in FIRST_CHARS])
        self.assertEqual(len(state['queue']),len(set(FIRST_CHARS)))
    def test_empty_search_is_cached_and_resume_skips_it(self):
        class FakeRobots:
            def crawl_delay(self,agent):return 0
            def can_fetch(self,agent,url):return True
        with tempfile.TemporaryDirectory() as dirname:
            d=Path(dirname)
            args=SimpleNamespace(state=d/'state.json',directory=d/'shards',
                queries=['ฬ.*'],all_initials=False,run=True,
                permission_confirmed=True,legacy_tls=False,max_requests=1,
                max_depth=1,delay=20,max_bytes=1000000)
            got=[]
            def fake(url,ctx,max_bytes):
                got.append(url)
                return b'<html>Nothing found.</html>'
            state=crawl(args,request_fn=fake,robots_fn=lambda ctx:FakeRobots())
            self.assertEqual(state['queue'],[])
            self.assertEqual(state['results']['ฬ.*']['status'],'empty')
            state2=crawl(args,request_fn=fake,robots_fn=lambda ctx:FakeRobots())
            self.assertEqual(len(got),1)
            self.assertEqual(state2['queue'],[])
    def test_overflow_creates_resumable_queue(self):
        class FakeRobots:
            def crawl_delay(self,agent):return 0
            def can_fetch(self,agent,url):return True
        with tempfile.TemporaryDirectory() as dirname:
            d=Path(dirname)
            args=SimpleNamespace(state=d/'state.json',directory=d/'shards',
                queries=['ก.*'],all_initials=False,run=True,
                permission_confirmed=True,legacy_tls=False,max_requests=1,
                max_depth=1,delay=20,max_bytes=1000000)
            state=crawl(args,
                request_fn=lambda *unused:b'Excessive number of hits (14408, limit 2400). Try again.',
                robots_fn=lambda ctx:FakeRobots())
            self.assertEqual(state['results']['ก.*']['status'],'overflow')
            self.assertGreater(len(state['queue']),20)
            self.assertFalse(state['coverage_proven'])
    def test_url_encoding(self):
        self.assertIn('lang=Thai',make_url('ณ.*'))
        self.assertIn('%E0%B8%93',make_url('ณ.*'))

if __name__=='__main__': unittest.main()
