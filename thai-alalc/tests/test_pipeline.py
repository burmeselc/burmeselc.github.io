import csv
import tempfile
import unittest
from pathlib import Path
from sys import path
BASE=Path(__file__).resolve().parents[1]
path.insert(0,str(BASE/'scripts'))
from ipa_candidates import candidate_from_ipa
from romanize import guess_word
from build_dictionary import make_entries
from sealang_batch import planned_query_urls,extract_entries,report_count

class ThaiDictionaryTests(unittest.TestCase):
    def test_simple_syllables(self):
        for thai,expected in [('ผ้า','phā'),('ฆ่า','khā'),('พา','phā'),
                              ('คน','khon'),('ขน','khon'),('ค่า','khā'),
                              ('ไก่','kai'),('กา','kā'),('นก','nok'),('แม่น','mǣn')]:
            with self.subTest(thai=thai):
                self.assertEqual(guess_word(thai),expected)
    def test_irregular_unresolved(self):
        for word in ('วัฒนธรรม','สวรรค์','มหาวิทยาลัย',''):
            self.assertIsNone(guess_word(word))
    def test_seed_and_reverse_collision(self):
        data=make_entries(BASE/'data/seed.json')
        self.assertEqual(len(data),25)
        self.assertTrue(any(x['thai']=='ภาษา' and x['alalc']=='phāsā' for x in data))
        self.assertEqual(sum(x['alalc']=='khā' for x in data),3)
    def test_import_review_status_and_gloss(self):
        with tempfile.TemporaryDirectory() as t:
            src=Path(t)/'lexicon.csv'
            with src.open('w',encoding='utf-8',newline='') as f:
                w=csv.DictWriter(f,fieldnames=['thai','meaning','ipa','source','alalc','verified'])
                w.writeheader()
                w.writerow({'thai':'ไก่','meaning':'chicken','source':'test'})
                w.writerow({'thai':'พิเศษ','meaning':'special'})
            data=make_entries(BASE/'data/seed.json',src)
            self.assertEqual(next(x for x in data if x['thai']=='ไก่')['status'],'tentative')
            self.assertEqual(next(x for x in data if x['thai']=='พิเศษ')['status'],'unresolved')
            self.assertEqual(next(x for x in data if x['thai']=='ไก่')['meaning'],'chicken')
    def test_ipa_roman_candidates(self):
        self.assertEqual(candidate_from_ipa('pʰaa-sǎa'),'phāsā')
        self.assertEqual(candidate_from_ipa('ˈkʰon'),'khon')
        self.assertEqual(candidate_from_ipa('saˈmɔ̌ɔ'),'samǭ')
        self.assertIsNone(candidate_from_ipa('something~else'))

    def test_incremental_preservation(self):
        with tempfile.TemporaryDirectory() as t:
            src=Path(t)/'new.csv'
            with src.open('w',encoding='utf-8',newline='') as f:
                w=csv.DictWriter(f,fieldnames=['thai','meaning','ipa','source','source_id'])
                w.writeheader()
                w.writerow({'thai':'ภาษา','meaning':'N: a natural language','ipa':'pʰaa-sǎa','source':'SEAlang Thai','source_id':'TDP:13753'})
            old=Path(t)/'previous.json'
            old.write_text(__import__('json').dumps([{'thai':'ภาษาจีน','alalc':'phāsāčhīn','meaning':'Chinese',
                'source':'legacy','status':'reviewed'}],ensure_ascii=False),encoding='utf-8')
            data=make_entries(BASE/'data/seed.json',src,old)
            self.assertTrue(any(x['thai']=='ภาษาจีน' for x in data))
            row=next(x for x in data if x.get('source_id')=='TDP:13753')
            self.assertEqual(row['alalc'],'phāsā')
            self.assertEqual(row['status'],'tentative')

    def test_api_url_and_xml_extract(self):
        urls=planned_query_urls(['ภาษา'])
        self.assertEqual(len(urls),1)
        self.assertIn('lang=Thai',urls[0][1])
        self.assertIn('query=',urls[0][1])
        html='''<html><body><p>1 items found</p>
        <entry orthTarget="ภาษา">
          <formx id="TDP:1"><orth type="head">ภาษา</orth><pron written="pʰaa-sǎa">pʰaa sǎa</pron></formx>
          <sense n="1"><num>1</num><pos>N</pos><def>language, speech</def></sense>
        </entry></body></html>'''
        self.assertEqual(report_count(html),1)
        result=extract_entries(html,'ภาษา')
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['thai'],'ภาษา')
        self.assertEqual(result[0]['ipa'],'pʰaa-sǎa')
        self.assertEqual(result[0]['meaning'],'N: language, speech')
        self.assertEqual(result[0]['source_id'],'TDP:1')

if __name__=='__main__':unittest.main()
