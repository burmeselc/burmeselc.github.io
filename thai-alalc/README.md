# Thai ALA-LC Converter (beta)

A static, dictionary-first Thai ↔ ALA-LC 2011 tool at /thai-alalc/. It inherits the existing burmeselc typography and layout, with a blue palette. Translation and search run in the browser (no API calls, no persistence of work documents). It fetches only this repository's dictionary.json.

## What works

- Thai → ALA-LC: finds word entries in dictionary; unknown substrings are explicitly marked "未登録".
- ALA-LC → Thai: supplies multiple Thai spellings for the same ALA-LC string with English glosses and a manual choice interface.
- Dictionary search by Thai, romanization, or gloss, and temporary local CSV/JSON upload.
- Plain text copying and download.

## What remains to be built

The initial dictionary has 25 manually curated demonstration entries, 17 with ALA-LC romanization given as examples in the official 2011 table; glosses are editor-written. **An initial SEAlang Thai API batch (ณ.* and ฬ.*) has been collected and reviewed only for parse/schema integrity.** The site does not perform reliable novel-word transcription or automatic Thai word division yet. 43 word division rules, irregular inherent vowels, silent letters, loanwords, and proper names require a reviewed dictionary and human cataloging review.

## Record schema and building

Each dictionary.json entry has: thai, alalc, meaning, ipa, source, status.
status = reviewed | tentative | unresolved.

Build from curated examples:

    python thai-alalc/scripts/build_dictionary.py

Build with authorized SEAlang CSV shards (as collected by GitHub Actions):

    python thai-alalc/scripts/build_dictionary.py --source thai-alalc/data/sealang-shards/

CSV header: thai,meaning,ipa,source,alalc,verified. A genuinely reviewed ALA-LC can be supplied with verified=yes. Without verification the build script gives simple words a tentative orthography-based romanization and leaves complex words unresolved. Never promote tentative results to verified automatically.

## SEAlang Thai API collection (GitHub-only)

The Thai search API was verified at `https://sealang.net/api/api.pl?service=dictionary&lang=Thai&query=...`. It returns XML-like HTML containing `entry` and `subentry`, with `formx` source IDs, `orth` Thai heads, `pron` phonetic transcriptions, and `sense/def` English glosses. A limited real batch on GitHub Actions retrieved 27 records with 2 search patterns, then wrote CSV shards and a 52-entry combined dictionary.

Visit **GitHub → Actions → Import SEAlang Thai dictionary → Run workflow**. Enter a limited group of regex search patterns separated by spaces (e.g. `ก.* ข.* ค.*`), set the maximum number of requests, and affirm the academic bulk-access and redistribution permissions. The workflow checks robots.txt, observes a minimum 20-second interval, caps each response at 8MB, merges fetched shards with the seed dataset, tests, and commits the resulting `dictionary.json` directly to the repository. No local installation is required.

The API's native-script search matches can include compounds containing the queried character and need not be anchored at the start. The apparently anchored expression `^ณ.*` returned no matching records in one verification attempt. Therefore distinct-character searches will substantially overlap and source IDs are retained for deduplication. Counting every headword has **not** been shown to establish complete dictionary coverage; a completeness audit remains necessary.

The SEAlang server currently presents a nonstandard TLS certificate that Python does not verify. The collector uses an explicit `--legacy-tls` option limited to public-data requests to `sealang.net`; it does not send login cookies or credentials. A future remediation is desirable. Source rows retain IDs like `TDP:6410` and `RI:23150`; the `source` field identifies origin.

The SEAlang `pron written` field is a phonetic transcription, not the ALA-LC romanization. This project stores it separately as `ipa` (provisionally named). Simple spellings use a conservative Thai orthography guess; other entries may receive a provisional segmental romanization inferred from SEAlang's IPA. Both are flagged `tentative` and the latter records `roman_method: ipa`; otherwise entries remain `unresolved`. IPA alone cannot determine official ALA-LC word division, etymological exceptions, or every phoneme-to-letter decision. All require verification before cataloging use. The official 2011 ALA-LC rules include 43 word-division guidelines. The user has stated that SEAlang expressly permitted academic bulk collection and public redistribution; the source attribution and each source ID are retained.

## Repository maintenance

Keep raw HTML and non-approved sources out of the repository. The CSV shard files contain the transferred entry text and are intentionally versioned to make changes auditable. Never commit browser input, account credentials, or private catalog records.

## Tests

    python -m unittest discover -s thai-alalc/tests -v
    node --check thai-alalc/app.js

Reference: https://www.loc.gov/catdir/cpso/romanization/thai.pdf
