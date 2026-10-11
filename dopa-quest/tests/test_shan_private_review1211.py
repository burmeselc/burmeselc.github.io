#!/usr/bin/env python3
"""Offline regression checks for the private Shan review preparation script."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepare-shan-private-review1211.py"
spec = importlib.util.spec_from_file_location("shan_private_review", SCRIPT)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


def row(pos, gloss="食べる", reason="nonstandard-pos", entries=1):
    return {
        "index": "7", "source_headword_nfc": "ၵိၼ်", "first_source_row": "8",
        "source_rows": "8", "source_entry_count": str(entries),
        "raw_pos_labels": pos, "source_japanese_candidates": gloss,
        "primary_review_reason": reason,
        "recommended_action": "confirm", "decision": "pending",
        "approved_gloss": "", "approved_pos": "", "sense_split": "",
        "major_categories": "", "medium_categories": "",
        "tags": "", "review_notes": "",
    }


class TestReviewProposals(unittest.TestCase):
    def test_english_label_is_only_a_proposal(self):
        before = row("noun", "学校")
        after = tool.assess(before)
        self.assertEqual(after["pos_normalization_candidate"], "名詞")
        self.assertEqual(after["pos_candidate_basis"], "exact-pos-label-only")
        self.assertEqual(after["independent_linguistic_review"], "not-reviewed")
        self.assertEqual(after["decision"], "pending")
        self.assertEqual(after["approved_pos"], "")
        self.assertEqual(before["approved_pos"], "")

    def test_descriptive_verb_not_forced_to_adjective(self):
        after = tool.assess(row("動詞（記述）", "赤い"))
        self.assertEqual(after["pos_normalization_candidate"], "動詞")
        self.assertIn("descriptive-source-label", after["grammatical_tag_candidates"])
        self.assertEqual(after["independent_linguistic_review"], "not-reviewed")

    def test_ambiguous_pos_and_multi_entry_not_collapsed(self):
        after = tool.assess(row("動詞/形容詞", "始める；【名詞】始まり", "multi-entry", 2))
        self.assertEqual(after["pos_normalization_candidate"], "")
        self.assertEqual(after["sense_structure_candidate"], "inspect-separate-source-entries")
        self.assertIn("multiple-source-entries", after["review_flags"])
        self.assertIn("embedded-pos-or-sense-label", after["review_flags"])

    def test_variant_reference_remains_unresolved(self):
        after = tool.assess(row("", "別形態 [[alternate form]]", "variant-reference"))
        self.assertEqual(after["pos_normalization_candidate"], "")
        self.assertEqual(after["sense_split"], "")
        self.assertEqual(after["decision"], "pending")
        self.assertIn("source-verification-required", after["review_flags"])

    def test_transitivity_metadata_is_separate(self):
        after = tool.assess(row("他動詞", "切る"))
        self.assertEqual(after["pos_normalization_candidate"], "動詞")
        self.assertEqual(after["grammatical_tag_candidates"], "transitivity:transitive")
        self.assertEqual(after["tags"], "")


if __name__ == "__main__":
    unittest.main()
