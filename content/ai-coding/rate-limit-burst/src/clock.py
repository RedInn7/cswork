import time


class SystemClock:
    def now(self):
        return time.monotonic()


class FakeClock:
    """A clock that tests move by hand."""

    def __init__(self, start=0.0):
        self.t = float(start)

    def now(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds
