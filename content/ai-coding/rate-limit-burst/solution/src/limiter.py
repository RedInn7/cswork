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
    """Bursts of up to `capacity` calls per key, refilled at `rate` tokens per second."""

    def __init__(self, rate, capacity, clock=None):
        if rate <= 0 or capacity <= 0:
            raise ValueError('rate and capacity must be positive')
        self.rate = rate
        self.capacity = capacity
        self.clock = clock or SystemClock()
        self._buckets = {}

    def _tokens(self, key, cost):
        if cost > self.capacity:
            raise ValueError('cost exceeds capacity')
        now = self.clock.now()
        tokens, then = self._buckets.get(key, (self.capacity, now))
        tokens = min(self.capacity, tokens + (now - then) * self.rate)
        self._buckets[key] = (tokens, now)
        return tokens

    def allow(self, key, cost=1):
        tokens = self._tokens(key, cost)
        if tokens < cost:
            return False
        self._buckets[key] = (tokens - cost, self.clock.now())
        return True

    def retry_after(self, key, cost=1):
        tokens = self._tokens(key, cost)
        return max(0, (cost - tokens) / self.rate)
