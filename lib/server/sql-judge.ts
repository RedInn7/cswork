/**
 * The SQL track's runner: a trusted Python program the sandbox's own python3
 * runs (no image change). stdin is the test's dataset (CREATE TABLE + INSERT
 * statements); query.sql is the learner's single SELECT. It loads the dataset
 * into an in-memory SQLite database, makes it read-only, runs the query and
 * prints the result in one canonical form, so the plain `exact` checker
 * compares result sets:
 *   - first line `columns: N`; column names are not compared, their order is;
 *   - each row as a JSON array; NULL -> null, a float rounded to 4 places and
 *     printed as an integer when integral (3.0 == 3), text stays text; a BLOB
 *     is {"blob": hex} and +-inf {"float": "inf"}, so neither equals text;
 *   - rows sorted unless the dataset's first line is `-- cswork:ordered`.
 * A learner SQL error goes to stderr (one zh / en line) with exit 1 (a
 * runtime error).
 */
export const SQL_ORDERED = '-- cswork:ordered';
export const SQL_MAX_ROWS = 100000;
export const SQL_HARNESS = `
import json, sqlite3, sys

def fail(message):
    # UTF-8 whatever the sandbox's locale: the messages are bilingual.
    sys.stderr.buffer.write((message + '\\n').encode('utf-8'))
    sys.exit(1)

def norm(value):
    if isinstance(value, float):
        if value != value or value in (float('inf'), float('-inf')):
            return {'float': str(value)}
        value = round(value, 4)
        return int(value) if value == int(value) else value
    if isinstance(value, bytes):
        return {'blob': value.hex()}
    return value

dataset = sys.stdin.read()
with open('query.sql', encoding='utf-8') as source:
    query = source.read().strip()
if not query:
    fail('查询为空：请写一条 SELECT 语句。 / Empty query: write one SELECT statement.')
db = sqlite3.connect(':memory:')
try:
    db.executescript(dataset)
except sqlite3.Error as error:
    fail('测试数据错误 / Dataset error: %s' % error)
db.execute('PRAGMA query_only = ON')
try:
    cursor = db.execute(query)
    if cursor.description is None:
        fail('查询没有返回结果集：请写一条 SELECT 语句。 / The query returned no result set: write one SELECT statement.')
    rows = []
    for row in cursor:
        if len(rows) >= ${SQL_MAX_ROWS}:
            fail('查询结果超过 ${SQL_MAX_ROWS} 行。 / The query returned more than ${SQL_MAX_ROWS} rows.')
        rows.append(json.dumps([norm(v) for v in row]))
except sqlite3.Warning as error:
    fail('只能写一条 SQL 语句 / Write exactly one SQL statement (%s)' % error)
except sqlite3.Error as error:
    fail('SQL 错误 / SQL error: %s' % error)
if not dataset.startswith('${SQL_ORDERED}'):
    rows.sort()
sys.stdout.write('columns: %d\\n' % len(cursor.description))
sys.stdout.write(''.join(r + '\\n' for r in rows))
`;
