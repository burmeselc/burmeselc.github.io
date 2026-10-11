"""Preserve Shan parent cards while reviewing 1,000 semantic proposals."""
from collections import Counter
import json
from pathlib import Path
import re
import unittest

DATA = Path(__file__).resolve().parents[1] / "data"

def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))

class ShanSemanticThirdBatchTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = read("shan-extra-pack-2.json")[1000:2000]
        cls.a = read("shan-extra-semantic-review-3a.json")
        cls.b = read("shan-extra-semantic-review-3b.json")
        cls.rows = cls.a + cls.b
        cls.manifest = read("shan-extra-semantic-review-manifest-v3.json")
        cls.taxonomy = read("study-taxonomy-v1.json")
        cls.rules = read("shan-extra-semantic-cue-rules-v3.json")
        cls.valid_medium = {
            medium["id"]: major["id"] for major in cls.taxonomy["categories"]
            for medium in major["children"]
        }
        cls.valid_tags = {
            axis["axis"]: set(axis["values"]) for axis in cls.taxonomy["tag_axes"]
        }

    def test_complete_contiguous_nonoverlapping_batch(self):
        self.assertEqual(len(self.a), 500)
        self.assertEqual(len(self.b), 500)
        self.assertEqual(len(self.rows), 1000)
        self.assertEqual([r["rank"] for r in self.rows], list(range(7481, 8481)))
        ids = [r["parent_card_id"] for r in self.rows]
        self.assertEqual(len(set(ids)), 1000)
        previous = (read("shan-extra-semantic-review-1a.json")
                    + read("shan-extra-semantic-review-1b.json")
                    + read("shan-extra-semantic-review-2a.json")
                    + read("shan-extra-semantic-review-2b.json"))
        self.assertFalse(set(ids) & {r["parent_card_id"] for r in previous})

    def test_original_data_source_ids_immutable(self):
        for source, row in zip(self.source, self.rows):
            self.assertEqual(row["parent_card_id"], source["id"])
            self.assertEqual(row["shan"], source["shan"])
            self.assertEqual(row["rank"], source["rank"])
            self.assertEqual(row["source_gloss"], source["japanese_core"])
            self.assertEqual(row["source_definition"], source["source_definition"])
            self.assertEqual(row["source_row"], source["source_row"])
            self.assertEqual(row["pos_source"], source["game_pos"])
            self.assertEqual(row["source_record_ids"], [
                f'{source.get("source_file", "anki_shan_jpn.csv")}:{source["source_serial"]}'
            ])
            self.assertIsNone(row["pos_candidate"])
            self.assertIsNone(row["sense_id"])
            self.assertFalse(row["publishable_as_approved_sense"])
            self.assertEqual(row["editorial_review"], "machine-proposal-unverified")
            self.assertEqual(row["secondary_categories"], [])

    def test_category_evidence_codes_and_nonapproval(self):
        self.assertEqual(len(self.taxonomy["categories"]), 18)
        self.assertEqual(len(self.valid_medium), 82)
        self.assertEqual(
            {x["medium_id"] for x in self.rules["rules"]},
            set(self.valid_medium)
        )
        for r in self.rows:
            cs = r["category_candidates"]
            self.assertEqual(len({c["medium"] for c in cs}), len(cs))
            for c in cs:
                self.assertEqual(c["major"], self.valid_medium[c["medium"]])
                text = re.sub(r"（(?:語源[：等]|借用)[^）]{0,120}）",
                              "", r["source_gloss"]).strip()
                self.assertTrue(c["evidence"])
                for pattern in c["evidence"]:
                    self.assertIsNotNone(re.search(pattern, text),
                                         (r["rank"], pattern))
            if r["primary_medium"]:
                self.assertEqual(len(cs), 1)
                self.assertFalse(r["segmentation_candidates"])
                self.assertEqual(r["review_status"], "single-cue-provisional")
                self.assertEqual(r["primary_major"],
                                 self.valid_medium[r["primary_medium"]])
            else:
                self.assertIsNone(r["primary_major"])
                self.assertIn(r["review_status"], {
                    "pending-sense-boundary",
                    "ambiguous-multiple-category-cues",
                    "no-supported-category-cue",
                })

    def test_semicolon_fragments_are_only_hypotheses(self):
        has_segments = [r for r in self.rows if r["segmentation_candidates"]]
        self.assertEqual(len(has_segments), 72)
        self.assertEqual(sum(len(r["segmentation_candidates"])
                             for r in has_segments), 152)
        for r in has_segments:
            self.assertIsNone(r["primary_medium"])
            self.assertEqual(r["review_status"], "pending-sense-boundary")
            for i, segment in enumerate(r["segmentation_candidates"], 1):
                self.assertEqual(segment["segment_ordinal"], i)
                self.assertIsNone(segment["verified_sense_id"])
                self.assertTrue(segment["gloss_fragment"])
                self.assertEqual(
                    segment["status"],
                    "segmentation-proposal-not-a-validated-sense"
                )
                for c in segment["category_candidates"]:
                    self.assertEqual(c["major"], self.valid_medium[c["medium"]])

    def test_tags_valid_and_evidence_traced(self):
        for r in self.rows:
            self.assertEqual(set(r["tags"]), set(self.valid_tags))
            for axis, values in r["tags"].items():
                self.assertEqual(len(values), len(set(values)))
                self.assertTrue(set(values) <= self.valid_tags[axis])
            for e in r["tag_evidence"]:
                self.assertIn(e["value"], r["tags"][e["axis"]])
                self.assertTrue(e["cue"])
            if r["primary_medium"] is None:
                self.assertTrue(all(not x for x in r["tags"].values()))

    def test_lexical_cue_false_positive_regressions(self):
        rows = {r["rank"]: r for r in self.rows}
        self.assertEqual(rows[7482]["primary_medium"], "10.01")
        self.assertNotEqual(rows[7966]["primary_medium"], "11.01")
        self.assertEqual(rows[8094]["primary_medium"], "14.01")
        self.assertNotEqual(rows[8397]["primary_medium"], "06.03")
        self.assertNotEqual(rows[8432]["primary_medium"], "14.02")
        self.assertEqual(rows[8247]["primary_medium"], "14.01")

    def test_manifest_counts(self):
        m = self.manifest
        self.assertEqual(m["source_count"], 1000)
        self.assertEqual(m["source_rank_span"], [7481, 8480])
        self.assertEqual([x["count"] for x in m["parts"]], [500, 500])
        counts = dict(Counter(r["review_status"] for r in self.rows))
        self.assertEqual(m["stats"]["other"], counts)
        self.assertEqual(
            m["stats"]["primary_provisional"],
            counts["single-cue-provisional"]
        )
        self.assertEqual(m["stats"]["semicolon_parents"], 72)
        self.assertEqual(m["stats"]["segmentation_fragments"], 152)
        for axis in ("semantic_type", "feature", "field", "usage"):
            key = axis + ("_candidates" if axis == "semantic_type"
                          else "_tag_candidates")
            self.assertEqual(m["stats"][key],
                             sum(len(r["tags"][axis]) for r in self.rows))

if __name__ == "__main__":
    unittest.main()
