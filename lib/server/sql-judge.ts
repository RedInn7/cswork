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
 * A query starting with SQL_NAMES (the workspace's previews, lib/sql-cte.ts)
 * also writes its column names to stderr as one JSON line; stdout is the same.
 * A learner SQL error goes to stderr (one zh / en line) with exit 1 (a
 * runtime error).
 */
import { SQL_NAMES } from '@/lib/sql-cte';

export { SQL_NAMES };
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
if query.startswith('${SQL_NAMES}'):
    names = json.dumps([column[0] for column in cursor.description], ensure_ascii=False)
    sys.stderr.buffer.write((names + '\\n').encode('utf-8'))
`;
/**
 * The Pandas track's runner (pd- problems): the SQL track's datasets and
 * expected outputs, solved in pandas. It loads stdin (the same CREATE TABLE +
 * INSERT script) into SQLite, reads each table into a DataFrame (INTEGER
 * columns as nullable Int64, the rest as pandas infers: TEXT is object), calls
 * solve(tables) from the learner's solution.py and prints the returned
 * DataFrame in SQL_HARNESS's form, so the SQL packages' expected outputs carry
 * over unchanged. The index is ignored, and values become what SQLite would
 * return: NaN / NaT / NA -> null, bool -> 0 / 1, numpy scalars -> Python
 * numbers, a Timestamp -> 'YYYY-MM-DD' ('YYYY-MM-DD HH:MM:SS' with a time) and
 * a Timedelta -> days. The learner's print() goes to stderr. It needs the judge
 * image's pandas (deploy/oj/Dockerfile.pandas); judge(dataset) is importable
 * so the track build checks many datasets in one process.
 */
export const PANDAS_HARNESS = `
import contextlib, datetime, decimal, importlib.util, json, sqlite3, sys
sys.dont_write_bytecode = True
import numpy as np
import pandas as pd

def fail(message):
    sys.stderr.write(message + '\\n')
    sys.exit(1)

def norm(value):
    if isinstance(value, np.datetime64):
        value = pd.Timestamp(value)
    elif isinstance(value, np.timedelta64):
        value = pd.Timedelta(value)
    elif isinstance(value, np.generic):
        value = value.item()
    if value is None or value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, decimal.Decimal):
        value = float(value)
    if isinstance(value, datetime.timedelta):
        value = value / datetime.timedelta(days=1)
    if isinstance(value, float):
        if value != value:
            return None
        if value in (float('inf'), float('-inf')):
            return {'float': str(value)}
        value = round(value, 4)
        return int(value) if value == int(value) else value
    if isinstance(value, (int, str)):
        return value
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None and value.time() == datetime.time():
            return value.date().isoformat()
        return value.isoformat(sep=' ')
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, bytes):
        return {'blob': value.hex()}
    kind = type(value).__name__
    fail('结果里有不支持的值类型 %s。 / The result holds a value of an unsupported type: %s.' % (kind, kind))

def judge(dataset):
    db = sqlite3.connect(':memory:')
    try:
        db.executescript(dataset)
    except sqlite3.Error as error:
        fail('测试数据错误 / Dataset error: %s' % error)
    tables = {}
    names = db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    for (name,) in names.fetchall():
        quoted = '"%s"' % name.replace('"', '""')
        ints = {column[1]: 'Int64' for column in db.execute('PRAGMA table_info(%s)' % quoted) if 'INT' in column[2].upper()}
        tables[name] = pd.read_sql_query('SELECT * FROM %s' % quoted, db, dtype=ints)
    db.close()
    spec = importlib.util.spec_from_file_location('solution', 'solution.py')
    module = importlib.util.module_from_spec(spec)
    # Only the returned DataFrame reaches stdout; the learner's prints go to stderr.
    with contextlib.redirect_stdout(sys.stderr):
        spec.loader.exec_module(module)
        solve = getattr(module, 'solve', None)
        if not callable(solve):
            fail('solution.py 里没有 solve(tables) 函数。 / solution.py defines no solve(tables) function.')
        result = solve(tables)
    if isinstance(result, pd.Series):
        fail('solve 返回了 Series，请返回 DataFrame（可以用 .reset_index() 或 .to_frame()）。 / solve returned a Series: return a DataFrame (try .reset_index() or .to_frame()).')
    if not isinstance(result, pd.DataFrame):
        kind = type(result).__name__
        fail('solve 要返回 pandas DataFrame，而不是 %s。 / solve must return a pandas DataFrame, not %s.' % (kind, kind))
    if len(result) > ${SQL_MAX_ROWS}:
        fail('结果超过 ${SQL_MAX_ROWS} 行。 / The result has more than ${SQL_MAX_ROWS} rows.')
    rows = [json.dumps([norm(v) for v in row]) for row in result.itertuples(index=False, name=None)]
    if not dataset.startswith('${SQL_ORDERED}'):
        rows.sort()
    return 'columns: %d\\n' % len(result.columns) + ''.join(r + '\\n' for r in rows)

if __name__ == '__main__':
    sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    sys.stdout.write(judge(sys.stdin.read()))
`;
