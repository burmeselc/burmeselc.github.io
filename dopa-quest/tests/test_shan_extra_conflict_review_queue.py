"""Queue integrity for 637 unresolved Shan medium-category conflicts."""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/"data"

def read(name):
    return json.loads((ROOT/name).read_text(encoding="utf-8"))

class ShanConflictQueueIntegrity(unittest.TestCase):
    def test_all_conflicts_are_exact_source_preserving_and_unapproved(self):
        manifest=read("shan-extra-conflict-review-manifest-v1.json")
        sources={}
        for batch in range(1,13):
            for suffix in "ab":
                for record in read(f"shan-extra-semantic-review-{batch}{suffix}.json"):
                    if record["review_status"]=="ambiguous-multiple-category-cues":
                        self.assertNotIn(record["parent_card_id"],sources)
                        sources[record["parent_card_id"]]=record
        seen=set()
        stats={"same_major_only":0,"cross_major":0,"shared_cue_collisions":0,
               "distinct_cues":0,"three_plus_candidate_media":0}
        for shard in manifest["shards"]:
            data=read(shard["file"])
            self.assertEqual(data["schema"],"dopa-shan-extra-conflict-review-queue-v1")
            self.assertEqual(data["state"],"review-queue-unverified")
            self.assertEqual(len(data["rows"]),shard["count"])
            for r in data["rows"]:
                src=sources[r["parent_card_id"]]
                self.assertNotIn(r["parent_card_id"],seen)
                seen.add(r["parent_card_id"])
                self.assertEqual((r["rank"],r["shan"],r["source_gloss"],r["pos_source"],
                                  r["source_record_ids"],r["candidates"]),
                                 (src["rank"],src["shan"],src["source_gloss"],src["pos_source"],
                                  src["source_record_ids"],src["category_candidates"]))
                self.assertIsNone(r["primary_medium"])
                self.assertIsNone(r["verified_sense_id"])
                self.assertFalse(r["publishable_as_approved_sense"])
                self.assertEqual(r["editorial_review"],"machine-proposal-unverified")
                self.assertEqual(r["decision_status"],"pending-conflict-review")
                cs=r["candidates"]
                self.assertGreaterEqual(len(cs),2)
                majors={c["major"] for c in cs}
                stats["same_major_only" if len(majors)==1 else "cross_major"]+=1
                if len(cs)>=3: stats["three_plus_candidate_media"]+=1
                cues=[e for c in cs for e in c["evidence"]]
                stats["shared_cue_collisions" if len(set(cues))<len(cues) else "distinct_cues"]+=1
        self.assertEqual(seen,set(sources))
        self.assertEqual(len(seen),637)
        self.assertEqual(manifest["total_conflicting_parents"],637)
        self.assertEqual(stats,manifest["audit"])

if __name__=="__main__":
    unittest.main()
