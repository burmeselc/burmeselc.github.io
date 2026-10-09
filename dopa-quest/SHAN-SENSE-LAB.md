# DOPA QUEST — Shan sense/POS card lab (experimental)

**This branch is a non-production experiment**, created separately from the Shan 18-category draft PR #17. It does not modify the original Shan 5,480 records, Burmese 2,500 records, or Firebase sync format.

## Card strategy

- Source Shan vocabulary: 5,480 parents, unchanged.
- An external staging review found **7,290** candidates when numbered ①② senses and part-of-speech distinctions were split.
- This lab stores all candidates under `data/shan-senses-{1..8}.json` plus a manifest. There are 3,052 new child card IDs, and 4,238 singleton candidates retain their parent IDs.
- **7,241 playable candidates** (including **3,034 split-child candidates**) meet the basic staging checks.
- 49 candidates are withheld for unresolved meaning or semantic domain. Another 227 candidates whose Japanese gloss coincides with other entries are now playable but explicitly flagged for review; the answer-choice generator excludes competing correct glosses and homographic senses instead of globally removing these cards.
- Curation is still provisional. Distinct senses in dictionary sources or real contexts are not independently checked for the entire data set.

## UI behavior

- Default **語義別学習 OFF**: exactly the original Shan 5,480 cards and existing category filter.
- If the Shan-only checkbox is enabled, questions use the eligible sense inventory instead; Japanese glosses are shown separately for every sense.
- Split cards can be quizzed in **both directions**: Shan spelling → one of its Japanese meanings, or Japanese meaning (+ POS) → Shan spelling. The four-choice distractor generator never offers another sense of the same Shan spelling, or an overlapping Japanese gloss. Such recognition does **not** establish the ability to disambiguate senses in context.
- All four distractors belong to the selected semantic category. Outside category mode the existing zone choice logic is unchanged.
- Game progress still uses `dopaQuestV5_profile` keyed by card ID. New child IDs start **fresh**; no old parent history is copied, divided, overwritten, or deleted. Singletons keep their parent ID and history.
- Missing or broken sense data disables the opt-in checkbox; ordinary Shan and Burmese remain playable.
- The category sidecar from PR #17 is a prerequisite because this branch is based on that branch.

## Before production release

1. Verify the split and POS glosses of the 3,052 child cards, especially same-form grammatical functions and synonym collisions; the 276 withheld candidates need editorial review.
2. Inspect Chromium browser smoke test and try the opt-in mode. Never load a real progress backup on external preview origins.
3. Add example sentences if assessing contextual sense disambiguation is desired. The present four-choice activity tests recognition of an attested possible meaning, not selection of a contextually appropriate interpretation.
4. Preserve parent history in backups and adopt a user-visible history migration/retirement policy before any default replacement.
5. Do **not** merge this lab to `main` merely because tests pass.
