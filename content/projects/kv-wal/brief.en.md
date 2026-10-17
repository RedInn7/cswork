# Key-Value Store with a WAL and Compaction

Write a durable single-node key-value store from scratch: every write is appended to a write-ahead log (WAL) and flushed to disk before it is acknowledged, so a killed process or a power cut recovers on restart; when the log grows, compaction shrinks it back. No ready-made storage engine such as SQLite, LevelDB or RocksDB. Any language.

## Usage

```
your-program --dir DATA_DIR
```

Read one command per line from standard input and write one reply line per command to standard output, flushing each. Exit 0 at the end of input.

| Command | Reply |
| --- | --- |
| `SET key value` | `OK`. The key is everything before the first space (no spaces); the value is the rest of the line, spaces and UTF-8 allowed, never empty. |
| `GET key` | The value itself, or `(nil)` when there is none. |
| `DEL key` | `1` if it existed, `0` if not. |
| `COMPACT` | `OK` once compaction is done. |
| Anything else, or missing arguments | One line starting with `ERR`. |

## Rules

- **Durable before acknowledged**: `SET` and `DEL` are in the log and fsynced before the reply. A write that answered `OK` is still there after a `kill -9` and a restart.
- **Crash recovery**: replay the log on startup. The last record may be half written (a power cut): detect and ignore it, for example with a length and a checksum per record, and make sure new writes are not appended after the torn record and lost. The acceptance script simulates this by appending a few junk bytes to the end of the file you wrote last, so keep the log the last file written.
- **Compaction**: `COMPACT` drops overwritten and deleted records. After 300 overwrites of one 2 KB value, compaction should take the folder from over 600 KB to under 100 KB. A kill at any moment during compaction must lose no data (write a temporary file, fsync it, then rename it atomically, for instance).
- A deleted key stays deleted across compactions and restarts.

## Constraints

- An in-memory index of all the data is fine; only the log and the compaction have to be right.
- Write down your record format, and what each fsync protects against.

## Extras

- Group commit: one fsync for several writes, and measure the throughput gain.
- Data bigger than memory: write compacted data as sorted files (SSTables) with a sparse index in memory.
- Background compaction that does not block reads and writes.
- A TCP or HTTP front end, and the throughput of concurrent writes.
