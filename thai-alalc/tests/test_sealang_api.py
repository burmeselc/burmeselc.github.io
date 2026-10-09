import unittest
import sys
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'scripts'))
from sealang_api_thai import parse_document,make_url

EXAMPLE='''<!DOCTYPE html><html><body>2 items found
<entry orthTarget="ณ"><formx id="TDP:6410">
<orth type="head">ณ</orth><pron written="ná">náʔ</pron></formx>
<sense n="1"><def>at, in</def></sense>
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
        self.assertEqual(rows[1]['thai'],'ณ บัดนี้')
        self.assertEqual(rows[1]['ipa'],'ná bàt níi')
    def test_no_empty_glosses(self):
        rows,count=parse_document(b'<html>Nothing found <entry><orth type="head">TEST</orth></entry></html>','test')
        self.assertEqual(rows,[])
        self.assertIsNone(count)
    def test_url_encoding(self):
        self.assertIn('lang=Thai',make_url('ณ.*'))
        self.assertIn('%E0%B8%93',make_url('ณ.*'))

if __name__=='__main__': unittest.main()
