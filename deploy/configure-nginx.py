"""Attach private media delivery to cswork's proxy, preserving other vhosts/TLS."""
import re
import sys
from pathlib import Path


def with_media_location(text: str) -> str:
    text = re.sub(
        r"^[ \t]*include /etc/nginx/snippets/cswork-media\.conf;[ \t]*\n",
        "", text, flags=re.M,
    )
    pattern = r"(?m)^([ \t]*)location / \{\s*\n[ \t]*proxy_pass http://127\.0\.0\.1:4317;"
    matches = list(re.finditer(pattern, text))
    if len(matches) != 1:
        raise ValueError("Cannot uniquely locate the cswork proxy; refusing to rewrite nginx")
    start, indent = matches[0].start(), matches[0].group(1)
    return text[:start] + indent + "include /etc/nginx/snippets/cswork-media.conf;\n" + text[start:]


if __name__ == "__main__":
    path = Path(sys.argv[1])
    path.write_text(with_media_location(path.read_text()))
