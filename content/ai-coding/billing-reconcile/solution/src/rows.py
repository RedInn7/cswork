"""Reading and checking the rows of one CSV file."""
import csv
import io
import re
from decimal import Decimal

AMOUNT = re.compile(r'[0-9]+(?:\.[0-9]{1,2})?')
CURRENCY = re.compile(r'[A-Za-z]{3}')


def read_rows(text, name, columns, key):
    """The valid rows of a CSV file (fields trimmed, amount a Decimal, currency upper-case) and an
    error per invalid row: {'file': name, 'line': n, 'reason': ...}, n counting the header as 1.
    Raises ValueError when the header lacks one of `columns`."""
    reader = csv.reader(io.StringIO(text))
    header = [column.strip().lower() for column in next(reader, [])]
    missing = [column for column in columns if column not in header]
    if missing:
        raise ValueError('%s: missing column %s' % (name, ', '.join(missing)))
    positions = {column: header.index(column) for column in columns}
    rows, errors, seen = [], [], set()
    for values in reader:
        if not values:
            continue  # an empty line: skipped, but it still counts in line numbers
        row = {column: (values[i] if i < len(values) else '').strip() for column, i in positions.items()}
        reason = problem(row, seen, key)
        if reason:
            errors.append({'file': name, 'line': reader.line_num, 'reason': reason})
            continue
        seen.add(row[key])
        rows.append(dict(row, amount=Decimal(row['amount']), currency=row['currency'].upper()))
    return rows, errors


def problem(row, seen, key):
    """Why a row is invalid, the first that applies, or None."""
    if not all(row.values()):
        return 'missing'
    if not AMOUNT.fullmatch(row['amount']) or not Decimal(row['amount']):
        return 'amount'
    if not CURRENCY.fullmatch(row['currency']):
        return 'currency'
    return 'duplicate' if row[key] in seen else None
