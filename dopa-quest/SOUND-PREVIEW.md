# DOPA QUEST — music-safe sound effects preview

This branch is **preview only**. Do not merge into main until music coexistence has been tested on an actual iPhone.

## Sound events

The entire sound design is synthesized with the Web Audio API in `sound-fx.js`; no downloaded samples and no background music.

- Correct: bright two-note chime.
- Incorrect: subtle low descending cue.
- COMBO 3 / COMBO 5 / COMBO 10: increasingly rich ascending sequences.
- BOSS entrance: short two-hit warning, distinct from victory.
- BOSS success: short low hit followed by a victory chord.
- First mastery seal: shimmering notes.
- NEMESIS defeat / RIVAL win: distinctive victory sequences.
- Level-up: sparkling rising arpeggio.
- Quest result: high- or low-score sting.

All are brief (under approximately 1.2 seconds). The game emits a **single prioritized event** for a correct answer to avoid overlapping celebratory cues. Presets are OFF, quiet, standard and flashy; a separate 0–100 volume slider and preview buttons are provided behind a collapsed panel.

## Preserve other audio

- On an Apple mobile browser, request `navigator.audioSession.type='ambient'` **before creating** an `AudioContext`. Repeat the policy check on every effect.
- If any mobile environment (including iOS or Android) cannot verify the ambient setting, deliberately **suppress new SFX** instead of risking background music interruption.
- On desktop browsers without the Audio Session API, Web Audio continues as normal; coexistence still depends on the operating system. Unconfirmed mobile environments stay silent.
- No `playback`, `transient-solo` or hidden looping audio workaround, no new background music, no MediaSession changes.
- Silent-mode playback is **not** guaranteed. Existing optional speech-synthesis/TTS is separate and may independently interrupt other music; this change does not alter TTS behavior.
- Audio session APIs express intent but do **not** establish that Apple Music or Spotify will never stop; test Safari and the actual preferred iPhone browser with each app actively playing music.

## Backwards compatibility

- The `dopaQuestV5_profile` key, card IDs and Firebase save structure remain unchanged.
- Legacy `P.sound` is preserved alongside the new optional `P.sfxStyle` and `P.sfxVolume`.
- When importing an older progress file, the old SOUND/MUTE state selects the corresponding default preset. Export and cloud restoration also restore preset and volume values.
- Preview is hosted on an isolated external origin, so production cloud sync is not activated.

## Acceptance checklist

1. On iPhone, start Apple Music; open preview and play all SFX at the flashy preset. Confirm Music remains playing and is not ducked unexpectedly.
2. Repeat with Spotify.
3. Repeat with the device's Silent switch on/off. In ambient mode, SFX may be silent with the switch on; preserving background music takes priority.
4. Check volume balance with Bluetooth earbuds, wired audio and iPhone speaker if applicable; preview default is 30%, not maximum.
5. Test OFF, quiet, standard and flashy, and ensure the existing SOUND header button still toggles sound.
6. Export/restore a SAVE file; ensure current vocabulary review history is preserved.

## Follow-up tuning (2026-10-10)

- Standard plays complete motifs instead of removing their resolution. Quiet compresses a cue to its first and final pitch; flashy adds brief, soft octave bell layers.
- Increase the common output gain from 0.08 to 0.14, keeping default volume at 30%; remove harsh sawtooth attacks and bring the miss cue into a more audible register. Actual perceived loudness still requires human audition.
- A new cue cancels the preceding cue and queued tails. MUTE, OFF, zero volume and page hiding stop active voices; completed voices disconnect their nodes.
- Reject non-finite volume, throwing session accessors, refused ambient settings and interrupted sessions. Recheck policy after context creation and before each cue.
- RIVAL completion takes precedence over routine boss/combo cues; each answer still emits one cue. Boss appearance uses a separate warning.
- All 13 cues have audition buttons. Card data, scoring, profile key and learning history are unchanged.
- Actual iPhone + Apple Music/Spotify coexistence and listening quality remain UNVERIFIED. CI checks control flow and desktop Chromium behavior only. Do not merge without device acceptance.
