#!/usr/bin/env python3
"""REST API problems answered by offline HTTP fixtures (lib/http-fixtures.mjs).

Builds, from seeded original data:
- three OAMaster REST problems that were blocked for depending on a live API
  (oa-oracle-6, oa-palantir-2, oa-rippling-3) as the OA candidate batch
  `rest-api-next`: packages, references, 163-input independent oracles, mutants,
  negative controls, editorials, local validation and the resolutions;
- six original problems, rest-01..rest-06, as the free `rest-` track:
  content/rest-api/packages.json (published by scripts/publish-sql-track.ts) and
  content/rest-api/programs.json (reference + incorrect programs, for CI).

Every program runs locally the way the judge runs it: `python3 -I -c BOOTSTRAP main.py`
beside cswork_fixtures.json. Local validation is not a sandbox: the OA batch still needs
`node scripts/verify-oa-judge.mjs --candidate-batch rest-api-next` against GoJudge.
Usage (repo root): python3 scripts/rest-api/build.py
"""
import hashlib
import json
import random
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from fractions import Fraction
from math import floor
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[2]
OA = ROOT / 'content/oa-judge'
TRACK = ROOT / 'content/rest-api'
BATCH = 'rest-api-next'
SEED = 20261015
HOST = 'https://data.cswork.test'
BOOT = subprocess.check_output(
    ['node', '-e', "import('./lib/http-fixtures.mjs').then(m=>process.stdout.write(m.HTTP_FIXTURE_BOOTSTRAP))"],
    cwd=ROOT, text=True)
# The bootstrap, also naming every key a program requests on stderr (visible_keys).
TRACE = BOOT.replace('    key = _key(url, params)\n', "    key = _key(url, params)\n    print('TRACE', key, file=sys.stderr)\n", 1)
assert TRACE != BOOT
OFFLINE_ZH = ('评测环境没有外网：接口返回的是题目自带的固定数据。Python 里的 `requests.get` 和 '
              '`urllib.request.urlopen` 由评测机直接应答，数据之外的地址返回 HTTP 404 和一段 JSON 错误信息。本题只支持 Python。')
OFFLINE_EN = ('The judge has no internet access: the API answers from a fixed data set that ships with the problem. '
              'Python\'s `requests.get` and `urllib.request.urlopen` are answered by the judge itself; any other address '
              'returns HTTP 404 with a JSON error body. Python only.')


def sha(text):
    return hashlib.sha256(text.encode() if isinstance(text, str) else text).hexdigest()


def key(path, **query):
    """The bootstrap's fixture key: the query's pairs sorted and form-encoded."""
    pairs = sorted((name, str(value)) for name, value in query.items())
    return 'GET ' + path + ('?' + urlencode(pairs) if pairs else '')


def paged(path, rows, per_page=10, **query):
    """Every page of `rows` (page 1 also without ?page=) and the empty page after the last."""
    total = len(rows)
    pages = -(-total // per_page)
    out = {}
    for page in range(1, pages + 2):
        body = {'page': page, 'per_page': per_page, 'total': total, 'total_pages': pages,
                'data': rows[(page - 1) * per_page:page * per_page]}
        out[key(path, page=page, **query)] = body
        if page == 1:
            out[key(path, **query)] = body
    return out


def one_or_none(path, row, **query):
    return {key(path, **query): {'page': 1, 'per_page': 10, 'total': int(row is not None),
                                 'total_pages': int(row is not None), 'data': [row] if row else []}}


def run_all(program, fixtures, inputs, boot=BOOT):
    """(stdout, stderr) of `program` on every input, each in a fresh interpreter like the judge's sandbox."""
    with tempfile.TemporaryDirectory(prefix='cswork-rest-') as box:
        Path(box, 'main.py').write_text(program)
        Path(box, 'cswork_fixtures.json').write_text(json.dumps(fixtures))

        def one(raw):
            done = subprocess.run(['python3', '-I', '-c', boot, 'main.py'], cwd=box, input=raw,
                                  capture_output=True, text=True, timeout=30)
            if done.returncode:
                raise RuntimeError(f'exit {done.returncode} on {raw!r}: {done.stderr[-800:]}')
            return done.stdout, done.stderr

        with ThreadPoolExecutor(4) as pool:
            return list(pool.map(one, inputs))


def shuffled(rng, items):
    items = list(items)
    rng.shuffle(items)
    return items


WORDS_A = ['Silent', 'Golden', 'Broken', 'Hidden', 'Northern', 'Crimson', 'Electric', 'Paper', 'Iron', 'Velvet',
           'Quiet', 'Wild', 'Distant', 'Hollow', 'Bright', 'Copper', 'Salt', 'Glass']
WORDS_B = ['Harbor', 'Ledger', 'Orchard', 'Signal', 'Frontier', 'Archive', 'Garden', 'Engine', 'Lantern',
           'Meridian', 'Atlas', 'Tide', 'Circuit', 'Canyon', 'Parade', 'Station', 'Kingdom', 'Mirror']
PEOPLE = ['ava', 'ben', 'cai', 'dina', 'eli', 'fay', 'gus', 'hana', 'ivo', 'jun', 'kai', 'lea', 'max', 'noa',
          'oli', 'pax', 'quy', 'rio', 'sol', 'tam', 'uma', 'vik', 'wen', 'xia', 'yan', 'zoe']


# ── oa-oracle-6: discounted price ────────────────────────────────────────────

def discount_problem(rng):
    pid, path = 'oa-oracle-6', '/api/inventory'
    cats = ['kitchen', 'garden', 'toys', 'office', 'audio', 'outdoor', 'books']
    rows, seen = [], {'74002314'}
    rows.append({'barcode': '74002314', 'item': 'Copper Kettle', 'category': 'kitchen', 'price': 3705, 'discount': 20, 'available': 1})
    while len(rows) < 160:
        code = ('00' if len(rows) % 9 == 0 else '') + ''.join(rng.choice('0123456789') for _ in range(8))
        code = code[:8]
        if code in seen:
            continue
        seen.add(code)
        n = len(rows)
        if n % 5 == 0:  # exact halves: price odd, half off
            price, off = rng.randrange(1, 4000) * 2 + 1, 50
        elif n % 7 == 0:
            price, off = rng.randrange(1, 10001), rng.choice([0, 100])
        else:
            price, off = rng.randrange(1, 10001), rng.randrange(0, 101)
        rows.append({'barcode': code, 'item': f'{rng.choice(WORDS_A)} {rng.choice(WORDS_B)}', 'category': rng.choice(cats),
                     'price': price, 'discount': off, 'available': rng.randrange(2)})
    by = {r['barcode']: r for r in rows}
    unknown = ['00000000', '99999999', '7400231', '740023140']
    while len(unknown) < 30:
        code = ''.join(rng.choice('0123456789') for _ in range(8))
        if code not in by:
            unknown.append(code)

    def expected(raw):
        row = by.get(raw.strip())
        if not row:
            return '-1\n'
        return f"{floor(Fraction(row['price'] * (100 - row['discount']), 100) + Fraction(1, 2))}\n"

    half_even = [r['barcode'] for r in rows if r['price'] * (100 - r['discount']) % 100 == 50 and r['price'] * (100 - r['discount']) // 100 % 2 == 0]
    zeros = [r['barcode'] for r in rows if r['barcode'].startswith('0')]
    assert len(half_even) >= 5 and len(zeros) >= 5
    fixtures = {}
    for code in [*by, *unknown]:
        fixtures.update(one_or_none(path, by.get(code), barcode=code))
    public = ['74002314', unknown[0], half_even[0]]
    hidden = [*half_even[1:6], *zeros[:5], *unknown[1:6], *shuffled(rng, [r['barcode'] for r in rows[1:] if r['barcode'] not in half_even + zeros])[:7]]
    oracle = list(dict.fromkeys([*by, *unknown]))[:163]
    reference = '''import requests


def discounted_price(barcode):
    body = requests.get('https://data.cswork.test/api/inventory', params={'barcode': barcode}, timeout=10).json()
    if not body['data']:
        return -1
    item = body['data'][0]
    # price * (1 - discount / 100), half up, in exact integers: no float, no banker's rounding.
    return (item['price'] * (100 - item['discount']) + 50) // 100


print(discounted_price(input().strip()))
'''
    mutants = [
        {'name': 'Python round 银行家舍入', 'code': reference.replace("return (item['price'] * (100 - item['discount']) + 50) // 100",
                                                               "return round(item['price'] - item['discount'] / 100 * item['price'])")},
        {'name': '截断小数', 'code': reference.replace("return (item['price'] * (100 - item['discount']) + 50) // 100",
                                                   "return int(item['price'] * (100 - item['discount']) / 100)")},
        {'name': '条码转整数丢前导零', 'code': reference.replace("params={'barcode': barcode}", "params={'barcode': int(barcode)}")
                                                  .replace("if not body['data']:", "if not body.get('data'):")},
    ]
    return {
        'id': pid, 'oa': True, 'checker': 'tokens', 'fixtures': fixtures, 'expected': expected,
        'public': [c + '\n' for c in public], 'hidden': [c + '\n' for c in hidden], 'oracle': [c + '\n' for c in oracle],
        'pool': [c + '\n' for c in oracle],
        'reference': reference, 'mutants': mutants,
        'title': 'REST API：折扣价', 'difficulty': '简单', 'tags': ['OA', 'Oracle', 'REST API', 'HTTP', 'JSON'],
        'description': f'''给定商品条码，请求库存接口，求商品打折后的价格。

```text
GET {HOST}{path}?barcode=<barcode>
```

返回一个 JSON 对象，`page`、`per_page`、`total`、`total_pages` 与本题无关；`data` 要么是空数组（条码不存在），要么恰好含一个商品：

```json
{{"page": 1, "per_page": 10, "total": 1, "total_pages": 1,
 "data": [{{"barcode": "74002314", "item": "Copper Kettle", "category": "kitchen", "price": 3705, "discount": 20, "available": 1}}]}}
```

其中 `price` 是原价（正整数），`discount` 是折扣百分比（0 到 100 的整数）。折后价为 `price - discount / 100 × price`，四舍五入到整数，恰好是 .5 时向上取整（例如 2.5 → 3）。条码不存在时输出 -1。

{OFFLINE_ZH}''',
        'input': '一行条码：8 位数字组成的字符串，可能以 0 开头，必须原样作为查询参数。',
        'output': '输出折后价（整数）；条码不存在输出 -1。',
        'explanation': '样例 1：price=3705、discount=20，折后 2964。样例 2：条码不存在，data 为空。样例 3：折后价恰好是 x.5，向上取整。',
        'hints': ['用整数算：price × (100 − discount) 再加 50 后整除 100，就是“.5 向上”的四舍五入。',
                  'Python 的 round() 对 .5 取最近的偶数，和题目的舍入规则不同。',
                  '条码按字符串传，别转成整数：前导零会丢。'],
        'editorial': '''## 思路

请求一次 `/api/inventory?barcode=<条码>`：`data` 为空输出 -1；否则取唯一商品的 `price` 与 `discount`，用整数计算 `(price × (100 − discount) + 50) // 100`。

## 正确性证明

折后价为 x = price × (100 − discount) / 100，记 P = price × (100 − discount)（非负整数）。题目要求 .5 向上的四舍五入，即 ⌊x + 1/2⌋ = ⌊(P + 50) / 100⌋，整数整除恰好给出这个值，不经过浮点数，因此不会出现 2.4999… 之类的误差，也不会像 Python 的 round() 那样把 2.5 舍成 2。条码以字符串原样作为查询参数，前导零不会丢失；`data` 为空时按题意输出 -1。

## 复杂度

一次请求，O(1) 时间与空间（不计 JSON 解析）。''',
    }


# ── oa-palantir-2: country calling codes ─────────────────────────────────────

COUNTRIES = [
    ('Afghanistan', 'Kabul', 'Asia', ['93']), ('Albania', 'Tirana', 'Europe', ['355']), ('Algeria', 'Algiers', 'Africa', ['213']),
    ('Argentina', 'Buenos Aires', 'Americas', ['54']), ('Australia', 'Canberra', 'Oceania', ['61']), ('Austria', 'Vienna', 'Europe', ['43']),
    ('Bangladesh', 'Dhaka', 'Asia', ['880']), ('Belgium', 'Brussels', 'Europe', ['32']), ('Brazil', 'Brasilia', 'Americas', ['55']),
    ('Canada', 'Ottawa', 'Americas', ['1']), ('Chile', 'Santiago', 'Americas', ['56']), ('China', 'Beijing', 'Asia', ['86']),
    ('Colombia', 'Bogota', 'Americas', ['57']), ('Denmark', 'Copenhagen', 'Europe', ['45']),
    ('Dominican Republic', 'Santo Domingo', 'Americas', ['1809', '1829', '1849']), ('Egypt', 'Cairo', 'Africa', ['20']),
    ('Finland', 'Helsinki', 'Europe', ['358']), ('France', 'Paris', 'Europe', ['33']), ('Germany', 'Berlin', 'Europe', ['49']),
    ('Greece', 'Athens', 'Europe', ['30']), ('India', 'New Delhi', 'Asia', ['91']), ('Indonesia', 'Jakarta', 'Asia', ['62']),
    ('Ireland', 'Dublin', 'Europe', ['353']), ('Italy', 'Rome', 'Europe', ['39']), ('Japan', 'Tokyo', 'Asia', ['81']),
    ('Kazakhstan', 'Astana', 'Asia', ['76', '77']), ('Kenya', 'Nairobi', 'Africa', ['254']), ('Mexico', 'Mexico City', 'Americas', ['52']),
    ('Netherlands', 'Amsterdam', 'Europe', ['31']), ('New Zealand', 'Wellington', 'Oceania', ['64']), ('Nigeria', 'Abuja', 'Africa', ['234']),
    ('Norway', 'Oslo', 'Europe', ['47']), ('Pakistan', 'Islamabad', 'Asia', ['92']), ('Peru', 'Lima', 'Americas', ['51']),
    ('Philippines', 'Manila', 'Asia', ['63']), ('Poland', 'Warsaw', 'Europe', ['48']), ('Portugal', 'Lisbon', 'Europe', ['351']),
    ('Puerto Rico', 'San Juan', 'Americas', ['1787', '1939']), ('Singapore', 'Singapore', 'Asia', ['65']),
    ('South Africa', 'Pretoria', 'Africa', ['27']), ('South Korea', 'Seoul', 'Asia', ['82']), ('Spain', 'Madrid', 'Europe', ['34']),
    ('Sweden', 'Stockholm', 'Europe', ['46']), ('Switzerland', 'Bern', 'Europe', ['41']), ('Thailand', 'Bangkok', 'Asia', ['66']),
    ('Turkey', 'Ankara', 'Asia', ['90']), ('United Kingdom', 'London', 'Europe', ['44']),
    ('United States of America', 'Washington', 'Americas', ['1']), ('Vietnam', 'Hanoi', 'Asia', ['84']),
    ('Bouvet Island', '', 'Antarctic', []), ('Heard Island and McDonald Islands', '', 'Antarctic', []),
]


def country_problem(rng):
    pid, path = 'oa-palantir-2', '/api/countries'
    by = {name: {'name': name, 'capital': capital, 'region': region, 'callingCodes': codes} for name, capital, region, codes in COUNTRIES}
    unknown = ['Oceania', 'Atlantis', 'afghanistan', 'United States', 'Korea', 'PUERTO RICO', 'New Zealandia', 'Bouvet']

    def phone(n=None):
        return ''.join(rng.choice('0123456789') for _ in range(n or rng.randrange(5, 16)))

    def expected(raw):
        name, number = raw.split('\n')[:2]
        codes = by[name]['callingCodes'] if name in by else []
        return f'+{codes[-1]} {number}\n' if codes else '-1\n'

    fixtures = {}
    for name in [*by, *unknown]:
        fixtures.update(one_or_none(path, by.get(name), name=name))
    public = ['Afghanistan\n6564454455\n', 'Puerto Rico\n564539386\n', 'Oceania\n987574876\n']
    multi = ['Dominican Republic', 'Kazakhstan', 'Puerto Rico']
    hidden = [f'{n}\n{phone()}\n' for n in [*multi, 'Bouvet Island', 'Heard Island and McDonald Islands', *unknown[1:],
                                             'United States of America', 'Canada', 'South Africa', 'New Zealand',
                                             *shuffled(rng, list(by))[:6]]]
    oracle = list(dict.fromkeys(public + hidden + [f'{rng.choice([*by, *unknown])}\n{phone()}\n' for _ in range(300)]))[:163]
    reference = '''import json
import urllib.parse
import urllib.request


def phone_number(country, number):
    url = 'https://data.cswork.test/api/countries?' + urllib.parse.urlencode({'name': country})
    with urllib.request.urlopen(url, timeout=10) as response:
        body = json.load(response)
    codes = body['data'][0]['callingCodes'] if body['data'] else []
    return '+' + codes[-1] + ' ' + number if codes else '-1'


country = input().strip()
number = input().strip()
print(phone_number(country, number))
'''
    mutants = [
        {'name': '取第一个区号', 'code': reference.replace("codes[-1]", "codes[0]")},
        {'name': '区号为空仍拼接', 'code': reference.replace("return '+' + codes[-1] + ' ' + number if codes else '-1'",
                                                       "return ('+' + codes[-1] + ' ' + number) if codes else ('+ ' + number if body['data'] else '-1')")},
    ]
    return {
        'id': pid, 'oa': True, 'checker': 'exact', 'fixtures': fixtures, 'expected': expected,
        'public': public, 'hidden': hidden, 'oracle': oracle, 'pool': oracle, 'reference': reference, 'mutants': mutants,
        'title': 'REST API：国家区号', 'difficulty': '简单', 'tags': ['OA', 'Palantir', 'REST API', 'HTTP', 'JSON'],
        'description': f'''给定国家名和电话号码，请求国家接口取得该国的电话区号，输出 `+<区号> <电话号码>`。

```text
GET {HOST}{path}?name=<国家名>
```

返回的 JSON 中，`data` 要么为空数组（没有这个国家），要么恰好含一条记录：

```json
{{"page": 1, "per_page": 10, "total": 1, "total_pages": 1,
 "data": [{{"name": "Puerto Rico", "capital": "San Juan", "region": "Americas", "callingCodes": ["1787", "1939"]}}]}}
```

- `name` 必须与记录名完全一致（区分大小写），否则 `data` 为空；国家名里可能有空格，要做 URL 编码。
- `callingCodes` 有多个时用下标最大的那个；`callingCodes` 为空数组也视为查不到。
- 查不到时输出 -1。

{OFFLINE_ZH}''',
        'input': '第一行国家名（英文字母和空格，首尾无空格）；第二行电话号码（5 到 15 位数字）。',
        'output': '输出一行：`+区号 电话号码`，或 -1。',
        'explanation': '样例 1：Afghanistan 的区号只有 93。样例 2：Puerto Rico 有两个区号，取下标最大的 1939。样例 3：Oceania 不是国家，data 为空。',
        'hints': ['国家名含空格时要编码：requests 的 params 或 urllib.parse.urlencode 都会处理。',
                  '“下标最大”就是数组的最后一个元素。', 'data 非空但 callingCodes 为空时也输出 -1。'],
        'editorial': '''## 思路

用国家名做查询参数请求一次接口；`data` 非空且 `callingCodes` 非空时输出 `+` 加最后一个区号、空格、电话号码，否则输出 -1。

## 正确性证明

接口按名称精确匹配，至多返回一条记录，因此一次请求即可确定该国的全部区号。题目规定多个区号时取下标最大者，即数组最后一个元素；没有记录或区号数组为空时都没有可用区号，按规定输出 -1。电话号码原样拼接，不做任何变换。

## 复杂度

一次请求，O(L) 时间与空间，L 为输出长度。''',
    }


# ── oa-rippling-3: TV series in production ───────────────────────────────────

def series_problem(rng):
    pid, path = 'oa-rippling-3', '/api/tvseries'
    names = set()
    while len(names) < 83:
        a, b = rng.choice(WORDS_A), rng.choice(WORDS_B)
        names.add(rng.choice([f'The {a} {b}', f'{a} {b}', f'{b} of {a} Days', f'{a} {b}s']))
    names = sorted(names) + ['iCity Nights', 'eLearning Hour', 'Zero Hour', 'the quiet garden']
    shows = []
    for name in shuffled(rng, names):
        start = rng.randrange(1985, 2025)
        kind = rng.random()
        end = None if kind < 0.3 else start if kind < 0.45 else min(2026, start + rng.randrange(1, 12))
        runtime = f'({start}- )' if end is None else f'({start})' if end == start else f'({start}-{end})'
        shows.append({'name': name, 'start': start, 'end': end, 'row': {
            'name': name, 'runtime_of_series': runtime, 'genre': rng.choice(['Drama', 'Comedy', 'Crime', 'Sci-Fi', 'Documentary']),
            'imdb_rating': round(rng.uniform(5.5, 9.4), 1)}})
    fixtures = paged(path, [s['row'] for s in shows])

    def expected(raw):
        start_year, end_year = map(int, raw.split())
        found = sorted(s['name'] for s in shows if s['start'] <= start_year and (
            s['end'] is None if end_year == -1 else s['end'] is not None and s['end'] <= end_year))
        return ''.join(f'{x}\n' for x in [len(found), *found])

    singles = sorted({s['start'] for s in shows if s['end'] == s['start']})
    public = ['2000 2010\n', '2015 -1\n', '1990 1995\n']
    hidden = ['2026 -1\n', '2026 2026\n', '1984 -1\n', '1985 2000\n', '2024 2025\n', '2010 2005\n',
              *[f'{y} {y}\n' for y in singles[:4]], *[f'{rng.randrange(1985, 2027)} {rng.choice([-1, rng.randrange(1985, 2027)])}\n' for _ in range(12)]]
    oracle = list(dict.fromkeys(public + hidden + [f'{s} {e}\n' for s in range(1984, 2027) for e in [-1, *range(1984, 2027)]]))
    oracle = oracle[:40] + shuffled(rng, oracle[40:])[:123]
    reference = '''import re
import requests

URL = 'https://data.cswork.test/api/tvseries'


def shows_in_production(start_year, end_year):
    found, page, pages = [], 1, 1
    while page <= pages:
        body = requests.get(URL, params={'page': page}, timeout=10).json()
        pages = body['total_pages']
        for show in body['data']:
            runtime = show['runtime_of_series']
            years = [int(year) for year in re.findall(r'\\d{4}', runtime)]
            running = len(years) == 1 and '-' in runtime
            if years[0] > start_year:
                continue
            if end_year == -1 and running or end_year != -1 and not running and years[-1] <= end_year:
                found.append(show['name'])
        page += 1
    return sorted(found)


start_year, end_year = map(int, input().split())
names = shows_in_production(start_year, end_year)
print(len(names))
for name in names:
    print(name)
'''
    mutants = [
        {'name': '漏掉最后一页', 'code': reference.replace('while page <= pages:', 'while page <= max(1, pages - 1):')},
        {'name': '单年剧当作在播', 'code': reference.replace("running = len(years) == 1 and '-' in runtime", 'running = len(years) == 1')},
        {'name': '开播年严格小于', 'code': reference.replace('if years[0] > start_year:', 'if years[0] >= start_year:')},
    ]
    return {
        'id': pid, 'oa': True, 'checker': 'exact', 'fixtures': fixtures, 'expected': expected,
        'public': public, 'hidden': hidden, 'oracle': oracle, 'pool': oracle, 'reference': reference, 'mutants': mutants,
        'title': 'REST API：某时期的剧集', 'difficulty': '中等', 'tags': ['OA', 'Rippling', 'REST API', '分页', 'JSON'],
        'description': f'''剧集接口分页返回全部剧集，每页 10 条：

```text
GET {HOST}{path}?page=<页码>
```

```json
{{"page": 1, "per_page": 10, "total": 87, "total_pages": 9,
 "data": [{{"name": "Copper Atlas", "runtime_of_series": "(2011-2019)", "genre": "Drama", "imdb_rating": 8.1}}, ...]}}
```

页码从 1 开始，需要一直取到第 `total_pages` 页。`runtime_of_series` 只有三种写法：

- `(A-B)`：A 年开播、B 年完结；
- `(A)`：A 年开播并在同一年完结；
- `(A- )`：A 年开播，仍在播出。

给定 `start_year` 和 `end_year`，找出所有开播年不晚于 `start_year` 的剧集，并且：

- 若 `end_year = -1`，剧集必须仍在播出；
- 否则剧集必须已完结，且完结年不晚于 `end_year`。

结果按名称的字典序排序（逐字符比较 Unicode 码点，大写字母排在小写字母前）。

{OFFLINE_ZH}''',
        'input': '一行两个整数 start_year end_year：1980 ≤ start_year ≤ 2030；end_year = -1 或 1980 ≤ end_year ≤ 2030。',
        'output': '第一行输出符合条件的剧集数 k，随后 k 行按字典序各输出一个剧名（原样，可能含空格）。',
        'explanation': '样例 1：2000 年或之前开播、2010 年或之前完结的剧集。样例 2：2015 年或之前开播、至今仍在播出的剧集。样例 3：只算 1990 年或之前开播、1995 年或之前完结的剧集。',
        'hints': ['先请求第 1 页拿到 total_pages，再把剩下的页依次取完；最后一页可能不满 10 条。',
                  '用正则取出 runtime_of_series 里的四位年份：只有一个年份且带“-”才是仍在播出。',
                  'Python 的 sorted() 按码点比较字符串，正是题目要求的顺序。'],
        'editorial': '''## 思路

从第 1 页起依次请求到第 `total_pages` 页。对每部剧用正则取出四位年份：两个年份为已完结（开播、完结），一个年份且含 `-` 为仍在播出，一个年份不含 `-` 为同年开播并完结。按条件筛选后排序输出。

## 正确性证明

接口按页划分全部剧集，第 1 页给出总页数，请求 1..total_pages 恰好覆盖每部剧一次，最后一页不足 10 条也会被读取。三种 runtime 写法互斥：在播剧只有开播年；完结剧的完结年是最后一个年份（单年剧开播年即完结年）。筛选条件与题意逐条对应：开播年 ≤ start_year；end_year = -1 时要求在播，否则要求已完结且完结年 ≤ end_year。Python 的字符串排序按码点比较，与规定的字典序一致。

## 复杂度

请求 ⌈n/10⌉ 次，处理 O(n)，排序 O(k log k)；n 为剧集总数，k 为结果数。''',
    }


# ── rest-01..06: original problems ───────────────────────────────────────────

def orders_problem(rng):
    path = '/api/orders'
    sizes = {'pending': 23, 'paid': 41, 'shipped': 60, 'cancelled': 13, 'refunded': 0}
    orders, oid = [], 1000
    for status, count in sizes.items():
        for _ in range(count):
            oid += rng.randrange(1, 4)
            orders.append({'id': oid, 'customer': rng.choice(PEOPLE), 'status': status,
                           'amount_cents': rng.choice([500, 1000, 2500, 5000, 9999, 10000]) if rng.random() < 0.3 else rng.randrange(100, 30000),
                           'created_at': f'2026-0{rng.randrange(1, 10)}-{rng.randrange(1, 29):02d}'})
    orders.sort(key=lambda o: o['id'])
    fixtures = {}
    for status in sizes:
        fixtures.update(paged(path, [o for o in orders if o['status'] == status], status=status))

    def expected(raw):
        status, low = raw.split()
        hit = [o['amount_cents'] for o in orders if o['status'] == status and o['amount_cents'] >= int(low)]
        return f'{len(hit)} {sum(hit)}\n'

    public = ['paid 5000\n', 'refunded 0\n', 'cancelled 10000\n']
    hidden = ['shipped 0\n', 'shipped 9999\n', 'shipped 10000\n', 'pending 2500\n', 'pending 1000000\n', 'paid 0\n',
              'paid 500\n', 'cancelled 0\n', 'refunded 5000\n', 'shipped 30000\n', 'pending 100\n', 'paid 10000\n']
    pool = [f'{rng.choice(list(sizes))} {rng.randrange(0, 30001)}\n' for _ in range(40)]
    reference = '''import requests

URL = 'https://data.cswork.test/api/orders'


def matching(status, low):
    count = total = 0
    page, pages = 1, 1
    while page <= pages:
        body = requests.get(URL, params={'status': status, 'page': page}, timeout=10).json()
        pages = body['total_pages']
        for order in body['data']:
            if order['amount_cents'] >= low:
                count += 1
                total += order['amount_cents']
        page += 1
    return count, total


status, low = input().split()
print(*matching(status, int(low)))
'''
    mutants = [
        {'name': 'strictly-greater', 'code': reference.replace("if order['amount_cents'] >= low:", "if order['amount_cents'] > low:")},
        {'name': 'skips-last-page', 'code': reference.replace('while page <= pages:', 'while page < max(2, pages):')},
    ]
    return {
        'id': 'rest-01', 'checker': 'tokens', 'fixtures': fixtures, 'expected': expected, 'public': public, 'hidden': hidden, 'pool': pool,
        'reference': reference, 'mutants': mutants, 'difficulty': '简单', 'tags': ['REST API', '分页', 'HTTP'],
        'title': ['订单分页筛选', 'Filter Paged Orders'],
        'description': [f'''订单接口按状态过滤并分页返回，每页 10 条：

```text
GET {HOST}{path}?status=<status>&page=<页码>
```

```json
{{"page": 1, "per_page": 10, "total": 41, "total_pages": 5,
 "data": [{{"id": 1003, "customer": "ava", "status": "paid", "amount_cents": 4999, "created_at": "2026-03-14"}}, ...]}}
```

`status` 是 `pending`、`paid`、`shipped`、`cancelled`、`refunded` 之一。没有订单时 `total` 和 `total_pages` 都是 0，`data` 为空。

给定状态和金额下限（单位：分），统计该状态下金额不低于下限的订单数和它们的金额之和。

{OFFLINE_ZH}''', f'''The orders API filters by status and returns 10 orders per page:

```text
GET {HOST}{path}?status=<status>&page=<page>
```

```json
{{"page": 1, "per_page": 10, "total": 41, "total_pages": 5,
 "data": [{{"id": 1003, "customer": "ava", "status": "paid", "amount_cents": 4999, "created_at": "2026-03-14"}}, ...]}}
```

`status` is one of `pending`, `paid`, `shipped`, `cancelled`, `refunded`. With no orders, `total` and `total_pages` are 0 and `data` is empty.

Given a status and a minimum amount in cents, count the orders with that status whose amount is at least the minimum, and add up their amounts.

{OFFLINE_EN}'''],
        'input': ['一行：状态和金额下限（0 ≤ 下限 ≤ 1000000 的整数，单位分），空格分隔。', 'One line: the status and the minimum amount in cents (an integer, 0 ≤ minimum ≤ 1000000), separated by a space.'],
        'output': ['输出两个整数：订单数和金额之和（分）。', 'Print two integers: the number of orders and the sum of their amounts in cents.'],
        'explanation': ['样例 2：refunded 没有订单，接口返回 total_pages = 0。', 'Sample 2: there are no refunded orders, so the API returns total_pages = 0.'],
        'hints': [['先取第 1 页得到 total_pages，再取到最后一页。', '“不低于”包含等于下限的订单。'],
                  ['Fetch page 1 for total_pages, then every page up to the last.', '"At least" includes orders equal to the minimum.']],
    }


def ledger_problem(rng):
    path = '/api/transactions'
    users = PEOPLE[:9]
    rows = []
    for i in range(124):
        rows.append({'id': 50001 + i, 'user': rng.choice(users), 'type': rng.choice(['credit', 'credit', 'debit']),
                     'amount': rng.choice([1000, 2000, 2500]) if rng.random() < 0.3 else rng.randrange(100, 9000),
                     'date': f'2026-0{rng.randrange(1, 7)}-{rng.randrange(1, 29):02d}'})
    # A July with a tie listed out of name order: hana before cai.
    for day, (user, kind, amount) in enumerate([('hana', 'credit', 2999), ('cai', 'credit', 3000), ('eli', 'debit', 500), ('hana', 'credit', 1)]):
        rows.append({'id': 50001 + len(rows), 'user': user, 'type': kind, 'amount': amount, 'date': f'2026-07-0{day + 1}'})
    fixtures = paged(path, rows)

    def expected(raw):
        month, k = raw.split()
        net = {}
        for r in rows:
            if r['date'][:7] == month:
                net[r['user']] = net.get(r['user'], 0) + (r['amount'] if r['type'] == 'credit' else -r['amount'])
        top = sorted(net.items(), key=lambda kv: (-kv[1], kv[0]))[:int(k)]
        return ''.join(f'{line}\n' for line in [len(top), *[f'{u} {v}' for u, v in top]])

    months = [f'2026-0{m}' for m in range(1, 7)]
    public = ['2026-03 3\n', '2025-12 5\n', '2026-01 1\n']
    hidden = [f'{m} {k}' + '\n' for m in months for k in (2, 9)] + ['2026-07 3\n', '2026-07 2\n', '2026-06 100\n', '2026-02 4\n', '2026-04 1\n',
                                                                    '2026-05 5\n', '2026-01 7\n', '2026-03 9\n', '2026-06 6\n', '2026-02 1\n', '2026-05 3\n']
    pool = [f'2026-0{rng.randrange(1, 7)} {rng.randrange(1, 12)}\n' for _ in range(40)]
    reference = '''import requests

URL = 'https://data.cswork.test/api/transactions'


def monthly_net(month):
    net, page, pages = {}, 1, 1
    while page <= pages:
        body = requests.get(URL, params={'page': page}, timeout=10).json()
        pages = body['total_pages']
        for row in body['data']:
            if row['date'].startswith(month + '-'):
                sign = 1 if row['type'] == 'credit' else -1
                net[row['user']] = net.get(row['user'], 0) + sign * row['amount']
        page += 1
    return net


month, k = input().split()
top = sorted(monthly_net(month).items(), key=lambda item: (-item[1], item[0]))[:int(k)]
print(len(top))
for user, value in top:
    print(user, value)
'''
    mutants = [
        {'name': 'debits-added', 'code': reference.replace("sign = 1 if row['type'] == 'credit' else -1", 'sign = 1')},
        {'name': 'unsorted-ties', 'code': reference.replace('key=lambda item: (-item[1], item[0])', 'key=lambda item: -item[1]')},
    ]
    return {
        'id': 'rest-02', 'checker': 'tokens', 'fixtures': fixtures, 'expected': expected, 'public': public, 'hidden': hidden, 'pool': pool,
        'reference': reference, 'mutants': mutants, 'difficulty': '中等', 'tags': ['REST API', '分页', '聚合', '排序'],
        'title': ['月度净流入排行', 'Monthly Net Flow Ranking'],
        'description': [f'''流水接口分页返回全部交易，每页 10 条，不支持过滤：

```text
GET {HOST}{path}?page=<页码>
```

```json
{{"page": 1, "per_page": 10, "total": 128, "total_pages": 13,
 "data": [{{"id": 50001, "user": "ava", "type": "credit", "amount": 2500, "date": "2026-03-14"}}, ...]}}
```

`type` 为 `credit`（入账，记正）或 `debit`（出账，记负），`amount` 为正整数。

给定月份 `YYYY-MM` 和 k，计算每个用户在这个月的净流入（入账之和减出账之和），只统计这个月有交易的用户。按净流入从大到小输出前 k 名，相同时按用户名字典序。

{OFFLINE_ZH}''', f'''The transactions API returns every transaction, 10 per page, with no filters:

```text
GET {HOST}{path}?page=<page>
```

```json
{{"page": 1, "per_page": 10, "total": 128, "total_pages": 13,
 "data": [{{"id": 50001, "user": "ava", "type": "credit", "amount": 2500, "date": "2026-03-14"}}, ...]}}
```

`type` is `credit` (money in, positive) or `debit` (money out, negative); `amount` is a positive integer.

Given a month `YYYY-MM` and k, compute each user's net flow in that month (credits minus debits), counting only users with a transaction that month. Print the top k by net flow, largest first, ties by user name in lexicographic order.

{OFFLINE_EN}'''],
        'input': ['一行：月份 YYYY-MM 和整数 k（1 ≤ k ≤ 100）。', 'One line: the month YYYY-MM and an integer k (1 ≤ k ≤ 100).'],
        'output': ['第一行输出名次数 m = min(k, 有交易的用户数)；随后 m 行，每行“用户名 净流入”。', 'First line: m = min(k, number of users with a transaction that month); then m lines of "user net".'],
        'explanation': ['样例 2：2025-12 没有交易，输出 0。', 'Sample 2: there are no transactions in 2025-12, so the answer is 0.'],
        'hints': [['所有页都要取完再排序：同一用户的交易分散在不同页。', '按 (−净流入, 用户名) 排序即可处理并列。'],
                  ['Read every page before sorting: one user\'s transactions are spread across pages.', 'Sort by (−net, user) to break ties.']],
    }


def accounts_problem(rng):
    teams = ['atlas', 'beacon', 'comet', 'delta', 'ember', 'fable']
    sizes = {'atlas': 14, 'beacon': 10, 'comet': 21, 'delta': 7, 'ember': 12, 'fable': 0}
    users, uid = [], 100
    first = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gil', 'Hal', 'Iris', 'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Ola', 'Pia', 'Rex', 'Sia', 'Ty', 'Val']
    for team in teams:
        for _ in range(sizes[team]):
            uid += rng.randrange(1, 5)
            users.append({'id': uid, 'name': f'{rng.choice(first)} {rng.choice(WORDS_B)}', 'team': team, 'active': rng.random() < 0.75})
    balance = {u['id']: rng.choice([5000, 12000, 30000]) if rng.random() < 0.35 else rng.randrange(0, 50000) for u in users}
    fixtures = {}
    for team in teams:
        fixtures.update(paged('/api/users', [u for u in users if u['team'] == team], team=team))
    for u in users:
        fixtures[key(f"/api/accounts/{u['id']}")] = {'user_id': u['id'], 'balance': balance[u['id']], 'currency': 'USD'}

    def expected(raw):
        team, k = raw.split()
        top = sorted(((u['name'], balance[u['id']]) for u in users if u['team'] == team and u['active']),
                     key=lambda x: (-x[1], x[0]))[:int(k)]
        return ''.join(f'{line}\n' for line in [len(top), *[f'{n} {b}' for n, b in top]])

    public = ['comet 3\n', 'fable 5\n', 'delta 10\n']
    hidden = [f'{t} {k}\n' for t in teams for k in (1, 4, 50)] + ['comet 21\n', 'atlas 9\n', 'ember 7\n', 'beacon 2\n']
    pool = [f'{rng.choice(teams)} {rng.randrange(1, 30)}\n' for _ in range(40)]
    reference = '''import requests

BASE = 'https://data.cswork.test/api'


def richest(team, k):
    found, page, pages = [], 1, 1
    while page <= pages:
        body = requests.get(BASE + '/users', params={'team': team, 'page': page}, timeout=10).json()
        pages = body['total_pages']
        for user in body['data']:
            if user['active']:
                account = requests.get(f"{BASE}/accounts/{user['id']}", timeout=10).json()
                found.append((user['name'], account['balance']))
        page += 1
    return sorted(found, key=lambda pair: (-pair[1], pair[0]))[:k]


team, k = input().split()
top = richest(team, int(k))
print(len(top))
for name, balance in top:
    print(name, balance)
'''
    mutants = [
        {'name': 'counts-inactive', 'code': reference.replace("if user['active']:", 'if True:')},
        {'name': 'ties-by-id', 'code': reference.replace('key=lambda pair: (-pair[1], pair[0])', 'key=lambda pair: -pair[1]')},
    ]
    return {
        'id': 'rest-03', 'checker': 'exact', 'fixtures': fixtures, 'expected': expected, 'public': public, 'hidden': hidden, 'pool': pool,
        'reference': reference, 'mutants': mutants, 'difficulty': '中等', 'tags': ['REST API', '分页', '连接'],
        'title': ['团队余额前 k 名', 'Top Balances in a Team'],
        'description': [f'''两个接口：

```text
GET {HOST}/api/users?team=<team>&page=<页码>
GET {HOST}/api/accounts/<user_id>
```

用户接口按团队过滤并分页（每页 10 条，没有成员时 `total_pages` 为 0）：

```json
{{"page": 1, "per_page": 10, "total": 14, "total_pages": 2,
 "data": [{{"id": 103, "name": "Iris Lantern", "team": "atlas", "active": true}}, ...]}}
```

账户接口返回一个用户的账户（每个用户都有）：

```json
{{"user_id": 103, "balance": 12000, "currency": "USD"}}
```

给定团队和 k，找出该团队中 `active` 为 true 的用户，按余额从高到低取前 k 名，余额相同时按姓名字典序。

{OFFLINE_ZH}''', f'''Two endpoints:

```text
GET {HOST}/api/users?team=<team>&page=<page>
GET {HOST}/api/accounts/<user_id>
```

The users endpoint filters by team and pages its results (10 per page; `total_pages` is 0 for an empty team):

```json
{{"page": 1, "per_page": 10, "total": 14, "total_pages": 2,
 "data": [{{"id": 103, "name": "Iris Lantern", "team": "atlas", "active": true}}, ...]}}
```

The accounts endpoint returns one user's account (every user has one):

```json
{{"user_id": 103, "balance": 12000, "currency": "USD"}}
```

Given a team and k, take the team's users whose `active` is true and list the top k by balance, highest first, ties by name in lexicographic order.

{OFFLINE_EN}'''],
        'input': ['一行：团队名和整数 k（1 ≤ k ≤ 100）。', 'One line: the team name and an integer k (1 ≤ k ≤ 100).'],
        'output': ['第一行输出 m = min(k, 活跃成员数)；随后 m 行，每行“姓名 余额”（姓名含一个空格）。', 'First line: m = min(k, number of active members); then m lines of "name balance" (a name has one space in it).'],
        'explanation': ['样例 2：fable 团队没有成员，输出 0。', 'Sample 2: team fable has no members, so the answer is 0.'],
        'hints': [['先分页取完团队成员，再逐个查询活跃成员的账户。', '只给活跃成员查账户，可以少发请求。'],
                  ['Page through the team first, then look up each active member\'s account.', 'Looking up active members only saves requests.']],
    }


def articles_problem(rng):
    sizes = {'lin': 0, 'mo': 7, 'nadia': 10, 'omar': 11, 'pia': 20, 'quinn': 23, 'ravi': 1, 'sara': 30}
    articles, aid = [], 7000
    for author, count in sizes.items():
        for _ in range(count):
            aid += rng.randrange(1, 9)
            title = f'{rng.choice(WORDS_A)} {rng.choice(WORDS_B)} notes'
            story = f'On {rng.choice(WORDS_B).lower()}s and {rng.choice(WORDS_B).lower()}s'
            shape = rng.random()
            articles.append({'id': aid, 'author': author, 'title': None if shape < 0.25 else title,
                             'story_title': story if shape < 0.4 else None,
                             'num_comments': None if rng.random() < 0.1 else rng.choice([0, 12, 40]) if rng.random() < 0.3 else rng.randrange(0, 60),
                             'published': f'2026-{rng.randrange(1, 10):02d}-{rng.randrange(1, 29):02d}'})
    fixtures = {}
    for author in sizes:
        fixtures.update(paged('/api/articles', [a for a in articles if a['author'] == author], author=author))

    def expected(raw):
        author, low = raw.split()
        kept = [(a['title'] or a['story_title'], a['num_comments'] or 0, a['published']) for a in articles
                if a['author'] == author and (a['title'] or a['story_title']) and (a['num_comments'] or 0) >= int(low)]
        lines = [len(kept), sum(c for _, c, _ in kept)]
        if kept:
            lines.append(min(kept, key=lambda t: (-t[1], t[2], t[0]))[0])
        return ''.join(f'{x}\n' for x in lines)

    public = ['omar 0\n', 'lin 0\n', 'pia 20\n']
    hidden = [f'{a} {k}\n' for a in sizes for k in (0, 12, 41)] + ['quinn 5\n', 'sara 30\n', 'nadia 59\n']
    reference = '''import requests

URL = 'https://data.cswork.test/api/articles'


def articles(author, low):
    kept, page, pages = [], 1, 1
    while page <= pages:
        body = requests.get(URL, params={'author': author, 'page': page}, timeout=10).json()
        pages = body['total_pages']
        for article in body['data']:
            title = article['title'] or article['story_title']
            comments = article['num_comments'] or 0
            if title and comments >= low:
                kept.append((title, comments, article['published']))
        page += 1
    return kept


author, low = input().split()
kept = articles(author, int(low))
print(len(kept))
print(sum(comments for _, comments, _ in kept))
if kept:
    print(min(kept, key=lambda item: (-item[1], item[2], item[0]))[0])
'''
    mutants = [
        {'name': 'floor-page-count', 'code': reference.replace("pages = body['total_pages']", "pages = body['total'] // body['per_page']")},
        {'name': 'ignores-story-title', 'code': reference.replace("title = article['title'] or article['story_title']", "title = article['title']")},
    ]
    return {
        'id': 'rest-04', 'checker': 'exact', 'fixtures': fixtures, 'expected': expected, 'public': public, 'hidden': hidden,
        'reference': reference, 'mutants': mutants, 'difficulty': '中等', 'tags': ['REST API', '分页', '边界'],
        'title': ['作者的文章与评论', "An Author's Articles and Comments"],
        'description': [f'''文章接口按作者过滤并分页，每页 10 条：

```text
GET {HOST}/api/articles?author=<author>&page=<页码>
```

```json
{{"page": 2, "per_page": 10, "total": 11, "total_pages": 2,
 "data": [{{"id": 7031, "author": "omar", "title": null, "story_title": "On harbors and signals", "num_comments": 12, "published": "2026-04-02"}}]}}
```

- 作者没有文章时 `total` 和 `total_pages` 都是 0，`data` 为空；最后一页可能不满 10 条，也可能正好满。
- `title` 为 null 时用 `story_title` 作标题；两者都为 null 的文章不计入。
- `num_comments` 为 null 时按 0 计。

给定作者和评论数下限，统计该作者评论数不低于下限的文章：文章数、评论总数，以及评论最多的文章标题（并列时取 `published` 较早的，再并列取标题字典序较小的）。

{OFFLINE_ZH}''', f'''The articles API filters by author and pages its results, 10 per page:

```text
GET {HOST}/api/articles?author=<author>&page=<page>
```

```json
{{"page": 2, "per_page": 10, "total": 11, "total_pages": 2,
 "data": [{{"id": 7031, "author": "omar", "title": null, "story_title": "On harbors and signals", "num_comments": 12, "published": "2026-04-02"}}]}}
```

- An author with no articles has `total` and `total_pages` 0 and an empty `data`; the last page may hold fewer than 10 articles, or exactly 10.
- When `title` is null, use `story_title` as the title; an article with both null does not count.
- A null `num_comments` counts as 0.

Given an author and a minimum number of comments, consider that author's articles with at least that many comments: print how many there are, their total comments, and the title of the most commented one (ties: earlier `published`, then the lexicographically smaller title).

{OFFLINE_EN}'''],
        'input': ['一行：作者名和整数下限（0 ≤ 下限 ≤ 1000）。', 'One line: the author and an integer minimum (0 ≤ minimum ≤ 1000).'],
        'output': ['第一行文章数，第二行评论总数；文章数大于 0 时第三行输出评论最多的标题。', 'Line 1: the number of articles; line 2: their total comments; if there is at least one article, line 3: the most commented title.'],
        'explanation': ['样例 1：omar 有 11 篇文章，第 2 页只有 1 篇。样例 2：lin 没有文章，total_pages 为 0。',
                        'Sample 1: omar has 11 articles, so page 2 holds just one. Sample 2: lin has no articles and total_pages is 0.'],
        'hints': [['总页数直接用 total_pages，不要用 total // per_page。', '标题回退：article["title"] or article["story_title"]。'],
                  ['Use total_pages as given, not total // per_page.', 'Title fallback: article["title"] or article["story_title"].']],
    }


def events_problem(rng):
    kinds = {'login': 37, 'purchase': 16, 'upload': 8, 'share': 0}
    users = PEOPLE[:7]
    events, eid = [], 900
    for kind, count in kinds.items():
        ts = 1767225600
        for _ in range(count):
            eid += 1
            ts += rng.randrange(0, 5000)
            events.append({'id': eid, 'type': kind, 'user': rng.choice(users), 'ts': ts})
    fixtures, cursors = {}, set()
    for kind in kinds:
        rows = [e for e in events if e['type'] == kind]
        chunks = [rows[i:i + 8] for i in range(0, len(rows), 8)] or [[]]
        names = []
        for _ in chunks[1:]:
            c = ''.join(rng.choice('0123456789abcdef') for _ in range(6))
            assert c not in cursors
            cursors.add(c)
            names.append(c)
        for i, chunk in enumerate(chunks):
            query = {'type': kind} if i == 0 else {'type': kind, 'cursor': names[i - 1]}
            fixtures[key('/api/events', **query)] = {'data': chunk, 'next_cursor': names[i] if i < len(names) else None}

    def expected(raw):
        kind, lo, hi = raw.split()
        counts = {}
        for e in events:
            if e['type'] == kind and int(lo) <= e['ts'] <= int(hi):
                counts[e['user']] = counts.get(e['user'], 0) + 1
        top = min(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0] if counts else '-'
        return f'{len(counts)}\n{top}\n'

    public = ['login 1767225600 1767300000\n', 'share 0 9999999999\n', 'upload 1767226000 1767240000\n']
    hidden = []
    for kind in kinds:
        rows = [e['ts'] for e in events if e['type'] == kind] or [1767225600]
        hidden += [f'{kind} 0 9999999999\n', f'{kind} {rows[0]} {rows[0]}\n', f'{kind} {rows[-1]} {rows[-1] + 1}\n',
                   f'{kind} {rows[len(rows) // 2]} {rows[-1]}\n', f'{kind} {rows[0] + 1} {rows[-1] - 1}\n', f'{kind} 1 2\n']
    reference = '''import requests

URL = 'https://data.cswork.test/api/events'


def window(kind, lo, hi):
    counts, cursor = {}, None
    while True:
        params = {'type': kind} if cursor is None else {'type': kind, 'cursor': cursor}
        body = requests.get(URL, params=params, timeout=10).json()
        for event in body['data']:
            if lo <= event['ts'] <= hi:
                counts[event['user']] = counts.get(event['user'], 0) + 1
        cursor = body['next_cursor']
        if cursor is None:
            return counts


kind, lo, hi = input().split()
counts = window(kind, int(lo), int(hi))
print(len(counts))
print(min(counts.items(), key=lambda item: (-item[1], item[0]))[0] if counts else '-')
'''
    mutants = [
        {'name': 'first-page-only', 'code': reference.replace("        cursor = body['next_cursor']\n        if cursor is None:", "        cursor = None\n        if cursor is None:")},
        {'name': 'exclusive-end', 'code': reference.replace("if lo <= event['ts'] <= hi:", "if lo <= event['ts'] < hi:")},
    ]
    return {
        'id': 'rest-05', 'checker': 'tokens', 'fixtures': fixtures, 'expected': expected, 'public': public, 'hidden': hidden,
        'reference': reference, 'mutants': mutants, 'difficulty': '中等', 'tags': ['REST API', '游标分页', '计数'],
        'title': ['游标分页的事件统计', 'Events Behind a Cursor'],
        'description': [f'''事件接口用游标分页：第一页不带 `cursor`，之后每次带上一页返回的 `next_cursor`，直到它为 null。

```text
GET {HOST}/api/events?type=<type>
GET {HOST}/api/events?type=<type>&cursor=<next_cursor>
```

```json
{{"data": [{{"id": 901, "type": "login", "user": "cai", "ts": 1767226012}}, ...], "next_cursor": "3fa9c1"}}
```

`type` 是 `login`、`purchase`、`upload`、`share` 之一；没有事件时 `data` 为空、`next_cursor` 为 null。游标是不透明的字符串，不能猜，只能从上一页拿。

给定类型和时间窗 [from, to]（Unix 秒，两端都包含），输出窗口内有该类事件的不同用户数，以及事件最多的用户（并列取用户名字典序最小者；没有事件时输出 `-`）。

{OFFLINE_ZH}''', f'''The events API pages with a cursor: the first request has no `cursor`; each next one passes the `next_cursor` of the page before, until it is null.

```text
GET {HOST}/api/events?type=<type>
GET {HOST}/api/events?type=<type>&cursor=<next_cursor>
```

```json
{{"data": [{{"id": 901, "type": "login", "user": "cai", "ts": 1767226012}}, ...], "next_cursor": "3fa9c1"}}
```

`type` is one of `login`, `purchase`, `upload`, `share`; with no events, `data` is empty and `next_cursor` is null. Cursors are opaque strings: you cannot guess them, only take them from the previous page.

Given a type and a time window [from, to] (Unix seconds, both ends included), print the number of distinct users with an event of that type in the window, and the user with the most such events (ties: the lexicographically smallest name; `-` if there are none).

{OFFLINE_EN}'''],
        'input': ['一行：类型、from、to（0 ≤ from ≤ to ≤ 10^10 的整数）。', 'One line: the type, from and to (integers, 0 ≤ from ≤ to ≤ 10^10).'],
        'output': ['第一行不同用户数；第二行事件最多的用户名或 `-`。', 'Line 1: the number of distinct users; line 2: the most active user, or `-`.'],
        'explanation': ['样例 2：share 没有事件，输出 0 和 -。', 'Sample 2: there are no share events, so the answer is 0 and -.'],
        'hints': [['循环直到 next_cursor 为 null，不要按页码猜。', '时间窗两端都包含：from ≤ ts ≤ to。'],
                  ['Loop until next_cursor is null; do not guess page numbers.', 'Both ends of the window count: from ≤ ts ≤ to.']],
    }


def tickets_problem(rng):
    agents = {i: {'id': i, 'name': f'{rng.choice(PEOPLE).title()} {rng.choice(WORDS_B)}', 'team': rng.choice(['billing', 'platform', 'support', 'growth'])}
              for i in range(1, 13)}
    gone = {4, 9}
    tickets = []
    for i in range(58):
        tickets.append({'id': 3001 + i, 'title': f'{rng.choice(WORDS_A)} {rng.choice(WORDS_B).lower()} issue',
                        'priority': rng.choice(['low', 'medium', 'high', 'urgent']), 'status': rng.choice(['open', 'closed']),
                        'assignee': None if rng.random() < 0.15 else rng.choice(list(agents))})
    fixtures = paged('/api/tickets', tickets)
    for i, agent in agents.items():
        if i not in gone:
            fixtures[key(f'/api/agents/{i}')] = agent

    def expected(raw):
        wanted, status = raw.split('\n')[:2]
        wanted = set(wanted.split(','))
        counts = {}
        for t in tickets:
            if t['priority'] in wanted and status in ('any', t['status']):
                team = agents[t['assignee']]['team'] if t['assignee'] and t['assignee'] not in gone else 'unassigned'
                counts[team] = counts.get(team, 0) + 1
        rows = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        return ''.join(f'{x}\n' for x in [len(rows), *[f'{t} {c}' for t, c in rows]])

    levels = ['low', 'medium', 'high', 'urgent']
    combos = [','.join(c for j, c in enumerate(levels) if mask >> j & 1) for mask in range(1, 16)]
    public = ['urgent\nopen\n', 'low,medium,high,urgent\nany\n', 'high\nclosed\n']
    hidden = [f'{c}\n{s}\n' for c in combos for s in ('any', 'open', 'closed')]
    hidden = shuffled(rng, hidden)
    reference = '''import requests

BASE = 'https://data.cswork.test/api'


def team_of(agent_id, cache):
    if agent_id is None:
        return 'unassigned'
    if agent_id not in cache:
        response = requests.get(f'{BASE}/agents/{agent_id}', timeout=10)
        cache[agent_id] = response.json()['team'] if response.status_code == 200 else 'unassigned'
    return cache[agent_id]


def by_team(priorities, status):
    counts, cache, page, pages = {}, {}, 1, 1
    while page <= pages:
        body = requests.get(BASE + '/tickets', params={'page': page}, timeout=10).json()
        pages = body['total_pages']
        for ticket in body['data']:
            if ticket['priority'] in priorities and status in ('any', ticket['status']):
                team = team_of(ticket['assignee'], cache)
                counts[team] = counts.get(team, 0) + 1
        page += 1
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))


priorities = set(input().strip().split(','))
status = input().strip()
rows = by_team(priorities, status)
print(len(rows))
for team, count in rows:
    print(team, count)
'''
    mutants = [
        {'name': 'drops-deleted-agents', 'code': reference.replace(
            "                team = team_of(ticket['assignee'], cache)\n                counts[team] = counts.get(team, 0) + 1",
            "                team = team_of(ticket['assignee'], cache)\n                if team != 'unassigned' or ticket['assignee'] is None:\n                    counts[team] = counts.get(team, 0) + 1")},
        {'name': 'sorted-by-team', 'code': reference.replace('key=lambda item: (-item[1], item[0])', 'key=lambda item: item[0]')},
    ]
    return {
        'id': 'rest-06', 'checker': 'tokens', 'fixtures': fixtures, 'expected': expected, 'public': public, 'hidden': hidden,
        'reference': reference, 'mutants': mutants, 'difficulty': '中等', 'tags': ['REST API', '分页', '连接', '错误处理'],
        'title': ['按团队统计工单', 'Tickets by Team'],
        'description': [f'''两个接口：

```text
GET {HOST}/api/tickets?page=<页码>
GET {HOST}/api/agents/<agent_id>
```

工单接口分页返回全部工单（每页 10 条，不支持过滤）：

```json
{{"page": 1, "per_page": 10, "total": 58, "total_pages": 6,
 "data": [{{"id": 3001, "title": "Iron signal issue", "priority": "high", "status": "open", "assignee": 7}}, ...]}}
```

`assignee` 是客服编号或 null。客服接口返回 `{{"id": 7, "name": "...", "team": "billing"}}`；已删除的客服返回 HTTP 404。

给定若干优先级和状态（`open`、`closed` 或 `any`），统计符合条件的工单在各团队的数量：没有 `assignee`、或客服已删除（404）的工单记为团队 `unassigned`。按数量从多到少输出，数量相同按团队名字典序。

{OFFLINE_ZH}''', f'''Two endpoints:

```text
GET {HOST}/api/tickets?page=<page>
GET {HOST}/api/agents/<agent_id>
```

The tickets endpoint pages through every ticket (10 per page, no filters):

```json
{{"page": 1, "per_page": 10, "total": 58, "total_pages": 6,
 "data": [{{"id": 3001, "title": "Iron signal issue", "priority": "high", "status": "open", "assignee": 7}}, ...]}}
```

`assignee` is an agent id or null. The agents endpoint returns `{{"id": 7, "name": "...", "team": "billing"}}`; a deleted agent answers HTTP 404.

Given some priorities and a status (`open`, `closed` or `any`), count the matching tickets per team: a ticket with no `assignee`, or whose agent was deleted (404), counts for the team `unassigned`. Print teams by count, highest first, ties by team name in lexicographic order.

{OFFLINE_EN}'''],
        'input': ['第一行用逗号分隔的优先级（`low`、`medium`、`high`、`urgent` 中的若干个，无空格）；第二行状态。', 'Line 1: comma-separated priorities (some of `low`, `medium`, `high`, `urgent`, no spaces); line 2: the status.'],
        'output': ['第一行团队数 m；随后 m 行，每行“团队 数量”。', 'Line 1: the number of teams m; then m lines of "team count".'],
        'explanation': ['样例 2：全部工单按团队统计。', 'Sample 2: every ticket, counted by team.'],
        'hints': [['先看 status_code：404 的客服不能调用 .json()["team"]。', '同一个客服只需查询一次，用字典缓存。'],
                  ['Check status_code first: a 404 agent has no "team".', 'Look each agent up once; cache the answers in a dict.']],
    }


# ── build ────────────────────────────────────────────────────────────────────

def distinct_hidden(p, rng):
    """22 hidden inputs, none repeated or public: the problem's own picks first, then its oracle/random pool."""
    hidden = [h for h in dict.fromkeys(p['hidden']) if h not in p['public']]
    pool = [x for x in shuffled(rng, p.get('pool', [])) if x not in hidden and x not in p['public']]
    p['hidden'] = (hidden + pool)[:22]


def cases_of(p):
    cases = []
    for i, raw in enumerate(p['public'] + p['hidden']):
        hidden = i >= len(p['public'])
        name = f'隐藏 {i - len(p["public"]) + 1}' if hidden else f'样例 {i + 1}'
        cases.append({'name': name, 'input': raw, 'expectedOutput': p['expected'](raw), 'hidden': hidden, 'weight': 1})
    return cases


def check(p, cases):
    """The reference matches the independent expectations everywhere; every incorrect program exits normally and is caught."""
    inputs = [c['input'] for c in cases] + p.get('oracle', [])
    got = [out for out, _ in run_all(p['reference'], p['fixtures'], inputs)]
    want = [c['expectedOutput'] for c in cases] + [p['expected'](raw) for raw in p.get('oracle', [])]
    for raw, a, b in zip(inputs, got, want):
        assert a == b, f"{p['id']} reference on {raw!r}: {a!r} != {b!r}"
    kills = []
    for mutant in p['mutants']:
        outs = [out for out, _ in run_all(mutant['code'], p['fixtures'], [c['input'] for c in cases])]
        rejected = [i for i, (c, out) in enumerate(zip(cases, outs)) if not same(out, c['expectedOutput'], p['checker'])]
        assert rejected, f"{p['id']}: surviving mutant {mutant['name']}"
        kills.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitCases': len(cases)})
    return kills


def visible_keys(p, cases):
    """The fixtures sample and custom-input runs get (lib/server/oj-engine.ts runSpec): every key the
    reference or an incorrect program requests on the visible cases, widened to the whole listing it
    pages through (either page-1 spelling, any page, the empty page after the last, every cursor)."""
    public = [c['input'] for c in cases if not c['hidden']]
    asked = {line[6:] for code in [p['reference'], *(m['code'] for m in p['mutants'])]
             for _, err in run_all(code, p['fixtures'], public, TRACE) for line in err.splitlines() if line.startswith('TRACE ')}

    def listing(k):
        path, _, query = k.partition('?')
        return path, tuple(pair for pair in parse_qsl(query, keep_blank_values=True) if pair[0] not in ('page', 'cursor'))

    wanted = {listing(k) for k in asked if k in p['fixtures']}
    return sorted(k for k in p['fixtures'] if listing(k) in wanted)


def same(actual, expected, checker):
    return actual.split() == expected.split() if checker == 'tokens' else actual == expected


def package(p, cases):
    zh = isinstance(p['title'], str)
    pick = (lambda v: v) if zh else (lambda v: v[0])
    problem = {
        'id': p['id'], 'courseId': 'gomall', 'lessonId': '00-overview', 'title': pick(p['title']), 'difficulty': p['difficulty'],
        **({} if zh else {'translations': {'en': {'title': p['title'][1], 'description': p['description'][1], 'input': p['input'][1],
                                                   'output': p['output'][1], 'explanation': p['explanation'][1], 'hints': p['hints'][1]}}}),
        'tags': p['tags'], 'description': pick(p['description']), 'input': pick(p['input']), 'output': pick(p['output']),
        'explanation': pick(p['explanation']), 'hints': p['hints'] if zh else p['hints'][0],
        'timeLimit': 2, 'memoryLimit': 262144, 'outputLimit': 64, 'checker': p['checker'], 'languages': ['python'],
        'httpFixtures': p['fixtures'], 'visibleFixtureKeys': visible_keys(p, cases),
    }
    script = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');"
              "process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
    return subprocess.run(['node', '--import', 'tsx', '-e', script], cwd=ROOT, check=True, capture_output=True, text=True,
                          input=json.dumps({'schemaVersion': 1, 'problem': problem, 'cases': cases}, ensure_ascii=False)).stdout


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    started = time.perf_counter()
    rng = random.Random(SEED)
    problems = [maker(rng) for maker in (discount_problem, country_problem, series_problem, orders_problem, ledger_problem,
                                         accounts_problem, articles_problem, events_problem, tickets_problem)]
    catalog = {x['id']: x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items']}
    coverage = {x['id']: x for x in json.loads((OA / 'coverage.json').read_text())['items']}
    track, programs, entries, resolutions, validation = [], {}, [], [], []
    for p in problems:
        distinct_hidden(p, rng)
        cases = cases_of(p)
        assert len(p['hidden']) >= 20 and len({c['input'] for c in cases}) == len(cases), p['id']
        assert len(json.dumps(p['fixtures']).encode()) <= 512 * 1024, p['id']
        kills = check(p, cases)
        normalized = package(p, cases)
        print(f"{p['id']}: {len(cases)} cases, {len(p.get('oracle', []))} oracle, {len(p['fixtures'])} fixtures, "
              f"{len(kills)} mutants caught", flush=True)
        if not p.get('oa'):
            track.append(json.loads(normalized))
            programs[p['id']] = {'reference': p['reference'], 'mutants': p['mutants']}
            continue
        pid, source = p['id'], catalog[p['id']]
        assert coverage[pid]['status'] in ('blocked', 'awaiting_sandbox'), pid
        oracle = [{'input': raw, 'expectedOutput': p['expected'](raw)} for raw in p['oracle']]
        assert len(oracle) == 163 and len({o['input'] for o in oracle}) == 163, pid
        (OA / 'references').mkdir(parents=True, exist_ok=True)
        (OA / 'references' / f'{pid}.py').write_text(p['reference'])
        for i, mutant in enumerate(p['mutants']):
            (OA / 'negative-controls' / f'{pid}-{i + 1}.py').write_text(mutant['code'])
        solutions = [{'language': 'python', 'code': p['reference']}]
        put(OA / 'packages' / f'{pid}.json', json.loads(normalized))
        put(OA / 'oracles' / f'{pid}.json', oracle)
        put(OA / 'mutants' / f'{pid}.json', p['mutants'])
        put(OA / 'editorials' / f'{pid}.json', {'schemaVersion': 1, 'id': pid, 'title': p['title'], 'explanation': p['editorial'], 'solutions': solutions})
        entries.append({'id': pid, 'sourceContentHash': source['contentHash'], 'packageChecksum': sha(normalized),
                        'editorial': p['editorial'], 'authoredSolutions': solutions})
        previous = coverage[pid].get('reason', '')
        if coverage[pid]['status'] == 'blocked' or coverage[pid].get('batch') == BATCH:
            old = next((r for r in json.loads((OA / 'resolutions' / f'{BATCH}.json').read_text())['items'] if r['id'] == pid), None) \
                if (OA / 'resolutions' / f'{BATCH}.json').exists() else None
            resolutions.append({'id': pid, 'sourceContentHash': source['contentHash'], 'batch': BATCH,
                                'previousReason': old['previousReason'] if old else previous,
                                'reason': '原题依赖外部实时 REST API；改用题目自带的离线 HTTP 桩（固定原创 JSON 数据，requests/urlopen 由评测机应答），明确舍入、匹配与分页语义，Python 判题。'})
        validation.append({'id': pid, 'oracleCases': len(oracle), 'uniqueOracleInputs': len(oracle), 'publicCases': len(p['public']),
                           'hiddenCases': len(p['hidden']), 'referenceFormalCases': len(cases), 'referenceLanguage': 'python',
                           'referenceSha256': sha(p['reference']), 'negativeControls': kills, 'fixtureKeys': len(p['fixtures']),
                           'oracleMethod': 'Expected outputs computed directly from the generated records (exact fractions, structured fields), never through the HTTP stubs or the reference program.',
                           'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True})
    put(OA / 'candidate-batches' / f'{BATCH}.json', {'schemaVersion': 1, 'items': entries})
    put(OA / 'resolutions' / f'{BATCH}.json', {'schemaVersion': 1, 'items': resolutions})
    put(OA / 'validation' / f'{BATCH}.json', {'schemaVersion': 1, 'seed': SEED, 'problems': validation,
                                               'elapsedSeconds': round(time.perf_counter() - started, 3)})
    TRACK.mkdir(parents=True, exist_ok=True)
    (TRACK / 'packages.json').write_text(json.dumps(track, ensure_ascii=False) + '\n')
    put(TRACK / 'programs.json', programs)
    print(f'done in {time.perf_counter() - started:.1f}s', flush=True)


if __name__ == '__main__':
    main()
