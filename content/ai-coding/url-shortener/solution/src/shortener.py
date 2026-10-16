"""A URL shortener with a per-client rate limit. See the README for the full rules."""
import math
import re
import secrets
import string
import time
from urllib.parse import urlsplit

from .errors import AliasTaken, InvalidAlias, InvalidUrl, NotFound
from .ratelimit import SlidingWindow

ALPHABET = string.digits + string.ascii_letters
CODE_LENGTH = 7
ALIAS = re.compile(r'[A-Za-z0-9_-]{3,30}')
MAX_URL = 2048


class Link:
    def __init__(self, url, client, expires_at):
        self.url = url
        self.client = client
        self.expires_at = expires_at
        self.hits = 0


class Shortener:
    def __init__(self, limit=10, window=60.0, clock=time.monotonic):
        """`limit` calls to shorten() per client in any `window` seconds. `clock` returns the time in
        seconds; tests pass a fake one."""
        self.clock = clock
        self.limiter = SlidingWindow(limit, window, clock)
        self.links = {}
        # (client, url) -> code of that client's plain link (no alias, no ttl): plain links never expire.
        self.plain = {}

    def shorten(self, url, client, alias=None, ttl=None):
        """Returns the code of a link to `url` made by `client`: `alias` when given, otherwise a new
        7-character code (or the code of the same client's earlier plain link to the same URL).
        The link expires `ttl` seconds from now when ttl is given. Raises InvalidUrl, InvalidAlias,
        AliasTaken, ValueError (a bad ttl) or RateLimited."""
        self.limiter.take(client)
        url = checked_url(url)
        expires_at = None if ttl is None else self.clock() + checked_ttl(ttl)
        plain = alias is None and ttl is None
        if plain and (client, url) in self.plain:
            return self.plain[client, url]
        code = self._new_code() if alias is None else self._claim(alias)
        self.links[code] = Link(url, client, expires_at)
        if plain:
            self.plain[client, url] = code
        return code

    def resolve(self, code):
        """The URL of a live link, counting one hit. Raises NotFound."""
        link = self._live(code)
        link.hits += 1
        return link.url

    def stats(self, code):
        """{'url': ..., 'hits': ..., 'client': ...} of a live link, without counting a hit. Raises NotFound."""
        link = self._live(code)
        return {'url': link.url, 'hits': link.hits, 'client': link.client}

    def _live(self, code):
        link = self.links.get(code)
        if link is None or (link.expires_at is not None and self.clock() >= link.expires_at):
            raise NotFound(code)
        return link

    def _new_code(self):
        # Random, so codes do not reveal how many links exist; 62^7 makes a retry rare.
        while True:
            code = ''.join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self.links:
                return code

    def _claim(self, alias):
        """An alias is never reused, even once its link has expired."""
        if not isinstance(alias, str) or not ALIAS.fullmatch(alias):
            raise InvalidAlias(alias)
        if alias in self.links:
            raise AliasTaken(alias)
        return alias


def checked_url(url):
    """The URL without surrounding whitespace, or InvalidUrl."""
    if not isinstance(url, str):
        raise InvalidUrl(url)
    url = url.strip()
    try:
        parts = urlsplit(url)
        host = parts.hostname
    except ValueError:
        raise InvalidUrl(url) from None
    if len(url) > MAX_URL or parts.scheme not in ('http', 'https') or not host or any(ch.isspace() for ch in url):
        raise InvalidUrl(url)
    return url


def checked_ttl(ttl):
    """A positive, finite number of seconds, or ValueError."""
    if isinstance(ttl, bool) or not isinstance(ttl, (int, float)) or not 0 < ttl < math.inf:
        raise ValueError('ttl must be a positive number of seconds')
    return ttl
