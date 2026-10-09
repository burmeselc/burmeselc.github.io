# DOPA QUEST — Shan sense/POS card lab (experimental)

**This branch is a non-production experiment**, created separately from the Shan 18-category draft PR #17. It does not modify the original Shan 5,480 records, Burmese 2,500 records, or Firebase sync format.

## Card strategy

- Source Shan vocabulary: 5,480 parents, unchanged.
- An external staging review found **7,290** candidates when numbered ①② senses and part-of-speech distinctions were split.
- This lab stores all candidates under `data/shan-senses-{1..8}.json` plus a manifest. There are 3,052 new child card IDs, and 4,238 singleton candidates retain their parent IDs.
- **7,014 playable candidates** (including **2,807 split-child candidates**) meet the basic staging checks.
- 276 candidates are withheld: 230 share a normalized Japanese meaning with another candidate, and 46 lack a sufficient/verified structure to play safely (meaning, category, or required gloss review).
- Curation is still provisional. Distinct senses in dictionary sources or real contexts are not independently checked for the entire data set.

## UI behavior

- Default **語義別学習 OFF**: exactly the original Shan 5,480 cards and existing category filter.
- If the Shan-only checkbox is enabled, questions use the eligible sense inventory instead; Japanese glosses are shown separately for every sense.
- Split cards are **only prompted Japanese meaning (+ POS) → Shan spelling**. Without example sentences, Shan spelling → specific Japanese sense would be ambiguous.
- All four distractors belong to the selected semantic category. Outside category mode the existing zone choice logic is unchanged.
- Game progress still uses `dopaQuestV5_profile` keyed by card ID. New child IDs start **fresh**; no old parent history is copied, divided, overwritten, or deleted. Singletons keep their parent ID and history.
- Missing or broken sense data disables the opt-in checkbox; ordinary Shan and Burmese remain playable.
- The category sidecar from PR #17 is a prerequisite because this branch is based on that branch.

## Before production release

1. Verify the split and POS glosses of the 3,052 child cards, especially same-form grammatical functions and synonym collisions; the 276 withheld candidates need editorial review.
2. Inspect Chromium browser smoke test and try the opt-in mode. Never load a real progress backup on external preview origins.
3. Decide whether to make new child cards available only in Japanese→Shan quizzes long-term or author contextual examples to allow Shan→Japanese disambiguation.
4. Preserve parent history in backups and adopt a user-visible history migration/retirement policy before any default replacement.
5. Do **not** merge this lab to `main` merely because tests pass.
