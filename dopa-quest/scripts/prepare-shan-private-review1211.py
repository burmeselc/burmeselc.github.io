#!/usr/bin/env python3
"""Prepare conservative, PRIVATE review batches for 1,211 unpublished Shan forms.

This script does not publish cards, assign senses, resolve variants, or modify
existing IDs/history. Keep the input and outputs outside the Git worktree.

Example:
  python3 dopa-quest/scripts/prepare-shan-private-review1211.py \
    --queue /private/DOPA_QUEST_Shan_unpublished_review_queue_1211_20261011.csv \
    --out-dir /private/shan-review-1211
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
import json
from pathlib import Path
import unicodedata

EXPECTED_REASONS = {
    "nonstandard-pos": 713,
    "multi-entry": 196,
    "other-hold": 184,
    "gloss-length": 83,
    "malformed-gloss": 17,
    "quoted-gloss": 8,
    "variant-reference": 5,
    "ellipsis": 4,
    "mixed-script": 1,
}
# Exact display-label translations only, NOT verified lexical analyses.
EXACT_POS = {
    "noun": ("名詞", ""),
    "verb": ("動詞", ""),
    "adverb": ("副詞", ""),
    "間投詞": ("感動詞", ""),
    "他動詞": ("動詞", "transitivity:transitive"),
    "自動詞": ("動詞", "transitivity:intransitive"),
}
# Retain the source distinction between descriptive predicates and adjectives.
DESCRIPTIVE = {
    "動詞（記述）", "動詞（記述的）", "動詞（形容的）",
    "動詞（形質）", "動詞（形容詞的）", "動詞（状態）",
    "verb, descriptive", "形質動詞",
}
ADDED = (
    "pos_normalization_candidate", "pos_candidate_basis",
    "grammatical_tag_candidates", "review_bucket", "review_flags",
    "sense_structure_candidate", "independent_linguistic_review",
)


def assess(row: dict[str, str]) -> dict[str, str]:
    """Add non-destructive editorial proposals; all approvals stay unchanged."""
    result = dict(row)
    source = row["raw_pos_labels"].strip()
    reason = row["primary_review_reason"]
    entry_count = int(row["source_entry_count"])
    gloss = row["source_japanese_candidates"]
    flags: list[str] = []
    proposal = ""
    tag = ""
    basis = "none"
    if reason == "nonstandard-pos" and source in EXACT_POS:
        proposal, tag = EXACT_POS[source]
        basis = "exact-pos-label-only"
        bucket = "1-exact-label-proposal"
    elif reason == "nonstandard-pos" and source in DESCRIPTIVE:
        proposal = "動詞"
        tag = "predicate:descriptive-source-label"
        basis = "source-descriptive-predicate-label; human confirmation required"
        bucket = "2-descriptive-predicate-proposal"
    elif reason == "multi-entry" or entry_count > 1:
        bucket = "3-multiple-source-entries"
    elif reason == "nonstandard-pos" and not source:
        bucket = "4-missing-source-pos"
    else:
        bucket = "5-other-holds"
    if entry_count > 1:
        flags.append("multiple-source-entries")
    if not source:
        flags.append("missing-pos-label")
    if "【" in gloss:
        flags.append("embedded-pos-or-sense-label")
    if "[[" in gloss or "]]" in gloss:
        flags.append("unparsed-source-comment")
    if reason in {"variant-reference", "ellipsis", "malformed-gloss", "mixed-script"}:
        flags.append("source-verification-required")
    if " | " in gloss or "；" in gloss:
        flags.append("multiple-gloss-segments-possible")
    result.update({
        "pos_normalization_candidate": proposal,
        "pos_candidate_basis": basis,
        "grammatical_tag_candidates": tag,
        "review_bucket": bucket,
        "review_flags": "|".join(flags),
        "sense_structure_candidate": "inspect-separate-source-entries" if entry_count > 1 else (
            "inspect-inline-senses" if "embedded-pos-or-sense-label" in flags else ""),
        "independent_linguistic_review": "not-reviewed",
    })
    # This utility must never silently approve any meaning, variant or category.
    for key in ("decision", "approved_gloss", "approved_pos", "sense_split",
                "major_categories", "medium_categories", "tags"):
        assert result[key] == row[key], f"modified protected field: {key}"
    return result


def load_queue(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        names = reader.fieldnames or []
        required = {
            "index", "source_headword_nfc", "source_entry_count",
            "raw_pos_labels", "source_japanese_candidates",
            "primary_review_reason", "decision", "approved_gloss",
            "approved_pos", "sense_split", "major_categories",
            "medium_categories", "tags",
        }
        if not required.issubset(names):
            raise ValueError(f"review queue columns missing: {sorted(required - set(names))}")
        rows = list(reader)
    if len(rows) != 1211:
        raise ValueError(f"expected 1211 unique forms; got {len(rows)}")
    counts = Counter(r["primary_review_reason"] for r in rows)
    if dict(counts) != EXPECTED_REASONS:
        raise ValueError(f"review reason totals changed: {dict(counts)}")
    if len({r["index"] for r in rows}) != 1211:
        raise ValueError("non-unique review indices")
    if len({r["source_headword_nfc"] for r in rows}) != 1211:
        raise ValueError("non-unique Shan headwords")
    if any(unicodedata.normalize("NFC", r["source_headword_nfc"]) != r["source_headword_nfc"] for r in rows):
        raise ValueError("source headword is not NFC")
    return rows, names


def write_csv(path: Path, rows: list[dict[str, str]], columns: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def out_of_git(path: Path) -> bool:
    directory = path.resolve()
    return not any((parent / ".git").exists() for parent in (directory, *directory.parents))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--queue", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, required=True)
    p.add_argument("--batch-size", type=int, default=500)
    args = p.parse_args()
    if args.batch_size < 1:
        p.error("--batch-size must be positive")
    if not out_of_git(args.out_dir):
        p.error("PRIVATE review outputs must be outside every Git worktree")
    originals, columns = load_queue(args.queue)
    enriched = [assess(r) for r in originals]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    export_columns = columns + [c for c in ADDED if c not in columns]
    write_csv(args.out_dir / "shan-review-1211-proposals.csv", enriched, export_columns)
    priority = sorted(enriched, key=lambda r: (r["review_bucket"], int(r["index"])))
    chunks = []
    for i, start in enumerate(range(0, len(priority), args.batch_size), 1):
        piece = priority[start:start + args.batch_size]
        name = f"shan-review-batch-{i:03}.csv"
        write_csv(args.out_dir / name, piece, export_columns)
        chunks.append({"file": name, "count": len(piece), "indices": [int(r["index"]) for r in piece]})
    summary = {
        "source_count": len(originals),
        "reason_counts": dict(Counter(r["primary_review_reason"] for r in enriched)),
        "review_bucket_counts": dict(Counter(r["review_bucket"] for r in enriched)),
        "exact_pos_label_proposals": sum(r["pos_candidate_basis"] == "exact-pos-label-only" for r in enriched),
        "descriptive_predicate_proposals": sum(r["review_bucket"] == "2-descriptive-predicate-proposal" for r in enriched),
        "linguistically_reviewed": 0,
        "approved_new_cards": 0,
        "sense_or_variant_merges": 0,
        "batches": chunks,
    }
    (args.out_dir / "shan-review-1211-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "batches"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
