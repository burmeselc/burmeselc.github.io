# Thai ALA-LC Converter (beta)

A static, rule-first Thai → ALA-LC / dictionary-first ALA-LC → Thai tool at /thai-alalc/. It inherits the existing burmeselc typography and layout, with a blue palette. Translation and search run in the browser (no API calls, no persistence of work documents). It fetches only this repository's dictionary.json.

## What works

- Thai → ALA-LC: rule-first conversion of vowel patterns, initial and final consonants, tone marks, simple silent letters, leading tone consonants, Thai digits, and punctuation; unknown words receive tentative romanized candidates even without a dictionary. Officially reviewed dictionary entries override rule candidates for lexical exceptions and complex compounds; unparseable material is marked `未解析`. Clicking blue candidate spans allows manual correction.
- ALA-LC → Thai: supplies multiple Thai spellings for the same ALA-LC string with English glosses and a manual choice interface.
- Dictionary search by Thai, romanization, or gloss, and temporary local CSV/JSON upload.
- Experimental k-best SEAlang lexical segmentation preview (click to expand). This is **not** the ALA-LC 43-rule word-division result.
- Plain text copying and download. Rule-generated spans can be edited in place, with ephemeral edits never uploaded or saved.

## What remains to be built

The seed contains 25 manually curated examples (17 tagged as reviewed). As of 2026-10-20, controlled SEAlang API requests contributed 791 additional distinct source records, producing 816 dictionary records with source IDs. The site now generates romanization candidates for unseen syllables but does **not** guarantee correct pronunciation or the ALA-LC word division of previously unseen multi-syllable terms. 43 word division rules, irregular inherent vowels, silent letters, loanwords, and proper names require a reviewed dictionary and human cataloging review.

## Record schema and building

Each dictionary.json entry has: `thai, alalc, meaning, ipa, source, status`; records can also retain `source_id, source_query, roman_method, roman_evidence, pron_display, pos, senses, web_rank, lexical_level`. `ipa` is a legacy field name: it stores the source's pronunciation notation, not necessarily strict IPA.
status = reviewed | tentative | unresolved.

Build from curated examples:

    python thai-alalc/scripts/build_dictionary.py

Build with authorized SEAlang CSV shards (as collected by GitHub Actions):

    python thai-alalc/scripts/build_dictionary.py --source thai-alalc/data/sealang-shards/

CSV header: thai,meaning,ipa,source,alalc,verified. A genuinely reviewed ALA-LC can be supplied with verified=yes. Without verification the build script gives simple words a tentative orthography-based romanization and leaves complex words unresolved. Never promote tentative results to verified automatically.

## SEAlang Thai API collection (GitHub-only)

The Thai search API was verified at `https://sealang.net/api/api.pl?service=dictionary&lang=Thai&query=...`. It returns XML-like HTML containing `entry` and `subentry`, with `formx` source IDs, `orth` Thai heads, `pron` phonetic transcriptions, and `sense/def` English glosses. The first two limited queries retrieved 27 records. A subsequent batch of six narrow expressions retrieved 791 additional distinct records (816 combined with 25 seed examples). Older CSV shards are deduplicated by original source ID.

Visit **GitHub → Actions → Import SEAlang Thai dictionary → Run workflow**. Enter a limited group of Thai literal-substring expressions separated by spaces (e.g. `กก.* กะ.*`), set the maximum number of requests (up to 12), and affirm the academic bulk-access and redistribution permissions. The workflow checks robots.txt, observes a minimum 20-second interval, caps each response at 8MB, persists its resumable queue, merges fetched shards with the seed dataset, runs a 150-item consistency audit and regression tests, then commits the resulting `dictionary.json`, state and audit records to the repository. No local installation is required.

The API's native-script search matches can include compounds containing the queried character and need not be anchored at the start. A controlled 2026-10-20 test showed that `ก# Thai ALA-LC Converter (beta)

A static, rule-first Thai → ALA-LC / dictionary-first ALA-LC → Thai tool at /thai-alalc/. It inherits the existing burmeselc typography and layout, with a blue palette. Translation and search run in the browser (no API calls, no persistence of work documents). It fetches only this repository's dictionary.json.

## What works

- Thai → ALA-LC: rule-first conversion of vowel patterns, initial and final consonants, tone marks, simple silent letters, leading tone consonants, Thai digits, and punctuation; unknown words receive tentative romanized candidates even without a dictionary. Officially reviewed dictionary entries override rule candidates for lexical exceptions and complex compounds; unparseable material is marked `未解析`. Clicking blue candidate spans allows manual correction.
- ALA-LC → Thai: supplies multiple Thai spellings for the same ALA-LC string with English glosses and a manual choice interface.
- Dictionary search by Thai, romanization, or gloss, and temporary local CSV/JSON upload.
- Experimental k-best SEAlang lexical segmentation preview (click to expand). This is **not** the ALA-LC 43-rule word-division result.
- Plain text copying and download. Rule-generated spans can be edited in place, with ephemeral edits never uploaded or saved.

## What remains to be built

The seed contains 25 manually curated examples (17 tagged as reviewed). As of 2026-10-20, controlled SEAlang API requests contributed 791 additional distinct source records, producing 816 dictionary records with source IDs. The site now generates romanization candidates for unseen syllables but does **not** guarantee correct pronunciation or the ALA-LC word division of previously unseen multi-syllable terms. 43 word division rules, irregular inherent vowels, silent letters, loanwords, and proper names require a reviewed dictionary and human cataloging review.

## Record schema and building

Each dictionary.json entry has: `thai, alalc, meaning, ipa, source, status`; records can also retain `source_id, source_query, roman_method, roman_evidence, pron_display, pos, senses, web_rank, lexical_level`. `ipa` is a legacy field name: it stores the source's pronunciation notation, not necessarily strict IPA.
status = reviewed | tentative | unresolved.

Build from curated examples:

    python thai-alalc/scripts/build_dictionary.py

Build with authorized SEAlang CSV shards (as collected by GitHub Actions):

    python thai-alalc/scripts/build_dictionary.py --source thai-alalc/data/sealang-shards/

CSV header: thai,meaning,ipa,source,alalc,verified. A genuinely reviewed ALA-LC can be supplied with verified=yes. Without verification the build script gives simple words a tentative orthography-based romanization and leaves complex words unresolved. Never promote tentative results to verified automatically.

## SEAlang Thai API collection (GitHub-only)

The Thai search API was verified at `https://sealang.net/api/api.pl?service=dictionary&lang=Thai&query=...`. It returns XML-like HTML containing `entry` and `subentry`, with `formx` source IDs, `orth` Thai heads, `pron` phonetic transcriptions, and `sense/def` English glosses. The first two limited queries retrieved 27 records. A subsequent batch of six narrow expressions retrieved 791 additional distinct records (816 combined with 25 seed examples). Older CSV shards are deduplicated by original source ID.

Visit **GitHub → Actions → Import SEAlang Thai dictionary → Run workflow**. Enter a limited group of Thai literal-substring expressions separated by spaces (e.g. `กก.* กะ.*`), set the maximum number of requests (up to 12), and affirm the academic bulk-access and redistribution permissions. The workflow checks robots.txt, observes a minimum 20-second interval, caps each response at 8MB, persists its resumable queue, merges fetched shards with the seed dataset, runs a 150-item consistency audit and regression tests, then commits the resulting `dictionary.json`, state and audit records to the repository. No local installation is required.

 did not produce a useful end-anchor match; `ก[กข].*` still produced 14,391 hits, whereas `กก.*` returned 12. Thus traditional regex assumptions are unsafe. In an actual API test, `ก.*` returned `Excessive number of hits (14408, limit 2400)`, whereas `กก.*` returned 12 results. Large expressions must be split into narrower patterns to stay within the server's result limit and protect the service. The apparently anchored expression `^ณ.*` returned no matching records in one verification attempt. Therefore distinct-character searches will substantially overlap and source IDs are retained for deduplication. **Crawl coverage is explicitly unproven.** `scripts/sealang_crawl.py` queues literal-character continuations on overflow and persists progress to `data/sealang-crawl-state.json`, but those continuations cannot be proved exhaustive, especially for words ending at the prefix or containing non-Thai characters. State fields always record `coverage_proven: false`. Counting every headword has **not** been shown to establish complete dictionary coverage; a completeness audit or direct data export from SEAlang remains necessary.

The SEAlang server currently presents a nonstandard TLS certificate that Python does not verify. The collector uses an explicit `--legacy-tls` option limited to public-data requests to `sealang.net`; it does not send login cookies or credentials. A future remediation is desirable. Source rows retain IDs like `TDP:6410` and `RI:23150`; the `source` field identifies origin.

The SEAlang `pron written` field is a phonetic transcription, not the ALA-LC romanization. This project stores it separately as `ipa` (provisionally named). Simple spellings use a conservative Thai orthography guess; other entries may receive a provisional segmental romanization inferred from SEAlang's IPA. Both are flagged `tentative` and the latter records `roman_method: ipa`; otherwise entries remain `unresolved`. IPA alone cannot determine official ALA-LC word division, etymological exceptions, or every phoneme-to-letter decision. All require verification before cataloging use. The official 2011 ALA-LC rules include 43 word-division guidelines. The user has stated that SEAlang expressly permitted academic bulk collection and public redistribution; the source attribution and each source ID are retained.

## Candidate evaluation and word segmentation prototype

`python thai-alalc/scripts/audit_candidates.py --size 150` generates `data/alalc-candidate-audit.json` from the downloaded CSV shards. In the first 150-record sample, 2 entries had agreeing spelling/phonetic estimates, 78 had only a phonetic estimate, and 70 were unresolved by both early-stage Python methods. **This is a candidate-consistency audit, not a cataloging accuracy statistic.** It does not say that 78 candidates are correct. SEAlang's transcriptions sometimes use `j` where Thai spelling requires the ALA-LC consonant `čh` (e.g. `ใจ`), demonstrating why orthography and pronunciation must be aligned before a candidate can be accepted.

`lexical-segmenter.mjs` proposes up to three dictionary-based segmentation paths using a small, bounded dynamic program and a coarse WebRank preference. The web app displays these inside a closed-by-default details panel. This analysis does not set the ALA-LC spacing in the transliteration output. Headwords and subentries can themselves be multiword Thai phrases, and word-division conventions differ from lexical boundaries. Large input (>300 code units) has no segmentation preview, but romanization continues.

## Repository maintenance

Keep raw HTML and non-approved sources out of the repository. The CSV shard files contain the transferred entry text and are intentionally versioned to make changes auditable. Never commit browser input, account credentials, or private catalog records.

## Tests

    python -m unittest discover -s thai-alalc/tests -v
    node --check thai-alalc/app.js
    node --test thai-alalc/tests/romanizer.test.mjs

Reference: https://www.loc.gov/catdir/cpso/romanization/thai.pdf

## Rule-first Thai → ALA-LC engine (2026-10)

`romanizer.mjs` is an independent ES module with `romanizeThai(text, entries)` and `romanizeSyllable(raw)`. It uses dynamic programming to select dictionary-confirmed lexical matches and rule-generated orthographic syllables. Approved lexicon records have priority; SEAlang entries with tentative or unresolved ALA-LC are not falsely treated as verified output. The UI highlights automatically generated and unparsed substrings and offers inline correction.

**Limitations:** ambiguous inherent vowels (`a/o/ǭ`), consonant clusters, exceptional pronunciation, silent syllables, word segmentation, names and grammatical compounds can require an authoritative lexicon and human review. Word boundaries inserted between segments are preliminary, *not* compliance with all 43 word-division instructions. Do not silently treat rule guesses as confirmed cataloging forms. Copying exports the displayed candidate including spaces and explicit unresolved markers.
