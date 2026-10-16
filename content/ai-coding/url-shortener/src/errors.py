"""The errors the shortener raises on purpose. Callers catch these, so keep the names and bases."""


class ShortenerError(Exception):
    """Base of every error below."""


class InvalidUrl(ShortenerError, ValueError):
    """Not an http(s) URL with a host, longer than 2048 characters, or with whitespace inside."""


class InvalidAlias(ShortenerError, ValueError):
    """A custom alias that is not 3-30 characters of A-Z, a-z, 0-9, '_' and '-'."""


class AliasTaken(ShortenerError):
    """The alias is already a code, of a live or an expired link."""


class NotFound(ShortenerError, LookupError):
    """No live link has this code: it never existed, or it expired."""


class RateLimited(ShortenerError):
    """The client used up its calls for the window; retry_after is how many seconds until it may call again."""

    def __init__(self, retry_after):
        super().__init__('rate limited: retry in %.1f s' % retry_after)
        self.retry_after = retry_after
