#!/usr/bin/env python3
"""Portfolio demo — 6 PIL cards (receipt-mode aesthetic) for the Mandate Beacon video."""
from __future__ import annotations
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import re
import subprocess

W, H = 1920, 1080

# Hustle Engine palette
BG = (15, 18, 14)
SURFACE = (30, 26, 20)
FG = (236, 229, 216)
MUTED = (156, 145, 131)
EMBER = (243, 106, 51)
TEAL = (84, 184, 171)
LINE = (50, 43, 33)

# Font paths — Helvetica is Mac-default; Menlo for mono
def font(size, mono=False, bold=False):
    try:
        if mono:
            return ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", size)
        if bold:
            return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size, index=1)
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except OSError:
        return ImageFont.load_default()

def new_card():
    img = Image.new("RGB", (W, H), BG)
    return img, ImageDraw.Draw(img)

def text(draw, xy, s, fill=FG, size=36, mono=False, bold=False):
    draw.text(xy, s, fill=fill, font=font(size, mono=mono, bold=bold))

def eyebrow(draw, x, y, s, fill=EMBER):
    text(draw, (x, y), s.upper(), fill=fill, size=22, mono=True)

def hr(draw, x, y, w=1760):
    draw.line([(x, y), (x + w, y)], fill=LINE, width=2)

def save(img, path):
    img.save(path, "PNG")
    print(f"  wrote {path} ({img.size})")

ROOT = Path.home() / "Documents" / "kajota-zama"
ROSTER = ROOT / "docs" / "beacon" / "sepolia-deployment.md"

def parse_rows():
    content = ROSTER.read_text()
    rows = []
    rx = re.compile(r"^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*\[tx\]\(([^)]+)\)\s*\|", re.M)
    for m in rx.finditer(content):
        rows.append({
            "seq": int(m.group(1)),
            "tick": int(m.group(2)),
            "block": int(m.group(3)),
            "mandate": m.group(4),
            "commit": m.group(5),
            "event": m.group(6).strip(),
            "tx": m.group(7),
        })
    return rows

rows = parse_rows()
print(f"Parsed {len(rows)} rows from roster")

# Event colour counts
from collections import Counter
event_counts = Counter(r["event"].split(" ")[0] for r in rows)
print(f"Event mix: {dict(event_counts)}")

# ---------- Beat 1 — hook ----------
img, d = new_card()
eyebrow(d, 160, 180, "Payflow Mandate Beacon · Sepolia · Portfolio")
text(d, (160, 240), f"{len(rows)}", fill=EMBER, size=380, bold=True)
text(d, (160, 620), "mandates on-chain", fill=FG, size=64)
text(d, (160, 720), "24 days of autonomous cron", fill=MUTED, size=42)
hr(d, 160, 800)
text(d, (160, 830), "4 event colours · 0 customer PII · 1 primitive", fill=TEAL, size=38, mono=True)
# four event chips
chips = [("Posted", EMBER), ("Settled", TEAL), ("SLABreached", (217, 72, 26)), ("DuplicateRouted", (200, 150, 70))]
x = 160
for label, col in chips:
    bbox = d.textbbox((x, 920), label, font=font(30, mono=True))
    pad = 20
    d.rectangle([(bbox[0]-pad, bbox[1]-pad), (bbox[2]+pad, bbox[3]+pad)], outline=col, width=2)
    text(d, (x, 920), label, fill=col, size=30, mono=True)
    x = bbox[2] + pad + 40
save(img, "beat1.png")

# ---------- Beat 2 — the host-protocol defect ----------
img, d = new_card()
eyebrow(d, 160, 160, "Named host-protocol defect · CBN NIP mandate spec")
text(d, (160, 220), "No replay-safety primitive", fill=EMBER, size=80, bold=True)
text(d, (160, 320), "for duplicate debits inside the 24-hour", fill=FG, size=60)
text(d, (160, 388), "dispute window.", fill=FG, size=60)
hr(d, 160, 500)
text(d, (160, 540), "At the signature layer, the second settlement", fill=MUTED, size=34)
text(d, (160, 582), "is indistinguishable from the first.", fill=MUTED, size=34)
text(d, (160, 700), "The fix — server-authored idempotency key:", fill=TEAL, size=32, mono=True)
text(d, (160, 760), 'keccak256(abi.encode(', fill=FG, size=32, mono=True)
text(d, (160, 808), '  canonicalMandate, amount, creTickBucket', fill=EMBER, size=32, mono=True)
text(d, (160, 856), '))', fill=FG, size=32, mono=True)
text(d, (160, 940), "A duplicate within TTL routes to human approval.", fill=FG, size=32)
save(img, "beat2.png")

# ---------- Beat 3 — the four event types, same 4 blocks ----------
img, d = new_card()
eyebrow(d, 160, 140, "Full state machine · four consecutive Sepolia blocks")
text(d, (160, 200), "The state machine is not slideware.", fill=EMBER, size=52, bold=True)
# four-row table — rows 7/8/9/10 from the Oct 15 seed
demo_rows = [r for r in rows if r["seq"] in (7, 8, 9, 10)]
table_y = 340
col_x = [160, 280, 450, 1150, 1500]
# header
text(d, (col_x[0], table_y), "#", fill=MUTED, size=28, mono=True)
text(d, (col_x[1], table_y), "Block", fill=MUTED, size=28, mono=True)
text(d, (col_x[2], table_y), "Event", fill=MUTED, size=28, mono=True)
text(d, (col_x[3], table_y), "Tx (prefix)", fill=MUTED, size=28, mono=True)
hr(d, 160, table_y + 46)
ry = table_y + 80
event_col = {"Posted": EMBER, "Settled": TEAL, "SLABreached": (217, 72, 26), "DuplicateRouted": (200, 150, 70)}
for r in demo_rows:
    text(d, (col_x[0], ry), str(r["seq"]), fill=FG, size=34, mono=True)
    text(d, (col_x[1], ry), str(r["block"]), fill=FG, size=34, mono=True)
    ekey = r["event"].split(" ")[0]
    text(d, (col_x[2], ry), r["event"], fill=event_col.get(ekey, FG), size=34, mono=True)
    text(d, (col_x[3], ry), r["tx"][:22] + "…", fill=MUTED, size=30, mono=True)
    ry += 80
hr(d, 160, ry + 12)
text(d, (160, ry + 50), f"Four event types · consecutive blocks · all four txs resolve on Etherscan", fill=TEAL, size=32)
save(img, "beat3.png")

# ---------- Beat 4 — the Inspector ----------
img, d = new_card()
eyebrow(d, 160, 160, "Inspector · kajota-mandate-beacon.vercel.app")
text(d, (160, 220), "Click-to-verify, no RPC round-trip", fill=EMBER, size=58, bold=True)
# three-tab mock
tab_y = 360
tabs = [
    ("MandateAnchor", "Napoleonic 1804 · direct-debit", EMBER, "0x7A4C3c92…bFacdBdECfDF6a2504"),
    ("SakkMandate", "Abbasid 10–11c · sealed instruction", TEAL, "0x0949aAa5…51d2Ea18D18b48D36063C9d7ce8349c1"),
    ("EsusuMandate", "Yoruba · rotating-savings", (217, 72, 26), "0x463463D0…eE28fEdE89525cc28A261301f14Ab9fd"),
]
for i, (tab, caption, col, addr) in enumerate(tabs):
    y = tab_y + i * 200
    d.rectangle([(160, y), (1760, y + 160)], outline=LINE, width=2, fill=SURFACE)
    text(d, (190, y + 24), tab, fill=col, size=38, bold=True)
    text(d, (190, y + 78), caption, fill=MUTED, size=28)
    text(d, (190, y + 118), addr, fill=FG, size=24, mono=True)
# footer with the verify claim
hr(d, 160, 1000)
text(d, (160, 1020), "In-browser keccak matches the on-chain rotationCommit — byte-for-byte.", fill=TEAL, size=30, mono=True)
save(img, "beat4.png")

# ---------- Beat 5 — one rail, three mechanisms, 26 tests ----------
img, d = new_card()
eyebrow(d, 160, 160, "One rail · three mandate shapes · 26 Solidity tests")
text(d, (160, 220), "Three mechanisms", fill=EMBER, size=80, bold=True)
text(d, (160, 320), "mined from history, killed by the same failure.", fill=FG, size=42)
hr(d, 160, 440)
tests = [
    ("MandateAnchor", "CBN NIP consumer-dispute mandate", "11"),
    ("SakkMandate", "Abbasid sealed banking instruction", "7"),
    ("EsusuMandate", "Yoruba rotating-savings mandate", "8"),
]
ty = 500
for name, desc, n in tests:
    text(d, (160, ty), name, fill=EMBER, size=38, bold=True)
    text(d, (160, ty + 54), desc, fill=MUTED, size=30)
    text(d, (1700, ty + 8), n, fill=TEAL, size=58, mono=True)
    text(d, (1700, ty + 76), "tests", fill=MUTED, size=22, mono=True)
    ty += 140
hr(d, 160, ty + 30)
text(d, (160, ty + 70), "26 passing · 411 ms · plain Solidity, no FHE on the regulator rail", fill=TEAL, size=30, mono=True)
save(img, "beat5.png")

# ---------- Beat 6 — Hustle Engine close ----------
img, d = new_card()
eyebrow(d, 160, 180, "Payflow Mandate Beacon · the Hustle Engine linkage")
text(d, (160, 250), "The same substrate", fill=EMBER, size=76, bold=True)
text(d, (160, 350), "that makes a CBN dispute clickable", fill=FG, size=52)
text(d, (160, 416), "also makes a seller's payout clickable", fill=FG, size=52)
text(d, (160, 482), "on KaJota's co-sell marketplace.", fill=FG, size=52)
hr(d, 160, 620)
text(d, (160, 660), "Payout reliability stops being a separate track from growth.", fill=MUTED, size=34)
hr(d, 160, 780)
text(d, (160, 820), "github.com/KaJota-inc/kajota-zama", fill=EMBER, size=42, mono=True)
text(d, (160, 880), "kajota-mandate-beacon.vercel.app", fill=TEAL, size=42, mono=True)
save(img, "beat6.png")

print("All 6 cards written.")
