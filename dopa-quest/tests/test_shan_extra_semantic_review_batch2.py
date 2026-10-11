"""Semantic review batch 2 stays source-preserving and non-publishable."""
from collections import Counter
import json
from pathlib import Path
import re
import unittest

DATA = Path(__file__).resolve().parents[1] / "data"


def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class ShanSemanticSecondBatchTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = read("shan-extra-pack-2.json")
        cls.prev = read("shan-extra-semantic-review-1a.json") + read("shan-extra-semantic-review-1b.json")
        cls.batch_a = read("shan-extra-semantic-review-2a.json")
        cls.batch_b = read("shan-extra-semantic-review-2b.json")
        cls.rows = cls.batch_a + cls.batch_b
        cls.manifest = read("shan-extra-semantic-review-manifest-v2.json")
        cls.taxonomy = read("study-taxonomy-v1.json")
        cls.rules = read("shan-extra-semantic-cue-rules-v2.json")
        cls.valid_medium = {
            sub["id"]: cat["id"]
            for cat in cls.taxonomy["categories"]
            for sub in cat["children"]
        }
        cls.valid_tags = {
            axis["axis"]: set(axis["values"])
            for axis in cls.taxonomy["tag_axes"]
        }

    def test_contiguous_500_by_500_batch_without_duplicate_parent_ids(self):
        self.assertEqual(len(self.batch_a), 500)
        self.assertEqual(len(self.batch_b), 500)
        self.assertEqual(len(self.rows), 1000)
        self.assertEqual([r["rank"] for r in self.rows], list(range(6481, 7481)))
        ids = [r["parent_card_id"] for r in self.rows]
        self.assertEqual(len(set(ids)), 1000)
        self.assertFalse(set(ids) & {r["parent_card_id"] for r in self.prev})

    def test_every_entry_preserves_published_parent_and_source(self):
        for src, row in zip(self.source[:1000], self.rows):
            self.assertEqual(row["parent_card_id"], src["id"])
            self.assertEqual(row["rank"], src["rank"])
            self.assertEqual(row["shan"], src["shan"])
            self.assertEqual(row["pos_source"], src["game_pos"])
            self.assertEqual(row["source_gloss"], src["japanese_core"])
            self.assertEqual(row["source_definition"], src["source_definition"])
            self.assertEqual(row["source_row"], src["source_row"])
            self.assertEqual(row["source_record_ids"], [
                f'{src.get("source_file", "anki_shan_jpn.csv")}:{src["source_serial"]}'
            ])
            self.assertIsNone(row["pos_candidate"])
            self.assertIsNone(row["sense_id"])
            self.assertEqual(row["editorial_review"], "machine-proposal-unverified")
            self.assertFalse(row["publishable_as_approved_sense"])
            self.assertEqual(row["secondary_categories"], [])

    def test_taxonomy_and_provisional_only(self):
        self.assertEqual(len(self.taxonomy["categories"]), 18)
        self.assertEqual(len(self.valid_medium), 82)
        self.assertEqual(
            {rule["medium_id"] for rule in self.rules["rules"]},
            set(self.valid_medium)
        )
        for r in self.rows:
            cms = r["category_candidates"]
            self.assertEqual(len({c["medium"] for c in cms}), len(cms))
            for candidate in cms:
                self.assertIn(candidate["medium"], self.valid_medium)
                self.assertEqual(candidate["major"], self.valid_medium[candidate["medium"]])
                self.assertTrue(candidate["evidence"])
                core = re.sub(
                    r"（(?:語源[：等]|借用)[^）]{0,120}）", "", r["source_gloss"]
                ).strip()
                for pattern in candidate["evidence"]:
                    self.assertIsNotNone(re.search(pattern, core), (r["rank"], pattern))
            if r["primary_medium"]:
                self.assertEqual(len(cms), 1)
                self.assertEqual(r["primary_major"], self.valid_medium[r["primary_medium"]])
                self.assertEqual(r["review_status"], "single-cue-provisional")
                self.assertFalse(r["segmentation_candidates"])
            else:
                self.assertIsNone(r["primary_major"])
                self.assertIn(r["review_status"], {
                    "pending-sense-boundary", "ambiguous-multiple-category-cues",
                    "no-supported-category-cue"
                })

    def test_unresolved_semicolon_segments_are_not_approved_senses(self):
        multi = [r for r in self.rows if r["segmentation_candidates"]]
        self.assertEqual(len(multi), 75)
        self.assertEqual(sum(len(r["segmentation_candidates"]) for r in multi), 160)
        for r in multi:
            self.assertIsNone(r["primary_medium"])
            self.assertEqual(r["review_status"], "pending-sense-boundary")
            for i, seg in enumerate(r["segmentation_candidates"], 1):
                self.assertEqual(seg["segment_ordinal"], i)
                self.assertTrue(seg["gloss_fragment"])
                self.assertIsNone(seg["verified_sense_id"])
                self.assertEqual(
                    seg["status"], "segmentation-proposal-not-a-validated-sense"
                )
                for c in seg["category_candidates"]:
                    self.assertEqual(c["major"], self.valid_medium[c["medium"]])

    def test_tag_evidence_validates_against_taxonomy(self):
        for r in self.rows:
            self.assertEqual(set(r["tags"]), set(self.valid_tags))
            for axis, tags in r["tags"].items():
                self.assertEqual(len(tags), len(set(tags)))
                self.assertTrue(set(tags).issubset(self.valid_tags[axis]))
            for e in r["tag_evidence"]:
                self.assertIn(e["axis"], r["tags"])
                self.assertIn(e["value"], r["tags"][e["axis"]])
                self.assertTrue(e["cue"])
            if not r["primary_medium"]:
                self.assertTrue(all(not tags for tags in r["tags"].values()))

    def test_no_obvious_broad_cue_regressions(self):
        by_rank = {r["rank"]: r for r in self.rows}
        # Nearness merely inside a parenthetical does not classify a sewage hole as space.
        self.assertNotEqual(by_rank[6557]["primary_medium"], "14.02")
        # 名声 is not the speech/voice category.
        self.assertNotEqual(by_rank[6620]["primary_medium"], "13.01")
        # 'Finish unfinished work' is not an occupation.
        self.assertNotEqual(by_rank[6654]["primary_medium"], "10.01")
        # A numeral denotes quantity, not a measure word.
        self.assertNotEqual(by_rank[6508]["primary_medium"], "17.05")

    def test_manifest_matches_real_data(self):
        self.assertEqual(self.manifest["source_count"], 1000)
        self.assertEqual(self.manifest["source_rank_span"], [6481, 7480])
        self.assertEqual([item["count"] for item in self.manifest["parts"]], [500, 500])
        counts = dict(Counter(r["review_status"] for r in self.rows))
        self.assertEqual(self.manifest["stats"]["other"], counts)
        self.assertEqual(self.manifest["stats"]["primary_provisional"],
                         counts.get("single-cue-provisional", 0))
        self.assertEqual(self.manifest["stats"]["semicolon_parents"], 75)
        self.assertEqual(self.manifest["stats"]["segmentation_fragments"], 160)
        for axis in ("feature", "field", "usage", "semantic_type"):
            key = axis + ("_candidates" if axis == "semantic_type"
                          else "_tag_candidates")
            self.assertEqual(
                self.manifest["stats"][key],
                sum(len(r["tags"][axis]) for r in self.rows)
            )


if __name__ == "__main__":
    unittest.main()
