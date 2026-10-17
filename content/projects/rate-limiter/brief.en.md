# Token-Bucket Rate Limiter Service

Build a standalone rate limiting service: before handling a request, other services ask it "may this key go through right now?". Each key has a token bucket: a full bucket allows a burst, and an empty one refills at a fixed rate. Any language or framework.

## API

Requests and responses are JSON. A key is 1–64 letters, digits or `_ . : -`.

| Method | Path | What it does |
| --- | --- | --- |
| `PUT` | `/limits/{key}` | Body `{"capacity": integer ≥ 1, "refill_per_sec": number > 0}`. Creates or replaces the config and fills the bucket. Answers 200 with the config. |
| `GET` | `/limits/{key}` | The config and the current `tokens`, rounded down. |
| `POST` | `/limits/{key}/take` | Optional body `{"tokens": n}`, default 1. If there are enough, take them and answer 200 `{"allowed": true, "remaining": left, rounded down}`; otherwise 429 `{"allowed": false, "remaining": …, "retry_after_ms": how long until enough}` with a `Retry-After` header (seconds, rounded up, at least 1). |
| `DELETE` | `/limits/{key}` | Removes it; answers 204. |

Errors: a key that was never configured is a 404; an invalid config, a body that is not JSON, or `tokens` that is not an integer from 1 to the capacity is a 400.

## Constraints

- Tokens refill continuously (not once per whole second), never above the capacity.
- Concurrent requests must not over-admit: 60 requests at once against a 25-token bucket allow exactly 25.
- No external store: in memory is fine. Measure time with a monotonic clock, not the wall clock.

## Extras

- Add a sliding-window-log algorithm, chosen with an `algorithm` field, and write a note comparing memory and accuracy.
- Evict keys that have gone unused so memory does not grow with every key ever seen.
- Several instances: implement the same semantics as a Redis Lua script and explain where the clock comes from.
- Load test it: report single-node QPS and p99 latency, and how lock granularity changes them.
