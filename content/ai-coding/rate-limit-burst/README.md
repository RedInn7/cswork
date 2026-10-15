# Rate limiter: allow bursts

The API gateway limits each API key with `FixedWindowLimiter` (`src/limiter.py`): a fixed number of calls per minute. Customers on the paid plan complain that a batch job sending 40 requests at once gets most of them rejected, although they stay far under their per-minute budget on average.

Implement `TokenBucket` in `src/limiter.py` and give the `pro` plan one in `src/policy.py`:

- `TokenBucket(rate, capacity, clock=None)`: each key has a bucket that starts full with `capacity` tokens and refills at `rate` tokens per second, never above `capacity`. `rate` and `capacity` must be positive, otherwise `ValueError`. Without a clock it uses `SystemClock`.
- `allow(key, cost=1)` takes `cost` tokens and returns `True` when the bucket holds at least that many; otherwise it takes nothing and returns `False`. A `cost` above `capacity` can never succeed: raise `ValueError`.
- `retry_after(key, cost=1)` returns the seconds until `allow(key, cost)` would succeed (`0` if it would now) without taking anything. Same `ValueError` rule.
- Keys are independent. Tokens may be fractional.
- `limiter_for('pro')` returns a bucket refilled at the plan's per-minute rate (600 a minute is 10 a second) holding up to 50 tokens. The `free` plan keeps its fixed window; unknown plans raise `ValueError`.

Use `FakeClock` from `src/clock.py` in tests instead of sleeping. A hidden suite checks the behaviour above; you only see how many of its tests pass.
