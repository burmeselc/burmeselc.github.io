"""Regression tests for non-destructive Shan semantic batch nine (1,000 parents)."""
import json
import re
import unittest
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"


def load(filename):
    return json.loads((DATA / filename).read_text(encoding="utf-8"))


def core(text):
    """Match the v4 candidate engine: parenthetical exemplification is not a headword."""
    return re.sub(r"\((?:語源|借用)[^)]*\)", "",
                  re.sub(r"（[^（）]*）", "", text)).strip()


class ShanExtraSemanticBatch9Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a = load("shan-extra-semantic-review-9a.json")
        cls.b = load("shan-extra-semantic-review-9b.json")
        cls.rows = cls.a + cls.b
        cls.source = load("shan-extra-pack-5.json")[:1000]
        cls.manifest = load("shan-extra-semantic-review-manifest-v9.json")
        cls.rules = load("shan-extra-semantic-cue-rules-v9.json")
        cls.tax = load("study-taxonomy-v1.json")
        cls.medium_major = {
            child["id"]: major["id"] for major in cls.tax["categories"]
            for child in major["children"]
        }
        cls.tags_allowed = {
            axis["axis"]: set(axis["values"]) for axis in cls.tax["tag_axes"]
        }
        cls.rule_by_medium = {r["medium_id"]: r for r in cls.rules["rules"]}

    def candidates(self, gloss):
        clean = core(gloss)
        candidates = []
        for medium, rule in self.rule_by_medium.items():
            m = re.search(rule["pattern"], clean)
            if not m or any(
                guard["medium_id"] == medium
                and re.search(guard["when"], gloss)
                for guard in self.rules["suppressions"]
            ):
                continue
            candidates.append({
                "medium": medium,
                "major": self.medium_major[medium],
                "evidence": [re.escape(m.group(0))],
            })
        return candidates

    def test_full_scope_rank_contiguity_and_unique_parents(self):
        self.assertEqual(len(self.a), 500)
        self.assertEqual(len(self.b), 500)
        self.assertEqual(len(self.rows), 1000)
        self.assertEqual([r["rank"] for r in self.rows], list(range(13481, 14481)))
        ids = [r["parent_card_id"] for r in self.rows]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(
            self.manifest["source_rank_span"], [13481, 14480]
        )
        earlier = []
        for batch in (1, 2, 3, 4, 5, 6, 7, 8):
            for part in ("a", "b"):
                earlier.extend(load(f"shan-extra-semantic-review-{batch}{part}.json"))
        self.assertTrue(set(ids).isdisjoint(
            r["parent_card_id"] for r in earlier
        ))
        self.assertEqual(len(earlier), 8000)

    def test_source_card_identity_gloss_pos_and_provenance_are_immutable(self):
        for card, row in zip(self.source, self.rows):
            with self.subTest(rank=card["rank"]):
                self.assertEqual(row["parent_card_id"], card["id"])
                self.assertEqual(row["rank"], card["rank"])
                self.assertEqual(row["shan"], card["shan"])
                self.assertEqual(row["source_row"], card["source_row"])
                self.assertEqual(row["source_gloss"], card["japanese_core"])
                self.assertEqual(row["source_definition"], card["source_definition"])
                self.assertEqual(row["pos_source"], card["game_pos"])
                self.assertEqual(row["source_record_ids"], [
                    f'{card.get("source_file", "anki_shan_jpn.csv")}:{card["source_serial"]}'
                ])
                self.assertIsNone(row["pos_candidate"])
                self.assertIsNone(row["sense_id"])
                self.assertEqual(row["secondary_categories"], [])
                self.assertFalse(row["publishable_as_approved_sense"])
                self.assertEqual(row["editorial_review"], "machine-proposal-unverified")

    def test_taxonomy_rules_and_traceable_candidates(self):
        self.assertEqual(len(self.tax["categories"]), 18)
        self.assertEqual(len(self.medium_major), 82)
        self.assertEqual(len(self.rule_by_medium), 82)
        self.assertEqual(set(self.rule_by_medium), set(self.medium_major))
        for r in self.rows:
            with self.subTest(rank=r["rank"]):
                cs = r["category_candidates"]
                self.assertEqual(cs, self.candidates(r["source_gloss"]))
                self.assertEqual(len(cs), len({c["medium"] for c in cs}))
                for c in cs:
                    self.assertEqual(c["major"], self.medium_major[c["medium"]])
                    for evidence in c["evidence"]:
                        self.assertIsNotNone(re.search(evidence, core(r["source_gloss"])))
                if r["primary_medium"] is not None:
                    self.assertEqual(len(cs), 1)
                    self.assertFalse(r["segmentation_candidates"])
                    self.assertEqual(r["primary_medium"], cs[0]["medium"])
                    self.assertEqual(r["primary_major"], cs[0]["major"])
                    self.assertEqual(r["review_status"], "single-cue-provisional")
                else:
                    self.assertIsNone(r["primary_major"])
                    self.assertIn(r["review_status"], (
                        "pending-sense-boundary",
                        "ambiguous-multiple-category-cues",
                        "no-supported-category-cue",
                    ))

    def test_semicolon_does_not_create_approved_senses(self):
        segmented = [r for r in self.rows if r["segmentation_candidates"]]
        self.assertEqual(len(segmented), 92)
        self.assertEqual(sum(len(r["segmentation_candidates"]) for r in segmented), 190)
        for r in self.rows:
            expected = [p.strip() for p in re.split(r"[；;]", r["source_gloss"]) if p.strip()]
            if not re.search(r"[；;]", r["source_gloss"]):
                self.assertEqual(r["segmentation_candidates"], [])
                continue
            self.assertIsNone(r["primary_medium"])
            self.assertEqual(r["review_status"], "pending-sense-boundary")
            self.assertEqual(len(r["segmentation_candidates"]), len(expected))
            for i, (part, text) in enumerate(zip(r["segmentation_candidates"], expected), 1):
                self.assertEqual(part["segment_ordinal"], i)
                self.assertEqual(part["gloss_fragment"], text)
                self.assertEqual(part["category_candidates"], self.candidates(text))
                self.assertIsNone(part["verified_sense_id"])
                self.assertEqual(part["status"], "segmentation-proposal-not-a-validated-sense")

    def test_tag_domain_and_evidence_consistency(self):
        tag_rules = {
            (rule["axis"], rule["value"]): rule
            for rule in self.rules["tag_rules"]
        }
        for r in self.rows:
            with self.subTest(rank=r["rank"]):
                self.assertEqual(set(r["tags"]), set(self.tags_allowed))
                if r["primary_medium"] is None:
                    self.assertFalse(any(r["tags"].values()))
                    self.assertEqual(r["tag_evidence"], [])
                for axis, values in r["tags"].items():
                    self.assertEqual(len(set(values)), len(values))
                    self.assertTrue(set(values) <= self.tags_allowed[axis])
                found = {(e["axis"], e["value"]) for e in r["tag_evidence"]}
                intended = {(axis, val) for axis, vals in r["tags"].items() for val in vals}
                self.assertEqual(found, intended)
                for e in r["tag_evidence"]:
                    rule = tag_rules[(e["axis"], e["value"])]
                    self.assertEqual(e["pattern"], rule["pattern"])
                    haystack = r["source_gloss"] if e["axis"] == "usage" else core(r["source_gloss"])
                    self.assertEqual(re.search(rule["pattern"], haystack).group(0), e["cue"])

    def test_v9_pack5_first_1000_and_part_boundary(self):
        self.assertEqual([r["rank"] for r in self.a], list(range(13481, 13981)))
        self.assertEqual([r["rank"] for r in self.b], list(range(13981, 14481)))
        self.assertEqual(self.a[-1]["parent_card_id"], self.source[499]["id"])
        self.assertEqual(self.b[0]["parent_card_id"], self.source[500]["id"])
        self.assertNotEqual(self.a[-1]["parent_card_id"], self.b[0]["parent_card_id"])

    def test_specific_v9_false_positive_protections(self):
        indexed = {r["rank"]: r for r in self.rows}
        expected = {
            13481: None,    # partially solidified is not part-whole lexeme
            13492: "05.01", # monastic attendant is a person
            13516: "12.01", # mythical kinnara not an ordinary animal
            13595: None,    # occupational/performing art collision held
            13603: "10.01", # photographer is profession
            13610: "10.01", # builder is profession, not construction activity
            13671: "12.03", # Burmese drum is musical object
            13682: "08.02", # cushion is household furnishing, not garment
            13786: None,    # なかご is tang, not かご basket
            13801: "03.02", # choking is bodily function
            13820: "02.04", # domestication rather than human referent
            13842: "07.01", # brass accessory is ornament not material
            13846: "11.04", # telecom hardware, not news/communication personnel
            13950: "11.01", # wooden mallet is a tool
            13962: "14.01", # course term is temporal phrase
            14019: None,    # silver can be finance or material
            14148: "13.01", # idiomatic interrupting speech, not physical insertion
            14230: None,    # 鎌をかける not literal agricultural sickle
            14336: "12.02", # officiating wedding as ceremony
            14474: "08.02", # writing desk not literary genre
            14480: "08.01", # roof overhang is architecture
        }
        for rank, medium in expected.items():
            with self.subTest(rank=rank):
                self.assertEqual(indexed[rank]["primary_medium"], medium)
        self.assertFalse(any(r["sense_id"] for r in self.rows))
        self.assertFalse(any(r["publishable_as_approved_sense"] for r in self.rows))

    def test_manifest_matches_derived_statistics(self):
        m = self.manifest
        self.assertEqual(m["batch"], 9)
        self.assertEqual(m["source_files"], [
            {"file": "shan-extra-pack-5.json", "slice_zero_based": [0, 1000],
             "count": 1000, "rank_span": [13481, 14480]},
        ])
        self.assertEqual(m["source_count"], 1000)
        self.assertEqual(sum(part["count"] for part in m["source_files"]), 1000)
        self.assertEqual(m["previous_review_manifest"],
                         "shan-extra-semantic-review-manifest-v8.json")
        self.assertEqual([x["count"] for x in m["parts"]], [500, 500])
        self.assertEqual(m["rules_file"], "shan-extra-semantic-cue-rules-v9.json")
        counts = dict(Counter(r["review_status"] for r in self.rows))
        s = m["stats"]
        self.assertEqual(s["other"], counts)
        self.assertEqual(s["primary_provisional"], counts["single-cue-provisional"])
        self.assertEqual(s["semicolon_parents"], 92)
        self.assertEqual(s["segmentation_fragments"], 190)
        for axis in self.tags_allowed:
            key = axis + ("_candidates" if axis == "semantic_type" else "_tag_candidates")
            self.assertEqual(s[key], sum(len(r["tags"][axis]) for r in self.rows))


if __name__ == "__main__":
    unittest.main()
