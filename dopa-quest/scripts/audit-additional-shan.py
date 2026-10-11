#!/usr/bin/env python3
"""Read-only audit of a proposed Shan Anki CSV against DOPA QUEST parent/sense cards.

Usage:
 python3 dopa-quest/scripts/audit-additional-shan.py \\
   --source anki_shan_jpn.csv --form-column 2 --meaning-column 4 \\
   --header-mode none --output /tmp/shan-additions-audit.json

Column selectors are 1-based indices or exact header names. Never assigns IDs,
edits a production deck, or claims linguistic identity from equal spellings.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
import re
from pathlib import Path
import unicodedata


BASE = Path(__file__).resolve().parents[1]
STATUSES = (
    "hold-incomplete", "duplicate-source", "existing-gloss-exact",
    "existing-form-review", "new-form-candidate",
)


def normalized(text: object) -> str:
    """NFC + trim only. Do NOT remove Shan combining marks, ZWJ or punctuation."""
    return unicodedata.normalize("NFC", str(text or "")).strip()


def meaning_key(text: object) -> str:
    # Collapsing whitespace is useful for matching identical gloss strings;
    # do not infer that translated synonyms are semantically equivalent.
    return " ".join(normalized(text).split())


def read_csv(path: Path, encoding: str = "utf-8-sig", delimiter: str = ","):
    with path.open("r", encoding=encoding, newline="") as handle:
        return list(csv.reader(handle, delimiter=delimiter))



def read_numbered_anki(path: Path, encoding: str = "utf-8-sig"):
    """This source uses '<serial>. <Shan>, <definition>' with unquoted gloss commas.

    CSV readers cannot parse it correctly: punctuation and quote characters
    inside definitions must be retained by splitting at the FIRST comma.
    """
    rows = []
    pattern = re.compile(r"^\s*(\d+)\s*[.:]\s*(.*)$")
    with path.open("r", encoding=encoding, newline="") as handle:
        for physical, line in enumerate(handle, 1):
            match = pattern.match(line.strip("\r\n"))
            if not match:
                raise ValueError(f"Missing numbered headword at physical line {physical}")
            headword, sep, definition = match.group(2).partition(",")
            if not sep:
                raise ValueError(f"Missing first comma at physical line {physical}")
            rows.append([headword, definition, match.group(1)])
    return rows


def column_index(selector: str, header: list[str] | None) -> int:
    if selector.isdecimal():
        value = int(selector)
        if value < 1:
            raise ValueError("CSV column numbers begin at 1")
        return value - 1
    if header is None:
        raise ValueError("Named column requires --header-mode first: " + selector)
    names = [normalized(x) for x in header]
    if names.count(normalized(selector)) != 1:
        raise ValueError("Column header is missing or ambiguous: " + selector)
    return names.index(normalized(selector))


def audit_rows(rows: list[list[str]], parents: list[dict], senses: list[dict],
               form_index: int, meaning_index: int, pos_index: int | None = None,
               first_csv_row: int = 1) -> dict:
    existing: dict[str, dict] = defaultdict(lambda: {"parents": set(), "senses": set(), "glosses": set()})
    known_ids = set()
    for kind, dataset in [("parents", parents), ("senses", senses)]:
        for card in dataset:
            card_id = card["id"]
            if kind == "parents" and card_id in known_ids:
                raise ValueError("Duplicate parent ID in built-in deck")
            known_ids.add(card_id)
            form = normalized(card.get("shan", ""))
            if not form:
                raise ValueError("Built-in card has an empty Shan headword")
            existing[form][kind].add(card_id)
            gloss = meaning_key(card.get("japanese_core", ""))
            if gloss:
                existing[form]["glosses"].add(gloss)
    source_pairs: dict[tuple[str, str], int] = {}
    records = []
    counts = Counter()
    all_forms = set()
    new_forms = set()
    uncertain_forms = set()
    for i, source_fields in enumerate(rows, first_csv_row):
        # The row index is only a provenance locator; never use Anki row numbers
        # or possibly repeated source serials to create a learning-card ID.
        source = list(source_fields)
        def at(index):
            return source[index] if index is not None and index < len(source) else ""
        form = normalized(at(form_index))
        gloss = meaning_key(at(meaning_index))
        pos = normalized(at(pos_index))
        match = existing.get(form) if form else None
        reason = ""
        matched_row = None
        if not form or not gloss:
            status = "hold-incomplete"
            reason = "原語または日本語訳が空欄・列不足"
        elif (form, gloss) in source_pairs:
            status = "duplicate-source"
            matched_row = source_pairs[(form, gloss)]
            reason = "同じ原語・同じ日本語訳が追加CSV内に重複"
        elif match and gloss in match["glosses"]:
            status = "existing-gloss-exact"
            reason = "既存語形と正規化後の日本語訳が文字列一致（語義同一の確証ではない）"
        elif match:
            status = "existing-form-review"
            reason = "既存語形と一致するが、訳語の完全一致はなし。新語義・言換へ・品詞を要判定"
        else:
            status = "new-form-candidate"
            reason = "既存親語・語義別デッキに同一NFC語形がない。異表記・訳語は未校閲"
        if form and gloss and (form, gloss) not in source_pairs:
            source_pairs[(form, gloss)] = i
        if form:
            all_forms.add(form)
        if status == "new-form-candidate":
            new_forms.add(form)
        if status in ("hold-incomplete", "existing-form-review"):
            if form:
                uncertain_forms.add(form)
        counts[status] += 1
        records.append({
            "source_row": i, "status": status, "reason": reason,
            "shan": form, "japanese": gloss, "pos_raw": pos,
            "raw_fields": source,
            "duplicates_source_row": matched_row,
            "matching_parent_ids": sorted(match["parents"]) if match else [],
            "matching_sense_ids": sorted(match["senses"]) if match else [],
            "new_id": None, "approved": False,
        })
    return {
        "schema": "dopa-shan-additional-csv-audit-v1",
        "read_only": True, "production_changes": 0,
        "automatic_card_approval": False,
        "counts": {
            "source_rows": len(rows),
            "distinct_nfc_headwords": len(all_forms),
            "existing_parent_cards": len(parents),
            "existing_sense_candidates": len(senses),
            "new_form_candidates": len(new_forms),
            "review_headwords": len(uncertain_forms),
            "by_status": {key: counts[key] for key in STATUSES},
        },
        "records": records,
    }


def run(args: argparse.Namespace) -> dict:
    source = Path(args.source)
    numbered = args.source_format == "anki-numbered"
    if numbered and args.header_mode != "none":
        raise ValueError("Numbered Anki format cannot have a column header")
    raw = (read_numbered_anki(source, encoding=args.encoding) if numbered else
           read_csv(source, encoding=args.encoding, delimiter=args.delimiter))
    if not raw:
        raise ValueError("Source CSV is empty")
    header = raw[0] if args.header_mode == "first" else None
    selectors = [column_index(x, header) if x else None
                 for x in [args.form_column, args.meaning_column, args.pos_column]]
    data = raw[1:] if header else raw
    data = [r for r in data if any(cell.strip() for cell in r)]
    parents = []
    for name in ("shan-1.json", "shan-2.json"):
        parents.extend(json.loads((Path(args.data_dir) / name).read_text(encoding="utf-8")))
    senses = []
    for i in range(1, 9):
        senses.extend(json.loads((Path(args.data_dir) / ("shan-senses-" + str(i) + ".json"))
                                  .read_text(encoding="utf-8")))
    if len(parents) != 5480 or len(senses) != 7290:
        raise ValueError("Unexpected baseline vocabulary; stop before auditing")
    result = audit_rows(data, parents, senses, *selectors, first_csv_row=2 if header else 1)
    if numbered:
        for row, fields in zip(result["records"], data):
            row["source_serial"] = int(fields[2])
    result["source"] = {
        "file_name": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "encoding": args.encoding, "delimiter": args.delimiter, "header_mode": args.header_mode,
        "form_column": args.form_column, "meaning_column": args.meaning_column,
        "pos_column": args.pos_column, "source_format": args.source_format,
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Anki CSV original file")
    parser.add_argument("--output", required=True, help="Output audit JSON; never a production deck")
    parser.add_argument("--data-dir", default=str(BASE / "data"))
    parser.add_argument("--form-column", required=True, help="Shan form: 1-based index or header")
    parser.add_argument("--meaning-column", required=True, help="Japanese gloss: index or header")
    parser.add_argument("--pos-column", help="Optional source POS: index or header")
    parser.add_argument("--header-mode", choices=("first", "none"), default="first")
    parser.add_argument("--source-format", choices=("csv", "anki-numbered"), default="csv")
    parser.add_argument("--delimiter", default=",")
    parser.add_argument("--encoding", default="utf-8-sig")
    args = parser.parse_args()
    result = run(args)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False, indent=2))
    print("READ ONLY — No ID issued. No deck or learning history modified.")


if __name__ == "__main__":
    main()
