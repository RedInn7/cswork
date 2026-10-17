/**
 * Pandas-only problems (pd-101…): reshaping, time series and cleaning, which
 * have no SQL twin. Each brings its own tables, a sample and at least three
 * hand-written hidden datasets, a reference solve(), other accepted solutions
 * and common wrong ones. scripts/sql-track/build.ts --pandas computes the
 * expected outputs with the reference through PANDAS_HARNESS and applies the
 * SQL track's checks: every accepted solution agrees everywhere and every
 * wrong one fails some hidden dataset. Three-digit ids keep clear of the
 * pd-NN ↔ sql-NN twins. The APIs used behave the same on pandas 2.1–2.3.
 */
import type { Data } from './datasets';

type Text = { zh: string; en: string };
export type PandasGroupKey = 'reshape' | 'timeseries' | 'cleaning';
export const PANDAS_GROUPS: { key: PandasGroupKey; zh: string; en: string }[] = [
  { key: 'reshape', zh: '重塑与透视', en: 'Reshaping & pivots' },
  { key: 'timeseries', zh: '时间序列', en: 'Time series' },
  { key: 'cleaning', zh: '数据清洗', en: 'Data cleaning' },
];
export type PandasProblem = {
  id: string;
  group: PandasGroupKey;
  difficulty: '简单' | '中等' | '困难';
  title: Text;
  /** [table, CREATE TABLE], one column per line; a trailing `--` comment is the column's note. */
  tables: [string, string][];
  ordered?: true;
  task: Text;
  /** [column, meaning zh, meaning en], in output order. */
  columns: [string, string, string][];
  explanation: Text;
  hints: { zh: string[]; en: string[] };
  reference: string;
  accepted?: string[];
  wrong: string[];
  sample: Data;
  hidden: Data[];
};

/** A solution file: the imports, then the body. */
const py = (body: string) => `import numpy as np\nimport pandas as pd\n\n\n${body.trim()}\n`;

const SALES_WIDE = `CREATE TABLE sales_wide (
  store TEXT NOT NULL,
  region TEXT NOT NULL,
  q1 INTEGER,              -- NULL: not reported
  q2 INTEGER,              -- NULL: not reported
  q3 INTEGER,              -- NULL: not reported
  q4 INTEGER               -- NULL: not reported
);`;
const MONTHLY = `CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  region TEXT NOT NULL,
  month TEXT NOT NULL,     -- 'YYYY-MM'
  amount INTEGER NOT NULL
);`;
const GRADES = `CREATE TABLE grades (
  student TEXT NOT NULL,
  subject TEXT NOT NULL,
  term TEXT NOT NULL,      -- 'fall' or 'spring'; one score per student, subject and term
  score INTEGER NOT NULL
);`;
const POSTS = `CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  author TEXT NOT NULL,
  tags TEXT                -- comma-separated, typed by hand; NULL: none
);`;
const PAYMENTS = `CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  paid_at TEXT NOT NULL,   -- 'YYYY-MM-DD HH:MM:SS'
  amount INTEGER NOT NULL  -- negative for a refund
);`;
const WORKOUTS = `CREATE TABLE workouts (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,       -- 'YYYY-MM-DD'; several workouts a day are possible
  minutes INTEGER NOT NULL
);`;
const TRADES = `CREATE TABLE trades (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  ts TEXT NOT NULL,        -- 'YYYY-MM-DD HH:MM:SS'
  qty INTEGER NOT NULL
);`;
const QUOTES = `CREATE TABLE quotes (
  symbol TEXT NOT NULL,
  ts TEXT NOT NULL,        -- 'YYYY-MM-DD HH:MM:SS'; one quote per symbol and time
  price REAL NOT NULL
);`;
const READINGS = `CREATE TABLE readings (
  sensor TEXT NOT NULL,
  ts TEXT NOT NULL,        -- 'YYYY-MM-DD HH:MM:SS'; one reading per sensor and time
  value REAL               -- NULL: the reading failed
);`;
const TEMPS = `CREATE TABLE temps (
  station TEXT NOT NULL,
  day TEXT NOT NULL,       -- 'YYYY-MM-DD'; one row per station and day, no day skipped
  temp REAL                -- NULL: missing reading
);`;
const SIGNUPS = `CREATE TABLE signups (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  signup_date TEXT         -- meant to be 'YYYY-MM-DD'; NULL: not given
);`;
const TICKETS = `CREATE TABLE tickets (
  id INTEGER PRIMARY KEY,
  subject TEXT             -- free text; NULL: empty subject
);`;
const CONTACTS = `CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,              -- typed by hand: stray spaces and capitals; NULL: not given
  created TEXT NOT NULL    -- 'YYYY-MM-DD'
);`;
const SHIRTS = `CREATE TABLE shirts (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  size TEXT NOT NULL       -- 'XS', 'S', 'M', 'L' or 'XL'
);`;

export const PANDAS_NATIVE: PandasProblem[] = [
  {
    id: 'pd-101',
    group: 'reshape',
    difficulty: '简单',
    title: { zh: '季度宽表变长表', en: 'Quarterly Sales, Wide to Long' },
    tables: [['sales_wide', SALES_WIDE]],
    task: {
      zh: '`sales_wide` 每家店一行，四个季度的销售额各占一列（`q1`–`q4`），没上报的季度是 NULL。把它变成长表：每家店每个上报了的季度一行，包含店名、季度名（列名本身，如 `q1`）和销售额。没上报的季度不要出现；销售额为 0 是上报了的。`region` 不是季度，不要拆开。',
      en: 'In `sales_wide` each store is one row with a column per quarter (`q1`–`q4`); a quarter not reported is NULL. Make it long: one row per store and reported quarter, with the store, the quarter name (the column name itself, like `q1`) and the sales. Unreported quarters are left out; sales of 0 count as reported. `region` is not a quarter and is not unpivoted.',
    },
    columns: [
      ['store', '店名', 'store'],
      ['quarter', "季度名：'q1'–'q4'", "quarter name: 'q1'–'q4'"],
      ['amount', '销售额', 'sales'],
    ],
    explanation: {
      zh: 'Elm St 上报了 q1、q2、q4，Oak Ave 上报了 q1、q4，Pine Rd 上报了 q1–q3，其中 q1 是 0，也要保留。一共 8 行。',
      en: 'Elm St reported q1, q2 and q4, Oak Ave q1 and q4, and Pine Rd q1–q3, whose q1 is 0 and still counts. 8 rows in all.',
    },
    hints: {
      zh: ['`melt(id_vars=…, value_vars=[…], var_name=…, value_name=…)` 把列变成行。', '只把季度列放进 value_vars；之后用 `dropna` 去掉没上报的行。'],
      en: ['`melt(id_vars=…, value_vars=[…], var_name=…, value_name=…)` turns columns into rows.', 'Put only the quarter columns in value_vars, then `dropna` the unreported rows.'],
    },
    reference: py(`
def solve(tables):
    wide = tables['sales_wide']
    long = wide.melt(id_vars='store', value_vars=['q1', 'q2', 'q3', 'q4'], var_name='quarter', value_name='amount')
    return long.dropna(subset=['amount'])
`),
    accepted: [
      py(`
def solve(tables):
    wide = tables['sales_wide']
    rows = [
        (store, quarter, value)
        for quarter in ['q1', 'q2', 'q3', 'q4']
        for store, value in zip(wide['store'], wide[quarter])
        if not pd.isna(value)
    ]
    return pd.DataFrame(rows, columns=['store', 'quarter', 'amount'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    wide = tables['sales_wide']
    return wide.melt(id_vars='store', value_vars=['q1', 'q2', 'q3', 'q4'], var_name='quarter', value_name='amount')
`),
      py(`
def solve(tables):
    wide = tables['sales_wide']
    long = wide.melt(id_vars='store', value_vars=['q1', 'q2', 'q3', 'q4'], var_name='quarter', value_name='amount')
    return long[long['amount'].fillna(0) != 0]
`),
      py(`
def solve(tables):
    long = tables['sales_wide'].melt(id_vars='store', var_name='quarter', value_name='amount')
    return long.dropna(subset=['amount'])
`),
    ],
    sample: {
      sales_wide: [
        ['Elm St', 'East', 120, 95, null, 140],
        ['Oak Ave', 'East', 80, null, null, 60],
        ['Pine Rd', 'West', 0, 30, 45, null],
      ],
    },
    hidden: [
      {
        sales_wide: [
          ['Bay Rd', 'North', null, null, null, null],
          ['Cove Ln', 'North', 10, 20, 30, 40],
        ],
      },
      { sales_wide: [['Dock St', 'South', null, 0, null, 0]] },
      {
        sales_wide: [
          ['Fir Ct', 'West', -15, 0, 25, null],
          ['Gate Sq', 'East', 70, 70, 70, 70],
          ['Hill Dr', 'West', null, 55, null, null],
        ],
      },
    ],
  },
  {
    id: 'pd-102',
    group: 'reshape',
    difficulty: '中等',
    title: { zh: '按月透视各区域销售额', en: 'Monthly Pivot by Region' },
    tables: [['orders', MONTHLY]],
    task: {
      zh: '做一张一季度报表：表里出现过的每个区域一行，后面三列依次是它在 2024-01、2024-02、2024-03 的销售额之和，没有订单的月份写 0。只在其他月份有订单的区域也要出现，三列都是 0。',
      en: 'Build a first-quarter report: one row per region that appears in the table, then three columns with its total sales in 2024-01, 2024-02 and 2024-03, 0 for a month without orders. A region with orders only in other months still appears, with three zeros.',
    },
    columns: [
      ['region', '区域', 'region'],
      ['jan', '2024-01 销售额之和', 'total for 2024-01'],
      ['feb', '2024-02 销售额之和', 'total for 2024-02'],
      ['mar', '2024-03 销售额之和', 'total for 2024-03'],
    ],
    explanation: {
      zh: 'North 一月有两单 100 + 50 = 150，三月 70；South 二月两单共 100；West 只有四月的订单，三列都是 0。',
      en: 'North has two January orders, 100 + 50 = 150, and 70 in March; South has two February orders totalling 100; West only ordered in April, so its three columns are 0.',
    },
    hints: {
      zh: [
        '`pivot_table` 的 aggfunc 默认是 mean，求和要写 `aggfunc=\'sum\'`。',
        '某个月整张表都没有订单时，透视结果里就没有这一列：用 `reindex(columns=…, fill_value=0)` 补齐，区域也一样。',
      ],
      en: [
        "`pivot_table`'s aggfunc defaults to mean; for totals pass `aggfunc='sum'`.",
        'A month with no orders at all is missing from the pivot: add it with `reindex(columns=…, fill_value=0)`, and the same for regions.',
      ],
    },
    reference: py(`
MONTHS = ['2024-01', '2024-02', '2024-03']


def solve(tables):
    orders = tables['orders']
    q1 = orders[orders['month'].isin(MONTHS)]
    table = q1.pivot_table(index='region', columns='month', values='amount', aggfunc='sum', fill_value=0)
    table = table.reindex(index=sorted(orders['region'].unique()), columns=MONTHS, fill_value=0)
    return table.reset_index()
`),
    accepted: [
      py(`
def solve(tables):
    orders = tables['orders']
    rows = []
    for region, group in orders.groupby('region'):
        rows.append([region] + [int(group.loc[group['month'] == m, 'amount'].sum()) for m in ['2024-01', '2024-02', '2024-03']])
    return pd.DataFrame(rows, columns=['region', 'jan', 'feb', 'mar'])
`),
    ],
    wrong: [
      py(`
MONTHS = ['2024-01', '2024-02', '2024-03']


def solve(tables):
    orders = tables['orders']
    q1 = orders[orders['month'].isin(MONTHS)]
    table = q1.pivot_table(index='region', columns='month', values='amount', fill_value=0)
    return table.reindex(index=sorted(orders['region'].unique()), columns=MONTHS, fill_value=0).reset_index()
`),
      py(`
MONTHS = ['2024-01', '2024-02', '2024-03']


def solve(tables):
    orders = tables['orders']
    q1 = orders[orders['month'].isin(MONTHS)]
    table = q1.pivot_table(index='region', columns='month', values='amount', aggfunc='sum', fill_value=0)
    return table.reindex(columns=MONTHS, fill_value=0).reset_index()
`),
      py(`
def solve(tables):
    orders = tables['orders']
    q1 = orders[orders['month'] < '2024-04']
    table = q1.pivot_table(index='region', columns='month', values='amount', aggfunc='sum', fill_value=0)
    return table.reset_index()
`),
    ],
    sample: {
      orders: [
        [1, 'North', '2024-01', 100],
        [2, 'North', '2024-01', 50],
        [3, 'North', '2024-03', 70],
        [4, 'South', '2024-02', 40],
        [5, 'South', '2024-02', 60],
        [6, 'West', '2024-04', 90],
      ],
    },
    hidden: [
      {
        orders: [
          [1, 'East', '2024-01', 20],
          [2, 'East', '2024-03', 30],
          [3, 'North', '2024-03', 5],
        ],
      },
      {
        orders: [
          [1, 'South', '2023-01', 500],
          [2, 'South', '2024-02', 10],
          [3, 'Coast', '2023-03', 80],
          [4, 'South', '2024-02', 15],
          [5, 'Inland', '2024-01', 0],
        ],
      },
      { orders: [[1, 'Solo', '2024-02', 42]] },
    ],
  },
  {
    id: 'pd-103',
    group: 'reshape',
    difficulty: '中等',
    title: { zh: '秋季和春季成绩对比', en: 'Fall Versus Spring Scores' },
    tables: [['grades', GRADES]],
    task: {
      zh: '每个（学生，科目）一行：秋季分数、春季分数，以及进步 = 春季 − 秋季。缺一个学期的分数时，那一列为 NULL，进步也为 NULL。整张表可能根本没有某个学期的数据，这一列仍要有，全为 NULL。',
      en: 'One row per (student, subject): the fall score, the spring score, and the progress, spring − fall. When a term is missing, its column is NULL and so is the progress. The whole table may have no data for a term at all; its column still appears, all NULL.',
    },
    columns: [
      ['student', '学生', 'student'],
      ['subject', '科目', 'subject'],
      ['fall', '秋季分数，没有为 NULL', 'fall score, NULL if none'],
      ['spring', '春季分数，没有为 NULL', 'spring score, NULL if none'],
      ['change', '春季 − 秋季，缺一个为 NULL', 'spring − fall, NULL if either is missing'],
    ],
    explanation: {
      zh: 'Amy 的数学从 70 到 85，进步 15；Bo 的美术从 80 到 72，进步 −8。Amy 的美术只有秋季、Bo 的数学只有春季，进步都是 NULL。',
      en: 'Amy’s math went from 70 to 85, progress 15; Bo’s art from 80 to 72, progress −8. Amy’s art has only fall and Bo’s math only spring, so their progress is NULL.',
    },
    hints: {
      zh: [
        "`set_index(['student', 'subject', 'term'])['score'].unstack('term')` 把学期变成列。",
        "再 `reindex(columns=['fall', 'spring'])`，没有数据的学期也有一列。",
      ],
      en: [
        "`set_index(['student', 'subject', 'term'])['score'].unstack('term')` turns the terms into columns.",
        "Then `reindex(columns=['fall', 'spring'])` so a term without data still has a column.",
      ],
    },
    reference: py(`
def solve(tables):
    grades = tables['grades']
    wide = grades.set_index(['student', 'subject', 'term'])['score'].unstack('term')
    wide = wide.reindex(columns=['fall', 'spring'])
    wide['change'] = wide['spring'] - wide['fall']
    return wide.reset_index()[['student', 'subject', 'fall', 'spring', 'change']]
`),
    accepted: [
      py(`
def solve(tables):
    grades = tables['grades']
    keys = grades[['student', 'subject']].drop_duplicates()
    for term in ['fall', 'spring']:
        part = grades.loc[grades['term'] == term, ['student', 'subject', 'score']].rename(columns={'score': term})
        keys = keys.merge(part, on=['student', 'subject'], how='left')
    keys['change'] = keys['spring'] - keys['fall']
    return keys
`),
    ],
    wrong: [
      py(`
def solve(tables):
    wide = tables['grades'].set_index(['student', 'subject', 'term'])['score'].unstack('term')
    wide = wide.reindex(columns=['fall', 'spring'])
    wide['change'] = wide['fall'] - wide['spring']
    return wide.reset_index()[['student', 'subject', 'fall', 'spring', 'change']]
`),
      py(`
def solve(tables):
    wide = tables['grades'].set_index(['student', 'subject', 'term'])['score'].unstack('term')
    wide = wide.reindex(columns=['fall', 'spring']).dropna()
    wide['change'] = wide['spring'] - wide['fall']
    return wide.reset_index()[['student', 'subject', 'fall', 'spring', 'change']]
`),
      py(`
def solve(tables):
    wide = tables['grades'].set_index(['student', 'subject', 'term'])['score'].unstack('term', fill_value=0)
    wide = wide.reindex(columns=['fall', 'spring'], fill_value=0)
    wide['change'] = wide['spring'] - wide['fall']
    return wide.reset_index()[['student', 'subject', 'fall', 'spring', 'change']]
`),
    ],
    sample: {
      grades: [
        ['Amy', 'math', 'fall', 70],
        ['Amy', 'math', 'spring', 85],
        ['Amy', 'art', 'fall', 90],
        ['Bo', 'math', 'spring', 60],
        ['Bo', 'art', 'fall', 80],
        ['Bo', 'art', 'spring', 72],
      ],
    },
    hidden: [
      {
        grades: [
          ['Cai', 'bio', 'fall', 66],
          ['Cai', 'chem', 'fall', 0],
          ['Dee', 'bio', 'fall', 91],
        ],
      },
      {
        grades: [
          ['Eli', 'math', 'spring', 77],
          ['Fay', 'math', 'spring', 59],
        ],
      },
      {
        grades: [
          ['Gil', 'math', 'fall', 50],
          ['Gil', 'math', 'spring', 50],
          ['Gil', 'art', 'spring', 100],
          ['Hal', 'art', 'fall', 88],
          ['Hal', 'art', 'spring', 95],
          ['Hal', 'math', 'fall', 40],
          ['Hal', 'math', 'spring', 35],
        ],
      },
    ],
  },
  {
    id: 'pd-104',
    group: 'reshape',
    difficulty: '中等',
    title: { zh: '拆开逗号分隔的标签', en: 'Explode Comma-Separated Tags' },
    tables: [['posts', POSTS]],
    task: {
      zh: '`tags` 是手填的逗号分隔标签，可能有多余空格、大小写不一、重复或空项。去掉每个标签两端的空格并转成小写，丢掉空标签，然后统计每个标签出现在多少篇帖子里：同一篇帖子里重复的标签只算一次。',
      en: '`tags` holds comma-separated tags typed by hand, with stray spaces, mixed case, repeats or empty items. Trim each tag, lowercase it and drop empty ones, then count how many posts carry each tag: a tag repeated within one post counts once.',
    },
    columns: [
      ['tag', '规范化后的标签', 'normalized tag'],
      ['posts', '带这个标签的帖子数', 'posts carrying it'],
    ],
    explanation: {
      zh: '帖子 1 和 4 有 sql（帖子 4 写了三次，大小写不同，只算一次），帖子 1 和 2 有 pandas，帖子 2 有 numpy。帖子 3 没有标签，帖子 5 是空字符串。',
      en: 'Posts 1 and 4 carry sql (post 4 lists it three times in mixed case, counted once), posts 1 and 2 carry pandas, and post 2 carries numpy. Post 3 has no tags and post 5 an empty string.',
    },
    hints: {
      zh: [
        "`str.split(',')` 把文本变成列表，`explode` 把列表里的每个元素变成一行。",
        "`str.strip().str.lower()` 规范化，再按（帖子，标签）`drop_duplicates`。",
      ],
      en: [
        "`str.split(',')` makes each text a list, and `explode` puts every element on its own row.",
        "Normalize with `str.strip().str.lower()`, then `drop_duplicates` on (post, tag).",
      ],
    },
    reference: py(`
def solve(tables):
    posts = tables['posts']
    rows = posts.assign(tag=posts['tags'].str.split(',')).explode('tag')
    rows['tag'] = rows['tag'].str.strip().str.lower()
    rows = rows[rows['tag'].notna() & (rows['tag'] != '')]
    rows = rows.drop_duplicates(['id', 'tag'])
    return rows.groupby('tag').size().reset_index(name='posts')
`),
    accepted: [
      py(`
def solve(tables):
    counts = {}
    for text in tables['posts']['tags']:
        if text is None:
            continue
        for tag in {item.strip().lower() for item in text.split(',')} - {''}:
            counts[tag] = counts.get(tag, 0) + 1
    return pd.DataFrame(sorted(counts.items()), columns=['tag', 'posts'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    posts = tables['posts']
    rows = posts.assign(tag=posts['tags'].str.split(',')).explode('tag')
    rows['tag'] = rows['tag'].str.strip().str.lower()
    rows = rows[rows['tag'].notna() & (rows['tag'] != '')]
    return rows.groupby('tag').size().reset_index(name='posts')
`),
      py(`
def solve(tables):
    posts = tables['posts']
    rows = posts.assign(tag=posts['tags'].str.split(',')).explode('tag')
    rows['tag'] = rows['tag'].str.lower()
    rows = rows[rows['tag'].notna() & (rows['tag'] != '')].drop_duplicates(['id', 'tag'])
    return rows.groupby('tag').size().reset_index(name='posts')
`),
      py(`
def solve(tables):
    posts = tables['posts']
    rows = posts.assign(tag=posts['tags'].str.split(',')).explode('tag')
    rows['tag'] = rows['tag'].str.strip()
    rows = rows[rows['tag'].notna() & (rows['tag'] != '')].drop_duplicates(['id', 'tag'])
    return rows.groupby('tag').size().reset_index(name='posts')
`),
    ],
    sample: {
      posts: [
        [1, 'ann', 'sql, pandas'],
        [2, 'ben', 'Pandas,numpy'],
        [3, 'cat', null],
        [4, 'dan', 'sql,sql, SQL'],
        [5, 'eve', ''],
      ],
    },
    hidden: [
      {
        posts: [
          [1, 'fay', '  ML ,stats,'],
          [2, 'gus', ',ml'],
          [3, 'hal', 'Stats ,  ,viz'],
        ],
      },
      {
        posts: [
          [1, 'ida', null],
          [2, 'jon', ''],
          [3, 'kay', ' , '],
        ],
      },
      {
        posts: [
          [1, 'lev', 'go'],
          [2, 'mia', 'Go, rust,GO'],
          [3, 'nat', 'rust'],
          [4, 'oz', 'c ,go'],
        ],
      },
    ],
  },
  {
    id: 'pd-105',
    group: 'timeseries',
    difficulty: '中等',
    title: { zh: '每日收款补零', en: 'Daily Payments with Empty Days' },
    tables: [['payments', PAYMENTS]],
    ordered: true,
    task: {
      zh: '从第一笔收款那天到最后一笔收款那天（按日历日，两端都包含），每天一行：日期和当天 `amount` 之和（退款为负数）。没有收款的日子写 0。按日期从早到晚排列。数据保证至少有一笔收款。',
      en: 'For every calendar day from the day of the first payment to the day of the last (both included), output one row: the day and the sum of that day’s `amount` (refunds are negative). Days without payments show 0. Order by day. There is always at least one payment.',
    },
    columns: [
      ['day', "日期，'YYYY-MM-DD'", "date, 'YYYY-MM-DD'"],
      ['total', '当天金额之和，没有为 0', "the day's total, 0 if none"],
    ],
    explanation: {
      zh: '2 月 27 日两笔共 50；28 日没有收款，写 0；29 日 23:59:59 有一笔 −20 的退款；3 月 1 日两笔共 65。',
      en: 'February 27 has two payments totalling 50; the 28th has none and shows 0; the 29th has a −20 refund at 23:59:59; March 1 has two payments totalling 65.',
    },
    hints: {
      zh: [
        '先 `pd.to_datetime` 再 `set_index`，`resample(\'D\').sum()` 按天汇总，并且会把中间没有数据的天补成 0。',
        '`groupby` 按日期汇总只会得到有数据的天。',
      ],
      en: [
        "`pd.to_datetime`, then `set_index`, then `resample('D').sum()` totals by day and fills the days in between with 0.",
        '`groupby` on the date only yields the days that have data.',
      ],
    },
    reference: py(`
def solve(tables):
    payments = tables['payments']
    amounts = payments.assign(at=pd.to_datetime(payments['paid_at'])).set_index('at')['amount'].astype('int64')
    return amounts.resample('D').sum().reset_index()
`),
    accepted: [
      py(`
def solve(tables):
    payments = tables['payments']
    day = pd.to_datetime(payments['paid_at']).dt.normalize()
    totals = payments['amount'].groupby(day).sum()
    days = pd.date_range(day.min(), day.max(), freq='D')
    return pd.DataFrame({'day': days, 'total': totals.reindex(days, fill_value=0).to_numpy()})
`),
    ],
    wrong: [
      py(`
def solve(tables):
    payments = tables['payments']
    day = pd.to_datetime(payments['paid_at']).dt.normalize()
    return payments['amount'].groupby(day).sum().reset_index()
`),
      py(`
def solve(tables):
    payments = tables['payments']
    at = pd.to_datetime(payments['paid_at'])
    totals = payments['amount'].groupby(at.dt.normalize()).sum()
    days = pd.date_range(at.min(), at.max(), freq='D')
    return pd.DataFrame({'day': days.normalize(), 'total': totals.reindex(days, fill_value=0).to_numpy()})
`),
    ],
    sample: {
      payments: [
        [1, '2024-02-27 09:15:00', 30],
        [2, '2024-02-27 18:40:00', 20],
        [3, '2024-03-01 00:05:00', 50],
        [4, '2024-02-29 23:59:59', -20],
        [5, '2024-03-01 12:00:00', 15],
      ],
    },
    hidden: [
      { payments: [[1, '2024-06-30 23:00:00', 99]] },
      {
        payments: [
          [1, '2024-12-30 10:00:00', 40],
          [2, '2025-01-02 08:00:00', 25],
          [3, '2024-12-30 11:00:00', -40],
          [4, '2025-01-02 09:30:00', 5],
        ],
      },
      {
        payments: [
          [1, '2024-04-05 00:00:00', 10],
          [2, '2024-04-01 12:00:00', 7],
          [3, '2024-04-03 23:59:59', 3],
        ],
      },
    ],
  },
  {
    id: 'pd-106',
    group: 'timeseries',
    difficulty: '困难',
    title: { zh: '7 天滚动训练时长', en: 'Rolling 7-Day Workout Minutes' },
    tables: [['workouts', WORKOUTS]],
    ordered: true,
    task: {
      zh: '对每位用户每个有训练的日子，计算以这天结束的 7 天窗口（这天和之前 6 天）里的训练分钟数之和。同一天的多次训练先合并。按用户编号、日期排列，每个（用户，日期）一行。',
      en: 'For each user and each day they worked out, total their minutes over the 7-day window ending that day (that day and the 6 before). Several workouts on one day are combined first. One row per (user, day), ordered by user id, then day.',
    },
    columns: [
      ['user_id', '用户编号', 'user id'],
      ['day', "日期，'YYYY-MM-DD'", "date, 'YYYY-MM-DD'"],
      ['minutes_7d', '7 天窗口里的分钟数之和', 'minutes in the 7-day window'],
    ],
    explanation: {
      zh: '用户 1 在 3 月 1 日练了 30 + 15 = 45 分钟。3 月 7 日的窗口是 1–7 日：45 + 20 + 40 = 105；3 月 8 日的窗口是 2–8 日，1 日的 45 分钟出了窗口：20 + 40 + 10 = 70。',
      en: 'User 1 trained 30 + 15 = 45 minutes on March 1. The window for March 7 is the 1st–7th: 45 + 20 + 40 = 105; for March 8 it is the 2nd–8th, so the 45 minutes of the 1st drop out: 20 + 40 + 10 = 70.',
    },
    hints: {
      zh: [
        "先按（用户，日期）求和，再 `groupby('user_id').rolling('7D', on='day')`：'7D' 按时间取窗口，不按行数。",
        "`rolling(7)` 取的是 7 行，中间有空着的日子时就不是 7 天了。",
      ],
      en: [
        "Sum per (user, day) first, then `groupby('user_id').rolling('7D', on='day')`: '7D' frames by time, not by rows.",
        '`rolling(7)` takes 7 rows, which is not 7 days once there are days off.',
      ],
    },
    reference: py(`
def solve(tables):
    workouts = tables['workouts']
    daily = workouts.assign(day=pd.to_datetime(workouts['day'])).groupby(['user_id', 'day'], as_index=False)['minutes'].sum()
    daily = daily.sort_values(['user_id', 'day'])
    rolled = daily.groupby('user_id').rolling('7D', on='day')['minutes'].sum()
    daily['minutes_7d'] = rolled.to_numpy()
    return daily[['user_id', 'day', 'minutes_7d']]
`),
    accepted: [
      py(`
def solve(tables):
    workouts = tables['workouts']
    daily = workouts.assign(day=pd.to_datetime(workouts['day'])).groupby(['user_id', 'day'], as_index=False)['minutes'].sum()
    pairs = daily.merge(daily, on='user_id', suffixes=('', '_before'))
    pairs = pairs[(pairs['day_before'] <= pairs['day']) & (pairs['day_before'] > pairs['day'] - pd.Timedelta(days=7))]
    out = pairs.groupby(['user_id', 'day'], as_index=False)['minutes_before'].sum()
    return out.sort_values(['user_id', 'day'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    workouts = tables['workouts']
    daily = workouts.assign(day=pd.to_datetime(workouts['day'])).groupby(['user_id', 'day'], as_index=False)['minutes'].sum()
    daily = daily.sort_values(['user_id', 'day'])
    daily['minutes_7d'] = daily.groupby('user_id')['minutes'].rolling(7, min_periods=1).sum().to_numpy()
    return daily[['user_id', 'day', 'minutes_7d']]
`),
      py(`
def solve(tables):
    workouts = tables['workouts']
    daily = workouts.assign(day=pd.to_datetime(workouts['day'])).groupby(['user_id', 'day'], as_index=False)['minutes'].sum()
    daily = daily.sort_values(['user_id', 'day'])
    daily['minutes_7d'] = daily.groupby('user_id').rolling('6D', on='day')['minutes'].sum().to_numpy()
    return daily[['user_id', 'day', 'minutes_7d']]
`),
      py(`
def solve(tables):
    workouts = tables['workouts']
    rows = workouts.assign(day=pd.to_datetime(workouts['day'])).sort_values(['user_id', 'day']).reset_index(drop=True)
    rows['minutes_7d'] = rows.groupby('user_id').rolling('7D', on='day')['minutes'].sum().to_numpy()
    return rows[['user_id', 'day', 'minutes_7d']]
`),
    ],
    sample: {
      workouts: [
        [1, '2024-03-01', 30],
        [1, '2024-03-01', 15],
        [1, '2024-03-03', 20],
        [1, '2024-03-07', 40],
        [1, '2024-03-08', 10],
        [1, '2024-03-15', 25],
        [2, '2024-03-02', 60],
        [2, '2024-03-09', 30],
      ],
    },
    hidden: [
      {
        workouts: [
          [3, '2024-02-26', 10],
          [3, '2024-02-27', 10],
          [3, '2024-02-28', 10],
          [3, '2024-02-29', 10],
          [3, '2024-03-01', 10],
          [3, '2024-03-02', 10],
          [3, '2024-03-03', 10],
          [3, '2024-03-04', 10],
        ],
      },
      {
        workouts: [
          [5, '2024-05-10', 20],
          [4, '2024-05-01', 15],
          [5, '2024-05-03', 25],
          [4, '2024-05-08', 45],
          [4, '2024-05-08', 5],
          [4, '2024-05-02', 30],
        ],
      },
      { workouts: [[6, '2024-07-04', 90]] },
    ],
  },
  {
    id: 'pd-107',
    group: 'timeseries',
    difficulty: '中等',
    title: { zh: '成交时的最新报价', en: 'Latest Quote at Trade Time' },
    tables: [
      ['trades', TRADES],
      ['quotes', QUOTES],
    ],
    task: {
      zh: '对每笔成交，找到同一个 `symbol` 在成交时刻或之前的最新一条报价，给出价格和成交金额 `qty * price`。同一时刻的报价也算。在它之前没有这个 symbol 的报价时，价格和金额都为 NULL。',
      en: 'For each trade, find the latest quote for the same `symbol` at or before the trade time, and give its price and the trade value `qty * price`. A quote at the very same time counts. With no earlier quote for that symbol, the price and value are NULL.',
    },
    columns: [
      ['id', '成交编号', 'trade id'],
      ['price', '最新报价，没有为 NULL', 'latest price, NULL if none'],
      ['value', 'qty * price，没有为 NULL', 'qty * price, NULL if none'],
    ],
    explanation: {
      zh: '成交 1 在 ACME 第一条报价之前一秒，没有报价。成交 2 和 9:45 的报价同时，用 11.25，金额 22.5。成交 5 的 BOLT 第一条报价在 9:40，比它晚，虽然 9:30 有一条 ACME 的报价，也不能用。',
      en: 'Trade 1 comes one second before ACME’s first quote, so it has none. Trade 2 is at the same time as the 9:45 quote and uses 11.25, value 22.5. Trade 5 is BOLT, whose first quote at 9:40 is later; the ACME quote at 9:30 does not apply.',
    },
    hints: {
      zh: [
        "`pd.merge_asof(trades, quotes, on='ts', by='symbol')` 为每行找 on 列不超过它的最后一行；两边都要先按 on 列排序。",
        '默认 `direction=\'backward\'`、`allow_exact_matches=True`，正好是「成交时刻或之前」。',
      ],
      en: [
        "`pd.merge_asof(trades, quotes, on='ts', by='symbol')` finds, for each row, the last row whose on key is not later; sort both sides by it first.",
        "The defaults `direction='backward'` and `allow_exact_matches=True` mean exactly \"at or before\".",
      ],
    },
    reference: py(`
def solve(tables):
    trades = tables['trades'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    quotes = tables['quotes'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    matched = pd.merge_asof(trades, quotes, on='ts', by='symbol')
    matched['value'] = matched['qty'] * matched['price']
    return matched[['id', 'price', 'value']]
`),
    accepted: [
      py(`
def solve(tables):
    trades = tables['trades']
    quotes = tables['quotes']
    rows = []
    for trade in trades.itertuples(index=False):
        earlier = quotes[(quotes['symbol'] == trade.symbol) & (quotes['ts'] <= trade.ts)]
        price = earlier.sort_values('ts')['price'].iloc[-1] if len(earlier) else None
        rows.append((trade.id, price, None if price is None else trade.qty * price))
    return pd.DataFrame(rows, columns=['id', 'price', 'value'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    trades = tables['trades'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    quotes = tables['quotes'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    matched = pd.merge_asof(trades, quotes, on='ts', by='symbol', direction='nearest')
    matched['value'] = matched['qty'] * matched['price']
    return matched[['id', 'price', 'value']]
`),
      py(`
def solve(tables):
    trades = tables['trades'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    quotes = tables['quotes'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    matched = pd.merge_asof(trades, quotes.drop(columns='symbol'), on='ts')
    matched['value'] = matched['qty'] * matched['price']
    return matched[['id', 'price', 'value']]
`),
      py(`
def solve(tables):
    trades = tables['trades'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    quotes = tables['quotes'].assign(ts=lambda d: pd.to_datetime(d['ts'])).sort_values('ts')
    matched = pd.merge_asof(trades, quotes, on='ts', by='symbol', allow_exact_matches=False)
    matched['value'] = matched['qty'] * matched['price']
    return matched[['id', 'price', 'value']]
`),
    ],
    sample: {
      trades: [
        [1, 'ACME', '2024-03-04 09:29:59', 5],
        [2, 'ACME', '2024-03-04 09:45:00', 2],
        [3, 'BOLT', '2024-03-04 09:50:00', 3],
        [4, 'ACME', '2024-03-04 09:59:00', 4],
        [5, 'BOLT', '2024-03-04 09:35:00', 1],
      ],
      quotes: [
        ['ACME', '2024-03-04 09:30:00', 10.5],
        ['ACME', '2024-03-04 09:45:00', 11.25],
        ['BOLT', '2024-03-04 09:40:00', 20],
        ['ACME', '2024-03-04 10:00:00', 11],
      ],
    },
    hidden: [
      {
        trades: [
          [1, 'CORE', '2024-03-05 10:00:00', 10],
          [2, 'CORE', '2024-03-05 11:00:00', 1],
          [3, 'DART', '2024-03-05 10:30:00', 2],
        ],
        quotes: [
          ['CORE', '2024-03-05 10:00:00', 7.75],
          ['CORE', '2024-03-05 10:59:59', 8],
          ['DART', '2024-03-05 10:31:00', 3.5],
          ['CORE', '2024-03-04 16:00:00', 7.5],
        ],
      },
      {
        trades: [
          [1, 'EDGE', '2024-03-06 09:00:00', 4],
          [2, 'EDGE', '2024-03-06 09:00:00', 6],
        ],
        quotes: [['FLUX', '2024-03-06 08:00:00', 1.25]],
      },
      {
        trades: [
          [1, 'GLOW', '2024-03-07 12:00:00', 3],
          [2, 'HALO', '2024-03-07 12:00:00', 2],
          [3, 'GLOW', '2024-03-07 12:20:00', 1],
        ],
        quotes: [
          ['HALO', '2024-03-07 11:59:00', 40.25],
          ['GLOW', '2024-03-07 12:10:00', 5],
          ['GLOW', '2024-03-07 11:00:00', 4.5],
          ['HALO', '2024-03-07 12:01:00', 41],
        ],
      },
    ],
  },
  {
    id: 'pd-108',
    group: 'timeseries',
    difficulty: '中等',
    title: { zh: '读数的间隔和变化', en: 'Gaps and Changes per Sensor' },
    tables: [['readings', READINGS]],
    task: {
      zh: '读数到达的顺序是乱的。对每条读数，给出它和同一传感器上一条读数（按时间）相隔的分钟数，以及读数的变化（这次减上次）。传感器的第一条读数两项都为 NULL；这次或上次读数失败（NULL）时变化为 NULL。',
      en: 'Readings arrive out of order. For each reading, give the minutes since the same sensor’s previous reading (by time) and the change in value (this one minus that one). A sensor’s first reading has NULL for both; the change is NULL when this or the previous reading failed (NULL).',
    },
    columns: [
      ['sensor', '传感器', 'sensor'],
      ['ts', '读数时间（原样）', 'reading time, as given'],
      ['gap_minutes', '距上一条读数的分钟数', 'minutes since the previous reading'],
      ['change', '读数变化', 'change in value'],
    ],
    explanation: {
      zh: 't1 的读数按时间是 9:30、10:00、10:45、11:00：间隔 30、45、15 分钟；10:00 比 9:30 高 0.75；10:45 的读数失败，所以它和 11:00 的变化都是 NULL。t2 的两条相隔 60 分钟，变化 −0.5。',
      en: 't1’s readings in time order are 9:30, 10:00, 10:45 and 11:00: gaps of 30, 45 and 15 minutes; 10:00 is 0.75 above 9:30; the 10:45 reading failed, so its change and 11:00’s are NULL. t2’s two readings are 60 minutes apart with a change of −0.5.',
    },
    hints: {
      zh: ["先按（传感器，时间）排序，再 `groupby('sensor')[...].diff()`：只在同一传感器内部相减。", '两个时间相减得到 Timedelta，`.dt.total_seconds() / 60` 变成分钟。'],
      en: ["Sort by (sensor, time), then `groupby('sensor')[...].diff()`: differences stay within one sensor.", 'Subtracting times gives a Timedelta; `.dt.total_seconds() / 60` turns it into minutes.'],
    },
    reference: py(`
def solve(tables):
    readings = tables['readings']
    readings = readings.assign(at=pd.to_datetime(readings['ts'])).sort_values(['sensor', 'at'])
    by_sensor = readings.groupby('sensor')
    readings['gap_minutes'] = by_sensor['at'].diff().dt.total_seconds() / 60
    readings['change'] = by_sensor['value'].diff()
    return readings[['sensor', 'ts', 'gap_minutes', 'change']]
`),
    accepted: [
      py(`
def solve(tables):
    readings = tables['readings'].sort_values(['sensor', 'ts'])
    rows = []
    previous = {}
    for sensor, ts, value in readings.itertuples(index=False):
        at = pd.Timestamp(ts)
        if sensor in previous:
            before_at, before_value = previous[sensor]
            gap = (at - before_at).total_seconds() / 60
            change = None if pd.isna(value) or pd.isna(before_value) else value - before_value
        else:
            gap = change = None
        rows.append((sensor, ts, gap, change))
        previous[sensor] = (at, value)
    return pd.DataFrame(rows, columns=['sensor', 'ts', 'gap_minutes', 'change'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    readings = tables['readings']
    readings = readings.assign(at=pd.to_datetime(readings['ts'])).sort_values(['sensor', 'at'])
    readings['gap_minutes'] = readings['at'].diff().dt.total_seconds() / 60
    readings['change'] = readings['value'].diff()
    return readings[['sensor', 'ts', 'gap_minutes', 'change']]
`),
      py(`
def solve(tables):
    readings = tables['readings']
    readings = readings.assign(at=pd.to_datetime(readings['ts']))
    by_sensor = readings.groupby('sensor')
    readings['gap_minutes'] = by_sensor['at'].diff().dt.total_seconds() / 60
    readings['change'] = by_sensor['value'].diff()
    return readings[['sensor', 'ts', 'gap_minutes', 'change']]
`),
      py(`
def solve(tables):
    readings = tables['readings']
    readings = readings.assign(at=pd.to_datetime(readings['ts'])).sort_values(['sensor', 'at'])
    by_sensor = readings.groupby('sensor')
    readings['gap_minutes'] = by_sensor['at'].diff().dt.total_seconds() / 60
    readings['change'] = by_sensor['value'].ffill().groupby(readings['sensor']).diff()
    return readings[['sensor', 'ts', 'gap_minutes', 'change']]
`),
    ],
    sample: {
      readings: [
        ['t1', '2024-03-01 10:00:00', 20.5],
        ['t2', '2024-03-01 10:05:00', 18],
        ['t1', '2024-03-01 09:30:00', 19.75],
        ['t1', '2024-03-01 10:45:00', null],
        ['t1', '2024-03-01 11:00:00', 21],
        ['t2', '2024-03-01 11:05:00', 17.5],
      ],
    },
    hidden: [
      {
        readings: [
          ['a', '2024-03-31 23:50:00', 1.5],
          ['a', '2024-04-01 00:20:00', 1.25],
          ['b', '2024-03-31 23:55:00', 9],
        ],
      },
      {
        readings: [
          ['p', '2024-05-01 08:00:00', null],
          ['p', '2024-05-01 07:00:00', 3],
          ['q', '2024-05-01 07:30:00', 4.5],
          ['p', '2024-05-01 09:00:00', 2.25],
          ['q', '2024-05-01 07:31:00', 4.5],
        ],
      },
      { readings: [['z', '2024-06-01 12:00:00', 0]] },
    ],
  },
  {
    id: 'pd-109',
    group: 'cleaning',
    difficulty: '中等',
    title: { zh: '补齐缺失的温度', en: 'Fill Missing Temperatures' },
    tables: [['temps', TEMPS]],
    task: {
      zh: '每个站点每天一行（中间不跳天），缺失的温度按站点各自补齐：夹在两个已知读数之间的，按天数线性插值；最后一个已知读数之后的，沿用最后的读数；第一个已知读数之前的，保持 NULL。不同站点之间互不影响。输出每一行补齐后的结果。',
      en: 'Each station has one row per day with no day skipped. Fill the missing temperatures station by station: between two known readings, interpolate linearly by day; after the last known reading, carry it forward; before the first known reading, leave NULL. Stations never affect each other. Output every row after filling.',
    },
    columns: [
      ['station', '站点', 'station'],
      ['day', "日期，'YYYY-MM-DD'", "date, 'YYYY-MM-DD'"],
      ['temp', '补齐后的温度', 'temperature after filling'],
    ],
    explanation: {
      zh: '站点 A 在 10 和 16 之间缺了两天，补成 12 和 14；最后一天沿用 16。站点 B 的第一天前面没有读数，保持 NULL；3 月 3 日夹在 5 和 8 之间，补成 6.5。',
      en: 'Station A misses two days between 10 and 16, filled as 12 and 14, and its last day carries 16 forward. Station B’s first day has nothing before it and stays NULL; March 3 sits between 5 and 8 and becomes 6.5.',
    },
    hints: {
      zh: [
        "先按（站点，日期）排序，再 `groupby('station')['temp'].transform(…)`，在每个站点内部处理。",
        "`interpolate(limit_area='inside')` 只补中间的缺口，`ffill()` 补末尾。",
      ],
      en: [
        "Sort by (station, day), then `groupby('station')['temp'].transform(…)` to work inside each station.",
        "`interpolate(limit_area='inside')` fills only inner gaps; `ffill()` fills the tail.",
      ],
    },
    reference: py(`
def solve(tables):
    temps = tables['temps'].sort_values(['station', 'day'])
    filled = temps.groupby('station')['temp'].transform(lambda s: s.interpolate(limit_area='inside').ffill())
    return temps.assign(temp=filled)[['station', 'day', 'temp']]
`),
    accepted: [
      py(`
def solve(tables):
    rows = []
    for station, group in tables['temps'].sort_values(['station', 'day']).groupby('station'):
        values = list(group['temp'])
        known = [k for k, v in enumerate(values) if not pd.isna(v)]
        for k in range(len(values)):
            before = [j for j in known if j <= k]
            after = [j for j in known if j >= k]
            if not before:
                value = None
            elif not after:
                value = values[before[-1]]
            elif before[-1] == after[0]:
                value = values[k]
            else:
                a, b = before[-1], after[0]
                value = values[a] + (values[b] - values[a]) * (k - a) / (b - a)
            rows.append((station, group['day'].iloc[k], value))
    return pd.DataFrame(rows, columns=['station', 'day', 'temp'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    temps = tables['temps'].sort_values(['station', 'day'])
    return temps.assign(temp=temps['temp'].interpolate(limit_area='inside').ffill())[['station', 'day', 'temp']]
`),
      py(`
def solve(tables):
    temps = tables['temps'].sort_values(['station', 'day'])
    return temps.assign(temp=temps.groupby('station')['temp'].ffill())[['station', 'day', 'temp']]
`),
      py(`
def solve(tables):
    temps = tables['temps'].sort_values(['station', 'day'])
    filled = temps.groupby('station')['temp'].transform(lambda s: s.interpolate(limit_direction='both'))
    return temps.assign(temp=filled)[['station', 'day', 'temp']]
`),
    ],
    sample: {
      temps: [
        ['B', '2024-03-02', 5],
        ['A', '2024-03-01', 10],
        ['A', '2024-03-04', 16],
        ['B', '2024-03-01', null],
        ['A', '2024-03-02', null],
        ['A', '2024-03-03', null],
        ['B', '2024-03-03', null],
        ['A', '2024-03-05', null],
        ['B', '2024-03-04', 8],
      ],
    },
    hidden: [
      {
        temps: [
          ['C', '2024-01-30', -2.5],
          ['C', '2024-01-31', null],
          ['C', '2024-02-01', null],
          ['C', '2024-02-02', null],
          ['C', '2024-02-03', 1.5],
          ['D', '2024-01-30', null],
          ['D', '2024-01-31', null],
          ['D', '2024-02-01', 4],
        ],
      },
      {
        temps: [
          ['E', '2024-07-01', 30],
          ['E', '2024-07-02', null],
          ['E', '2024-07-03', null],
          ['F', '2024-07-01', null],
          ['F', '2024-07-02', 20],
          ['F', '2024-07-03', 21],
        ],
      },
      {
        temps: [
          ['G', '2024-09-01', null],
          ['H', '2024-09-01', 12],
          ['H', '2024-09-02', null],
          ['H', '2024-09-03', 13],
        ],
      },
    ],
  },
  {
    id: 'pd-110',
    group: 'cleaning',
    difficulty: '简单',
    title: { zh: '找出不合法的日期', en: 'Find the Bad Dates' },
    tables: [['signups', SIGNUPS]],
    task: {
      zh: "`signup_date` 应该是 'YYYY-MM-DD' 格式的真实日期。找出填了但不合法的行：格式不对（如 '03/01/2024'、空字符串），或者日期不存在（如 '2023-02-29'、'2024-13-01'）。NULL 表示没填，不算不合法。",
      en: "`signup_date` should be a real date in 'YYYY-MM-DD' form. Find the rows where it is filled in but invalid: the wrong format (such as '03/01/2024' or an empty string) or a date that does not exist (such as '2023-02-29' or '2024-13-01'). NULL means not given and is not invalid.",
    },
    columns: [
      ['id', '编号', 'id'],
      ['signup_date', '原样的日期文本', 'the date text as given'],
    ],
    explanation: {
      zh: '2023 年不是闰年，没有 2 月 29 日；没有 13 月；\'03/01/2024\' 和 \'soon\' 格式不对。2024-02-29 合法，编号 4 没填日期。',
      en: "2023 is not a leap year, so it has no February 29; there is no month 13; '03/01/2024' and 'soon' have the wrong format. 2024-02-29 is valid and id 4 gave no date.",
    },
    hints: {
      zh: [
        "`pd.to_datetime(…, format='%Y-%m-%d', errors='coerce')` 把解析不了的值变成 NaT。",
        '解析结果是 NaT、但原值不是缺失值的行，就是填错了的。',
      ],
      en: [
        "`pd.to_datetime(…, format='%Y-%m-%d', errors='coerce')` turns whatever it cannot parse into NaT.",
        'Rows that parse to NaT but were not missing to begin with are the bad ones.',
      ],
    },
    reference: py(`
def solve(tables):
    signups = tables['signups']
    parsed = pd.to_datetime(signups['signup_date'], format='%Y-%m-%d', errors='coerce')
    bad = parsed.isna() & signups['signup_date'].notna()
    return signups.loc[bad, ['id', 'signup_date']]
`),
    accepted: [
      py(`
import datetime
import re


def valid(text):
    if not re.fullmatch(r'\\d{4}-\\d{2}-\\d{2}', text):
        return False
    try:
        datetime.date.fromisoformat(text)
        return True
    except ValueError:
        return False


def solve(tables):
    signups = tables['signups']
    keep = [text is not None and not valid(text) for text in signups['signup_date']]
    return signups.loc[keep, ['id', 'signup_date']]
`),
    ],
    wrong: [
      py(`
def solve(tables):
    signups = tables['signups']
    parsed = pd.to_datetime(signups['signup_date'], format='%Y-%m-%d', errors='coerce')
    return signups.loc[parsed.isna(), ['id', 'signup_date']]
`),
      py(`
def solve(tables):
    signups = tables['signups']
    shaped = signups['signup_date'].str.fullmatch(r'\\d{4}-\\d{2}-\\d{2}')
    return signups.loc[shaped == False, ['id', 'signup_date']]
`),
    ],
    sample: {
      signups: [
        [1, 'a@x.io', '2024-02-29'],
        [2, 'b@x.io', '2023-02-29'],
        [3, 'c@x.io', '03/01/2024'],
        [4, 'd@x.io', null],
        [5, 'e@x.io', '2024-13-01'],
        [6, 'f@x.io', 'soon'],
        [7, 'g@x.io', '2024-03-01'],
      ],
    },
    hidden: [
      {
        signups: [
          [1, 'h@x.io', ''],
          [2, 'i@x.io', '1 Mar 2024'],
          [3, 'j@x.io', '2024-04-31'],
          [4, 'k@x.io', '2024-04-30'],
        ],
      },
      {
        signups: [
          [1, 'l@x.io', '2024-01-01'],
          [2, 'm@x.io', null],
        ],
      },
      {
        signups: [
          [1, 'n@x.io', '2100-02-29'],
          [2, 'o@x.io', '2000-02-29'],
          [3, 'p@x.io', '2024-00-10'],
          [4, 'q@x.io', 'TBD'],
        ],
      },
    ],
  },
  {
    id: 'pd-111',
    group: 'cleaning',
    difficulty: '中等',
    title: { zh: '从工单标题里提取订单号和金额', en: 'Extract Order Numbers and Amounts' },
    tables: [['tickets', TICKETS]],
    task: {
      zh: '退款工单的标题里写着订单号和金额：订单号是第一处「`#` 紧跟数字」里的那串数字，金额是第一处「`$` 紧跟数字」里的那个数（可以带小数点和一到两位小数，没有千位分隔符）。只保留两样都有的工单，订单号输出为整数，金额输出为数字。',
      en: 'Refund ticket subjects mention an order number and an amount: the order number is the digits at the first place where `#` is directly followed by digits, and the amount is the number at the first place where `$` is directly followed by one (it may have a decimal point and one or two decimals, no thousands separators). Keep only tickets that have both, with the order number as an integer and the amount as a number.',
    },
    columns: [
      ['id', '工单编号', 'ticket id'],
      ['order_no', '订单号（整数）', 'order number (integer)'],
      ['amount', '金额（数字）', 'amount (number)'],
    ],
    explanation: {
      zh: '工单 1 是订单 1042、金额 35.5；工单 3 是 2001、8.5；工单 6 的第一个 # 后是 507，$ 后是 40。工单 2 没有 #，工单 5 没有 $，工单 4 没有标题。',
      en: 'Ticket 1 is order 1042 for 35.5, ticket 3 is 2001 for 8.5, and ticket 6 has 507 after its first # and 40 after the $. Ticket 2 has no #, ticket 5 no $ and ticket 4 no subject.',
    },
    hints: {
      zh: [
        "`str.extract(r'#(\\d+)', expand=False)` 取出第一个捕获组，没匹配到为缺失值。",
        "提取结果是文本，用 `astype(int)` / `astype(float)` 转成数字；'35.50' 和 35.5 不相等。",
      ],
      en: [
        "`str.extract(r'#(\\d+)', expand=False)` returns the first capture group, missing where nothing matches.",
        "The extracted values are text; convert them with `astype(int)` / `astype(float)`, since '35.50' is not 35.5.",
      ],
    },
    reference: py(String.raw`
def solve(tables):
    tickets = tables['tickets']
    subject = tickets['subject']
    out = pd.DataFrame({
        'id': tickets['id'],
        'order_no': subject.str.extract(r'#(\d+)', expand=False),
        'amount': subject.str.extract(r'\$(\d+(?:\.\d{1,2})?)', expand=False),
    }).dropna()
    return out.astype({'order_no': 'int64', 'amount': 'float64'})
`),
    accepted: [
      py(String.raw`
import re


def solve(tables):
    rows = []
    for ticket_id, subject in tables['tickets'].itertuples(index=False):
        number = re.search(r'#(\d+)', subject or '')
        money = re.search(r'\$(\d+(?:\.\d{1,2})?)', subject or '')
        if number and money:
            rows.append((ticket_id, int(number.group(1)), float(money.group(1))))
    return pd.DataFrame(rows, columns=['id', 'order_no', 'amount'])
`),
    ],
    wrong: [
      py(String.raw`
def solve(tables):
    tickets = tables['tickets']
    subject = tickets['subject']
    out = pd.DataFrame({
        'id': tickets['id'],
        'order_no': subject.str.extract(r'#(\d+)', expand=False),
        'amount': subject.str.extract(r'\$(\d+(?:\.\d{1,2})?)', expand=False),
    }).dropna()
    return out.astype({'order_no': 'int64'})
`),
      py(String.raw`
def solve(tables):
    tickets = tables['tickets']
    subject = tickets['subject']
    out = pd.DataFrame({
        'id': tickets['id'],
        'order_no': subject.str.extract(r'#(\d+)', expand=False),
        'amount': subject.str.extract(r'\$(\d+)', expand=False),
    }).dropna()
    return out.astype({'order_no': 'int64', 'amount': 'float64'})
`),
      py(String.raw`
def solve(tables):
    tickets = tables['tickets']
    subject = tickets['subject']
    out = pd.DataFrame({
        'id': tickets['id'],
        'order_no': subject.str.extract(r'(\d+)', expand=False),
        'amount': subject.str.extract(r'\$(\d+(?:\.\d{1,2})?)', expand=False),
    }).dropna()
    return out.astype({'order_no': 'int64', 'amount': 'float64'})
`),
    ],
    sample: {
      tickets: [
        [1, 'Refund #1042: charged $35.50 twice'],
        [2, 'Where is order 77? Paid $12'],
        [3, 'RE: #2001 refund $8.5 please'],
        [4, null],
        [5, 'Coupon #33 not applied'],
        [6, '$40 refund for #507 and #508'],
      ],
    },
    hidden: [
      {
        tickets: [
          [1, 'Order 12 #12 refund $0.99'],
          [2, '#9 $100.00'],
        ],
      },
      {
        tickets: [
          [1, 'no numbers here'],
          [2, '# 55 refund $5'],
          [3, '3 items, #61, $7.25 each'],
        ],
      },
      {
        tickets: [
          [1, 'Two refunds: #301 $15, #302 $16.40'],
          [2, 'Refund $3 for 2 mugs #88'],
          [3, '$ 9 for #4'],
        ],
      },
    ],
  },
  {
    id: 'pd-112',
    group: 'cleaning',
    difficulty: '简单',
    title: { zh: '规范化邮箱后去重', en: 'Dedupe Contacts by Email' },
    tables: [['contacts', CONTACTS]],
    task: {
      zh: '去掉两端空格并转成小写后邮箱相同的联系人是同一个人。每人只保留一条：`created` 最早的，同一天的取编号小的。没有邮箱（NULL）的联系人不出现。输出保留的编号和规范化后的邮箱。',
      en: 'Contacts whose emails match after trimming spaces and lowercasing are the same person. Keep one per person: the earliest `created`, the smaller id on the same day. Contacts without an email (NULL) are left out. Output the kept ids with the normalized email.',
    },
    columns: [
      ['id', '保留的联系人编号', 'kept contact id'],
      ['email', '规范化后的邮箱', 'normalized email'],
    ],
    explanation: {
      zh: '编号 1 和 2 规范化后都是 ann@mail.com，2 创建得更早；3 和 5 都是 bob@mail.com 且同一天创建，保留编号小的 3。编号 4 没有邮箱。',
      en: 'Ids 1 and 2 both normalize to ann@mail.com and 2 was created earlier; 3 and 5 are both bob@mail.com, created the same day, so the smaller id 3 stays. Id 4 has no email.',
    },
    hints: {
      zh: ['先 `str.strip().str.lower()`，再去重。', "先按 `['created', 'id']` 排序，`drop_duplicates('email')` 默认保留第一条。"],
      en: ['`str.strip().str.lower()` first, then deduplicate.', "Sort by `['created', 'id']`; `drop_duplicates('email')` keeps the first row by default."],
    },
    reference: py(`
def solve(tables):
    contacts = tables['contacts']
    contacts = contacts[contacts['email'].notna()].assign(email=lambda d: d['email'].str.strip().str.lower())
    contacts = contacts.sort_values(['created', 'id']).drop_duplicates('email')
    return contacts[['id', 'email']]
`),
    accepted: [
      py(`
def solve(tables):
    best = {}
    for row in tables['contacts'].itertuples(index=False):
        if row.email is None:
            continue
        email = row.email.strip().lower()
        if email not in best or (row.created, row.id) < best[email]:
            best[email] = (row.created, row.id)
    return pd.DataFrame([(key[1], email) for email, key in best.items()], columns=['id', 'email'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    contacts = tables['contacts']
    contacts = contacts[contacts['email'].notna()].sort_values(['created', 'id']).drop_duplicates('email')
    return contacts.assign(email=contacts['email'].str.strip().str.lower())[['id', 'email']]
`),
      py(`
def solve(tables):
    contacts = tables['contacts']
    contacts = contacts[contacts['email'].notna()].assign(email=lambda d: d['email'].str.strip().str.lower())
    return contacts.drop_duplicates('email')[['id', 'email']]
`),
      py(`
def solve(tables):
    contacts = tables['contacts']
    contacts = contacts[contacts['email'].notna()].assign(email=lambda d: d['email'].str.strip().str.lower())
    contacts = contacts.sort_values(['created', 'id']).drop_duplicates('email', keep='last')
    return contacts[['id', 'email']]
`),
    ],
    sample: {
      contacts: [
        [1, 'Ann', 'ann@mail.com', '2024-01-10'],
        [2, 'Ann L', '  Ann@Mail.com ', '2024-01-05'],
        [3, 'Bob', 'bob@mail.com', '2024-02-01'],
        [4, 'Cy', null, '2024-01-01'],
        [5, 'Bobby', 'BOB@mail.com', '2024-02-01'],
        [6, 'Dee', 'dee@mail.com', '2024-03-01'],
      ],
    },
    hidden: [
      {
        contacts: [
          [1, 'Eve', 'eve@web.org ', '2024-05-02'],
          [2, 'Eve B', 'EVE@WEB.ORG', '2024-05-01'],
          [3, 'Eve C', 'eve@web.org', '2024-05-03'],
        ],
      },
      {
        contacts: [
          [3, 'Fox 2', 'fox@mail.com', '2024-06-01'],
          [5, 'Gus', null, '2024-01-01'],
          [7, 'Fox', 'Fox@mail.com', '2024-06-01'],
        ],
      },
      {
        contacts: [
          [1, 'Hana', 'hana@x.io', '2024-07-01'],
          [2, 'Ian', 'ian@x.io', '2024-07-02'],
        ],
      },
    ],
  },
  {
    id: 'pd-113',
    group: 'cleaning',
    difficulty: '中等',
    title: { zh: '每单最大的尺码', en: 'Largest Size per Order' },
    tables: [['shirts', SHIRTS]],
    task: {
      zh: "尺码从小到大是 XS < S < M < L < XL。对每个订单，给出其中最大的尺码，以及这个尺码有几件。注意按字母顺序比较时 'XS' 比 'XL' 大，'S' 比 'L' 大，这不是尺码的大小。",
      en: "Sizes run XS < S < M < L < XL. For each order, give its largest size and how many shirts of that size it has. Note that alphabetically 'XS' is above 'XL' and 'S' above 'L', which is not how sizes compare.",
    },
    columns: [
      ['order_id', '订单编号', 'order id'],
      ['largest', '最大的尺码', 'largest size'],
      ['count', '这个尺码的件数', 'shirts of that size'],
    ],
    explanation: {
      zh: '订单 1 有 M、L、S、L，最大是 L，2 件；订单 2 有 XS 和 XL，最大是 XL；订单 4 有两件 M 和一件 XS，最大是 M，2 件。',
      en: 'Order 1 has M, L, S and L: the largest is L, 2 shirts. Order 2 has XS and XL: XL. Order 4 has two M and one XS: M, 2 shirts.',
    },
    hints: {
      zh: [
        "`pd.Categorical(…, categories=['XS', 'S', 'M', 'L', 'XL'], ordered=True)` 让尺码按给定顺序比较。",
        '有序分类的 `.cat.codes` 就是尺码的名次，可以直接取最大值。',
      ],
      en: [
        "`pd.Categorical(…, categories=['XS', 'S', 'M', 'L', 'XL'], ordered=True)` makes sizes compare in the given order.",
        "An ordered categorical's `.cat.codes` are the sizes' ranks, ready for a max.",
      ],
    },
    reference: py(`
SIZES = ['XS', 'S', 'M', 'L', 'XL']


def solve(tables):
    shirts = tables['shirts']
    size = pd.Categorical(shirts['size'], categories=SIZES, ordered=True)
    shirts = shirts.assign(rank=size.codes)
    top = shirts[shirts['rank'] == shirts.groupby('order_id')['rank'].transform('max')]
    return top.groupby('order_id').agg(largest=('size', 'first'), count=('id', 'size')).reset_index()
`),
    accepted: [
      py(`
RANK = {'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4}


def solve(tables):
    best = {}
    for order_id, size in zip(tables['shirts']['order_id'], tables['shirts']['size']):
        current = best.get(order_id)
        if current is None or RANK[size] > RANK[current[0]]:
            best[order_id] = [size, 1]
        elif size == current[0]:
            current[1] += 1
    return pd.DataFrame([(k, v[0], v[1]) for k, v in best.items()], columns=['order_id', 'largest', 'count'])
`),
    ],
    wrong: [
      py(`
def solve(tables):
    shirts = tables['shirts']
    top = shirts[shirts['size'] == shirts.groupby('order_id')['size'].transform('max')]
    return top.groupby('order_id').agg(largest=('size', 'first'), count=('id', 'size')).reset_index()
`),
      py(`
SIZES = ['XS', 'S', 'M', 'L', 'XL']


def solve(tables):
    shirts = tables['shirts']
    shirts = shirts.assign(rank=pd.Categorical(shirts['size'], categories=SIZES, ordered=True).codes)
    largest = shirts.sort_values('rank').groupby('order_id')['size'].last()
    count = shirts.groupby('order_id').size()
    return pd.DataFrame({'largest': largest, 'count': count}).reset_index()
`),
    ],
    sample: {
      shirts: [
        [1, 1, 'M'],
        [2, 1, 'L'],
        [3, 1, 'S'],
        [4, 1, 'L'],
        [5, 2, 'XS'],
        [6, 2, 'XL'],
        [7, 3, 'S'],
        [8, 4, 'M'],
        [9, 4, 'XS'],
        [10, 4, 'M'],
      ],
    },
    hidden: [
      {
        shirts: [
          [1, 7, 'XS'],
          [2, 7, 'XS'],
          [3, 8, 'XL'],
          [4, 8, 'XS'],
          [5, 8, 'XL'],
        ],
      },
      {
        shirts: [
          [1, 9, 'S'],
          [2, 9, 'L'],
          [3, 9, 'M'],
        ],
      },
      { shirts: [[1, 5, 'L']] },
    ],
  },
];
