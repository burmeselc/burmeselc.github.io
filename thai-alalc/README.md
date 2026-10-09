# Thai ALA-LC Converter (beta)

A static, dictionary-first Thai ↔ ALA-LC 2011 tool at /thai-alalc/. It inherits the existing burmeselc typography and layout, with a blue palette. Translation and search run in the browser (no API calls, no persistence of work documents). It fetches only this repository's dictionary.json.

## What works

- Thai → ALA-LC: finds word entries in dictionary; unknown substrings are explicitly marked "未登録".
- ALA-LC → Thai: supplies multiple Thai spellings for the same ALA-LC string with English glosses and a manual choice interface.
- Dictionary search by Thai, romanization, or gloss, and temporary local CSV/JSON upload.
- Plain text copying and download.

## What remains to be built

The initial dictionary has 25 manually curated demonstration entries, 17 with ALA-LC romanization given as examples in the official 2011 table; glosses are editor-written. **No SEAlang entries were downloaded or republished.** The site does not perform reliable novel-word transcription or automatic Thai word division yet. 43 word division rules, irregular inherent vowels, silent letters, loanwords, and proper names require a reviewed dictionary and human cataloging review.

## Record schema and building

Each dictionary.json entry has: thai, alalc, meaning, ipa, source, status.
status = reviewed | tentative | unresolved.

Build from curated examples:

    python thai-alalc/scripts/build_dictionary.py

Build with an authorized, privately obtained SEAlang CSV:

    python thai-alalc/scripts/build_dictionary.py --source thai-alalc/data/sealang-export.csv

CSV header: thai,meaning,ipa,source,alalc,verified. A genuinely reviewed ALA-LC can be supplied with verified=yes. Without verification the build script gives simple words a tentative orthography-based romanization and leaves complex words unresolved. Never promote tentative results to verified automatically.

## Opt-in SEAlang collection

scripts/sealang_batch.py can plan conservative queries partitioned by Thai initial orthographic character (ก.*, ข.*, เ.*, etc.). It **does not know** the current official Thai query endpoint or actual result CSS selectors. A query may paginate or truncate, and therefore prefix partitioning does not establish full coverage. Inspect SEAlang's live site first.

- No network activity unless both --run and --permission-confirmed are supplied.
- Explicit --url-template (one {query} placeholder, HTTPS sealang.net only).
- 7 seconds minimum between queries, max 100 requests per execution, robots.txt check, stop on HTTP errors, resumable manifest.
- parse-only mode requires observed --entry-selector, --thai-selector, --meaning-selector, and optionally --ipa-selector.

**Rights:** a past email permitting the user to download Shan dictionary results does not establish permission to redistribute SEAlang's Thai lexical definitions in a public GitHub repo. The Thai search collection combines several providers, including Haas, Royal Institute, and LEXiTRON. Permission for *public distribution* and the source-specific license must be checked separately. The raw HTML and exports are ignored via .gitignore.

To inspect an endpoint without contacting SEAlang:

    python thai-alalc/scripts/sealang_batch.py --url-template 'https://sealang.net/VERIFIED-PATH?query={query}' --dry-run

For opt-in download after checks:

    python thai-alalc/scripts/sealang_batch.py --url-template 'https://sealang.net/VERIFIED-PATH?query={query}' --run --permission-confirmed --max-requests 20 --delay 10

Extraction is a distinct local step, after inspecting the actual returned HTML. Do not commit private session cookies, raw html, or data without redistribution rights. The current script is a preparatory collector, not a verified production crawler.

## Tests

    python -m unittest discover -s thai-alalc/tests -v
    node --check thai-alalc/app.js

Reference: https://www.loc.gov/catdir/cpso/romanization/thai.pdf
