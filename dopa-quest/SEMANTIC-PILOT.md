# DOPA QUEST: Burmese semantic-domain pilot (branch only)

This branch adds an **optional semantic category selector for Burmese** using a separate provisional sidecar file. No card IDs, source vocabulary, review-history keys, progress schema, or existing Shan data are changed.

## Testing locally from this branch

1. Checkout `feature/burmese-semantic-domains-pilot-20261009`.
2. From the repository root, run `python3 -m http.server 8000`.
3. Open `http://localhost:8000/dopa-quest/`.
4. Select ビルマ語 and an 意味領域. "全カテゴリ" retains the old behavior; Shan remains unfiltered.
5. Run `node --test dopa-quest/tests/category-pilot.test.mjs` and existing quality tests.

**The branch is not a live GitHub Pages preview.** The normal GitHub Pages publication remains on main.

## Data rules

- File: `data/burmese-categories-v1.json`
- `cards[legacy_id] = [major_category, status]`
- Status P = automatically classified / provisional (not independently verified)
- Status R = category checked against existing Japanese gloss only
- Status M = multiple senses, withheld from category-filtered questions until sense-level curation
- There are exactly 2,500 original parent IDs and 18 major semantic domains. Categories are not embedded into the source deck.
- Multi-sense cards remain available in the default all-words mode.
- When a category is active, **all four alternatives come from that same semantic category**, including the three distractors. The question can be limited to one rank zone while distractors are sampled from the entire category across ranks, keeping four distinct choices available. The original all-words mode retains its previous behavior.
- The category map is optional: if it fails to load, the all-words mode continues.

## Known limitations

The classification is a provisional learning aid, **not a dictionary-verified sense inventory**. Some category allocations are still based on earlier heuristic rules; they require human review. The 2,779 proposed sense-level cards are *not* deployed. Staged sense IDs are not mapped to review history; an eventual sense split needs explicit migration rules and distinct question-disambiguation policies. For safety, this branch makes no change to the original 2,500 item count.

## Release gates

- Verify browser gameplay on Safari / iPhone and at least one desktop browser.
- Check that a category question has four distinct plausible choices in sparse rank zones.
- Export a progress SAVE file and verify progress before and after a category-filtered session.
- Re-review provisional categories and confirm how multi-sense cards enter category lessons.
- Do not merge into main until regression tests and manual checks succeed.
