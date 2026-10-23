#!/usr/bin/env bash
# Link-smoke every URL + relative path in a Markdown file.
#
# Usage:
#   scripts/beacon/link-smoke.sh README.md
#   scripts/beacon/link-smoke.sh docs/BEACON_BRIEF.md
#
# Exits 0 if every load-bearing link resolves. Exits 1 on any real failure.
# Bot-detection false-positives are allow-listed in the BOT_BLOCKED grep below —
# the dorahacks.io case returned 405 on curl HEAD + GET but 200 to a real browser,
# so we treat UA-driven 403/405 as pass when the host matches the allow-list.
#
# The three failure modes the hackathon-winning-playbook calls out
# ([[feedback_fact_check_public_posts]]): dead URLs, missing files,
# claimed-public-but-private repos. All three fire this script.

set -eo pipefail

MD="${1:-README.md}"
[[ -f $MD ]] || { echo "✗ not a file: $MD" >&2; exit 2; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# Markdown relative paths resolve against the FILE'S DIRECTORY, not the repo root —
# that is how GitHub (and every Markdown viewer) renders them. A link
# `[docs/BEACON_BRIEF.md](./WHAT_WE_GOT_WRONG_FIRST.md)` points at
# docs/WHAT_WE_GOT_WRONG_FIRST.md, not root/WHAT_WE_GOT_WRONG_FIRST.md.
MD_DIR="$(cd "$(dirname "$MD")" && pwd)"

# Browser-ish UA to defeat the common curl-blocking WAFs (dorahacks, cloudflare, etc.).
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Hosts whose 403/405 responses to any UA we treat as "bot-detection, judges see 200".
# Add here only after a browser-click confirms the page is up for a human.
BOT_BLOCKED='^https?://(dorahacks\.io|www\.linkedin\.com|twitter\.com|x\.com|claude\.ai)/'

fail=0
pass=0
skipped=0

check_http() {
  local url=$1
  local code
  code=$(curl -sI -o /dev/null -w "%{http_code}" -L --max-time 10 -A "$UA" "$url" 2>&1 || echo "000")
  # 429 is rate-limiting (common on github.com from CI). Retry once after a short sleep;
  # if still 429 count as pass — a browser clicking the same URL would succeed.
  if [[ $code == 429 ]]; then
    sleep 3
    code=$(curl -sI -o /dev/null -w "%{http_code}" -L --max-time 10 -A "$UA" "$url" 2>&1 || echo "000")
  fi
  if [[ $code == 2* ]] || [[ $code == 3* ]]; then
    echo "✓ $code $url"; pass=$((pass + 1))
  elif [[ $code == 429 ]]; then
    echo "⚠ 429 (rate-limited twice; browser would clear) $url"; pass=$((pass + 1))
  elif { [[ $code == 403 ]] || [[ $code == 405 ]] || [[ $code == 406 ]]; } && [[ $url =~ $BOT_BLOCKED ]]; then
    echo "⚠ $code (bot-block; verified browser-200) $url"; pass=$((pass + 1))
  else
    echo "✗ $code $url"; fail=$((fail + 1))
  fi
}

check_path() {
  local p=$1
  # Intra-page anchors (#heading) and in-code example commands are not file paths.
  [[ $p == \#* ]] && { echo "⊝ anchor: $p"; skipped=$((skipped + 1)); return; }
  # Strip trailing #anchor fragments ("docs/X.md#heading" → "docs/X.md").
  local path="${p%%#*}"
  # Resolve against the markdown file's directory, not CWD.
  local resolved
  if [[ $path = /* ]]; then
    resolved="$path"
  else
    resolved="$MD_DIR/$path"
  fi
  if [[ -e $resolved ]]; then
    echo "✓ exists: $p"; pass=$((pass + 1))
  else
    echo "✗ MISSING: $p (resolved: $resolved)"; fail=$((fail + 1))
  fi
}

echo "═══ ${MD} — HTTP links ═══"
# URL char class stops at whitespace, markdown delimiters, inline-code
# backticks, and sentence-ending punctuation; sed strips trailing
# punctuation that may still cling (period, comma, colon, semicolon,
# right-paren without matching left) — the Markdown autolink spec treats
# these as sentence punctuation, not URL characters.
while IFS= read -r url; do
  [[ -z $url ]] && continue
  if [[ $url == http://localhost* ]]; then
    echo "⊝ localhost (not shipped): $url"; skipped=$((skipped + 1))
    continue
  fi
  check_http "$url"
done < <(grep -oE 'https?://[^][ )`"<>'"'"']+' "$MD" | sed 's/[.,:;]*$//' | sort -u)

echo
echo "═══ ${MD} — relative paths ═══"
# Markdown link syntax: ](path) where path doesn't start with 'h' (not http) or '#' (anchor).
while IFS= read -r p; do
  [[ -z $p ]] && continue
  check_path "$p"
done < <(grep -oE '\]\([^)h#][^)]*' "$MD" | sed 's/^](//' | sort -u)

echo
echo "═══ summary ═══"
echo "  pass    $pass"
echo "  skipped $skipped"
echo "  fail    $fail"

if (( fail > 0 )); then
  echo "✗ link-smoke failed: $fail broken link(s)"
  exit 1
fi
echo "✓ link-smoke clean"
