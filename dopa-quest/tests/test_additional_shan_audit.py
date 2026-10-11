"""Regression tests for an untrusted extra Anki CSV import (no production writes)."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "audit-additional-shan.py"
SPEC = importlib.util.spec_from_file_location("additional_shan_audit", MODULE_PATH)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class CsvAdditionTests(unittest.TestCase):
    def setUp(self):
        self.parents = [
            {"id": "shn:one", "shan": "တီႈ", "japanese_core": "場所"},
            {"id": "shn:two", "shan": "ၼၼ်ႉ", "japanese_core": "それ"},
        ]
        self.senses = [
            {"id": "shn:one:sense:01", "parent_id": "shn:one", "shan": "တီႈ",
             "japanese_core": "場所"},
            {"id": "shn:one:sense:02", "parent_id": "shn:one", "shan": "တီႈ",
             "japanese_core": "～で"},
        ]

    def test_all_outcomes_and_provenance_without_generating_ids(self):
        p0 = json.dumps(self.parents, ensure_ascii=False)
        s0 = json.dumps(self.senses, ensure_ascii=False)
        rows = [
            ["1", "တီႈ", "場所", "名詞"],
            ["1", "တီႈ", "～で", "前置詞"],
            ["1", "တီႈ", "新たな意味", "動詞"],
            ["2", "新語", "新しい訳", "名詞"],
            ["3", "新語", "新しい訳", "名詞"],
            ["4", "", "語義", "名詞"],
            ["5", "空訳", "", "名詞"],
            ["6", "新語", "別の訳", "動詞"],
        ]
        audit = AUDIT.audit_rows(rows, self.parents, self.senses, 1, 2, 3)
        self.assertEqual(audit["counts"]["source_rows"], 8)
        self.assertEqual([r["status"] for r in audit["records"]], [
            "existing-gloss-exact", "existing-gloss-exact", "existing-form-review",
            "new-form-candidate", "duplicate-source", "hold-incomplete",
            "hold-incomplete", "new-form-candidate",
        ])
        self.assertEqual(audit["records"][4]["duplicates_source_row"], 4)
        self.assertEqual(audit["records"][0]["matching_parent_ids"], ["shn:one"])
        self.assertEqual(audit["records"][1]["matching_sense_ids"],
                         ["shn:one:sense:01", "shn:one:sense:02"])
        self.assertEqual(audit["counts"]["new_form_candidates"], 1)
        for row in audit["records"]:
            self.assertFalse(row["approved"])
            self.assertIsNone(row["new_id"])
            self.assertEqual(row["raw_fields"], rows[row["source_row"] - 1])
        self.assertEqual(json.dumps(self.parents, ensure_ascii=False), p0)
        self.assertEqual(json.dumps(self.senses, ensure_ascii=False), s0)

    def test_unicode_nfc_does_not_remove_distinct_marks(self):
        composed = "é"
        decomposed = "e\u0301"
        rows = [[decomposed, "same"], [composed, "same"],
                ["A\u200dB", "different"], ["AB", "different"]]
        audit = AUDIT.audit_rows(rows, [], [], 0, 1)
        self.assertEqual(audit["counts"]["distinct_nfc_headwords"], 3)
        self.assertEqual(audit["records"][1]["status"], "duplicate-source")
        self.assertNotEqual(audit["records"][2]["shan"], audit["records"][3]["shan"])

    def test_missing_columns_and_named_headers(self):
        self.assertEqual(AUDIT.column_index("日本語訳", ["単語", "日本語訳"]), 1)
        self.assertEqual(AUDIT.column_index("2", None), 1)
        with self.assertRaises(ValueError):
            AUDIT.column_index("日本語訳", None)
        with self.assertRaises(ValueError):
            AUDIT.column_index("0", ["単語"])
        audit = AUDIT.audit_rows([["語形"], []], [], [], 0, 2)
        self.assertEqual(audit["counts"]["by_status"]["hold-incomplete"], 2)

    def test_exact_gloss_is_only_an_candidate_not_a_verified_semantic_merge(self):
        audit = AUDIT.audit_rows([["တီႈ", "場所"]], self.parents, self.senses, 0, 1)
        item = audit["records"][0]
        self.assertEqual(item["status"], "existing-gloss-exact")
        self.assertIn("確証ではない", item["reason"])
        self.assertFalse(item["approved"])

    def test_source_parser_preserves_duplicate_serials_and_irregular_width(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "original.csv"
            path.write_text(
                "番号,原語,日本語\n7,တီႈ,場所\n7,新語,意味,余分な列\n", encoding="utf-8"
            )
            rows = AUDIT.read_csv(path)
            self.assertEqual(len(rows), 3)
            self.assertEqual(rows[2][3], "余分な列")
            self.assertEqual(AUDIT.column_index("原語", rows[0]), 1)

    def test_actual_numbered_anki_layout_keeps_definition_commas_and_serial_collisions(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "anki_shan_jpn.csv"
            file.write_text(
                '1. တီႈ, 【動詞】 前段、後段 [first, second]\\n'
                '2. ၵတ်း, 【形容詞】 寒い [cold]\\n'
                '2: ၵတ်း, 【動詞】 噛む [bite, chew]\\n',
                encoding="utf-8"
            )
            rows = AUDIT.read_numbered_anki(file)
            self.assertEqual(len(rows), 3)
            self.assertEqual(rows[0], ["တီႈ", " 【動詞】 前段、後段 [first, second]", "1"])
            self.assertEqual(rows[1][2], rows[2][2])
            report = AUDIT.audit_rows(rows, self.parents, self.senses, 0, 1)
            self.assertEqual(report["counts"]["source_rows"], 3)
            self.assertEqual(report["counts"]["by_status"]["existing-form-review"], 1)
            self.assertEqual(report["counts"]["by_status"]["new-form-candidate"], 2)
            self.assertEqual(report["counts"]["by_status"]["new-form-candidate"]+
                             report["counts"]["by_status"]["existing-form-review"]+
                             report["counts"]["by_status"]["hold-incomplete"],3)


if __name__ == "__main__":
    unittest.main()
