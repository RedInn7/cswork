# LRU Cache Service with TTL

Build an in-memory cache reachable over HTTP: capacity counted in entries, evicting the least recently used when full, with an optional expiry per value. Values are arbitrary bytes. Any language or framework, but write the LRU structure yourself rather than using a ready-made LRU container.

## API

A key is 1–128 letters, digits or `_ . : -`. The capacity (in entries) comes from a flag or the `CAPACITY` environment variable, default 100.

| Method | Path | What it does |
| --- | --- | --- |
| `PUT` | `/cache/{key}?ttl_ms=N` | The body is the value (raw bytes, at most 1 MiB). `ttl_ms` is optional: a positive integer of milliseconds until it expires; without it the value never expires. Overwriting a key replaces both the value and its expiry. Answers 204. |
| `GET` | `/cache/{key}` | A hit answers 200 with the exact bytes; a missing or expired key is a 404. A hit makes the key the most recently used. |
| `DELETE` | `/cache/{key}` | 204 if it was there, 404 if not. |
| `GET` | `/stats` | `{"hits", "misses", "evictions", "size", "capacity"}`, counted since startup. |

Rules:

- Every `GET /cache/...` counts as one hit or one miss.
- `size` counts unexpired keys only.
- Writing a new key into a full cache: drop expired entries first; only if it is still full, evict the least recently used key and add 1 to `evictions`. Dropping expired entries is not an eviction.
- A value over 1 MiB answers 413 (closing the connection is fine too) and is not stored; a `ttl_ms` that is not a positive integer is a 400.

## Constraints

- GET and DELETE in O(1), PUT in O(log n) or better: a hash map plus a doubly linked list keeps the LRU order, and a min-heap (or a timing wheel) on expiry time finds the expired entries to drop without scanning every key.
- Many clients reading and writing at once must not break it.

## Extras

- Sweep expired keys in the background, and explain what that costs compared with checking on access.
- Limit capacity by bytes instead of entries.
- Compare LRU, LFU and W-TinyLFU hit rates on a real access log.
- Add consistent hashing to turn several nodes into one cache cluster.
