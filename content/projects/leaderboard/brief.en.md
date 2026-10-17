# Leaderboard Service

Build a leaderboard service for a game or a contest: submit scores, read the top N, look up a player's rank, and see who is around them. One service hosts many boards that never affect each other. Any language or framework.

## API

Requests and responses are JSON. Board and player names are 1–32 letters, digits, `_` or `-`.

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/boards/{board}/scores` | Body `{"player": name, "score": integer from 0 to 10^12}`. Keeps each player's best score only. Answers 200 `{"player", "score", "rank"}` with their best and rank after the submission. A board exists from its first submission. |
| `GET` | `/boards/{board}/top?limit=10&offset=0` | `{"total": players, "items": [{"player", "score", "rank"}, …]}`. limit 1–100, default 10; offset default 0. |
| `GET` | `/boards/{board}/players/{player}` | That player's `{"player", "score", "rank"}`. |
| `GET` | `/boards/{board}/players/{player}/around?radius=2` | The players up to radius places (0–50, default 2) either side in the order, cut off at the ends. |
| `DELETE` | `/boards/{board}/players/{player}` | Removes the player; answers 204. |

Order: score high to low, ties by name in ascending byte order. Rank: 1 plus the number of players with a strictly higher score, so ties share a rank and the next one skips (1, 2, 2, 4).

Errors: an unknown player is a 404; an invalid body, or a limit or radius out of range, is a 400.

## Constraints

- A rank lookup or a top-N read must not sort the whole board each time. Write down each operation's time complexity.
- Concurrent submissions for one player must not lose a score: the highest one stays.
- In memory is fine.

## Extras

- Build a version on Redis sorted sets (ZADD, ZREVRANK, ZREVRANGE) and compare it with your own data structure.
- Weekly boards: a new board every Monday 00:00 UTC, with old weeks still readable.
- Load test 100,000 players at 1,000 submissions a second and report p99.
- Anti-cheat: where scores come from and how you would check them.
