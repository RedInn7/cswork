"""
Builds the fixed CJK font subset the Open Graph cards draw with (lib/server/og-card.tsx):
public/fonts/noto-sans-sc-og-{400,700}.otf and noto-sans-sc-og.txt, every character both keep.

The set never depends on what a card says: printable ASCII, Latin-1 and Latin Extended-A,
common punctuation and arrows, CJK and full-width punctuation, and the 3755 level-1 hanzi of
GB2312 (the commonly used characters). A card with any other character falls back to its
English / handle text, so no text is ever sent to a font service.

  pip install fonttools
  python scripts/og-font.py NotoSansSC-Regular.otf NotoSansSC-Bold.otf

The sources are Noto Sans SC 1.004 (SIL Open Font License 1.1, public/fonts/OFL-NotoSansSC.txt).
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

out = Path(__file__).resolve().parent.parent / 'public' / 'fonts'
codes = set(range(0x20, 0x7F)) | set(range(0xA0, 0x180))
codes |= {ord(c) for c in '–—‘’“”…·•′″‰€™←↑→↓↗✓×÷'}
codes |= set(range(0x3000, 0x3020)) | set(range(0xFF01, 0xFF5F))
for row in range(0xB0, 0xD8):
    for cell in range(0xA1, 0xFF):
        if row == 0xD7 and cell > 0xF9:
            break
        codes.add(ord(bytes([row, cell]).decode('gb2312')))

kept = None
for source, weight in zip(sys.argv[1:3], (400, 700)):
    font = TTFont(source)
    options = subset.Options()
    options.layout_features = ['kern', 'liga', 'palt', 'vert']
    options.name_IDs = ['*']
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(unicodes=codes)
    sub.subset(font)
    font.save(out / f'noto-sans-sc-og-{weight}.otf')
    cmap = set(font.getBestCmap())
    kept = cmap if kept is None else kept & cmap

(out / 'noto-sans-sc-og.txt').write_text(''.join(chr(c) for c in sorted(kept)), encoding='utf-8')
print(len(kept), 'characters')
