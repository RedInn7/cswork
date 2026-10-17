# Mini Redis (a RESP Subset)

Implement an in-memory database server that speaks the Redis protocol (RESP2), so `redis-cli` can connect to it. Strings and expiry only, but the protocol parsing, pipelining and concurrent clients must be right. No wrapping a real Redis or a Redis library. Any language.

## Protocol

Each command from a client is an array of bulk strings: `*argument count\r\n`, then each argument as `$byte length\r\ncontent\r\n`. Replies come in five types:

- Simple string `+OK\r\n`
- Error `-ERR message\r\n`
- Integer `:42\r\n`
- Bulk string `$5\r\nhello\r\n`, or `$-1\r\n` (nil) when there is nothing
- Array (not needed here)

Values are binary safe: they may contain `\r\n` and `\0`; the length after `$` is what counts. Support values of at least 1 MB.

## Commands

Command names are case-insensitive.

| Command | Reply |
| --- | --- |
| `PING [msg]` | `+PONG` without an argument, otherwise the argument as a bulk string |
| `ECHO msg` | A bulk string |
| `SET key value [EX seconds \| PX ms] [NX \| XX]` | `+OK`; with NX on an existing key, or XX on a missing one, nothing is written and the reply is nil. A SET without an expiry option clears any old expiry. |
| `GET key` | A bulk string or nil |
| `DEL key [key …]` | How many were deleted (integer) |
| `EXISTS key [key …]` | How many exist, counting repeated keys again |
| `INCR key` | The value after adding 1; a missing key counts as 0; an error if the value is not a signed 64-bit integer or would overflow |
| `EXPIRE key seconds` | 1 if set, 0 if the key does not exist |
| `TTL key` | Seconds left (rounded); -1 without an expiry; -2 when the key does not exist |

An unknown command, a wrong number of arguments or an invalid option: one `-ERR …` line, and the connection stays usable.

## Constraints

- One `send` may carry many commands (pipelining) and the replies must keep their order; one command may also arrive in several pieces, so wait until it is complete.
- Many clients at once, and `INCR` never loses an update.
- An expired key looks missing to GET, EXISTS and TTL.

## Extras

- Sample and delete expired keys periodically (as Redis does) rather than only on access.
- Persistence: an append-only file or RDB-style snapshots, restored on startup.
- Lists or hashes, and `KEYS pattern`.
- Benchmark with `redis-benchmark` against a real Redis and explain the gap.
