import csv
import json
import tempfile
import unittest
from pathlib import Path
from sys import path

BASE=Path(__file__).resolve().parents[1]
path.insert(0,str(BASE/'scripts'))
from audit_candidates import audit,classify,load_records
from build_dictionary import make_entries

class LexiconAuditTests(unittest.TestCase):
    def test_consistency_does_not_claim_accuracy(self):
        agree=classify({'thai':'ไก่','ipa':'kài','source_id':'test-1'})
        self.assertEqual(agree['comparison'],'agreement')
        self.assertNotIn('accurate',agree)
        conflict=classify({'thai':'ไก่','ipa':'kɔɔ','source_id':'test-2'})
        self.assertEqual(conflict['comparison'],'disagreement')
        report=audit([{'thai':'ไก่','ipa':'kài','source_id':'test-1'}])
        self.assertEqual(report['summary']['sample_size'],1)
        self.assertFalse(report['summary']['complete_dictionary'])

    def test_deduplicate_repeated_source_ids_with_enriched_senses(self):
        with tempfile.TemporaryDirectory() as dirname:
            directory=Path(dirname)
            headers=['thai','meaning','ipa','source','source_id','senses_json','pos','web_rank']
            for idx,senses in enumerate(['','[{"n":"1","pos":["V"],"definitions":["work"]}]']):
                with (directory/f'{idx}.csv').open('w',encoding='utf-8',newline='') as file:
                    writer=csv.DictWriter(file,fieldnames=headers)
                    writer.writeheader()
                    writer.writerow({'thai':'ไก่','meaning':'chicken','ipa':'kài',
                        'source':'SEAlang Thai / TDP','source_id':'TDP:1',
                        'senses_json':senses,'pos':'V' if senses else '',
                        'web_rank':'3' if senses else ''})
            records=load_records(directory)
            self.assertEqual(len(records),1)
            self.assertTrue(records[0]['senses_json'])
            entries=make_entries(BASE/'data/seed.json',directory)
            records=[e for e in entries if e.get('source_id')=='TDP:1']
            self.assertEqual(len(records),1)
            self.assertEqual(records[0]['senses'][0]['pos'],['V'])
            self.assertEqual(records[0]['web_rank'],'3')
            self.assertEqual(records[0]['roman_evidence'],'agreement')

if __name__=='__main__':
    unittest.main()
