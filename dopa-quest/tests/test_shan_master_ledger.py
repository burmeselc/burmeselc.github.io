"""Read-only guard tests for source line identity and non-semantic equivalence."""
from __future__ import annotations
import importlib.util
import tempfile
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'build-shan-master-ledger.py'
if not SCRIPT.exists():
    SCRIPT = Path(__file__).with_name('build_shan_master_ledger.py')
spec = importlib.util.spec_from_file_location('shan_master_ledger', SCRIPT)
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)

class LedgerSourceTest(unittest.TestCase):
    def test_original_commas_serial_collisions_and_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'anki.csv'
            p.write_text('7. ၵႂႃႇ, 【動詞】 行く、進む [go, move]\n'
                         '7. ၵိၼ်, 【動詞】 食べる [eat]\n',encoding='utf-8')
            rows=ledger.parse_anki(p)
            self.assertEqual(len(rows), 2)
            self.assertEqual([r['source_row'] for r in rows],[1,2])
            self.assertEqual([r['source_serial'] for r in rows],[7,7])
            self.assertEqual(rows[0]['japanese_source_candidate'],'行く、進む')
            self.assertIn('[go, move]',rows[0]['raw_definition'])
            self.assertEqual(rows[0]['source_pos'],'動詞')

    def test_normalization_preserves_significant_shan_marks(self):
        self.assertEqual(ledger.nfc(' é '),'é')
        self.assertNotEqual(ledger.nfc('A\u200dB'),ledger.nfc('AB'))
        self.assertEqual(ledger.match_gloss('  a   b  '),'a b')

    def test_variant_flag_does_not_assume_semantic_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'a.csv'
            p.write_text('1. ၵႂႃႇ, 【動詞】 別形を参照 [variant of ...]\n',encoding='utf-8')
            self.assertTrue(ledger.parse_anki(p)[0]['source_is_variant_reference'])

    def test_fallback_pilot_serial_index(self):
        import base64
        raw=bytes([1]+[1]*999)
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'index.txt'
            p.write_text(base64.b64encode(raw).decode())
            got=ledger.read_reference_pilot_indexes(p)
            self.assertEqual(len(got),1000)
            self.assertIn(1000,got)

if __name__=='__main__':unittest.main()