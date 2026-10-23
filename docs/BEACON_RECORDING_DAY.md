# Mandate Beacon — recording-day cheat-sheet

**Companion to:** [BEACON_PITCH_SCRIPT.md](./BEACON_PITCH_SCRIPT.md).
**Audience:** you, at the desk, about to hit record.
**Rule in one line:** every take at **1.0×**, nothing atempo'd, every clip ≤ 30 seconds so retakes are cheap.

The pitch script already carries the words. This file is the operations — what windows to open, what to click when, what to record separately, how to stitch, how to verify the final cut is submission-ready. Walk it top-to-bottom; nothing here is a "later".

---

## 10 minutes before you record

- [ ] **Close** every distraction window — Slack, Mail, chat tabs. The URL bar + the window-title bar WILL end up in a frame if you don't.
- [ ] **Set browser zoom to 110 %** so the inspector reads at phone-width and desktop-width both. Default 100 % looks tight on a 1080p recording.
- [ ] **Open** the inspector in **Chrome incognito** at the Vercel URL (or `kajota-hub.onrender.com/beacon/` if Vercel is pending). Confirm the manifest shows the latest anchor count.
- [ ] **Open** Etherscan to [MandateAnchor](https://sepolia.etherscan.io/address/0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504) in a separate tab, scrolled to the Events panel. Judges watch for the Etherscan jump.
- [ ] **Open** [BEACON_PITCH_SCRIPT.md](./BEACON_PITCH_SCRIPT.md) on your second monitor (or printed) — the script is read, not improvised.
- [ ] **Quit** any Dropbox / Google Drive sync icons in the menu bar. They flash. On camera.
- [ ] **Silence** phone + watch. Charge mic.
- [ ] **Pour water.** Dry mouth kills take-count.

---

## Window layout (OBS or QuickTime)

```
┌─────────────────────────────────────────────────────────┐
│ Scene 1 — INSPECTOR 2D                                   │
│ Chrome window ONLY (no menu bar, no dock), 1920×1080     │
│ Zoom 110 %. First tab = MandateAnchor by default.        │
├─────────────────────────────────────────────────────────┤
│ Scene 2 — INSPECTOR 3D                                   │
│ Same window; EsusuMandate tab with 3D toggle active.     │
│ Camera orbit should start from the member-0 angle.       │
├─────────────────────────────────────────────────────────┤
│ Scene 3 — ETHERSCAN                                      │
│ Full-page Chrome tab, Events panel visible, light theme. │
├─────────────────────────────────────────────────────────┤
│ Scene 4 — CODE                                           │
│ VSCode showing docs/BEACON_BRIEF.md §4 hard-parts        │
│ table, dark theme, font 15pt+, no sidebar.               │
└─────────────────────────────────────────────────────────┘
```

Record each scene as its own `.mov`. Do **not** switch windows live — tab animations read as broken on compressed video.

---

## The 7 clips (per [BEACON_PITCH_SCRIPT.md](./BEACON_PITCH_SCRIPT.md) beats)

| # | Clip name | Duration | Scene | Click flow during recording |
|---|---|---|---|---|
| 1 | `beacon-01-hook.mov` | 10 s | 2D hero | still frame; narrate the hook |
| 2 | `beacon-02-problem.mov` | 25 s | 2D hero | still frame; narrate the problem |
| 3 | `beacon-03-anchor.mov` | 20 s | 2D MandateAnchor tab → Etherscan | at 15 s mark, click the first anchor-row Etherscan link; let Scene 3 fill the frame for 5 s |
| 4 | `beacon-04-sakk.mov` | 20 s | 2D SakkMandate tab → Etherscan | similar — click seed-seal tx mid-sentence |
| 5 | `beacon-05-esusu.mov` | 25 s | **3D** EsusuMandate | **click Verify in the browser button** — hold on the printed hash for 4 s |
| 6 | `beacon-06-hardparts.mov` | 20 s | Scene 4 (VSCode) | scroll one screen of the HARD_PARTS table |
| 7 | `beacon-07-close.mov` | 15 s | 2D hero + 3D ring | split-screen OR cut back to hero; the close line is on screen |

**Trim-to-fit note from the pitch script:** if the total overshoots 3:00, drop beat 6 first (clip length 20 s → brings total to ~2:40). The hard-parts table lives in README anyway.

---

## Voice-first recording recipe (per [[feedback_realvoice_demo_video]])

The pitch script bans AI voice on both hackathon-safety grounds (Zama precedent) and credibility grounds (a judge who hears AI voice treats the whole submission as low-effort). Real voice only.

### Record

```bash
# For each clip, record video silent and voice separately. QuickTime audio
# screens record from the system mic; or OBS can split the channels.
# Save as:  ~/Movies/beacon-NN-name-video.mov  and  ~/Movies/beacon-NN-name-voice.wav
```

Rehearse the line **three times** before the take. First rehearsal is calibration (do I need to breathe here?); second is pacing; third is the shape. Then record. If the clip is >5 seconds off the target duration, retake immediately — splicing an off-length clip loses more time later.

### Sync (whisper.cpp)

```bash
# Install if needed:
#   brew install whisper-cpp
#
# One pass per clip to confirm the WAV matches the script, so you can edit
# WORDS not WAVEFORMS when a line misreads:
for n in 01 02 03 04 05 06 07; do
  whisper-cli -m /opt/homebrew/share/whisper-models/ggml-base.en.bin \
    -f ~/Movies/beacon-$n-*-voice.wav --output-txt
done
# Each .txt is 10-25 seconds of transcript; diff against the script and
# retake any clip whose transcript diverges meaningfully.
```

### Stitch (ffmpeg, per [[feedback_demo_video_production]])

```bash
# Overlay voice on the matching silent video, matching sample rate:
for n in 01 02 03 04 05 06 07; do
  ffmpeg -y -i ~/Movies/beacon-$n-*-video.mov \
         -i ~/Movies/beacon-$n-*-voice.wav \
         -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest \
         ~/Movies/beacon-$n-mixed.mov
done

# Concat list (one file per line, prefix 'file '):
cat > ~/Movies/beacon-concat.txt <<EOF
file 'beacon-01-mixed.mov'
file 'beacon-02-mixed.mov'
file 'beacon-03-mixed.mov'
file 'beacon-04-mixed.mov'
file 'beacon-05-mixed.mov'
file 'beacon-06-mixed.mov'
file 'beacon-07-mixed.mov'
EOF

# Produce the final (1080p 30fps H.264 for YouTube):
ffmpeg -y -f concat -safe 0 -i ~/Movies/beacon-concat.txt \
       -vf "scale=1920:1080:flags=lanczos,fps=30" -c:v libx264 -preset slow -crf 20 \
       -c:a aac -b:a 192k \
       ~/Movies/beacon-final.mp4
```

---

## Pre-upload verify

- [ ] **Duration ≤ 3:00** — `ffprobe -show_format ~/Movies/beacon-final.mp4 | grep duration`. If 3:00.1 or over, re-cut, do NOT atempo.
- [ ] **No speed change applied** — `ffprobe -i ~/Movies/beacon-final.mp4 2>&1 | grep -i tempo` must return empty. [[feedback_submission_form_rules_first]].
- [ ] **1080p 30fps H.264** — `ffprobe -i ~/Movies/beacon-final.mp4 2>&1 | grep -E "Stream.*Video"` reports `1920x1080, 30 fps, h264`.
- [ ] **Playback test with system volume at 60 %** — if the voice is unintelligible at that level, the mic was too far away; retake.
- [ ] **Watch end-to-end silently** — nothing surprising visually (notification toast, tab switch glitch, cursor sitting idle for 2 seconds).

---

## Upload

```bash
# YouTube studio: new upload → beacon-final.mp4
#   Title:       "Payflow Mandate Beacon — BLI Legal Tech Hackathon 2 submission"
#   Visibility:  Unlisted  (NOT Public, NOT Private)
#   Not for Kids: YES   (judges can't open Kids-marked videos in incognito)
#   Playlist:    (none)
#   Comments:    hold for review  (prevents junk hot-takes while judging)
#
# Copy the final URL (youtu.be/XXXXXXXX form, not watch?v=…).
```

Paste the URL into:
- [ ] [BEACON_BRIEF.md §5](./BEACON_BRIEF.md) — "Live surfaces" table, "Demo video" row flips from ⬜ to ✅
- [ ] [BEACON_SUBMIT_DRYRUN.md](./BEACON_SUBMIT_DRYRUN.md) — T−48h gate item "Demo video uploaded"
- [ ] GitHub repo README — add a "Demo" row near the top with the thumbnail link. Shape: wrap a markdown image whose src is `img.youtube.com/vi/<VIDEO_ID>/0.jpg` inside a markdown link to `youtu.be/<VIDEO_ID>`; `<VIDEO_ID>` is the 11-char slug from the Unlisted URL.

---

## Honest-ledger carry-forward

Anything that broke, or any take that cost >3 attempts, lands in [WHAT_WE_GOT_WRONG_FIRST.md](./WHAT_WE_GOT_WRONG_FIRST.md) within 48h — one more entry on the honest-ledger means one more judge trust-signal, exactly per [[feedback_winner_teardown_keeperhub]]. Common recording failures worth preempting:

- **Clock skew between QuickTime audio + QuickTime video** — one often starts a frame late, which drifts into visible lip-sync by the fifth clip. Fix: record audio with OBS instead; QuickTime audio is unreliable.
- **Esusu scene renders white on first toggle** — a cold `preview_start` sometimes needs a browser hard-reload before the 3D canvas initialises. Open the inspector 2 minutes before recording, flip to 3D once, then back to 2D, then start recording.
- **`beacon.kajota.io` CNAME failed** — the pitch script's hook mentions it; fallback is the Vercel URL. Both are already acknowledged in the script.

Related: [BEACON_PITCH_SCRIPT.md](./BEACON_PITCH_SCRIPT.md) · [BEACON_SUBMIT_DRYRUN.md](./BEACON_SUBMIT_DRYRUN.md) · [[feedback_demo_video_production]] · [[feedback_realvoice_demo_video]] · [[feedback_submission_form_rules_first]] · [[feedback_winner_teardown_keeperhub]].
