# Feature Flag Service

Build a feature flag service: product can turn a new feature on for 30% of users, check that nothing breaks, then go to 60% and 100%; or target it on or off by attributes such as country or plan. Any language or framework.

## API

A flag key is lowercase letters, digits and `_ . -`, starting with a letter or digit, at most 64 long. Requests and responses are JSON.

| Method | Path | What it does |
| --- | --- | --- |
| `PUT` | `/flags/{key}` | Body `{"enabled": boolean, "rollout": integer 0–100, "rules": [rule…]}`; `rules` may be left out. Creates or replaces the whole flag. `version` starts at 1 and goes up by 1 on every PUT. Answers 200 with the flag and `ETag: "version"`. |
| `GET` | `/flags/{key}` | `{"key", "enabled", "rollout", "rules", "version"}` with the ETag. |
| `GET` | `/flags/{key}/evaluate?user=ID&attribute=value…` | `{"flag", "on", "reason", "version"}`. |
| `DELETE` | `/flags/{key}` | Removes it; answers 204. |

A rule looks like `{"attribute": "country", "in": ["US", "CA"], "serve": true}`: `attribute` is lowercase letters and underscores (and not `user`), `in` is a non-empty list of strings, and `serve` is the value returned on a match.

Evaluation order:

1. `enabled` is false: `on` is false and `reason` is `"disabled"`.
2. The rules in order: the first one that matches (the request's value for its attribute is in `in`) decides, with `reason` `"rule:index"` (from 0).
3. Otherwise the percentage rollout: hash (flag key, user ID) to a bucket in [0, 100) and turn the flag on when the bucket is below `rollout`, with `reason` `"rollout"`.

The rollout must be sticky (the same user always gets the same answer) and accurate; raising `rollout` must keep every user who was on still on; and different flags must pick independent sets of users (so the hash includes the flag key).

Concurrent edits: a PUT with `If-Match: "version"` that does not match the current version answers 412 and changes nothing. Without it, the PUT simply overwrites.

Errors: an unknown flag is a 404; evaluate without `user` is a 400; an invalid body is a 400.

## Constraints

- Evaluation is the hot path: no disk reads and no scan over every flag per call.
- Write down your hash and bucketing, and why raising the percentage never switches a user off.

## Extras

- A client SDK that caches every flag locally, hears about changes by long polling or SSE, and keeps evaluating on the last config when the service is down.
- An audit log: who changed which flag from what to what, and when.
- Experiments: extend the rollout to several A/B variants with their own shares.
- Persist to SQLite so a restart keeps the config.
