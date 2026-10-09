# Thai ALA-LC Converter (beta)

Static Thai ⇄ ALA-LC candidate lookup hosted on GitHub Pages: https://burmeselc.github.io/thai-alalc/

## User interface
- Uses the site-wide burmeselc design with a blue theme.
- Thai → ALA-LC finds known dictionary forms, with ambiguous candidates selectable.
- ALA-LC → Thai retrieves spellings with glosses.
- Search Thai, romanized forms, and English definitions; import local CSV or JSON without uploading work text.
- **Outputs are aids, not certified ALA-LC records.** The authoritative ALA-LC table has 43 word-division rules. Unknown segments are explicitly indicated.

## SEAlang import with GitHub Actions

The dictionary API endpoint has been tested (2026-10-09):

`http://sealang.net/api/api.pl?service=dictionary&lang=Thai&query=ภาษา`

SEAlang's XHTML contains `entry` and `subentry` elements, with `formx/orth[@type=head]` for Thai, `formx/pron` for pronunciation (often in a `written` attribute), and `sense/def` for definitions. The `formx` ID records source identifiers such as TDP codes.

**Run on GitHub:** Actions → **Thai SEAlang dictionary import (permission-confirmed)** → Run workflow. Enter `max_requests`, `start_index` (0 then 20 then 40, etc.), and optionally `queries` (semicolon-separated, e.g., `ก.*;ข.*`). Confirm both permissions. This performs the work in GitHub's hosted runner, commits the incrementally expanded `thai-alalc/dictionary.json`, and GitHub Pages deploys it. The user reports that SEAlang granted permission to download and republish; users should adhere to the actual scope of that authorization.

SEAlang's robots.txt currently specifies **Crawl-Delay: 20**. The script uses at least 20 seconds between queries, limits each run to 100 requests, checks robots.txt, stops rather than retries after errors, and never accesses the site from a browser visitor's machine. Successive runs use `start_index` to avoid repeating the first prefix batch. Queries are partitioned by Thai initial written characters, including preposed vowels `เ แ โ ใ ไ`.

### Coverage limitations

A `.*` search may return a truncated or collapsed list (for example, an observed query for `ภาษา` reported 55 results while the XHTML contained 41 entry/subentry blocks). Accordingly:
- A single query or one search per initial letter **does not establish complete coverage**.
- The collector prints counts and warnings; subsequent partitioning into narrower patterns or an API pagination strategy will be needed to verify full dictionary coverage.
- Temporary collected HTML/CSV is gitignored. Only normalized candidate records should be committed.
- The returned source IDs, IPA, and English definitions are retained in dictionary JSON for tracing and later review.

### Romanization integrity

The Python converter prioritizes manually reviewed ALA-LC forms. Simple Thai spelling rules are a fallback; for other words, SEAlang's pronunciation may provide a tentative segment-based spelling. Each record carries `status` (`reviewed`, `tentative`, `unresolved`) and `roman_method` (`curated`, `manual`, `spelling`, `ipa`). **IPA-derived guesses are not certified ALA-LC**, because Thai word division and etymological conventions are not guaranteed by pronunciation alone.

Existing dictionary rows are preserved across successive runs. Unreviewed SEAlang records must never be assigned `reviewed` merely because they have IPA.

## Command-line equivalents (for developer testing, not needed by users)

```sh
python -m pip install beautifulsoup4
python thai-alalc/scripts/sealang_batch.py --queries 'ภาษา' --max-requests 1 --run --permission-confirmed
python thai-alalc/scripts/sealang_batch.py --parse-only
python thai-alalc/scripts/build_dictionary.py --source thai-alalc/data/sealang-export.csv
python -m unittest discover -s thai-alalc/tests -v
node --check thai-alalc/app.js
```

Reference: [ALA-LC Thai Romanization Table (2011)](https://www.loc.gov/catdir/cpso/romanization/thai.pdf).
