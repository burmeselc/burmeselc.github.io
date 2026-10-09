# DOPA QUEST v6.2 — stability, rapid play, and cloud recovery

DOPA QUEST vocabulary RPG for **Shan and Burmese**.

## v6.2 release notes

- Shan word-count metadata: restore the original per-word source occurrence counts for all 5,480 entries, rather than showing `undefined件`.
- Correct answers advance automatically after **950 ms** by default. Tap **解説を見る** within that window to pause for details; optional setting **正解後も確認するまで停止** re-enables manual advancement.
- Before a remote snapshot overwrites local progress, save the previous local profile in the browser's IndexedDB under a recovery slot. **復旧** can recover that local copy after confirmation.
- Synchronization now checks newer cloud revisions even when the local profile is unchanged.
- Cloud snapshot retrieval re-checks the server revision after reading chunks and prevents overwriting answers made while loading. Identity is captured during uploads to avoid cross-account races.
- Backgrounding the page attempts a cloud flush; localStorage remains the immediate persistence mechanism, so browser termination may interrupt the network operation.
- Tests cover counts, fast answers, UTF-8 snapshots, in-flight edit protection and remote revision retrieval.

**Storage notice:** Recovery is a single-slot, on-device safety copy; it is not a complete historical archive. Use SAVE to export additional backups. Cloud syncing still uses a snapshot model rather than a per-card, automatic conflict merge.

## v6.1 learning-quality changes

- Two cards with overlapping Japanese glosses are **never presented as false alternative answers** in four-choice questions. Ambiguous reverse prompts switch automatically to source-language recognition and show a label; this is conservative until curated sense IDs are available.
- A correct answer awards XP immediately, and XP/coins are saved per answer. Closing a round early no longer discards XP.
- Initial or **due** successful retrieval advances long-term mastery. Early repetitions still award XP but do not artificially extend review intervals. Immediate REVENGE does not advance long-term skill.
- Accuracy at round end reflects **first attempts**, not easy successes on repeated cards.
- Up to 1,000 recent primary review events are stored in the existing per-user progress snapshot (timestamp, card ID, skill, accuracy, credited retention). This is backward-compatible with existing save data and paves the way for FSRS.
- Cloud sync schema, URLs, vocabulary IDs and Firebase configuration are unchanged.
- Regression checks: `node --test dopa-quest/tests/quality.test.mjs`.

**Important:** the current algorithm is a custom staged repetition scheduler, not FSRS. The review log must be interpreted as training events, not necessarily validated retention estimates.
 This folder is a preview of the v5 → v6 migration. The game logic retains v5's RIVAL, NEMESIS, REVENGE, timed rounds, XP, and progress record.

## What is / is not deployed

- **Included:** game code, 5,480 Shan and 2,500 Burmese author-owned built-in words, optional vocabulary importer, local progress, JSON backup, Google Auth + Firestore sync, security rules.
- **Vocabulary rights:** the deck creator has explicitly confirmed both Anki sets are self-authored and authorized their inclusion. Independently sourced dictionary text, images, or audio still require separate rights checks where applicable.
- **Configured:** Firebase Web project and Google Auth/Firestore synchronization (reported operational by the user in v6); the new v6.2 improvements still require device-side verification.
- **Not yet production-verified:** actual iOS Safari login, Firebase permissions, conflict behaviour across two devices, security rules emulator testing.

## Default vocabulary and optional additions

The two default decks load automatically on site launch; no upload is necessary. To add or update vocabulary, click **デッキを追加・更新** and select a JSON file structured as `{"shan":[{"id":"...","shan":"...","japanese_core":"..."}], "burmese":[{"id":"...","burmese":"...","japanese_core":"..."}]}`.

Imported words **merge with the default decks** using stable IDs and are stored locally in **IndexedDB**, not Firestore. Custom additions must be imported separately on each new device. Learning progress is stored locally in **localStorage** until cloud sync is configured.

## Preserve existing v5 progress

The old standalone `file://` game and the GitHub Pages site do **not** share localStorage. On the old v5, click **SAVE** to download the progress JSON. On v6, click **LOAD** and select that JSON. Confirm progress before enabling cloud synchronization. Future v6 updates on the same domain retain localStorage.

## Enable optional cloud sync (Firebase Console step)

1. Create a Firebase project and register a **Web app**. In Firebase Authentication, enable **Google** provider. In authorized domains add `burmeselc.github.io`.
2. Create a Cloud Firestore database and **publish `firestore.rules`** (Firestore Rules tab). Do not store personal progress under public test rules. The rules restrict access to the signed-in UID.
3. In `firebase-config.js`, replace `window.DOPA_FIREBASE_CONFIG = null` with the public Web app config object from Firebase console. Do not use a service-account JSON or an admin SDK key in this public repository.
4. Deploy to GitHub Pages and open it in your browser. Google popup login is used; some iPhone home-screen installations may require signing in from Safari first.
5. Back up local progress using SAVE. Initial conflicting cloud/local histories cause **automatic syncing to pause**. The user must explicitly choose which snapshot to keep, after backup.

### Why snapshots are chunked

Firestore has a per-document size limit. We split a UTF-8 progress snapshot into 96 KB chunks, encoded as Base64, and commit all chunks plus a versioned meta document in one Firestore transaction. This prevents an older tab from silently overwriting a newer cloud revision; stale writes show an explicit conflict.

Current limitations: last-writer preservation rather than per-word merging, no automatic migration of private vocabulary, no real-time listeners, and no completed integration test on a live Firebase project.

## Privacy and permission notes

The author-owned built-in decks are intentionally published under `data/`. Never commit personal progress JSON; it contains learning history. Check third-party rights before incorporating externally sourced media or dictionary content.

## Local development

`python3 -m http.server 8000` in this folder, then open `http://localhost:8000/`.

## Roadmap

1. Firebase project creation, rules verification, Google sign-in on iPhone.
2. Two-device syncing tests and conflict recovery with JSON backups.
3. Per-word append-only review history and merge resolution, then more robust spaced repetition.
4. UI and motivational systems as separate changes once data durability is established.
