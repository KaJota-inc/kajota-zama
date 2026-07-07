#!/usr/bin/env bash
# Generate an OpenAI-TTS voiceover, time each line to the video's caption cues,
# and mux it onto the stitched demo. Reads the API key from ~/.openai_key (gitignored,
# never in the repo or chat). Run under bash:  bash scripts/make-voiceover.sh
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="$(cat ~/.openai_key)"
VOICE="${VOICE:-onyx}"
MODEL="${MODEL:-gpt-4o-mini-tts}"
INSTR="Confident, warm, measured product-demo narrator. Clear diction, steady pace."
SRC="docs/demo/kajota-zama-demo-full-captioned.mp4"
OUT="docs/demo/kajota-zama-demo-full-voiced.mp4"
VO="/tmp/vo"; mkdir -p "$VO"

# start time (ms) for each line — matched to the caption cues
START=(400 7000 15000 23000 31000 39000 47000 63000 71000 80000 96000)
TEXT=(
"Every payment on a public blockchain is exposed — your balance, every amount, all of it. Kajota Confidential Pay changes that: private payments on Ethereum, powered by Zama's F.H.E.V.M."
"I connect a Sepolia wallet. From here, every balance and every amount lives on-chain, fully encrypted."
"First, I claim a starting balance. It's a real transaction, and it runs encryption right inside the smart contract."
"On-chain, my balance is just ciphertext. I sign once, and only I can decrypt it. Ten thousand."
"Now a private transfer. The amount is encrypted in my browser before it ever leaves. The chain never sees the number."
"I decrypt again: seven thousand five hundred. It moved exactly two thousand five hundred, privately, and provably."
"The same primitive scales up. Confidential disperse splits a private balance across many recipients in one transaction, each amount individually encrypted. This is our TokenOps flow — a confidential payout, or a private airdrop."
"Every amount stays encrypted, end to end. The chain only ever stores ciphertext."
"And it confirms on-chain like any other transaction, just without leaking a single number."
"Under the hood: eight of eight tests green. Encrypted transfers, an overspend that clamps to zero with no balance leak, and strict, owner-only decryption."
"And it's live on Sepolia right now — a deploy, a confidential transfer, and a disperse, all verifiable on-chain. Confidential balances, confidential payments, confidential disperse. That's Kajota Confidential Pay."
)

echo "Generating ${#TEXT[@]} lines via OpenAI TTS ($MODEL / $VOICE)…"
for i in "${!TEXT[@]}"; do
  out="$VO/line_$i.wav"
  code=$(curl -s -w '%{http_code}' -o "$out" https://api.openai.com/v1/audio/speech \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"model":sys.argv[1],"voice":sys.argv[2],"input":sys.argv[3],"instructions":sys.argv[4],"response_format":"wav"}))' "$MODEL" "$VOICE" "${TEXT[$i]}" "$INSTR")")
  if [ "$code" != "200" ]; then echo "  line $i FAILED (HTTP $code): $(head -c 200 "$out")"; exit 1; fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")
  printf "  line %-2s  start %6sms  dur %5.1fs\n" "$i" "${START[$i]}" "$dur"
done

# Build the timed, mixed VO track
inputs=""; filt=""; labels=""
for i in "${!TEXT[@]}"; do
  inputs="$inputs -i $VO/line_$i.wav"
  filt="$filt[$i]adelay=${START[$i]}:all=1[a$i];"
  labels="$labels[a$i]"
done
filt="${filt}${labels}amix=inputs=${#TEXT[@]}:normalize=0:dropout_transition=0,volume=1.5[aout]"
ffmpeg -y $inputs -filter_complex "$filt" -map "[aout]" "$VO/vo_track.wav" 2>/dev/null
echo "VO track built: $(ffprobe -v error -show_entries format=duration -of csv=p=0 $VO/vo_track.wav)s"

# Mux onto the captioned video
ffmpeg -y -i "$SRC" -i "$VO/vo_track.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$OUT" 2>/dev/null
echo "DONE → $OUT ($(ls -lh "$OUT" | awk '{print $5}'))"
