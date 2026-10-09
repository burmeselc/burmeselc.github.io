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
from sealang_batch import planned_urls

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
        self.assertIsNone(candidate_from_ipa('two~pronunciations'))

    def test_collector_rejects_untrusted_hosts(self):
        self.assertEqual(len(planned_urls('https://sealang.net/results?query={query}',4)),4)
        with self.assertRaises(ValueError):
            planned_urls('https://example.com/?query={query}',4)

if __name__=='__main__':unittest.main()
