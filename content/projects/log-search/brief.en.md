# Log Search Service (Inverted Index)

Build a small log search service: ingest structured logs in batches, search them by words, phrases, level, service and time range, and page through the results newest first. The core is an inverted index you write yourself, with no Elasticsearch, Lucene or database full-text search. Any language or framework.

## API

**Ingest** `POST /logs`: the body is NDJSON, one `{"ts": milliseconds (an integer ≥ 0), "level": "debug|info|warn|error", "service": 1–64 characters, "msg": string}` per line, with no other fields; blank lines are skipped. Answers 200 `{"ingested": lines}`. If any line is invalid, nothing from the batch is stored and it answers 400 `{"error", "line": its number, from 1}`.

**Search** `GET /search`, every parameter optional:

| Parameter | Meaning |
| --- | --- |
| `q` | Space-separated terms that must all match. Double quotes make a phrase. |
| `level` | A minimum: `warn` returns warn and error. |
| `service` | An exact service name. |
| `from`, `to` | The range `from ≤ ts < to`. |
| `limit` | Results per page, 1–500, default 50. |
| `cursor` | The `next` of the previous page. |

Answers `{"total": all matches, "items": [{"id", "ts", "level", "service", "msg"}], "next": the next page's cursor, or null}`. Order: `ts` newest first; for the same `ts`, the line ingested later comes first.

Tokenizing (the same for ingest and search): lowercase, then split on every character that is not a–z or 0–9, so `Host-3 (code=503)` gives `host`, `3`, `code`, `503`. A search term that splits into several tokens (such as `host-3`) is a phrase. A phrase needs its tokens next to each other in the message. Only whole tokens match: `tim` does not find `timeout`.

Invalid parameters (limit out of range, an unknown level, a non-numeric from) answer 400.

## Constraints

- It must use an inverted index: token to a list of log IDs, intersected for several terms starting from the shortest list. No full scan per search.
- Cursor paging must neither repeat nor skip older results when new lines arrive between two requests.

## Extras

- Persist the index as segments and merge them in the background, so a restart does not rebuild it.
- Excluded terms with `-word`, and counts grouped by `service` or `level`.
- Compress the posting lists (delta encoding plus varints) and compare memory before and after.
- Load ten million generated lines and report ingest throughput and search p99.
