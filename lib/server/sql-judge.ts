/**
 * The SQL track's runner: a trusted Python program the sandbox's own python3
 * runs (no image change). stdin is the test's dataset (CREATE TABLE + INSERT
 * statements); query.sql is the learner's single SELECT. It loads the dataset
 * into an in-memory SQLite database, makes it read-only, runs the query and
 * prints the result in one canonical form, so the plain `exact` checker
 * compares result sets:
 *   - first line `columns: N`; column names are not compared, their order is;
 *   - each row as a JSON array; NULL -> null, a float rounded to 4 places and
 *     printed as an integer when integral (3.0 == 3), text stays text;
 *   - rows sorted unless the dataset's first line is `-- cswork:ordered`.
 * A learner SQL error goes to stderr with exit 1 (a runtime error).
 */
export const SQL_ORDERED = '-- cswork:ordered';
export const SQL_MAX_ROWS = 100000;
export const SQL_HARNESS = `
import json, sqlite3, sys

def fail(message):
    sys.stderr.write(message + '\\n')
    sys.exit(1)

def norm(value):
    if isinstance(value, float):
        if value != value or value in (float('inf'), float('-inf')):
            return str(value)
        value = round(value, 4)
        return int(value) if value == int(value) else value
    if isinstance(value, bytes):
        return 'x' + value.hex()
    return value

dataset = sys.stdin.read()
with open('query.sql', encoding='utf-8') as source:
    query = source.read().strip()
if not query:
    fail('Empty query: write one SELECT statement.')
db = sqlite3.connect(':memory:')
try:
    db.executescript(dataset)
except sqlite3.Error as error:
    fail('Dataset error: %s' % error)
db.execute('PRAGMA query_only = ON')
try:
    cursor = db.execute(query)
    if cursor.description is None:
        fail('The query returned no result set: write one SELECT statement.')
    rows = []
    for row in cursor:
        if len(rows) >= ${SQL_MAX_ROWS}:
            fail('The query returned more than ${SQL_MAX_ROWS} rows.')
        rows.append(json.dumps([norm(v) for v in row]))
except sqlite3.Warning as error:
    fail('Write exactly one SQL statement (%s)' % error)
except sqlite3.Error as error:
    fail('SQL error: %s' % error)
if not dataset.startswith('${SQL_ORDERED}'):
    rows.sort()
sys.stdout.write('columns: %d\\n' % len(cursor.description))
sys.stdout.write(''.join(r + '\\n' for r in rows))
`;
