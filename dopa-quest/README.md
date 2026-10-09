# DOPA QUEST v6 — private progress / cloud-sync foundation

DOPA QUEST vocabulary RPG for **Shan and Burmese**. This folder is a preview of the v5 → v6 migration. The game logic retains v5's RIVAL, NEMESIS, REVENGE, timed rounds, XP, and progress record.

## What is / is not deployed

- **Included:** game code, sample 8 Shan + 8 Burmese cards, vocabulary importer, local progress, JSON backup, optional Google Auth + Firestore sync, security rules.
- **Not included:** the original 5,480 Shan and 2,500 Burmese Anki-derived cards. Their redistribution rights have not been checked. The real data must be loaded privately from the user's integrated JSON.
- **Not yet configured:** a Firebase project or Firestore database. Without configuration, the game runs **local-only**. Cloud buttons are disabled.
- **Not yet production-verified:** actual iOS Safari login, Firebase permissions, conflict behaviour across two devices, security rules emulator testing.

## Load real vocabulary

Open the site over HTTPS, then click **語彙を読込**. Select an integrated JSON file structured as `{"shan":[{"id":"...","shan":"...","japanese_core":"..."}], "burmese":[{"id":"...","burmese":"...","japanese_core":"..."}]}`.

The imported wordlist is stored locally in **IndexedDB** and is not uploaded to Firestore. It will need to be imported separately on each new device. Learning progress is stored locally in **localStorage** until cloud sync is configured.

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

Never commit the private integrated vocabulary JSON or downloaded personal progress JSON. The files can include third-party dictionary data or learning history. Only the game code and intentionally authored demo cards belong in the public repository.

## Local development

`python3 -m http.server 8000` in this folder, then open `http://localhost:8000/`.

## Roadmap

1. Firebase project creation, rules verification, Google sign-in on iPhone.
2. Two-device syncing tests and conflict recovery with JSON backups.
3. Per-word append-only review history and merge resolution, then more robust spaced repetition.
4. UI and motivational systems as separate changes once data durability is established.
