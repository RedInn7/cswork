# Re-encodes downloaded content images as WebP (at most 1200 px wide, quality 80) and points
# parsed/assets-map.json at the new files; originals that were replaced are removed.
#   python3 -I scripts/content-import/prachub/compress-images.py
# Run after fetch-images.mjs; already converted images are skipped, so it can run again.
import hashlib
import io
import json
import os
from pathlib import Path

from PIL import Image

DIR = Path(os.environ.get('PRACHUB_DIR', Path.home() / 'cswork-prachub'))
ASSETS = DIR / 'assets'
MAP = DIR / 'parsed' / 'assets-map.json'
MAX_WIDTH, QUALITY = 1200, 80


def webp(src: Path) -> bytes | None:
    with Image.open(src) as im:
        if getattr(im, 'is_animated', False):
            return None
        im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
        if im.width > MAX_WIDTH:
            im.thumbnail((MAX_WIDTH, im.height))
        out = io.BytesIO()
        im.save(out, 'WEBP', quality=QUALITY, method=6)
        return out.getvalue()


def main() -> None:
    mapping = json.loads(MAP.read_text())
    before = after = converted = 0
    replaced: dict[str, str] = {}
    for url, local in mapping.items():
        name = local.rsplit('/', 1)[1]
        src = ASSETS / name
        if name.endswith(('.svg', '.gif', '.webp')) or not src.exists():
            continue
        if name in replaced:  # same image referenced by several URLs
            mapping[url] = replaced[name]
            continue
        data = webp(src)
        size = src.stat().st_size
        before += size
        if not data or len(data) >= size:
            after += size
            continue
        new = f'{hashlib.sha1(data).hexdigest()}.webp'
        (ASSETS / new).write_bytes(data)
        replaced[name] = mapping[url] = f'/content-assets/{new}'
        after += len(data)
        converted += 1
    MAP.write_text(json.dumps(mapping, indent=1))
    for name in replaced:
        (ASSETS / name).unlink(missing_ok=True)
    print(f'converted {converted}; {before / 2**20:.0f} MB -> {after / 2**20:.0f} MB')


if __name__ == '__main__':
    main()
