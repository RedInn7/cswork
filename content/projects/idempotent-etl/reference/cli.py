"""Reference idempotent ETL (only for scripts/projects/verify.mjs): cli.py --input DIR --db FILE."""
import argparse
import csv
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

COLUMNS = ['order_id', 'customer', 'amount', 'currency', 'status', 'updated_at']
STATUSES = {'created', 'paid', 'shipped', 'cancelled'}
SCHEMA = """
CREATE TABLE IF NOT EXISTS orders(order_id TEXT PRIMARY KEY, customer TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rejects(file TEXT NOT NULL, line INTEGER NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(file, line));
CREATE TABLE IF NOT EXISTS daily_totals(day TEXT NOT NULL, currency TEXT NOT NULL, orders INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL, PRIMARY KEY(day, currency));
"""


def clean(row):
    """A CSV row as an order tuple, or raise ValueError with the reason."""
    if len(row) != len(COLUMNS):
        raise ValueError('wrong column count')
    order_id, customer, amount, currency, status, updated_at = (v.strip() for v in row)
    if not re.fullmatch(r'[A-Za-z0-9-]{1,40}', order_id):
        raise ValueError('bad order_id')
    if not customer or len(customer) > 200:
        raise ValueError('bad customer')
    m = re.fullmatch(r'(\d{1,12})(?:\.(\d{1,2}))?', amount)
    if not m:
        raise ValueError('bad amount')
    cents = int(m.group(1)) * 100 + int((m.group(2) or '0').ljust(2, '0'))
    currency = currency.upper()
    if not re.fullmatch(r'[A-Z]{3}', currency):
        raise ValueError('bad currency')
    status = status.lower()
    if status not in STATUSES:
        raise ValueError('bad status')
    try:
        datetime.strptime(updated_at, '%Y-%m-%dT%H:%M:%SZ')
    except ValueError:
        raise ValueError('bad updated_at') from None
    if len(updated_at) != 20:
        raise ValueError('bad updated_at')
    return order_id, customer, cents, currency, status, updated_at


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--db', required=True)
    args = parser.parse_args()
    folder = Path(args.input)
    if not folder.is_dir():
        print(f'no such directory: {folder}', file=sys.stderr)
        return 2
    db = sqlite3.connect(args.db, isolation_level=None)
    db.executescript(SCHEMA)
    db.execute('BEGIN IMMEDIATE')  # the whole run is one transaction: a crash leaves the old state
    upserted = rejected = 0
    for path in sorted(folder.glob('*.csv')):
        with open(path, newline='', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if header is None or [h.strip() for h in header] != COLUMNS:
                db.execute('INSERT OR REPLACE INTO rejects VALUES(?,?,?)', (path.name, 1, 'bad header'))
                rejected += 1
                continue
            for row in reader:
                line = reader.line_num
                if not row:
                    continue
                try:
                    order = clean(row)
                except ValueError as e:
                    db.execute('INSERT OR REPLACE INTO rejects VALUES(?,?,?)', (path.name, line, str(e)))
                    rejected += 1
                    continue
                # Newer wins; an equal or older updated_at leaves the stored row alone.
                upserted += db.execute(
                    """INSERT INTO orders VALUES(?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET
                    customer=excluded.customer, amount_cents=excluded.amount_cents, currency=excluded.currency,
                    status=excluded.status, updated_at=excluded.updated_at WHERE excluded.updated_at > orders.updated_at""",
                    order,
                ).rowcount
    db.execute('DELETE FROM daily_totals')
    db.execute("""INSERT INTO daily_totals SELECT substr(updated_at, 1, 10), currency, COUNT(*), SUM(amount_cents)
                  FROM orders WHERE status != 'cancelled' GROUP BY 1, 2""")
    db.execute('COMMIT')
    print(f'upserted={upserted} rejected={rejected}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
