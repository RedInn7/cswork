"""Attach private media delivery to cswork's proxy, preserving other vhosts/TLS."""
import re
import sys
from pathlib import Path


def with_media_location(text: str) -> str:
    text = re.sub(
        r"^[ \t]*include /etc/nginx/snippets/cswork-(?:media|oj-import)\.conf;[ \t]*\n",
        "", text, flags=re.M,
    )
    pattern = r"(?m)^([ \t]*)location / \{\s*\n[ \t]*proxy_pass http://127\.0\.0\.1:4317;"
    matches = list(re.finditer(pattern, text))
    if len(matches) != 1:
        raise ValueError("Cannot uniquely locate the cswork proxy; refusing to rewrite nginx")
    start, indent = matches[0].start(), matches[0].group(1)
    return (text[:start] + indent + "include /etc/nginx/snippets/cswork-media.conf;\n"
            + indent + "include /etc/nginx/snippets/cswork-oj-import.conf;\n" + text[start:])


def with_server_names(text: str, names: list[str]) -> str:
    """Add hostnames to every server_name in the cswork vhost, keeping existing ones first."""
    def merge(m: re.Match) -> str:
        current = m.group(2).split()
        return m.group(1) + " ".join(current + [n for n in names if n not in current]) + ";"
    result, count = re.subn(r"(?m)^([ \t]*server_name[ \t]+)([^;]+);", merge, text)
    if not count:
        raise ValueError("No server_name in the cswork vhost; refusing to rewrite nginx")
    return result


CANONICAL_MARK = "# cswork-canonical"


def with_canonical(text: str, host: str | None) -> str:
    """Redirect every other HTTPS hostname to `host`; None removes the redirect (rollback)."""
    text = re.sub(rf"(?m)^[ \t]*if \(\$host != [^)]+\) {{[^\n]*{CANONICAL_MARK}\n", "", text)
    if not host:
        return text
    tls = list(re.finditer(r"(?m)^([ \t]*)listen 443 ssl;[^\n]*\n", text))
    if len(tls) != 1:
        raise ValueError("Cannot uniquely locate the cswork HTTPS server; refusing to rewrite nginx")
    indent, end = tls[0].group(1), tls[0].end()
    line = f"{indent}if ($host != {host}) {{ return 301 https://{host}$request_uri; }} {CANONICAL_MARK}\n"
    return text[:end] + line + text[end:]


if __name__ == "__main__":
    # configure-nginx.py FILE                      media/import includes (install.sh)
    # configure-nginx.py FILE --names A B ...      add hostnames
    # configure-nginx.py FILE --canonical HOST|-   redirect to HOST, or remove the redirect
    path, args = Path(sys.argv[1]), sys.argv[2:]
    text = path.read_text()
    if args[:1] == ["--names"]:
        text = with_server_names(text, args[1:])
    elif args[:1] == ["--canonical"]:
        text = with_canonical(text, None if args[1] == "-" else args[1])
    else:
        text = with_media_location(text)
    path.write_text(text)
