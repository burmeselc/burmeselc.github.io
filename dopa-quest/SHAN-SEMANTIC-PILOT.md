# DOPA QUEST Shan semantic-domain pilot

This is a feature-branch experiment, not a production deploy. The existing **5,480 Shan cards and their stable IDs** stay unchanged. The separate `data/shan-categories-v1.json` maps their IDs to the same 18 broad semantic domains used in Burmese.

## Status

- `P`: 4,207 parents with provisional domain proposals; available in category-limited study.
- `M`: 1,242 parents have multiple senses and/or parts of speech; excluded from filtered study.
- `H`: 31 parents have unresolved glosses; excluded from filtered study.
- All 5,480 parents remain available in unrestricted learning, as before.
- The staged **7,290 sense/part-of-speech candidates** are a separate curation project and are not deployed. No new IDs and no automatic migration of learning histories are introduced here.
- Semantic classifications, especially those derived from Japanese/English gloss heuristics, are **not dictionary-verified**.

In either language, selecting a category restricts both questions and **all four displayed answer choices** to that semantic domain. Questions can be restricted to a rank zone, while distractors can be drawn from the entire selected semantic domain across zones. Both language selectors have the same 18 categories; switching language resets selection to 'all'.

Each optional sidecar is independently loaded. If the Shan sidecar fails, ordinary Shan play and Burmese category mode continue; if the Burmese sidecar fails, ordinary Burmese play and Shan category mode continue.

## Tests

Run `node --test dopa-quest/tests/quality.test.mjs dopa-quest/tests/category-pilot.test.mjs dopa-quest/tests/shan-category.test.mjs` and the branch's GitHub Actions Chromium smoke suite (`shan-browser.test.mjs` and `category-browser.test.mjs`).

Before merging to production, confirm the new selector in Chromium and verify learning history export/restore locally. Do not merge this branch on the strength of static semantics alone; it is an initial release of provisional categories.
