# Log rollup: make it fast

Every night `src/report.py` posts a table of the busiest API routes to the on-call channel: requests, share of 5xx errors and the 95th-percentile latency per route, from that day's access log (`src/parser.py` reads one line per request). Since the product added per-tenant routes, the job takes over an hour on a day's log and sometimes misses the morning stand-up.

Make `rollup()` in `src/rollup.py` fast enough for a day's log, close to linear in the number of lines, without changing what it returns:

- same routes, counts, error rates (rounded to 4 places) and nearest-rank p95 as today;
- same order: busiest first, ties broken by route name;
- malformed lines are still skipped, and `top` larger than the number of routes still returns every route.

Measure before and after, and keep the public functions' signatures. The hidden suite compares your output with the current behaviour on generated logs and times a few large ones; you only see how many of its tests pass.
