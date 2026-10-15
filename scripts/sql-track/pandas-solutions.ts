/**
 * Reference pandas solutions for the Pandas track (pd-xx), one per SQL track
 * problem, with one pandas hint each. scripts/sql-track/build.ts --pandas runs
 * every solution on every dataset of the SQL package through the production
 * harness and fails unless it prints exactly the SQL expected output.
 */
export type PandasSolution = { code: string; hint: { zh: string; en: string } };

const solution = (zh: string, en: string, body: string): PandasSolution => ({
  hint: { zh, en },
  code: `import numpy as np\nimport pandas as pd\n\n\n${body.trim()}\n`,
});

/** Paid orders' item rows with their amount (quantity * unit_price). */
const PAID_ITEMS = `
def paid_items(tables):
    orders = tables['orders']
    items = tables['order_items']
    paid = orders.loc[orders['status'] == 'paid', 'id']
    items = items[items['order_id'].isin(paid)].copy()
    items['amount'] = items['quantity'] * items['unit_price']
    return items
`;

/** Per user, a key shared by the logins of one run of consecutive days. */
const RUNS = `
def runs(logins):
    days = logins.drop_duplicates(['user_id', 'login_date']).copy()
    days['day'] = pd.to_datetime(days['login_date'])
    days = days.sort_values(['user_id', 'day'])
    step = pd.to_timedelta(days.groupby('user_id').cumcount(), unit='D')
    days['run'] = days['day'] - step
    return days
`;

export const PANDAS_SOLUTIONS: Record<string, PandasSolution> = {
  'sql-01': solution(
    '`isin` 检查 manager_id 是否出现在 id 列里；缺失值（pd.NA）不在任何集合里。',
    '`isin` tests whether manager_id appears among the ids; a missing value (pd.NA) is in no set.',
    `
def solve(tables):
    employees = tables['employees']
    valid = employees['manager_id'].isin(employees['id'])
    return employees.loc[~valid, ['id', 'name']]
`,
  ),
  'sql-02': solution(
    '先 `fillna(\'Unknown\')`，再 `groupby(...).size()`：groupby 默认会丢掉缺失的键。',
    "`fillna('Unknown')` first, then `groupby(...).size()`: groupby drops missing keys by default.",
    `
def solve(tables):
    customers = tables['customers']
    city = customers['city'].fillna('Unknown')
    return city.groupby(city).size().reset_index(name='customers')
`,
  ),
  'sql-03': solution(
    '`count` 不计缺失值，`size` 计所有行；`mean` 也跳过缺失值，按 0 分计时先 `fillna(0)`。',
    '`count` skips missing values while `size` counts every row; `mean` skips them too, so `fillna(0)` first to count absences as 0.',
    `
def solve(tables):
    courses = tables['courses']
    enrollments = tables['enrollments']
    rows = enrollments.merge(courses, left_on='course_id', right_on='id')
    rows['score_or_zero'] = rows['score'].fillna(0)
    result = rows.groupby(['course_id', 'title'], as_index=False).agg(
        enrolled=('student_id', 'size'),
        sat=('score', 'count'),
        avg_score=('score', 'mean'),
        avg_with_zero=('score_or_zero', 'mean'),
    )
    result['avg_score'] = result['avg_score'].round(2)
    result['avg_with_zero'] = result['avg_with_zero'].round(2)
    return result[['title', 'enrolled', 'sat', 'avg_score', 'avg_with_zero']]
`,
  ),
  'sql-04': solution(
    '用 `~customers[\'id\'].isin(...)` 取反；游客订单的 customer_id 是缺失值，先 `dropna()`。',
    "Negate `customers['id'].isin(...)` with `~`; guest orders have a missing customer_id, so `dropna()` first.",
    `
def solve(tables):
    customers = tables['customers']
    orders = tables['orders']
    ordered = customers['id'].isin(orders['customer_id'].dropna())
    return customers.loc[~ordered, ['id', 'name']]
`,
  ),
  'sql-05': solution(
    '把 employees 和自己 `merge`（left_on=\'manager_id\', right_on=\'id\'），用 suffixes 区分两边的列。',
    "`merge` employees with itself (left_on='manager_id', right_on='id') and tell the two sides apart with suffixes.",
    `
def solve(tables):
    employees = tables['employees']
    pairs = employees.merge(employees, left_on='manager_id', right_on='id', suffixes=('', '_manager'))
    pairs = pairs[pairs['salary'] > pairs['salary_manager']]
    return pairs[['name', 'salary', 'name_manager', 'salary_manager']]
`,
  ),
  'sql-06': solution(
    '先按 department_id 数人数，再用 `map` 对到每个部门上，没有人的部门 `fillna(0)`。',
    'Count people per department_id, `map` the counts onto the departments and `fillna(0)` the empty ones.',
    `
def solve(tables):
    departments = tables['departments']
    employees = tables['employees']
    counts = employees.groupby('department_id').size()
    result = departments[['name']].copy()
    result['headcount'] = departments['id'].map(counts).fillna(0).astype(int)
    return result
`,
  ),
  'sql-07': solution(
    '先按 order_id 汇总明细金额，再和已支付订单 `merge`；客户用 how=\'left\' 合并，游客的名字 `fillna(\'Guest\')`。',
    "Sum the item amounts per order_id, `merge` with the paid orders, then join customers with how='left' and `fillna('Guest')`.",
    `${PAID_ITEMS}

def solve(tables):
    orders = tables['orders']
    customers = tables['customers'][['id', 'name']].rename(columns={'id': 'customer_id'})
    totals = paid_items(tables).groupby('order_id', as_index=False)['amount'].sum()
    result = totals.merge(orders[['id', 'customer_id']], left_on='order_id', right_on='id')
    result = result.merge(customers, on='customer_id', how='left')
    result['customer'] = result['name'].fillna('Guest')
    return result[['order_id', 'customer', 'amount']]
`,
  ),
  'sql-08': solution(
    '先 `dropna(subset=[\'city\'])`，再按 city 自连接，保留 id_x < id_y 的行。',
    "`dropna(subset=['city'])`, self-merge on city, and keep the rows where id_x < id_y.",
    `
def solve(tables):
    customers = tables['customers'].dropna(subset=['city'])
    pairs = customers.merge(customers, on='city')
    pairs = pairs[pairs['id_x'] < pairs['id_y']]
    return pairs[['city', 'id_x', 'id_y']]
`,
  ),
  'sql-09': solution(
    '先筛出 status == \'paid\' 的订单，`groupby(\'customer_id\').size()` 后再筛 >= 3。',
    "Keep the orders with status == 'paid', `groupby('customer_id').size()`, then filter >= 3.",
    `
def solve(tables):
    customers = tables['customers']
    orders = tables['orders']
    paid = orders[orders['status'] == 'paid']
    counts = paid.groupby('customer_id').size().reset_index(name='paid_orders')
    result = customers.merge(counts, left_on='id', right_on='customer_id')
    return result.loc[result['paid_orders'] >= 3, ['id', 'name', 'paid_orders']]
`,
  ),
  'sql-10': solution(
    '`sort_values([\'revenue\', \'category\'], ascending=[False, True])` 一次给出两层排序。',
    "`sort_values(['revenue', 'category'], ascending=[False, True])` sorts by both keys at once.",
    `${PAID_ITEMS}

def solve(tables):
    products = tables['products'][['id', 'category']].rename(columns={'id': 'product_id'})
    items = paid_items(tables).merge(products, on='product_id')
    result = items.groupby('category', as_index=False)['amount'].sum()
    result = result[result['amount'] >= 300]
    return result.sort_values(['amount', 'category'], ascending=[False, True])
`,
  ),
  'sql-11': solution(
    '`str.lower()` 统一大小写后再 groupby。',
    'Normalize the case with `str.lower()` before grouping.',
    `
def solve(tables):
    email = tables['customers']['email'].str.lower()
    counts = email.groupby(email).size().reset_index(name='accounts')
    return counts[counts['accounts'] > 1]
`,
  ),
  'sql-12': solution(
    '`drop_duplicates()` 后降序排序，取第二个；不存在时结果是一行 None。',
    '`drop_duplicates()`, sort descending and take the second value; when there is none, the one row holds None.',
    `
def solve(tables):
    salaries = tables['employees']['salary'].drop_duplicates().sort_values(ascending=False)
    second = salaries.iloc[1] if len(salaries) > 1 else None
    return pd.DataFrame({'second_salary': [second]})
`,
  ),
  'sql-13': solution(
    '`groupby(\'department_id\')[\'salary\'].transform(\'mean\')` 把部门平均值放到每一行上。',
    "`groupby('department_id')['salary'].transform('mean')` puts each department's average on every row.",
    `
def solve(tables):
    departments = tables['departments']
    employees = tables['employees'].dropna(subset=['department_id']).copy()
    employees['average'] = employees.groupby('department_id')['salary'].transform('mean')
    above = employees[employees['salary'] > employees['average']]
    result = above.merge(departments, left_on='department_id', right_on='id', suffixes=('', '_department'))
    return result[['name_department', 'name', 'salary']]
`,
  ),
  'sql-14': solution(
    '`nunique()` 数每位客户买过几个类目，和 products 的类目总数比较。',
    "`nunique()` counts each customer's categories; compare it with the number of categories in products.",
    `${PAID_ITEMS}

def solve(tables):
    customers = tables['customers']
    orders = tables['orders'][['id', 'customer_id']].rename(columns={'id': 'order_id'})
    products = tables['products'][['id', 'category']].rename(columns={'id': 'product_id'})
    items = paid_items(tables).merge(orders, on='order_id').merge(products, on='product_id')
    covered = items.groupby('customer_id')['category'].nunique()
    everything = covered[covered == products['category'].nunique()].index
    return customers.loc[customers['id'].isin(everything), ['id', 'name']]
`,
  ),
  'sql-15': solution(
    '按 customer_id、order_date、id 排序后，`groupby(\'customer_id\').tail(1)` 取每组最后一行。',
    "Sort by customer_id, order_date and id, then `groupby('customer_id').tail(1)` keeps each group's last row.",
    `
def solve(tables):
    orders = tables['orders'].dropna(subset=['customer_id'])
    orders = orders.sort_values(['customer_id', 'order_date', 'id'])
    latest = orders.groupby('customer_id').tail(1)
    return latest[['customer_id', 'id', 'order_date']]
`,
  ),
  'sql-16': solution(
    '`groupby(...)[\'salary\'].rank(method=\'dense\', ascending=False)` 就是 DENSE_RANK。',
    "`groupby(...)['salary'].rank(method='dense', ascending=False)` is DENSE_RANK.",
    `
def solve(tables):
    departments = tables['departments']
    employees = tables['employees'].dropna(subset=['department_id']).copy()
    employees['level'] = employees.groupby('department_id')['salary'].rank(method='dense', ascending=False)
    top = employees[employees['level'] <= 3]
    result = top.merge(departments, left_on='department_id', right_on='id', suffixes=('', '_department'))
    return result[['name_department', 'name', 'salary']]
`,
  ),
  'sql-17': solution(
    '按日期汇总并排序后，`cumsum()` 就是累计值。',
    'Sum per day, sort by date, and `cumsum()` gives the running total.',
    `${PAID_ITEMS}

def solve(tables):
    orders = tables['orders'][['id', 'order_date']].rename(columns={'id': 'order_id'})
    items = paid_items(tables).merge(orders, on='order_id')
    days = items.groupby('order_date', as_index=False)['amount'].sum().sort_values('order_date')
    days['running_total'] = days['amount'].cumsum()
    return days
`,
  ),
  'sql-18': solution(
    '`str[:7]` 取出 YYYY-MM；按月排序后 `diff()` 就是和上一行的差，第一行为 NaN。',
    '`str[:7]` gives YYYY-MM; after sorting by month, `diff()` is the change from the previous row, NaN on the first.',
    `${PAID_ITEMS}

def solve(tables):
    orders = tables['orders'][['id', 'order_date']].rename(columns={'id': 'order_id'})
    items = paid_items(tables).merge(orders, on='order_id')
    items['month'] = items['order_date'].str[:7]
    months = items.groupby('month', as_index=False)['amount'].sum().sort_values('month')
    months['change'] = months['amount'].diff()
    return months
`,
  ),
  'sql-19': solution(
    '去重后按日期排序，日期减去组内序号（`cumcount()` 天）：同一段连续登录得到同一个值。',
    'Deduplicate, sort by date and subtract the position in the group (`cumcount()` days): one run of consecutive days shares the result.',
    `${RUNS}

def solve(tables):
    days = runs(tables['logins'])
    lengths = days.groupby(['user_id', 'run']).size()
    users = lengths[lengths >= 3].reset_index()['user_id'].drop_duplicates()
    return users.to_frame()
`,
  ),
  'sql-20': solution(
    '每人首日用 `groupby(\'user_id\')[\'login_date\'].min()`，加 `pd.Timedelta(days=1)` 得到次日，再查它是否在登录记录里。',
    "Each first day is `groupby('user_id')['login_date'].min()`; add `pd.Timedelta(days=1)` and look the next day up in the logins.",
    `
def solve(tables):
    logins = tables['logins']
    first = logins.groupby('user_id')['login_date'].min()
    next_day = (pd.to_datetime(first) + pd.Timedelta(days=1)).dt.strftime('%Y-%m-%d')
    seen = set(zip(logins['user_id'], logins['login_date']))
    returned = sum((user, day) in seen for user, day in next_day.items())
    return pd.DataFrame({'retention': [round(returned / len(first), 2)]})
`,
  ),
  'sql-21': solution(
    '日期是 YYYY-MM-DD 文本，可以直接按字符串比较；`fillna(0)` 让没有部门的人也满足「不在 1 号部门」。',
    'YYYY-MM-DD text compares correctly as strings; `fillna(0)` makes people without a department count as not in department 1.',
    `
def solve(tables):
    employees = tables['employees']
    recent = employees['hire_date'] >= '2021-01-01'
    elsewhere = employees['department_id'].fillna(0) != 1
    return employees.loc[recent & elsewhere, ['id', 'name', 'hire_date']]
`,
  ),
  'sql-22': solution(
    '`between(25, 60)` 两端都包含；排序用 `sort_values([\'price\', \'name\'], ascending=[False, True])`。',
    "`between(25, 60)` includes both ends; sort with `sort_values(['price', 'name'], ascending=[False, True])`.",
    `
def solve(tables):
    products = tables['products']
    chosen = products[products['price'].between(25, 60)]
    chosen = chosen.sort_values(['price', 'name'], ascending=[False, True])
    return chosen[['name', 'category', 'price']]
`,
  ),
  'sql-23': solution(
    '`map` 一个按顺序判断的函数，或者用 `pd.cut` 按区间分档。',
    'Use `map` with a function that checks the bands in order, or `pd.cut` with the band edges.',
    `
def band(salary):
    if salary >= 9000:
        return 'high'
    if salary >= 5000:
        return 'mid'
    return 'low'


def solve(tables):
    employees = tables['employees'][['name', 'salary']].copy()
    employees['band'] = employees['salary'].map(band)
    return employees
`,
  ),
  'sql-24': solution(
    '一步步用 `isin` 缩小范围：Books 商品 → 含有它们的订单 → 其中已支付的订单 → 这些订单的客户。',
    'Narrow down with `isin` step by step: Books products, the orders containing them, the paid ones, and their customers.',
    `
def solve(tables):
    customers = tables['customers']
    products = tables['products']
    orders = tables['orders']
    items = tables['order_items']
    books = products.loc[products['category'] == 'Books', 'id']
    with_books = items.loc[items['product_id'].isin(books), 'order_id']
    paid = orders[(orders['status'] == 'paid') & orders['id'].isin(with_books)]
    return customers.loc[customers['id'].isin(paid['customer_id'].dropna()), ['id', 'name']]
`,
  ),
  'sql-25': solution(
    '`merge(..., how=\'left\')` 保留每位员工，找不到上级时上级的列是缺失值。',
    "`merge(..., how='left')` keeps every employee; the manager's columns are missing when there is no match.",
    `
def solve(tables):
    employees = tables['employees']
    managers = employees[['id', 'name']].rename(columns={'id': 'manager_id', 'name': 'manager'})
    result = employees.merge(managers, on='manager_id', how='left')
    return result[['name', 'manager']]
`,
  ),
  'sql-26': solution(
    '先找出在已支付订单里出现过的 product_id，再用 `~isin` 取反。',
    'Find the product_ids that appear in paid orders, then negate `isin` with `~`.',
    `
def solve(tables):
    products = tables['products']
    orders = tables['orders']
    items = tables['order_items']
    paid = orders.loc[orders['status'] == 'paid', 'id']
    sold = items.loc[items['order_id'].isin(paid), 'product_id']
    return products.loc[~products['id'].isin(sold), ['id', 'name']]
`,
  ),
  'sql-27': solution(
    '`merge(how=\'cross\')` 做笛卡尔积，再 how=\'left\' 合并选课记录；`indicator=True` 告诉你哪些行没匹配上。',
    "`merge(how='cross')` builds every pair; a how='left' merge with the enrollments and `indicator=True` shows which rows found no match.",
    `
def solve(tables):
    courses = tables['courses'].rename(columns={'id': 'course_id'})
    enrollments = tables['enrollments']
    students = enrollments[['student_id']].drop_duplicates()
    grid = students.merge(courses, how='cross')
    rows = grid.merge(enrollments, on=['student_id', 'course_id'], how='left', indicator=True)
    rows['status'] = np.where(
        rows['_merge'] == 'left_only',
        'not enrolled',
        np.where(rows['score'].isna(), 'absent', 'sat'),
    )
    return rows[['student_id', 'title', 'status', 'score']]
`,
  ),
  'sql-28': solution(
    '先按订单汇总金额，再按客户求订单数和平均值；不要直接对明细行求平均。',
    'Total each order first, then count and average the orders per customer; do not average the item rows.',
    `${PAID_ITEMS}

def solve(tables):
    customers = tables['customers'][['id', 'name']].rename(columns={'id': 'customer_id'})
    orders = tables['orders'][['id', 'customer_id']].rename(columns={'id': 'order_id'})
    totals = paid_items(tables).groupby('order_id', as_index=False)['amount'].sum()
    totals = totals.merge(orders, on='order_id')
    result = totals.groupby('customer_id', as_index=False).agg(
        orders=('order_id', 'size'),
        avg_order_value=('amount', 'mean'),
    )
    result = result.merge(customers, on='customer_id')
    result['avg_order_value'] = result['avg_order_value'].round(2)
    return result[['customer_id', 'name', 'orders', 'avg_order_value']]
`,
  ),
  'sql-29': solution(
    '`agg(products=(\'product_id\', \'nunique\'), units=(\'quantity\', \'sum\'))` 一次算出两列。',
    "`agg(products=('product_id', 'nunique'), units=('quantity', 'sum'))` computes both columns at once.",
    `${PAID_ITEMS}

def solve(tables):
    result = paid_items(tables).groupby('order_id', as_index=False).agg(
        products=('product_id', 'nunique'),
        units=('quantity', 'sum'),
    )
    return result[result['products'] >= 2]
`,
  ),
  'sql-30': solution(
    '命名聚合 `agg(min_price=(\'price\', \'min\'), ...)` 让每列都有自己的名字。',
    "Named aggregation, `agg(min_price=('price', 'min'), ...)`, gives each column its own name.",
    `
def solve(tables):
    result = tables['products'].groupby('category', as_index=False).agg(
        products=('id', 'size'),
        min_price=('price', 'min'),
        max_price=('price', 'max'),
        avg_price=('price', 'mean'),
    )
    result['avg_price'] = result['avg_price'].round(1)
    return result
`,
  ),
  'sql-31': solution(
    '先去掉 score 缺失的行；`(score >= 80).astype(int)` 再求和就是优秀人数。',
    'Drop the rows with a missing score; `(score >= 80).astype(int)` summed is the number of top scores.',
    `
def solve(tables):
    courses = tables['courses']
    enrollments = tables['enrollments'].dropna(subset=['score']).copy()
    enrollments['top'] = (enrollments['score'] >= 80).astype(int)
    rows = enrollments.merge(courses, left_on='course_id', right_on='id')
    result = rows.groupby(['course_id', 'title'], as_index=False).agg(sat=('score', 'size'), top=('top', 'sum'))
    result['top_rate'] = (result['top'] / result['sat']).round(2)
    return result[['title', 'sat', 'top', 'top_rate']]
`,
  ),
  'sql-32': solution(
    '把 status 比较的结果 `astype(int)` 成 0 / 1 两列，再按城市求和。',
    'Turn the status comparisons into 0 / 1 columns with `astype(int)`, then sum them per city.',
    `
def solve(tables):
    customers = tables['customers'][['id', 'city']].rename(columns={'id': 'customer_id'})
    orders = tables['orders'].merge(customers, on='customer_id')
    orders['city'] = orders['city'].fillna('Unknown')
    orders['paid'] = (orders['status'] == 'paid').astype(int)
    orders['cancelled'] = (orders['status'] == 'cancelled').astype(int)
    return orders.groupby('city', as_index=False)[['paid', 'cancelled']].sum()
`,
  ),
  'sql-33': solution(
    '`mean()` 得到一个数，用它筛选，再作为常数列放到每一行。',
    '`mean()` gives one number: filter with it, then add it to every row as a constant column.',
    `
def solve(tables):
    employees = tables['employees']
    average = employees['salary'].mean()
    result = employees.loc[employees['salary'] > average, ['name', 'salary']].copy()
    result['company_avg'] = round(average, 2)
    return result
`,
  ),
  'sql-34': solution(
    '`groupby(\'course_id\')[\'score\'].transform(\'max\')` 把每门课的最高分放到每一行上。',
    "`groupby('course_id')['score'].transform('max')` puts each course's top score on every row.",
    `
def solve(tables):
    courses = tables['courses']
    enrollments = tables['enrollments'].copy()
    enrollments['best'] = enrollments.groupby('course_id')['score'].transform('max')
    best = enrollments[(enrollments['score'] == enrollments['best']).fillna(False)]
    result = best.merge(courses, left_on='course_id', right_on='id')
    return result[['title', 'student_id', 'score']]
`,
  ),
  'sql-35': solution(
    '高于 Sales 的每一个人，就是高于 Sales 的最高工资；Sales 没有人时全部输出。',
    'More than every Sales employee means more than the top Sales salary; with nobody in Sales, everyone qualifies.',
    `
def solve(tables):
    departments = tables['departments']
    employees = tables['employees']
    sales = departments.loc[departments['name'] == 'Sales', 'id']
    salaries = employees.loc[employees['department_id'].isin(sales), 'salary']
    if len(salaries):
        employees = employees[employees['salary'] > salaries.max()]
    return employees[['name', 'salary']]
`,
  ),
  'sql-36': solution(
    '两个 `isin` 条件：有订单，并且不在「有取消订单的客户」里。',
    'Two `isin` tests: the customer has orders and is not among those with a cancelled one.',
    `
def solve(tables):
    customers = tables['customers']
    orders = tables['orders']
    ordered = customers['id'].isin(orders['customer_id'].dropna())
    cancelled = orders.loc[orders['status'] == 'cancelled', 'customer_id'].dropna()
    return customers.loc[ordered & ~customers['id'].isin(cancelled), ['id', 'name']]
`,
  ),
  'sql-37': solution(
    '先用 `products[\'price\'].max()` 找出最贵的商品（可能有多个），再一步步 `isin` 到客户。',
    "Find the priciest products with `products['price'].max()` (there may be several), then `isin` your way to the customers.",
    `
def solve(tables):
    customers = tables['customers']
    products = tables['products']
    orders = tables['orders']
    items = tables['order_items']
    priciest = products.loc[products['price'] == products['price'].max(), 'id']
    with_them = items.loc[items['product_id'].isin(priciest), 'order_id']
    paid = orders[(orders['status'] == 'paid') & orders['id'].isin(with_them)]
    return customers.loc[customers['id'].isin(paid['customer_id'].dropna()), ['id', 'name']]
`,
  ),
  'sql-38': solution(
    '`rank(method=\'min\', ascending=False)` 就是 RANK：并列取最小名次，后面的名次跳过。',
    "`rank(method='min', ascending=False)` is RANK: ties share the lowest place and the next place skips ahead.",
    `
def solve(tables):
    departments = tables['departments']
    employees = tables['employees'].dropna(subset=['department_id']).copy()
    employees['pay_rank'] = employees.groupby('department_id')['salary'].rank(method='min', ascending=False)
    result = employees.merge(departments, left_on='department_id', right_on='id', suffixes=('', '_department'))
    return result[['name_department', 'name', 'salary', 'pay_rank']]
`,
  ),
  'sql-39': solution(
    '排好序后 `groupby(\'customer_id\')[\'day\'].shift()` 取上一笔的日期，相减后 `.dt.days`。',
    "After sorting, `groupby('customer_id')['day'].shift()` is the previous order's date; subtract and take `.dt.days`.",
    `
def solve(tables):
    orders = tables['orders']
    paid = orders[(orders['status'] == 'paid') & orders['customer_id'].notna()].copy()
    paid['day'] = pd.to_datetime(paid['order_date'])
    paid = paid.sort_values(['customer_id', 'day', 'id'])
    paid['gap_days'] = (paid['day'] - paid.groupby('customer_id')['day'].shift()).dt.days
    return paid[['customer_id', 'id', 'order_date', 'gap_days']]
`,
  ),
  'sql-40': solution(
    '先按商品汇总，再用 `groupby(\'category\')[\'revenue\'].transform(\'sum\')` 得到类目总额作分母。',
    "Total each product, then `groupby('category')['revenue'].transform('sum')` gives the category total to divide by.",
    `${PAID_ITEMS}

def solve(tables):
    products = tables['products'].rename(columns={'id': 'product_id', 'name': 'product'})
    items = paid_items(tables).merge(products, on='product_id')
    result = items.groupby(['product_id', 'category', 'product'], as_index=False)['amount'].sum()
    category = result.groupby('category')['amount'].transform('sum')
    result['share'] = (result['amount'] / category).round(2)
    return result[['category', 'product', 'amount', 'share']]
`,
  ),
  'sql-41': solution(
    '排好序后，组内 `rolling(3, min_periods=1).mean()` 就是「本笔和之前最多两笔」的平均值。',
    'After sorting, `rolling(3, min_periods=1).mean()` within each group averages an order with up to two before it.',
    `${PAID_ITEMS}

def solve(tables):
    orders = tables['orders'][['id', 'customer_id', 'order_date']].rename(columns={'id': 'order_id'})
    totals = paid_items(tables).groupby('order_id', as_index=False)['amount'].sum()
    totals = totals.merge(orders.dropna(subset=['customer_id']), on='order_id')
    totals = totals.sort_values(['customer_id', 'order_date', 'order_id'])
    amount = totals['amount'].astype(float)
    totals['moving_avg'] = amount.groupby(totals['customer_id']).transform(
        lambda values: values.rolling(3, min_periods=1).mean()
    ).round(2)
    return totals[['customer_id', 'order_id', 'amount', 'moving_avg']]
`,
  ),
  'sql-42': solution(
    'groupby 之后直接 `median()`：偶数个时就是中间两个的平均值。',
    'Call `median()` after the groupby: for an even count it averages the middle two.',
    `
def solve(tables):
    departments = tables['departments']
    employees = tables['employees']
    rows = employees.merge(departments, left_on='department_id', right_on='id', suffixes=('', '_department'))
    result = rows.groupby(['department_id', 'name_department'], as_index=False)['salary'].median()
    return result[['name_department', 'salary']]
`,
  ),
  'sql-43': solution(
    '和「连续登录」一样给每段连续日期一个键，每段 `size()`，再按用户取 `max()`。',
    'Key each run of consecutive days as in the login-streak problem, `size()` every run, then take the `max()` per user.',
    `${RUNS}

def solve(tables):
    days = runs(tables['logins'])
    lengths = days.groupby(['user_id', 'run']).size().reset_index(name='length')
    return lengths.groupby('user_id', as_index=False)['length'].max()
`,
  ),
  'sql-44': solution(
    '`str.split(\'@\', n=1).str[-1]` 取 @ 后面的部分，再 `str.lower()`。',
    "`str.split('@', n=1).str[-1]` takes the part after the @; then `str.lower()`.",
    `
def solve(tables):
    email = tables['customers']['email']
    domain = email.str.split('@', n=1).str[-1].str.lower()
    return domain.groupby(domain).size().reset_index(name='customers')
`,
  ),
  'sql-45': solution(
    '对每个邮箱 `map` 一个函数：s[:1] + \'***\' + s[s.find(\'@\'):]。',
    "`map` a function over the emails: s[:1] + '***' + s[s.find('@'):].",
    `
def mask(email):
    at = email.find('@')
    return email[:1] + '***' + (email[at:] if at >= 0 else email)


def solve(tables):
    customers = tables['customers'][['id', 'email']].copy()
    customers['masked'] = customers['email'].map(mask)
    return customers[['id', 'masked']]
`,
  ),
  'sql-46': solution(
    '把规则写成一个返回 True / False 的函数，`map` 到 email 列上再取反。',
    'Write the rules as a function returning True / False, `map` it over the emails and negate it.',
    `
def valid(email):
    at = email.find('@')
    domain = email[at + 1:]
    return (
        email.count('@') == 1
        and at > 0
        and '.' in domain
        and not domain.startswith('.')
        and not domain.endswith('.')
    )


def solve(tables):
    customers = tables['customers']
    return customers.loc[~customers['email'].map(valid), ['id', 'email']]
`,
  ),
  'sql-47': solution(
    '`str[:1].str.upper()` 取首字母并转大写，再 groupby。',
    '`str[:1].str.upper()` takes the first letter in uppercase; then group by it.',
    `
def solve(tables):
    initial = tables['customers']['name'].str[:1].str.upper()
    return initial.groupby(initial).size().reset_index(name='customers')
`,
  ),
  'sql-48': solution(
    '`str[:4]` 取出年份文本；按年份分组计数后 `sort_values`。',
    '`str[:4]` gives the year as text; count per year, then `sort_values`.',
    `
def solve(tables):
    year = tables['employees']['hire_date'].str[:4]
    hires = year.groupby(year).size().reset_index(name='hires')
    return hires.sort_values('hire_date')
`,
  ),
  'sql-49': solution(
    '`pd.to_datetime(...).dt.dayofweek` 里周一是 0、周六是 5、周日是 6。',
    '`pd.to_datetime(...).dt.dayofweek` counts Monday as 0, Saturday as 5 and Sunday as 6.',
    `
def solve(tables):
    orders = tables['orders']
    weekday = pd.to_datetime(orders['order_date']).dt.dayofweek
    chosen = orders[(orders['status'] == 'paid') & (weekday >= 5)].copy()
    chosen['day'] = weekday[chosen.index].map({5: 'Sat', 6: 'Sun'})
    return chosen[['id', 'order_date', 'day']]
`,
  ),
  'sql-50': solution(
    '年份差 `2025 - int(年份)`，再看 `str[5:]`（月-日）是否晚于 \'01-01\'，晚了就减 1。',
    "Take `2025 - int(year)`, then subtract 1 when `str[5:]` (month-day) comes after '01-01'.",
    `
def solve(tables):
    employees = tables['employees'][['name', 'hire_date']].copy()
    year = employees['hire_date'].str[:4].astype(int)
    later = (employees['hire_date'].str[5:] > '01-01').astype(int)
    employees['years'] = 2025 - year - later
    return employees[['name', 'years']]
`,
  ),
};
