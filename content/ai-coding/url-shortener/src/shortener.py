"""A URL shortener with a per-client rate limit. See the README for the full rules."""
import time


class Shortener:
    def __init__(self, limit=10, window=60.0, clock=time.monotonic):
        """`limit` calls to shorten() per client in any `window` seconds. `clock` returns the time in
        seconds; tests pass a fake one."""
        self.limit = limit
        self.window = window
        self.clock = clock

    def shorten(self, url, client, alias=None, ttl=None):
        """Returns the code of a link to `url` made by `client`: `alias` when given, otherwise a new
        7-character code (or the code of the same client's earlier plain link to the same URL).
        The link expires `ttl` seconds from now when ttl is given. Raises InvalidUrl, InvalidAlias,
        AliasTaken, ValueError (a bad ttl) or RateLimited."""
        raise NotImplementedError

    def resolve(self, code):
        """The URL of a live link, counting one hit. Raises NotFound."""
        raise NotImplementedError

    def stats(self, code):
        """{'url': ..., 'hits': ..., 'client': ...} of a live link, without counting a hit. Raises NotFound."""
        raise NotImplementedError
