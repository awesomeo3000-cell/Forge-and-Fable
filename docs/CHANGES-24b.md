# Changes 24b — Soundboard and table audio

## Delivered

- Schema revision 4 adds migration-ledger entries plus `campaign_tracks` and versioned `campaign_audio` state.
- The DM can add/remove direct audio URLs, start/stop looping music, and fire one-shot cues from The Soundboard.
- Players receive shared now-playing state through campaign sync, but keep local mute and volume controls.
- Audio requires an explicit **Join table audio** action; it does not assume browser autoplay permission.

## Verification

- Store tests cover track creation, now-playing updates, and stale-version conflict handling.
- Manual speaker testing remains required for browser autoplay, late join/reload seeking, cue-once behavior, and cleanup when leaving a campaign.

## Scope

- This round stores direct URLs only. It does not add uploads or an audio-hosting service.
