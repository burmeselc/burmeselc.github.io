"""Review-only Shan semantic batch 1: preservation and taxonomy integrity."""
import json
from collections import Counter
from pathlib import Path
import re
import unittest

DATA = Path(__file__).resolve().parents[1] / "data"

def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))

class SemanticReviewBatchOneTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = read("shan-extra-pilot-1.json")
        cls.tax = read("study-taxonomy-v1.json")
        cls.rules = read("shan-extra-semantic-cue-rules-v1.json")
        cls.manifest = read("shan-extra-semantic-review-manifest-v1.json")
        cls.rows = read("shan-extra-semantic-review-1a.json") + read("shan-extra-semantic-review-1b.json")
        cls.major_by_medium = {
            child["id"]: major["id"]
            for major in cls.tax["categories"]
            for child in major["children"]
        }
        cls.rule_by_medium = {r["medium_id"]: r for r in cls.rules["rules"]}
        cls.valid_tags = {
            axis["axis"]: set(axis["values"]) for axis in cls.tax["tag_axes"]
        }

    def test_1000_exact_original_parents_without_minted_senses(self):
        self.assertEqual(len(self.rows), 1000)
        self.assertEqual(len(self.source), 1000)
        self.assertEqual(len({r["parent_card_id"] for r in self.rows}), 1000)
        self.assertEqual([r["rank"] for r in self.rows], list(range(5481, 6481)))
        for source, row in zip(self.source, self.rows):
            self.assertEqual(row["parent_card_id"], source["id"])
            self.assertEqual(row["shan"], source["shan"])
            self.assertEqual(row["source_gloss"], source["japanese_core"])
            self.assertEqual(row["pos_source"], source["game_pos"])
            self.assertEqual(row["source_record_ids"], [
                f'{source.get("source_file", "anki_shan_jpn.csv")}:{source["source_serial"]}'
            ])
            self.assertIsNone(row["sense_id"])
            self.assertFalse(row["publishable_as_approved_sense"])
            self.assertEqual(row["editorial_review"], "machine-proposal-unverified")
            self.assertEqual(row["secondary_categories"], [])

    def test_only_one_supported_taxonomy_code_per_provisional_assignment(self):
        self.assertEqual(len(self.major_by_medium), 82)
        self.assertEqual(len(self.tax["categories"]), 18)
        self.assertEqual(set(self.rule_by_medium), set(self.major_by_medium))
        for row in self.rows:
            candidates = row["category_candidates"]
            mediums = [c["medium"] for c in candidates]
            self.assertEqual(len(mediums), len(set(mediums)))
            for candidate in candidates:
                self.assertEqual(
                    candidate["major"], self.major_by_medium[candidate["medium"]]
                )
                self.assertTrue(candidate["evidence"])
                for cue in candidate["evidence"]:
                    cleaned = re.sub(
                        r"（(?:語源[：等]|借用)[^）]{0,120}）",
                        "", row["source_gloss"]
                    )
                    self.assertIsNotNone(re.search(cue, cleaned), (row["rank"], cue))
            if row["primary_medium"] is not None:
                self.assertEqual(len(candidates), 1)
                self.assertEqual(row["review_status"], "single-cue-provisional")
                self.assertEqual(row["primary_major"],
                                 self.major_by_medium[row["primary_medium"]])
                self.assertFalse(row["segmentation_candidates"])
            else:
                self.assertIsNone(row["primary_major"])
                self.assertIn(row["review_status"], {
                    "pending-sense-boundary", "ambiguous-multiple-category-cues",
                    "no-supported-category-cue"
                })

    def test_ambiguous_semicolon_entries_remain_unpublished(self):
        multi = [r for r in self.rows if r["segmentation_candidates"]]
        self.assertEqual(len(multi), 79)
        self.assertEqual(sum(len(r["segmentation_candidates"]) for r in multi), 173)
        for r in multi:
            self.assertIsNone(r["primary_medium"])
            self.assertEqual(r["review_status"], "pending-sense-boundary")
            for i, segment in enumerate(r["segmentation_candidates"], 1):
                self.assertEqual(segment["segment_ordinal"], i)
                self.assertTrue(segment["gloss_fragment"])
                self.assertIsNone(segment["verified_sense_id"])
                self.assertEqual(
                    segment["status"], "segmentation-proposal-not-a-validated-sense"
                )

    def test_valid_tag_axes_and_explicit_evidence(self):
        for row in self.rows:
            self.assertEqual(set(row["tags"]), set(self.valid_tags))
            for axis, values in row["tags"].items():
                self.assertEqual(len(set(values)), len(values))
                self.assertTrue(set(values) <= self.valid_tags[axis])
            for tag in row["tag_evidence"]:
                self.assertIn(tag["value"], row["tags"][tag["axis"]])
                self.assertTrue(tag["cue"])
            if row["primary_medium"] is None:
                self.assertTrue(all(not values for values in row["tags"].values()))

    def test_manifest_counts_match_data(self):
        m = self.manifest
        self.assertEqual(m["source_count"], 1000)
        self.assertEqual([part["count"] for part in m["parts"]], [500, 500])
        c = Counter(x["review_status"] for x in self.rows)
        self.assertEqual(dict(c), m["stats"]["other"])
        self.assertEqual(c["single-cue-provisional"], m["stats"]["primary_provisional"])
        self.assertEqual(m["stats"]["semicolon_parents"], 79)
        self.assertEqual(m["stats"]["segmentation_fragments"], 173)

if __name__ == "__main__":
    unittest.main()
