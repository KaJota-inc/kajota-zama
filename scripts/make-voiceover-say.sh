#!/usr/bin/env bash
# Voiceover via macOS `say` (free, offline), timed to the caption cues + muxed.
# Run under bash:  bash scripts/make-voiceover-say.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VOICE="${VOICE:-Samantha}"
RATE="${RATE:-172}"
SRC="docs/demo/kajota-zama-demo-full-captioned.mp4"
OUT="docs/demo/kajota-zama-demo-full-voiced.mp4"
VO="/tmp/vo"; mkdir -p "$VO"

START=(400 8000 15500 23000 31000 39000 47000 63000 71000 80000 96000)
TEXT=(
"Every payment on a public blockchain is exposed. Kajota Confidential Pay keeps the amounts private, powered by F.H.E.V.M."
"I connect a Sepolia wallet. From here, every balance and every amount lives on-chain, fully encrypted."
"First, I claim a starting balance. It's a real transaction, and it runs encryption right inside the smart contract."
"On-chain, my balance is just ciphertext. I sign once, and only I can decrypt it. Ten thousand."
"Now a private transfer. The amount is encrypted in my browser before it ever leaves. The chain never sees the number."
"I decrypt again: seven thousand five hundred. It moved exactly two thousand five hundred, privately, and provably."
"The same primitive scales up. Confidential disperse splits a private balance across many recipients in one transaction, each amount individually encrypted. This is our Token Ops flow: a confidential payout, or a private airdrop."
"Every amount stays encrypted, end to end. The chain only ever stores ciphertext."
"And it confirms on-chain like any other transaction, just without leaking a single number."
"Under the hood: eight of eight tests green. Encrypted transfers, an overspend that clamps to zero with no balance leak, and strict, owner-only decryption."
"And it's live on Sepolia right now: a deploy, a confidential transfer, and a disperse, all verifiable on-chain. Confidential balances, confidential payments, confidential disperse. That's Kajota Confidential Pay."
)

echo "Generating ${#TEXT[@]} lines via say ($VOICE @ ${RATE}wpm)…"
for i in "${!TEXT[@]}"; do
  say -v "$VOICE" -r "$RATE" -o "$VO/line_$i.aiff" "${TEXT[$i]}"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VO/line_$i.aiff")
  win=""; n=$((i+1)); [ $n -lt ${#START[@]} ] && win=$(python3 -c "print(f'{(${START[$n]}-${START[$i]})/1000:.1f}')")
  printf "  line %-2s  start %6sms  dur %5.1fs  (window %ss)\n" "$i" "${START[$i]}" "$dur" "${win:-end}"
done

inputs=""; filt=""; labels=""
for i in "${!TEXT[@]}"; do
  inputs="$inputs -i $VO/line_$i.aiff"
  filt="$filt[$i]adelay=${START[$i]}:all=1[a$i];"
  labels="$labels[a$i]"
done
filt="${filt}${labels}amix=inputs=${#TEXT[@]}:normalize=0:dropout_transition=0,volume=1.5[aout]"
ffmpeg -y $inputs -filter_complex "$filt" -map "[aout]" "$VO/vo_track.wav" 2>/dev/null
echo "VO track: $(ffprobe -v error -show_entries format=duration -of csv=p=0 $VO/vo_track.wav)s (video ~116s)"

ffmpeg -y -i "$SRC" -i "$VO/vo_track.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$OUT" 2>/dev/null
echo "DONE → $OUT ($(ls -lh "$OUT" | awk '{print $5}'))"
