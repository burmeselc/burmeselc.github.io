# DOPA QUEST v6 — private progress / cloud-sync foundation

DOPA QUEST vocabulary RPG for **Shan and Burmese**. This folder is a preview of the v5 → v6 migration. The game logic retains v5's RIVAL, NEMESIS, REVENGE, timed rounds, XP, and progress record.

## What is / is not deployed

- **Included:** game code, sample 8 Shan + 8 Burmese cards, vocabulary importer, local progress, JSON backup, optional Google Auth + Firestore sync, security rules.
- **Vocabulary rights:** the deck creator has explicitly confirmed both Anki sets are self-authored and authorized their inclusion. Independently sourced dictionary text, images, or audio still require separate rights checks where applicable.
- **Not yet configured:** a Firebase project or Firestore database. Without configuration, the game runs **local-only**. Cloud buttons are disabled.
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
