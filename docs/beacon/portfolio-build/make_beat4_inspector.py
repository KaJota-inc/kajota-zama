#!/usr/bin/env python3
"""Beat 4 — three Inspector state-transition cards rendered as browser-chrome mocks."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080

# Match the Inspector's committed stylesheet palette (Hustle Engine)
BG = (15, 18, 14)
SURFACE = (30, 26, 20)
SURFACE2 = (36, 32, 24)
FG = (236, 229, 216)
MUTED = (156, 145, 131)
EMBER = (243, 106, 51)
TEAL = (84, 184, 171)
LINE = (50, 43, 33)
DIM = (80, 70, 55)

def font(size, mono=False, bold=False):
    try:
        if mono:
            return ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", size)
        if bold:
            return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size, index=1)
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except OSError:
        return ImageFont.load_default()

def text(d, xy, s, fill=FG, size=36, mono=False, bold=False):
    d.text(xy, s, fill=fill, font=font(size, mono=mono, bold=bold))

def new_card():
    img = Image.new("RGB", (W, H), BG)
    return img, ImageDraw.Draw(img)

def browser_chrome(d, url_text):
    # Grey bar top
    d.rectangle([(0, 0), (W, 72)], fill=(42, 37, 28))
    # Traffic lights
    for i, col in enumerate([(240, 95, 87), (240, 190, 70), (85, 200, 105)]):
        cx = 36 + i * 36
        d.ellipse([(cx, 24), (cx + 24, 48)], fill=col)
    # URL bar
    d.rectangle([(180, 18), (W - 60, 54)], fill=(22, 19, 14), outline=LINE, width=2)
    text(d, (204, 26), url_text, fill=MUTED, size=22, mono=True)

def tab_bar(d, active_index):
    y = 92
    tabs = ["MandateAnchor", "SakkMandate", "EsusuMandate"]
    x = 160
    for i, t in enumerate(tabs):
        w = 300
        if i == active_index:
            d.rectangle([(x, y), (x + w, y + 60)], fill=SURFACE2, outline=EMBER, width=3)
            text(d, (x + 24, y + 12), t, fill=EMBER, size=32, bold=True)
        else:
            d.rectangle([(x, y), (x + w, y + 60)], fill=SURFACE, outline=LINE, width=2)
            text(d, (x + 24, y + 12), t, fill=MUTED, size=32)
        x += w + 20

def heading(d, s):
    text(d, (160, 200), s, fill=EMBER, size=52, bold=True)

def meta_row(d, y, label, value, value_col=FG, value_mono=True):
    text(d, (160, y), label, fill=MUTED, size=26, mono=True)
    text(d, (420, y), value, fill=value_col, size=28, mono=value_mono)

# ---------- Beat 4a — MandateAnchor tab ----------
img, d = new_card()
browser_chrome(d, "kajota-mandate-beacon.vercel.app/#/mandate-anchor")
tab_bar(d, 0)
heading(d, "MandateAnchor — CBN consumer-dispute mandate")
text(d, (160, 280), "Napoleonic 1804 · direct-debit lineage · 24-hour reversal SLA", fill=MUTED, size=30)
d.rectangle([(160, 360), (1760, 760)], fill=SURFACE, outline=LINE, width=2)
meta_row(d, 400, "address", "0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504")
meta_row(d, 450, "deployer", "0xC58A7717fdf1Bc40dFb63b02ab54D6CF6c8F7093")
meta_row(d, 500, "sla window", "86 400 s  ·  CBN CPR 2019", value_col=TEAL)
meta_row(d, 550, "anchors on record", "94  ·  last @ block 11 958 462", value_col=EMBER)
meta_row(d, 600, "event colours", "Posted · Settled · SLABreached · DuplicateRouted", value_col=TEAL)
meta_row(d, 650, "cron cadence", "7 past every 6 h  ·  autonomous since 2026-10-15", value_col=TEAL)
text(d, (160, 820), "View 94 rows on Etherscan →", fill=EMBER, size=28, mono=True)
d.rectangle([(1620, 1020), (1760, 1060)], outline=EMBER, width=2)
text(d, (1640, 1028), "LIVE", fill=EMBER, size=22, bold=True)
img.save("beat4a.png")

# ---------- Beat 4b — SakkMandate tab ----------
img, d = new_card()
browser_chrome(d, "kajota-mandate-beacon.vercel.app/#/sakk-mandate")
tab_bar(d, 1)
heading(d, "SakkMandate — sealed Abbasid banking instruction")
text(d, (160, 280), "10th–11th century · payer seals · witness quorum attests · beneficiary opens", fill=MUTED, size=28)
d.rectangle([(160, 360), (1760, 760)], fill=SURFACE, outline=LINE, width=2)
meta_row(d, 400, "address", "0x0949aAa551d2Ea18D18b48D36063C9d7ce8349c1")
meta_row(d, 450, "commit scheme", "keccak256(abi.encode(bodyBytes, nonce))", value_col=TEAL)
meta_row(d, 500, "seed sakk id", "basra-draft-01", value_col=EMBER)
meta_row(d, 550, "quorum", "2 of 3 witnesses · HD paths 1/2/3 off deployer", value_col=TEAL)
meta_row(d, 600, "seal tx", "0xeb6361408fadea77966e8610986699067e6d12c58f27…", value_col=EMBER)
meta_row(d, 650, "sealedAt", "block 11 858 671 · 2026-10-06T22:04:36 UTC", value_col=TEAL)
text(d, (160, 820), "Historical failure fixed: replay-on-physical-seal detectable now.", fill=FG, size=28)
d.rectangle([(1620, 1020), (1760, 1060)], outline=EMBER, width=2)
text(d, (1640, 1028), "LIVE", fill=EMBER, size=22, bold=True)
img.save("beat4b.png")

# ---------- Beat 4c — EsusuMandate tab WITH in-browser verifier open ----------
img, d = new_card()
browser_chrome(d, "kajota-mandate-beacon.vercel.app/#/esusu-mandate")
tab_bar(d, 2)
heading(d, "EsusuMandate — Yoruba rotating-savings mandate")
text(d, (160, 280), "Pre-colonial West African ajo · pinned collector order on-chain", fill=MUTED, size=28)
d.rectangle([(160, 360), (1760, 540)], fill=SURFACE, outline=LINE, width=2)
meta_row(d, 400, "address", "0x463463D0eE28fEdE89525cc28A261301f14Ab9fd")
meta_row(d, 450, "rotation seed", "lagos-market-01  ·  3 members, 7-day cycle", value_col=TEAL)
# Verifier card below
d.rectangle([(160, 580), (1760, 940)], fill=SURFACE2, outline=TEAL, width=3)
text(d, (190, 598), "⚡ IN-BROWSER VERIFY", fill=TEAL, size=26, mono=True, bold=True)
text(d, (190, 650), "rotationCommit (computed here from the manifest)", fill=MUTED, size=24, mono=True)
text(d, (190, 695), "0xe63fcfcc259fecf65e847c805041d2ef2a215f68b482eeb0d29982518cc17a7f", fill=FG, size=22, mono=True)
text(d, (190, 750), "rotationCommit (returned by EsusuMandate.rotationCommit() on-chain)", fill=MUTED, size=24, mono=True)
text(d, (190, 795), "0xe63fcfcc259fecf65e847c805041d2ef2a215f68b482eeb0d29982518cc17a7f", fill=FG, size=22, mono=True)
# match badge
d.rectangle([(190, 850), (520, 910)], outline=TEAL, width=3, fill=(20, 40, 36))
text(d, (210, 862), "✓ BYTE-FOR-BYTE MATCH", fill=TEAL, size=26, mono=True, bold=True)
text(d, (560, 866), "no RPC trust required — the chain is the audit log", fill=MUTED, size=24, mono=True)
d.rectangle([(1620, 1020), (1760, 1060)], outline=EMBER, width=2)
text(d, (1640, 1028), "LIVE", fill=EMBER, size=22, bold=True)
img.save("beat4c.png")

print("3 Inspector state cards written.")
