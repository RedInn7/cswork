# URL shortener with rate limits

A take-home assignment of the kind many teams send instead of, or after, a phone screen. Budget about three hours. There is no AI pair here: work the way you would if the company asked you not to use one.

## The brief

Implement the `Shortener` class in `src/shortener.py`. The error classes in `src/errors.py` are part of the interface: raise them as described and keep their names. Add any modules you like under `src/`, and your own tests under `tests/`.

```python
shortener = Shortener(limit=10, window=60.0, clock=time.monotonic)
code = shortener.shorten(url, client, alias=None, ttl=None)
shortener.resolve(code)   # -> url, counts a hit
shortener.stats(code)     # -> {'url': ..., 'hits': ..., 'client': ...}
```

**URLs.** `shorten` trims surrounding whitespace, then accepts a URL only if its scheme is `http` or `https` (any case), it has a host, it has no whitespace inside and it is at most 2048 characters long. Anything else, including a value that is not a string, raises `InvalidUrl`. The link stores the trimmed URL.

**Codes and aliases.** Without `alias`, the code is 7 characters from `0-9`, `A-Z` and `a-z`, different from every code and alias already handed out. With `alias`, the alias is the code: 3 to 30 characters from `A-Z`, `a-z`, `0-9`, `_` and `-`, otherwise `InvalidAlias`. An alias that is already a code (of a live or an expired link) raises `AliasTaken`. Codes are case-sensitive.

**The same link twice.** A plain call (no `alias`, no `ttl`) by a client that already made a plain link to the same URL returns that earlier code. Calls with an alias or a ttl always make a new link, and different clients never share a link.

**Expiry.** `ttl` is a positive, finite number of seconds (not a bool); anything else raises `ValueError`. A link made at time `t` with a ttl stops existing at `t + ttl`: from then on `resolve` and `stats` raise `NotFound`, as they do for a code that never existed.

**Rate limit.** Each client may call `shorten` at most `limit` times in any `window` seconds; a call at time `t` stops counting at `t + window`. The call after that raises `RateLimited` with `retry_after`, the seconds until the client may call again. A refused call does not count; any other call does, even one that then fails with `InvalidUrl`. `resolve` and `stats` are not limited.

**Time.** Read the time only from `clock`, so the tests can move it.

## What to hand in

- the code in `src/`, readable by someone who has not seen the brief;
- your tests in `tests/`, covering the rules above and the edge cases you found;
- a short design note in the notes box beside the editor: how to run it, the assumptions you made, the trade-offs, and what you would change to run this on several servers with a database behind it.

The hidden suite checks the rules above. Once a run has finished you can ask for an AI review of the code quality: structure, tests, error handling and the design note, each scored from 1 to 4.
