from .clock import SystemClock


class FixedWindowLimiter:
    """At most `limit` calls per key in each `window`-second window."""

    def __init__(self, limit, window, clock=None):
        if limit <= 0 or window <= 0:
            raise ValueError('limit and window must be positive')
        self.limit = limit
        self.window = window
        self.clock = clock or SystemClock()
        self._counts = {}

    def allow(self, key, cost=1):
        start = int(self.clock.now() // self.window)
        window, used = self._counts.get(key, (start, 0))
        if window != start:
            used = 0
        if used + cost > self.limit:
            self._counts[key] = (start, used)
            return False
        self._counts[key] = (start, used + cost)
        return True


class TokenBucket:
    """Bursts of up to `capacity` calls per key, refilled at `rate` tokens per second.

    See README.md for the full behaviour.
    """

    def __init__(self, rate, capacity, clock=None):
        raise NotImplementedError

    def allow(self, key, cost=1):
        raise NotImplementedError

    def retry_after(self, key, cost=1):
        raise NotImplementedError
