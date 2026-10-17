# Idempotent ETL Pipeline (CLI)

Write a command-line program that loads a folder of order CSVs into SQLite and computes daily totals. The point is idempotency: the same input gives the same result however many times it runs, and if the run is killed halfway the database holds either the previous state or the finished new one, never half of it. Any language that can write SQLite.

## Usage

```
your-program --input DIR --db FILE.sqlite
```

Read every `*.csv` in the folder in file-name order. Exit 0 once everything is processed (rejected rows included); exit non-zero when the folder does not exist.

## Input

UTF-8 CSV (possibly with a BOM). The first line is the header and must be exactly `order_id,customer,amount,currency,status,updated_at` (fixed order, surrounding spaces ignored). Fields may be double-quoted and contain commas and escaped quotes. Trim each field, then check it:

| Field | Rule |
| --- | --- |
| `order_id` | 1–40 letters, digits or `-` |
| `customer` | Not empty, at most 200 characters |
| `amount` | Non-negative with at most two decimals, such as `12`, `0.5`, `19.99`; stored as integer cents in `amount_cents` |
| `currency` | Three letters once uppercased |
| `status` | Once lowercased, one of `created`, `paid`, `shipped`, `cancelled` |
| `updated_at` | A valid UTC time in exactly `YYYY-MM-DDTHH:MM:SSZ` |

A row with the wrong number of columns or any invalid field goes to `rejects`. A file with the wrong header gets a single `rejects` row (line 1) and is skipped.

## Output (fixed schema)

```sql
CREATE TABLE orders(order_id TEXT PRIMARY KEY, customer TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE rejects(file TEXT NOT NULL, line INTEGER NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(file, line));
CREATE TABLE daily_totals(day TEXT NOT NULL, currency TEXT NOT NULL, orders INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL, PRIMARY KEY(day, currency));
```

- `orders`: one row per `order_id`, the one with the latest `updated_at`. An incoming row replaces the stored one only when its `updated_at` is strictly newer; equal or older leaves it alone.
- `rejects`: `file` is the file name (no folder), `line` the CSV line number (the header is line 1), `reason` your own text. A rerun must not duplicate them.
- `daily_totals`: grouped by the date of `updated_at` (its first 10 characters) and currency, leaving out `cancelled` orders. It matches `orders` after every run.

## Constraints

- Idempotent: with the same input, a rerun leaves all three tables identical.
- Atomic: a run takes effect completely or not at all. After a `kill -9`, the next run ends exactly as an uninterrupted one would.
- A 150,000-line file should take a few seconds at most.

## Extras

- Record each file's hash and skip unchanged files, and explain whether that is still correct for a stale file that arrives late.
- Read input from S3 or HTTP, with a bounded number of retries.
- Report run metrics: rows read, updated, rejected, and the time taken.
- Schedule it with Airflow or cron and explain why a duplicate schedule is safe.
