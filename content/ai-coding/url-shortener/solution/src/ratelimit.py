"""A sliding-window limit per client."""
from collections import defaultdict, deque

from .errors import RateLimited


class SlidingWindow:
    """At most `limit` calls per client in any `window` seconds; a refused call is not counted."""

    def __init__(self, limit, window, clock):
        self.limit = limit
        self.window = window
        self.clock = clock
        # ponytail: one deque per client ever seen, in memory; a shared store (Redis) once there are several servers.
        self.calls = defaultdict(deque)

    def take(self, client):
        """Counts one call by `client`, or raises RateLimited when it has none left."""
        now = self.clock()
        calls = self.calls[client]
        while calls and calls[0] + self.window <= now:
            calls.popleft()
        if len(calls) >= self.limit:
            raise RateLimited(calls[0] + self.window - now)
        calls.append(now)
