# Portfolio demo — reproducible build

This directory holds the two Python scripts that generate the 1080p PIL cards for the Mandate
Beacon portfolio video. The narration script and beat sheet live one level up at
[`docs/beacon/portfolio-demo-narration.md`](../portfolio-demo-narration.md).

Rendered artefacts (PNG, AIFF, M4A, MP4) live **outside** the repo at
`~/Documents/beacon-portfolio-build/` — they bloat the tree, they shift byte-for-byte on every
roster growth, and git history isn't a useful store for them.

## Reproduce the cards

```bash
# From ~/Documents/beacon-portfolio-build/ (or any dir where you want the PNGs to land)
python3 /path/to/kajota-zama/docs/beacon/portfolio-build/make_cards.py
python3 /path/to/kajota-zama/docs/beacon/portfolio-build/make_beat4_inspector.py
```

Both scripts read the live roster at `docs/beacon/sepolia-deployment.md` for numbers that must
match the chain at render time (beat 1's "94 mandates" and beat 3's row #7-#10 table are both
pulled from there). Beat 4 cards are self-contained; they bake the three Sepolia contract
addresses + the known `rotationCommit` from the Oct 6 `basra-draft-01` seed.

## Build the full video

Follow the narration doc one level up — AI voice via `say -v Daniel -r 162` for the first five
beats and `-r 148` for beat five, loop-PNG + audio per beat, then an xfade chain with
`acrossfade` on the audio side. Final size is ~3.7 MB at 1920×1080, 30 fps, ~1:39.

## Palette

The cards use the Hustle Engine palette (`BG #0F120E`, `EMBER #F36A33`, `TEAL #54B8AB`), which
matches the published artefact at <https://claude.ai/artifact/DqRTDi5DHKBcAEV2h7qwUY> and the
Inspector's committed stylesheet. Any new card should hold to the same tokens.
