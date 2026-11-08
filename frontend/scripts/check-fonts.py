"""out/ の .ttf と .otf を fontTools で読み、両形式が同じ見た目（名前・メトリクス・cmap・送り幅・輪郭の範囲）になっているかを確かめる。

OTS（ブラウザと同じフォントの検証器）でも、両方のフォントを確かめる。

使い方（pip install -r scripts/requirements-fonts.txt で fontTools と OTS を入れる）：
    npm run fonts:sample && python3 scripts/check-fonts.py sample-fonts/Sample.ttf sample-fonts/Sample.otf
"""

import sys

import ots

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont


def names(font):
    return sorted(
        (r.platformID, r.platEncID, r.langID, r.nameID, r.toUnicode()) for r in font["name"].names
    )


def bounds(font, name):
    pen = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(pen)
    return pen.bounds


def main(ttf_path, otf_path):
    errors = []
    for path in (ttf_path, otf_path):
        r = ots.sanitize(path, "/dev/null", capture_output=True, text=True)
        print(f"OTS {path}: {r.stdout.strip()} {r.stderr.strip()}")
        if r.returncode != 0:
            errors.append(f"OTS で失敗した: {path}")

    ttf, otf = TTFont(ttf_path), TTFont(otf_path)

    def check(label, a, b):
        if a != b:
            errors.append(f"{label}: ttf={a!r} otf={b!r}")

    assert "glyf" in ttf and "CFF " in otf, "形式が違う"
    check("name", names(ttf), names(otf))
    for table, fields in {
        "head": ["unitsPerEm", "fontRevision", "macStyle"],
        "hhea": ["ascent", "descent", "lineGap"],
        "OS/2": [
            "fsType", "usWeightClass", "sTypoAscender", "sTypoDescender", "sTypoLineGap",
            "usWinAscent", "usWinDescent", "ulCodePageRange1", "ulUnicodeRange1", "ulUnicodeRange2",
            "fsSelection", "achVendID", "sxHeight", "sCapHeight", "xAvgCharWidth",
        ],
        "post": ["underlinePosition", "underlineThickness", "isFixedPitch"],
    }.items():
        for f in fields:
            check(f"{table}.{f}", getattr(ttf[table], f), getattr(otf[table], f))

    # グリフ名は形式によって付け方が違う（.ttf は ASCII を "A" などにする）ので、コードポイントで対応付ける
    cmap_t, cmap_o = ttf.getBestCmap(), otf.getBestCmap()
    check("cmap のコードポイント", sorted(cmap_t), sorted(cmap_o))
    pairs = [(".notdef", ".notdef", ".notdef")] + [
        (f"U+{cp:04X}", cmap_t[cp], cmap_o[cp]) for cp in sorted(cmap_t) if cp in cmap_o
    ]
    for label, nt, no in pairs:
        check(f"advance {label}", ttf["hmtx"][nt][0], otf["hmtx"][no][0])
        bt, bo = bounds(ttf, nt), bounds(otf, no)
        # .otf は三次曲線の制御点を整数に丸めるので、1 単位までの差は許す
        if (bt is None) != (bo is None) or (
            bt and any(abs(x - y) > 1 for x, y in zip(bt, bo))
        ):
            errors.append(f"bounds {label}: ttf={bt} otf={bo}")

    print(f"glyphs: {len(ttf.getGlyphOrder())}, cmap: {len(cmap_t)}")
    for n in names(ttf):
        print("name", n)
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print("OK: .ttf と .otf の値が一致した")


if __name__ == "__main__":
    main(*sys.argv[1:3])
