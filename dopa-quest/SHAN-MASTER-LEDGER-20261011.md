# DOPA QUEST — シャン語Anki統合マスター台帳 v1

作成日：2026-10-11。元となったGitHub `main` は `46494662b448fa746207f6ebac43b33e83f3b018`（PR #47統合後）です。

## 資料と突合の範囲

* Anki原本 `anki_shan_jpn.csv` の19,637行を**欠落なく**収録。原本 SHA-256 は `1aa74d2d3c6cef6535a8f41925eb945a05cd51a6a31244ed525776172aae1bd7` です。
* 元デッキのシャン語親語彙5,480、語義・品詞候補7,290、追加済み1,000件、既存親語彙の暫定分類5,480件（大カテゴリが暫定確定されてゐるもの4,207件）を照合。
* 過去の `DOPA_QUEST_SHN5480_sense_semantic_v4.json`、`DOPA_QUEST_SHN5480_category_edits_v4.csv` の399件を再利用。ただし歴史的提案と公開中の分類とは別列に保存。
* 18大カテゴリ・82中カテゴリの分類IDを照合。意味不明の語義を勝手に分類せず、未確定を空欄に保持。

## 数量

| 項目 | 件数 |
|---|---:|
| Anki物理行 | 19,637 |
| Anki異なり語形（NFC） | 18,196 |
| 元の5,480語彙と重なる語形 | 5,480 |
| 既存デッキにない新規語形 | 12,716 |
| 公開済み追加新規語形 | 1,000 |
| 未公開新規語形 | 11,716 |
| 未公開・単一記載で抽出条件を満たす語形 | 10,717 |
| 第2パック用の校閲候補 | 2,000 |
| 元Anki通し番号が重複してゐる値 | 5種類（計10行） |

## 各ファイル

* `shan-anki-master-19637-v1.csv`：全19,637行。`source_row`／`anki-row:<行番号>` を一意の出典キーとして記録。日本語訳・品詞候補・既存親ID・既存語義ID・公開済みフラグ・分類資料の出自・レビュー状態を区別。
* `shan-current-5480-parent-crosswalk-v1.csv`：既存親語彙と公開中の18大カテゴリ対応。
* `shan-7290-sense-provenance-v1.csv`：既存語義候補と、過去分類案・過去修正案・公開中親語彙カテゴリとの対応。
* `shan-published-1000-crosswalk-v1.csv`：PR #47で公開済みの追加語形の対応。下記の「公開IDについて」を参照。
* `shan-historical-category-edits-399-v1.csv`：元の399件の分類修正案。
* `shan-next-pack-shortlist-2000-v1.csv`：次の2,000語形の校閲用抽出結果。**出題カードとしては未承認**。
* `shan-master-summary-v1.json`：機械判読用の数量・証拠水準・検証情報。
* `build-shan-master-ledger.py`：GitHubにも登録した再生成プログラム。

## 重要な区別

1. **語形一致は語義の一致を意味しません。** `existing-gloss-string-exact` は訳語の文字列一致に限られ、同義語・多義・新語義の判断は保留です。
2. **既存親語彙の分類を追加語義へ継承させません。** 語義別の大・中カテゴリ、異表記参照先、品詞差などは、根拠のある場合だけ決定します。
3. **原本の通し番号は一意ではありません。** `source_row` は出典位置であり、学習カードIDではありません。既存の `shn:...` IDと、公開済みの `shn:anki:...` IDは変更しません。
4. **第2パック候補2,000件は未公開です。** 語義の査読・出題時の訳語衝突・異綴りを検討し、利用可能なものから公開して下さい。

## 公開IDについて（重要な留保）

この配布版はAnki原本と公開済み1,000件の通し番号・語形を照合してゐます。ただしローカル作成時にはGitHub上の公開済みパック全文を直接取得できなかったため、1,000件中998件の `published_extra_id` が空欄（`published_id_join_pending=1`）です。この状態でも、公開済みか否かの判定と11,716件の未公開語形は確認できてゐます。残る2件のIDは重複通し番号を照合して確定しました。

GitHub上の `dopa-quest/data/shan-extra-pilot-1.json` を `--pilot` に指定するか、同ファイルのあるリポジトリ内で再実行すれば、**既存1,000件すべての不変IDを直接照合した完全版を生成**できます。原本の通し番号のみからIDを捏造することはしません。

## 再生成例

GitHubリポジトリを取得し、Anki原本と既存の分類資料をローカルに保存した上で、リポジトリのルートから次を実行します。既存デッキと公開済み1,000件、分類定義はGitHubの現行ファイルを自動的に参照します。

```bash
python3 dopa-quest/scripts/build-shan-master-ledger.py \
  --source /path/to/anki_shan_jpn.csv \
  --historic-senses /path/to/DOPA_QUEST_SHN5480_sense_semantic_v4.json \
  --historic-edits /path/to/DOPA_QUEST_SHN5480_category_edits_v4.csv \
  --out /tmp/dopa-shan-master
```

これは**読み取り専用の監査作業**であり、アプリの語彙数・セーブデータ・Firebase同期・UIには変更を加へません。