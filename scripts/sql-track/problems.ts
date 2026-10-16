/**
 * The SQL track: 50 practice problems written for CSWork (21–50 live in
 * problems-more.ts). Each one names its
 * tables, a reference query, other accepted forms, and common wrong queries the
 * hidden datasets must reject. scripts/sql-track/build.ts turns them into judge
 * packages; tests/sql-track.test.ts reruns every query on every dataset.
 */
import { APP, COMPANY, SCHOOL, SHOP, type Data, type SchemaName } from './datasets';
import { MORE_PROBLEMS } from './problems-more';

type Text = { zh: string; en: string };
export type GroupKey = 'basics' | 'joins' | 'grouping' | 'subqueries' | 'windows' | 'strings' | 'dates';
export const GROUPS: { key: GroupKey; zh: string; en: string }[] = [
  { key: 'basics', zh: '过滤与 NULL', en: 'Filtering & NULL' },
  { key: 'joins', zh: '连接', en: 'Joins' },
  { key: 'grouping', zh: '分组与 HAVING', en: 'GROUP BY & HAVING' },
  { key: 'subqueries', zh: '子查询', en: 'Subqueries' },
  { key: 'windows', zh: '窗口函数', en: 'Window functions' },
  { key: 'strings', zh: '字符串处理', en: 'Strings' },
  { key: 'dates', zh: '日期处理', en: 'Dates' },
];
/**
 * Interview patterns across the topic groups: the SQL track filters by them (?pattern=) and the
 * /learn/sql course links to them. A problem may have none (plain filtering, strings, dates).
 */
export const PATTERNS: { key: string; zh: string; en: string; ids: string[] }[] = [
  { key: 'top-n-per-group', zh: '分组 Top N', en: 'Top N per group', ids: ['sql-15', 'sql-16', 'sql-34'] },
  { key: 'ranking', zh: '排名与第 N 高', en: 'Ranking & Nth highest', ids: ['sql-12', 'sql-38', 'sql-42'] },
  { key: 'gaps-islands', zh: '连续区间', en: 'Gaps & islands', ids: ['sql-19', 'sql-43'] },
  { key: 'running-total', zh: '累计与移动窗口', en: 'Running totals', ids: ['sql-17', 'sql-41'] },
  { key: 'period-over-period', zh: '环比与间隔', en: 'Period over period', ids: ['sql-18', 'sql-39'] },
  { key: 'retention', zh: '留存', en: 'Retention', ids: ['sql-20'] },
  { key: 'ratio', zh: '占比与比率', en: 'Ratios & shares', ids: ['sql-20', 'sql-31', 'sql-40'] },
  { key: 'dedupe', zh: '去重与找重复', en: 'Dedupe & duplicates', ids: ['sql-11', 'sql-19', 'sql-24', 'sql-29', 'sql-43'] },
  { key: 'pivot', zh: '条件聚合与行转列', en: 'Conditional aggregation & pivot', ids: ['sql-03', 'sql-27', 'sql-31', 'sql-32'] },
  { key: 'anti-join', zh: '反连接（从未…）', en: 'Anti-join (never …)', ids: ['sql-01', 'sql-04', 'sql-26', 'sql-35', 'sql-36'] },
  { key: 'self-join', zh: '自连接', en: 'Self-join', ids: ['sql-01', 'sql-05', 'sql-08', 'sql-25'] },
  { key: 'relational-division', zh: '全称条件', en: 'For all (division)', ids: ['sql-14', 'sql-35'] },
];
export type SqlProblem = {
  id: string;
  group: GroupKey;
  difficulty: '简单' | '中等' | '困难';
  title: Text;
  schema: SchemaName;
  tables: string[];
  /** Rows are compared in order (the task asks for an ORDER BY). */
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
  /** Hand-written edge cases; the build adds two seeded random datasets. */
  hidden: Data[];
};

export const PROBLEMS: SqlProblem[] = [
  {
    id: 'sql-01',
    group: 'basics',
    difficulty: '简单',
    title: { zh: '找不到上级的员工', en: 'Employees Without a Valid Manager' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '公司在清理组织架构。找出所有「找不到上级」的员工：`manager_id` 为 NULL，或者 `manager_id` 指向的员工并不存在。',
      en: 'The company is cleaning up its org chart. Find every employee without a valid manager: `manager_id` is NULL, or it points to an employee who does not exist.',
    },
    columns: [
      ['id', '员工编号', 'employee id'],
      ['name', '员工姓名', 'employee name'],
    ],
    explanation: {
      zh: 'Ava 和 Eve 的 manager_id 是 NULL；Hugo 的上级编号 42 不存在。其余员工的上级都在表里。',
      en: "Ava and Eve have a NULL manager_id; Hugo's manager id 42 does not exist. Everyone else's manager is in the table.",
    },
    hints: {
      zh: ['把 employees 和自己做 LEFT JOIN：没匹配上的上级那一侧全是 NULL。', '`x = NULL` 永远不为真，判断空值要用 `IS NULL`。'],
      en: ['LEFT JOIN employees to itself: the manager side is all NULL when there is no match.', '`x = NULL` is never true; test for missing values with `IS NULL`.'],
    },
    reference: `SELECT e.id, e.name
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
WHERE m.id IS NULL;`,
    accepted: [
      `SELECT id, name FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employees m WHERE m.id = e.manager_id);`,
    ],
    wrong: [
      'SELECT id, name FROM employees WHERE manager_id IS NULL;',
      'SELECT id, name FROM employees WHERE manager_id NOT IN (SELECT id FROM employees);',
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-02',
    group: 'basics',
    difficulty: '简单',
    title: { zh: '各城市的客户数', en: 'Customers per City' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '统计每个城市有多少客户。`city` 为 NULL 的客户归到名为 `Unknown` 的一组（数据中不会有真的叫 Unknown 的城市）。',
      en: 'Count the customers in each city. Customers whose `city` is NULL form one group named `Unknown` (no real city in the data is called Unknown).',
    },
    columns: [
      ['city', '城市，NULL 显示为 Unknown', 'city, with NULL shown as Unknown'],
      ['customers', '该城市的客户数', 'number of customers there'],
    ],
    explanation: {
      zh: 'Austin 有 Alice、Cara、Femi 三位客户，Boston 有两位，Dev 的城市未知。',
      en: "Austin has Alice, Cara and Femi, Boston has two customers, and Dev's city is unknown.",
    },
    hints: {
      zh: ['`COALESCE(city, \'Unknown\')` 把 NULL 换成默认值。', '`COUNT(city)` 不计 NULL，`COUNT(*)` 计所有行。'],
      en: ["`COALESCE(city, 'Unknown')` replaces NULL with a default.", '`COUNT(city)` skips NULLs; `COUNT(*)` counts every row.'],
    },
    reference: `SELECT COALESCE(city, 'Unknown') AS city, COUNT(*) AS customers
FROM customers
GROUP BY COALESCE(city, 'Unknown');`,
    accepted: [
      `SELECT CASE WHEN city IS NULL THEN 'Unknown' ELSE city END, COUNT(*) FROM customers GROUP BY city;`,
    ],
    wrong: [
      'SELECT city, COUNT(*) FROM customers GROUP BY city;',
      "SELECT COALESCE(city, 'Unknown'), COUNT(city) FROM customers GROUP BY city;",
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-03',
    group: 'basics',
    difficulty: '中等',
    title: { zh: '缺考与平均分', en: 'Absences and Averages' },
    schema: 'school',
    tables: ['courses', 'enrollments'],
    task: {
      zh: '`enrollments.score` 为 NULL 表示学生选了课但缺考，0 分是真实成绩。对每门至少有一人选课的课程，求：选课人数、参加考试人数、参加考试者的平均分（没人参加时为 NULL），以及把缺考按 0 分计的平均分。两个平均分都用 `ROUND(x, 2)` 保留两位小数。',
      en: '`enrollments.score` is NULL when a student enrolled but missed the exam; a score of 0 is a real result. For each course with at least one enrollment, report the number enrolled, the number who sat the exam, the average score of those who sat (NULL if nobody did), and the average counting absences as 0. Round both averages with `ROUND(x, 2)`.',
    },
    columns: [
      ['title', '课程名', 'course title'],
      ['enrolled', '选课人数', 'students enrolled'],
      ['sat', '参加考试人数', 'students who sat the exam'],
      ['avg_score', '参加者平均分', 'average of those who sat'],
      ['avg_with_zero', '缺考按 0 分的平均分', 'average with absences as 0'],
    ],
    explanation: {
      zh: 'Algebra 三人选课、两人考试：(90+75)/2 = 82.5，缺考记 0 为 165/3 = 55。Chemistry 无人考试，平均分是 NULL。Drama 没人选课，不输出。',
      en: 'Algebra has three enrolled and two who sat: (90+75)/2 = 82.5, and 165/3 = 55 with the absence as 0. Nobody sat Chemistry, so its average is NULL. Drama has no enrollments and is left out.',
    },
    hints: {
      zh: ['`AVG` 和 `COUNT(col)` 会跳过 NULL。', 'SQLite 里整数相除会截断：`165 / 2` 是 82。'],
      en: ['`AVG` and `COUNT(col)` skip NULLs.', 'Integer division truncates in SQLite: `165 / 2` is 82.'],
    },
    reference: `SELECT c.title, COUNT(*) AS enrolled, COUNT(e.score) AS sat,
       ROUND(AVG(e.score), 2) AS avg_score,
       ROUND(AVG(COALESCE(e.score, 0)), 2) AS avg_with_zero
FROM courses c
JOIN enrollments e ON e.course_id = c.id
GROUP BY c.id, c.title;`,
    accepted: [
      `SELECT c.title, COUNT(*), SUM(e.score IS NOT NULL),
       ROUND(1.0 * SUM(e.score) / COUNT(e.score), 2),
       ROUND(1.0 * TOTAL(e.score) / COUNT(*), 2)
FROM enrollments e JOIN courses c ON c.id = e.course_id GROUP BY c.id;`,
    ],
    wrong: [
      `SELECT c.title, COUNT(*), COUNT(*), ROUND(AVG(e.score), 2), ROUND(AVG(COALESCE(e.score, 0)), 2)
FROM courses c JOIN enrollments e ON e.course_id = c.id GROUP BY c.id;`,
      `SELECT c.title, COUNT(*), COUNT(e.score), ROUND(AVG(e.score), 2), ROUND(AVG(e.score), 2)
FROM courses c JOIN enrollments e ON e.course_id = c.id GROUP BY c.id;`,
      `SELECT c.title, COUNT(*), COUNT(e.score), SUM(e.score) / COUNT(e.score), SUM(COALESCE(e.score, 0)) / COUNT(*)
FROM courses c JOIN enrollments e ON e.course_id = c.id GROUP BY c.id;`,
    ],
    sample: SCHOOL.sample,
    hidden: [SCHOOL.rounding, SCHOOL.zero],
  },
  {
    id: 'sql-04',
    group: 'joins',
    difficulty: '简单',
    title: { zh: '从未下单的客户', en: 'Customers Who Never Ordered' },
    schema: 'shop',
    tables: ['customers', 'orders'],
    task: {
      zh: '找出从未下过任何订单的客户（已取消的订单也算下过单）。注意：游客订单的 `customer_id` 是 NULL。',
      en: 'Find the customers who have never placed an order of any status (a cancelled order still counts as placed). Note that guest orders have a NULL `customer_id`.',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
    ],
    explanation: {
      zh: 'Dev 和 Femi 没有订单。Bob 只有一笔已取消的订单，也算下过单。',
      en: 'Dev and Femi have no orders. Bob has only a cancelled order, which still counts.',
    },
    hints: {
      zh: ['`NOT EXISTS` 或 `LEFT JOIN … WHERE o.id IS NULL` 都可以。', '子查询结果里有 NULL 时，`x NOT IN (…)` 永远不为真。'],
      en: ['Use `NOT EXISTS`, or `LEFT JOIN … WHERE o.id IS NULL`.', 'When the subquery returns a NULL, `x NOT IN (…)` is never true.'],
    },
    reference: `SELECT c.id, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);`,
    accepted: [
      `SELECT c.id, c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;`,
      `SELECT id, name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL);`,
    ],
    wrong: [
      'SELECT id, name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);',
      `SELECT c.id, c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' WHERE o.id IS NULL;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-05',
    group: 'joins',
    difficulty: '简单',
    title: { zh: '比上级挣得多', en: 'Earning More Than the Manager' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '找出工资严格高于自己直属上级的员工。上级不存在或为 NULL 的员工不参与比较。',
      en: 'Find the employees paid strictly more than their direct manager. Employees whose manager is NULL or missing are not compared.',
    },
    columns: [
      ['employee', '员工姓名', 'employee name'],
      ['salary', '员工工资', "employee's salary"],
      ['manager', '上级姓名', "manager's name"],
      ['manager_salary', '上级工资', "manager's salary"],
    ],
    explanation: {
      zh: 'Finn（8500）高于上级 Eve（8000），Jack（5500）高于上级 Hugo（5000）。Ben 和 Chloe 低于 Ava。',
      en: 'Finn (8500) out-earns his manager Eve (8000), and Jack (5500) out-earns Hugo (5000). Ben and Chloe earn less than Ava.',
    },
    hints: {
      zh: ['同一张表 JOIN 两次，用别名区分员工 e 和上级 m：`ON m.id = e.manager_id`。'],
      en: ['Join the table to itself with two aliases, employee e and manager m: `ON m.id = e.manager_id`.'],
    },
    reference: `SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;`,
    wrong: [
      `SELECT e.name, e.salary, m.name, m.salary FROM employees e JOIN employees m ON m.id = e.manager_id WHERE e.salary >= m.salary;`,
      `SELECT e.name, e.salary, m.name, m.salary FROM employees e JOIN employees m ON e.id = m.manager_id WHERE e.salary > m.salary;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-06',
    group: 'joins',
    difficulty: '简单',
    title: { zh: '部门人数（含空部门）', en: 'Headcount per Department' },
    schema: 'company',
    tables: ['departments', 'employees'],
    task: {
      zh: '列出每个部门及其员工人数，没有员工的部门显示 0。不属于任何部门的员工不计入。',
      en: 'List every department with its number of employees, showing 0 for empty departments. Employees without a department are not counted.',
    },
    columns: [
      ['department', '部门名', 'department name'],
      ['headcount', '员工人数', 'number of employees'],
    ],
    explanation: {
      zh: 'Engineering 4 人，Sales 3 人，Support 2 人，Legal 没有员工显示 0；Iris 不属于任何部门。',
      en: 'Engineering has 4, Sales 3, Support 2, and Legal has none, so 0; Iris belongs to no department.',
    },
    hints: {
      zh: ['从 departments 出发 LEFT JOIN employees，空部门才会保留。', '数员工要用 `COUNT(e.id)`：`COUNT(*)` 会把空部门那一行也算成 1。'],
      en: ['Start from departments and LEFT JOIN employees so empty departments stay.', 'Count `COUNT(e.id)`: `COUNT(*)` counts the empty department’s padded row as 1.'],
    },
    reference: `SELECT d.name AS department, COUNT(e.id) AS headcount
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
GROUP BY d.id, d.name;`,
    accepted: [
      `SELECT name, (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) FROM departments d;`,
    ],
    wrong: [
      `SELECT d.name, COUNT(*) FROM departments d JOIN employees e ON e.department_id = d.id GROUP BY d.id;`,
      `SELECT d.name, COUNT(*) FROM departments d LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-07',
    group: 'joins',
    difficulty: '中等',
    title: { zh: '已支付订单的金额', en: 'Paid Order Totals' },
    schema: 'shop',
    tables: ['customers', 'products', 'orders', 'order_items'],
    task: {
      zh: '对每笔至少包含一件商品的已支付（`status = \'paid\'`）订单，求订单金额：各明细 `quantity * unit_price` 之和（按实际成交价，不是商品标价）。游客订单的客户名显示为 `Guest`。',
      en: "For every paid (`status = 'paid'`) order with at least one item, compute its total: the sum of `quantity * unit_price` over its items (the price actually charged, not the list price). Show `Guest` as the customer of guest orders.",
    },
    columns: [
      ['order_id', '订单编号', 'order id'],
      ['customer', '客户姓名或 Guest', 'customer name or Guest'],
      ['total', '订单金额', 'order total'],
    ],
    explanation: {
      zh: '订单 1 是 2×30 + 1×55 = 115（棋盘按折扣价 55 计）。订单 6 是游客订单。订单 3、9 已取消，不输出。',
      en: 'Order 1 is 2×30 + 1×55 = 115 (the chess set was charged 55, not 60). Order 6 is a guest order. Orders 3 and 9 were cancelled and are left out.',
    },
    hints: {
      zh: ['订单和明细用内连接，订单和客户用左连接，游客订单才不会丢。'],
      en: ['Inner-join orders to their items but left-join customers, so guest orders survive.'],
    },
    reference: `SELECT o.id AS order_id, COALESCE(c.name, 'Guest') AS customer,
       SUM(i.quantity * i.unit_price) AS total
FROM orders o
JOIN order_items i ON i.order_id = o.id
LEFT JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid'
GROUP BY o.id, c.name;`,
    wrong: [
      `SELECT o.id, COALESCE(c.name, 'Guest'), SUM(i.quantity * p.price)
FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
LEFT JOIN customers c ON c.id = o.customer_id WHERE o.status = 'paid' GROUP BY o.id;`,
      `SELECT o.id, c.name, SUM(i.quantity * i.unit_price)
FROM orders o JOIN order_items i ON i.order_id = o.id JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid' GROUP BY o.id;`,
      `SELECT o.id, COALESCE(c.name, 'Guest'), SUM(i.quantity * i.unit_price)
FROM orders o JOIN order_items i ON i.order_id = o.id LEFT JOIN customers c ON c.id = o.customer_id GROUP BY o.id;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-08',
    group: 'joins',
    difficulty: '中等',
    title: { zh: '同城客户配对', en: 'Same-City Pairs' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '列出所有住在同一个已知城市的两位不同客户，每一对只出现一次，且 `first_id < second_id`。城市为 NULL 的客户不和任何人配对。',
      en: 'List every pair of different customers who live in the same known city, each pair once with `first_id < second_id`. Customers with a NULL city are never paired.',
    },
    columns: [
      ['city', '城市', 'city'],
      ['first_id', '编号较小的客户', 'smaller customer id'],
      ['second_id', '编号较大的客户', 'larger customer id'],
    ],
    explanation: {
      zh: 'Austin 有客户 1、3、6，组成 (1,3)、(1,6)、(3,6) 三对；Boston 有 (2,5)。Dev 城市未知，不配对。',
      en: 'Austin has customers 1, 3 and 6, giving (1,3), (1,6) and (3,6); Boston gives (2,5). Dev’s city is unknown, so he is not paired.',
    },
    hints: {
      zh: ['自连接时用 `a.id < b.id` 去掉自己和自己、以及 (b,a) 这种重复。', 'NULL = NULL 的结果是 NULL，不是真。'],
      en: ['In the self-join, `a.id < b.id` drops self-pairs and the mirrored (b,a) duplicates.', 'NULL = NULL yields NULL, not true.'],
    },
    reference: `SELECT a.city, a.id AS first_id, b.id AS second_id
FROM customers a
JOIN customers b ON a.city = b.city AND a.id < b.id;`,
    wrong: [
      'SELECT a.city, a.id, b.id FROM customers a JOIN customers b ON a.city = b.city AND a.id <> b.id;',
      'SELECT a.city, a.id, b.id FROM customers a JOIN customers b ON a.city IS b.city AND a.id < b.id;',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-09',
    group: 'grouping',
    difficulty: '简单',
    title: { zh: '活跃买家', en: 'Frequent Buyers' },
    schema: 'shop',
    tables: ['customers', 'orders'],
    task: {
      zh: '找出已支付订单不少于 3 笔的客户，并给出已支付订单数。已取消的订单不算。',
      en: 'Find the customers with at least 3 paid orders, along with that number. Cancelled orders do not count.',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
      ['paid_orders', '已支付订单数', 'number of paid orders'],
    ],
    explanation: {
      zh: 'Alice 有 4 笔订单，其中订单 9 已取消，已支付的恰好 3 笔。Cara 只有 2 笔。',
      en: 'Alice has 4 orders, but order 9 was cancelled, which leaves exactly 3 paid. Cara has only 2.',
    },
    hints: {
      zh: ['`WHERE` 先筛行，`HAVING` 再筛分组。'],
      en: ['`WHERE` filters rows first; `HAVING` filters the groups afterwards.'],
    },
    reference: `SELECT c.id, c.name, COUNT(*) AS paid_orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.id, c.name
HAVING COUNT(*) >= 3;`,
    accepted: [
      `SELECT c.id, c.name, SUM(o.status = 'paid') AS n FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING n >= 3;`,
    ],
    wrong: [
      `SELECT c.id, c.name, COUNT(*) FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING COUNT(*) >= 3;`,
      `SELECT c.id, c.name, COUNT(*) FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid' GROUP BY c.id HAVING COUNT(*) > 3;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-10',
    group: 'grouping',
    difficulty: '中等',
    title: { zh: '类目销售榜', en: 'Category Revenue Board' },
    schema: 'shop',
    tables: ['products', 'orders', 'order_items'],
    ordered: true,
    task: {
      zh: '按商品类目统计已支付订单的销售额（`quantity * unit_price` 之和），只保留销售额不少于 300 的类目。结果按销售额从高到低排序，销售额相同时按类目名升序。',
      en: 'Compute the revenue of each product category over paid orders (the sum of `quantity * unit_price`), keeping only categories with revenue of at least 300. Sort by revenue, highest first, breaking ties by category name ascending.',
    },
    columns: [
      ['category', '类目', 'category'],
      ['revenue', '销售额', 'revenue'],
    ],
    explanation: {
      zh: 'Books 共 60+90+30+45+300 = 525，Games 共 55+25+180+60 = 320，Kitchen 只有 230，被过滤掉。',
      en: 'Books makes 60+90+30+45+300 = 525 and Games 55+25+180+60 = 320; Kitchen makes only 230 and is filtered out.',
    },
    hints: {
      zh: ['聚合之后的条件写在 `HAVING`。', '本题比较行的顺序，ORDER BY 要写全平局规则。'],
      en: ['Conditions on aggregates go in `HAVING`.', 'Row order is compared here, so spell out the tie-break in ORDER BY.'],
    },
    reference: `SELECT p.category, SUM(i.quantity * i.unit_price) AS revenue
FROM order_items i
JOIN orders o ON o.id = i.order_id
JOIN products p ON p.id = i.product_id
WHERE o.status = 'paid'
GROUP BY p.category
HAVING SUM(i.quantity * i.unit_price) >= 300
ORDER BY revenue DESC, p.category;`,
    wrong: [
      `SELECT p.category, SUM(i.quantity * i.unit_price) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id
JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY p.category HAVING revenue > 300 ORDER BY revenue DESC, p.category;`,
      `SELECT p.category, SUM(i.quantity * i.unit_price) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id
JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY p.category HAVING revenue >= 300 ORDER BY revenue, p.category;`,
      `SELECT p.category, SUM(i.quantity * p.price) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id
JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY p.category HAVING revenue >= 300 ORDER BY revenue DESC, p.category;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-11',
    group: 'grouping',
    difficulty: '简单',
    title: { zh: '重复的邮箱', en: 'Duplicate Emails' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '邮箱不区分大小写。找出被不止一位客户使用的邮箱，输出其全小写形式和使用它的客户数。',
      en: 'Email addresses are case-insensitive. Find the addresses used by more than one customer, in lowercase, with the number of customers using each.',
    },
    columns: [
      ['email', '全小写的邮箱', 'email in lowercase'],
      ['accounts', '使用该邮箱的客户数', 'customers using it'],
    ],
    explanation: {
      zh: 'alice@mail.com 和 Alice@Mail.com 是同一个邮箱，被 2 位客户使用。',
      en: 'alice@mail.com and Alice@Mail.com are the same address, used by 2 customers.',
    },
    hints: {
      zh: ['按 `LOWER(email)` 分组，输出的也是 `LOWER(email)`。'],
      en: ['Group by `LOWER(email)` and output `LOWER(email)` too.'],
    },
    reference: `SELECT LOWER(email) AS email, COUNT(*) AS accounts
FROM customers
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;`,
    wrong: [
      'SELECT email, COUNT(*) FROM customers GROUP BY email HAVING COUNT(*) > 1;',
      'SELECT LOWER(email), COUNT(*) FROM customers GROUP BY LOWER(email);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-12',
    group: 'subqueries',
    difficulty: '中等',
    title: { zh: '第二高的工资', en: 'Second-Highest Salary' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '求所有员工工资中第二高的不同值。如果不存在（比如所有人工资相同），返回 NULL。结果恰好一行一列。',
      en: 'Find the second-highest distinct salary among all employees, or NULL if there is none (for example when everyone earns the same). The result is exactly one row and one column.',
    },
    columns: [['second_salary', '第二高的不同工资，或 NULL', 'second-highest distinct salary, or NULL']],
    explanation: {
      zh: '不同的工资从高到低是 12000、9000、8500……第二高是 9000（Ben 和 Chloe 并列也只算一个值）。',
      en: 'The distinct salaries, highest first, are 12000, 9000, 8500, … so the answer is 9000 (Ben and Chloe share it, which still counts once).',
    },
    hints: {
      zh: ['标量子查询没有结果时值为 NULL，外层 SELECT 仍会返回一行。', '也可以找「小于最大值的最大值」。'],
      en: ['A scalar subquery with no row is NULL, and the outer SELECT still returns one row.', 'Or look for the largest salary below the maximum.'],
    },
    reference: `SELECT (
  SELECT DISTINCT salary FROM employees
  ORDER BY salary DESC
  LIMIT 1 OFFSET 1
) AS second_salary;`,
    accepted: [
      'SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);',
    ],
    wrong: [
      'SELECT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;',
      'SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;',
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie, COMPANY.flat],
  },
  {
    id: 'sql-13',
    group: 'subqueries',
    difficulty: '中等',
    title: { zh: '高于部门平均工资', en: 'Above the Department Average' },
    schema: 'company',
    tables: ['departments', 'employees'],
    task: {
      zh: '找出工资严格高于本部门平均工资的员工。没有部门的员工不参与。',
      en: "Find the employees paid strictly more than their own department's average salary. Employees without a department are left out.",
    },
    columns: [
      ['department', '部门名', 'department name'],
      ['employee', '员工姓名', 'employee name'],
      ['salary', '工资', 'salary'],
    ],
    explanation: {
      zh: 'Engineering 平均 9250，只有 Ava 高于它；Sales 平均 7500，Eve 和 Finn 高于它；Support 平均 5250，Jack 高于它。',
      en: 'Engineering averages 9250 and only Ava is above it; Sales averages 7500, beaten by Eve and Finn; Support averages 5250, beaten by Jack.',
    },
    hints: {
      zh: ['相关子查询：在 WHERE 里按当前行的 department_id 现算平均值。', '也可以先按部门算好平均值，再 JOIN 回来。'],
      en: ["A correlated subquery computes the average for the current row's department_id.", 'Or compute the averages per department first and join them back.'],
    },
    reference: `SELECT d.name AS department, e.name AS employee, e.salary
FROM employees e
JOIN departments d ON d.id = e.department_id
WHERE e.salary > (
  SELECT AVG(x.salary) FROM employees x WHERE x.department_id = e.department_id
);`,
    accepted: [
      `WITH a AS (SELECT department_id, AVG(salary) AS avg FROM employees GROUP BY department_id)
SELECT d.name, e.name, e.salary FROM employees e JOIN a ON a.department_id = e.department_id
JOIN departments d ON d.id = e.department_id WHERE e.salary > a.avg;`,
    ],
    wrong: [
      `SELECT d.name, e.name, e.salary FROM employees e JOIN departments d ON d.id = e.department_id
WHERE e.salary > (SELECT AVG(salary) FROM employees);`,
      `SELECT d.name, e.name, e.salary FROM employees e JOIN departments d ON d.id = e.department_id
WHERE e.salary >= (SELECT AVG(x.salary) FROM employees x WHERE x.department_id = e.department_id);`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-14',
    group: 'subqueries',
    difficulty: '困难',
    title: { zh: '买齐所有类目', en: 'Bought Every Category' },
    schema: 'shop',
    tables: ['customers', 'products', 'orders', 'order_items'],
    task: {
      zh: '`products` 表里出现过的每个类目，客户都在已支付订单中至少买过一件，这样的客户有哪些？',
      en: 'Which customers have bought, in paid orders, at least one product from every category that appears in `products`?',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
    ],
    explanation: {
      zh: '类目共有 Books、Games、Kitchen 三个。Alice 在订单 1、2 里买齐了，Elle 在订单 7 里买齐了；Cara 没买过 Kitchen。',
      en: 'There are three categories: Books, Games and Kitchen. Alice covers them in orders 1 and 2, and Elle in order 7; Cara never bought Kitchen.',
    },
    hints: {
      zh: ['把每位客户买过的不同类目数和全部类目数比较：`COUNT(DISTINCT …)`。'],
      en: ['Compare the number of distinct categories each customer bought with the total: `COUNT(DISTINCT …)`.'],
    },
    reference: `SELECT c.id, c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
JOIN order_items i ON i.order_id = o.id
JOIN products p ON p.id = i.product_id
GROUP BY c.id, c.name
HAVING COUNT(DISTINCT p.category) = (SELECT COUNT(DISTINCT category) FROM products);`,
    accepted: [
      `SELECT c.id, c.name FROM customers c WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE NOT EXISTS (
    SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products q ON q.id = i.product_id
    WHERE o.customer_id = c.id AND o.status = 'paid' AND q.category = p.category));`,
    ],
    wrong: [
      `SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
GROUP BY c.id HAVING COUNT(p.category) = (SELECT COUNT(DISTINCT category) FROM products);`,
      `SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
GROUP BY c.id HAVING COUNT(DISTINCT p.category) = (SELECT COUNT(DISTINCT category) FROM products);`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-15',
    group: 'subqueries',
    difficulty: '中等',
    title: { zh: '每位客户的最新订单', en: 'Latest Order per Customer' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '对每位下过单的客户（任何状态都算，游客订单除外），找出其最新的一笔订单：`order_date` 最晚，同一天有多笔时取 `id` 最大的那笔。',
      en: 'For each customer with orders (any status; guest orders excluded), find the latest order: the latest `order_date`, and among orders on that day the one with the largest `id`.',
    },
    columns: [
      ['customer_id', '客户编号', 'customer id'],
      ['order_id', '最新订单编号', 'latest order id'],
      ['order_date', '该订单日期', "that order's date"],
    ],
    explanation: {
      zh: 'Alice（1）的订单 9 虽已取消，仍是她最晚的一笔；Cara（3）最新的是 3 月 1 日的订单 8。',
      en: "Alice's (1) order 9 was cancelled but is still her latest; Cara's (3) latest is order 8 on March 1.",
    },
    hints: {
      zh: ['`MAX(id)` 和 `MAX(order_date)` 分别取最大值，不一定来自同一行。', '`ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` 可以给每组排名。'],
      en: ['`MAX(id)` and `MAX(order_date)` are separate maxima and may come from different rows.', '`ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` ranks rows within each group.'],
    },
    reference: `SELECT customer_id, id AS order_id, order_date
FROM (
  SELECT o.*, ROW_NUMBER() OVER (
    PARTITION BY customer_id ORDER BY order_date DESC, id DESC
  ) AS rn
  FROM orders o
  WHERE customer_id IS NOT NULL
)
WHERE rn = 1;`,
    accepted: [
      `SELECT o.customer_id, o.id, o.order_date FROM orders o WHERE o.customer_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM orders p WHERE p.customer_id = o.customer_id
  AND (p.order_date > o.order_date OR (p.order_date = o.order_date AND p.id > o.id)));`,
    ],
    wrong: [
      'SELECT customer_id, MAX(id), MAX(order_date) FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id;',
      `SELECT customer_id, id, order_date FROM (SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, id) AS rn
FROM orders o WHERE customer_id IS NOT NULL) WHERE rn = 1;`,
      `SELECT customer_id, id, order_date FROM (SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, id DESC) AS rn
FROM orders o) WHERE rn = 1;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-16',
    group: 'windows',
    difficulty: '困难',
    title: { zh: '部门工资前三档', en: 'Top Three Pay Levels per Department' },
    schema: 'company',
    tables: ['departments', 'employees'],
    task: {
      zh: '在每个部门内，把不同的工资值从高到低排，取前三档。输出工资落在前三档的所有员工（同档的人都要输出）。没有部门的员工不参与。',
      en: "Within each department, rank the distinct salary values from highest to lowest and keep the top three levels. Output every employee whose salary falls in those levels (everyone sharing a level is included). Employees without a department are left out.",
    },
    columns: [
      ['department', '部门名', 'department name'],
      ['employee', '员工姓名', 'employee name'],
      ['salary', '工资', 'salary'],
    ],
    explanation: {
      zh: 'Engineering 的工资档是 12000、9000、7000：Ben 和 Chloe 同在第二档，Dan 在第三档，四人都输出。',
      en: 'Engineering’s levels are 12000, 9000 and 7000: Ben and Chloe share the second level and Dan is in the third, so all four are listed.',
    },
    hints: {
      zh: ['`RANK` 遇到并列会跳号，`DENSE_RANK` 不会，`ROW_NUMBER` 不处理并列。'],
      en: ['`RANK` skips numbers after ties, `DENSE_RANK` does not, and `ROW_NUMBER` ignores ties.'],
    },
    reference: `SELECT department, employee, salary
FROM (
  SELECT d.name AS department, e.name AS employee, e.salary,
         DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS level
  FROM employees e
  JOIN departments d ON d.id = e.department_id
)
WHERE level <= 3;`,
    accepted: [
      `SELECT d.name, e.name, e.salary FROM employees e JOIN departments d ON d.id = e.department_id
WHERE (SELECT COUNT(DISTINCT x.salary) FROM employees x WHERE x.department_id = e.department_id AND x.salary > e.salary) < 3;`,
    ],
    wrong: [
      `SELECT department, employee, salary FROM (SELECT d.name AS department, e.name AS employee, e.salary,
RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS r FROM employees e JOIN departments d ON d.id = e.department_id) WHERE r <= 3;`,
      `SELECT department, employee, salary FROM (SELECT d.name AS department, e.name AS employee, e.salary,
ROW_NUMBER() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC, e.id) AS r FROM employees e JOIN departments d ON d.id = e.department_id) WHERE r <= 3;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-17',
    group: 'windows',
    difficulty: '中等',
    title: { zh: '每日累计销售额', en: 'Running Daily Revenue' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    ordered: true,
    task: {
      zh: '对每个有已支付销售的日期，给出当天销售额（`quantity * unit_price` 之和）和截至当天的累计销售额。按日期升序输出。',
      en: 'For each date with paid sales, give that day’s revenue (the sum of `quantity * unit_price`) and the running total up to and including that day. Sort by date ascending.',
    },
    columns: [
      ['day', '日期', 'date'],
      ['revenue', '当天销售额', 'revenue that day'],
      ['running_total', '累计销售额', 'running total'],
    ],
    explanation: {
      zh: '1 月 5 日 115，1 月 20 日只有订单 2 的 80（订单 3 已取消），累计 195；2 月 14 日有两笔共 210……',
      en: 'January 5 makes 115; January 20 has only order 2’s 80 (order 3 was cancelled), 195 in total; February 14 has two orders worth 210, …',
    },
    hints: {
      zh: ['先按天聚合成一天一行，再在外层做 `SUM(revenue) OVER (ORDER BY day)`。'],
      en: ['First aggregate to one row per day, then take `SUM(revenue) OVER (ORDER BY day)` outside.'],
    },
    reference: `SELECT day, revenue, SUM(revenue) OVER (ORDER BY day) AS running_total
FROM (
  SELECT o.order_date AS day, SUM(i.quantity * i.unit_price) AS revenue
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid'
  GROUP BY o.order_date
)
ORDER BY day;`,
    accepted: [
      `WITH d AS (SELECT o.order_date AS day, SUM(i.quantity * i.unit_price) AS revenue FROM orders o
JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' GROUP BY day)
SELECT a.day, a.revenue, (SELECT SUM(b.revenue) FROM d b WHERE b.day <= a.day) FROM d a ORDER BY a.day;`,
    ],
    wrong: [
      `SELECT o.order_date, i.quantity * i.unit_price, SUM(i.quantity * i.unit_price) OVER (ORDER BY o.order_date, o.id, i.product_id)
FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' ORDER BY o.order_date;`,
      `SELECT day, revenue, SUM(revenue) OVER (ORDER BY day) FROM (SELECT o.order_date AS day, SUM(i.quantity * i.unit_price) AS revenue
FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY o.order_date) ORDER BY day;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-18',
    group: 'windows',
    difficulty: '中等',
    title: { zh: '月度销售额环比', en: 'Month-over-Month Revenue' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    ordered: true,
    task: {
      zh: '按月份（`YYYY-MM`）统计已支付订单的销售额，只列出有销售的月份，并给出与上一个列出的月份相比的变化量（本月减上月）；第一个月份的变化量为 NULL。按月份升序输出。',
      en: 'Compute paid revenue per month (`YYYY-MM`), listing only months with sales, together with the change from the previous listed month (this month minus that one); the first month’s change is NULL. Sort by month ascending.',
    },
    columns: [
      ['month', '月份 YYYY-MM', 'month as YYYY-MM'],
      ['revenue', '当月销售额', 'revenue that month'],
      ['change', '与上一个列出月份的差', 'change from the previous listed month'],
    ],
    explanation: {
      zh: '1 月 115+80 = 195；2 月 115+180+30 = 325，变化 130；3 月 255+300 = 555，变化 230。',
      en: 'January makes 115+80 = 195; February 115+180+30 = 325, a change of 130; March 255+300 = 555, a change of 230.',
    },
    hints: {
      zh: ["`strftime('%Y-%m', order_date)` 取出年月。", '`LAG(x) OVER (ORDER BY …)` 取上一行的值，第一行为 NULL。'],
      en: ["`strftime('%Y-%m', order_date)` extracts the year and month.", '`LAG(x) OVER (ORDER BY …)` reads the previous row, NULL on the first.'],
    },
    reference: `SELECT month, revenue, revenue - LAG(revenue) OVER (ORDER BY month) AS change
FROM (
  SELECT strftime('%Y-%m', o.order_date) AS month, SUM(i.quantity * i.unit_price) AS revenue
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid'
  GROUP BY month
)
ORDER BY month;`,
    accepted: [
      `WITH m AS (SELECT substr(o.order_date, 1, 7) AS month, SUM(i.quantity * i.unit_price) AS revenue
FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' GROUP BY 1)
SELECT a.month, a.revenue, a.revenue - (SELECT b.revenue FROM m b WHERE b.month < a.month ORDER BY b.month DESC LIMIT 1)
FROM m a ORDER BY a.month;`,
    ],
    wrong: [
      `SELECT month, revenue, revenue - LEAD(revenue) OVER (ORDER BY month) FROM (SELECT strftime('%Y-%m', o.order_date) AS month,
SUM(i.quantity * i.unit_price) AS revenue FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' GROUP BY month) ORDER BY month;`,
      `SELECT month, revenue, revenue - COALESCE(LAG(revenue) OVER (ORDER BY month), 0) FROM (SELECT strftime('%Y-%m', o.order_date) AS month,
SUM(i.quantity * i.unit_price) AS revenue FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' GROUP BY month) ORDER BY month;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-19',
    group: 'dates',
    difficulty: '困难',
    title: { zh: '连续三天登录', en: 'Three Days in a Row' },
    schema: 'app',
    tables: ['logins'],
    task: {
      zh: '找出曾在连续至少 3 个自然日都登录过的用户。同一天登录多次只算一天；跨月、跨年也算连续。',
      en: 'Find the users who logged in on at least 3 consecutive calendar days. Several logins on one day count as one day; streaks may cross month and year boundaries.',
    },
    columns: [['user_id', '用户编号', 'user id']],
    explanation: {
      zh: '用户 1 在 2024 年 2 月 27、28、29 日连续登录（闰年）；用户 3 在 3 月 1–3 日连续登录；用户 4 只有两天。',
      en: 'User 1 logged in on February 27, 28 and 29, 2024 (a leap year); user 3 on March 1–3; user 4 on only two days.',
    },
    hints: {
      zh: ['先对 (user_id, login_date) 去重。', '连续的日期减去它的序号（ROW_NUMBER）会得到同一个值：`julianday(login_date) - ROW_NUMBER() …`。'],
      en: ['First deduplicate (user_id, login_date).', 'Consecutive dates minus their row number give the same value: `julianday(login_date) - ROW_NUMBER() …`.'],
    },
    reference: `WITH days AS (
  SELECT DISTINCT user_id, login_date FROM logins
), streaks AS (
  SELECT user_id,
         julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS streak
  FROM days
)
SELECT DISTINCT user_id
FROM streaks
GROUP BY user_id, streak
HAVING COUNT(*) >= 3;`,
    accepted: [
      `SELECT DISTINCT a.user_id FROM logins a
JOIN logins b ON b.user_id = a.user_id AND b.login_date = date(a.login_date, '+1 day')
JOIN logins c ON c.user_id = a.user_id AND c.login_date = date(a.login_date, '+2 days');`,
    ],
    wrong: [
      `SELECT DISTINCT user_id FROM (SELECT user_id, julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS s FROM logins)
GROUP BY user_id, s HAVING COUNT(*) >= 3;`,
      `SELECT DISTINCT a.user_id FROM logins a JOIN logins b ON b.user_id = a.user_id AND b.login_date = date(a.login_date, '+1 day');`,
    ],
    sample: APP.sample,
    hidden: [APP.boundaries, APP.sparse],
  },
  {
    id: 'sql-20',
    group: 'dates',
    difficulty: '中等',
    title: { zh: '次日留存率', en: 'Next-Day Retention' },
    schema: 'app',
    tables: ['logins'],
    task: {
      zh: '每位用户第一次登录的那天是其首日。次日留存率 = 首日的下一天也登录过的用户数 ÷ 用户总数，用 `ROUND(x, 2)` 保留两位小数。数据保证至少有一位用户。结果恰好一行一列。',
      en: "A user's first day is the date of their first login. Next-day retention is the number of users who also logged in on the day after their first day, divided by the number of users, rounded with `ROUND(x, 2)`. There is always at least one user. The result is exactly one row and one column.",
    },
    columns: [['retention', '次日留存率', 'next-day retention']],
    explanation: {
      zh: '4 位用户中，用户 1（2 月 27 日→28 日）、3（3 月 1 日→2 日）、4（2 月 28 日→29 日）次日回来了，用户 2 没有，留存率 3/4 = 0.75。',
      en: 'Of 4 users, users 1 (Feb 27 → 28), 3 (Mar 1 → 2) and 4 (Feb 28 → 29) came back the next day and user 2 did not: 3/4 = 0.75.',
    },
    hints: {
      zh: ["`date(first_day, '+1 day')` 得到下一天。", '先乘 `1.0` 再相除，避免整数除法。'],
      en: ["`date(first_day, '+1 day')` gives the next day.", 'Multiply by `1.0` before dividing to avoid integer division.'],
    },
    reference: `WITH firsts AS (
  SELECT user_id, MIN(login_date) AS first_day FROM logins GROUP BY user_id
)
SELECT ROUND(1.0 * SUM(EXISTS (
  SELECT 1 FROM logins l
  WHERE l.user_id = f.user_id AND l.login_date = date(f.first_day, '+1 day')
)) / COUNT(*), 2) AS retention
FROM firsts f;`,
    accepted: [
      `WITH f AS (SELECT user_id, MIN(login_date) AS d FROM logins GROUP BY user_id)
SELECT ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM logins l WHERE l.user_id = f.user_id
  AND julianday(l.login_date) - julianday(f.d) = 1) THEN 1.0 ELSE 0 END), 2) FROM f;`,
    ],
    wrong: [
      `WITH f AS (SELECT user_id, MIN(login_date) AS d FROM logins GROUP BY user_id)
SELECT SUM(EXISTS (SELECT 1 FROM logins l WHERE l.user_id = f.user_id AND l.login_date = date(f.d, '+1 day'))) / COUNT(*) FROM f;`,
      `WITH f AS (SELECT user_id, MIN(login_date) AS d FROM logins GROUP BY user_id)
SELECT ROUND(1.0 * SUM(EXISTS (SELECT 1 FROM logins l WHERE l.user_id = f.user_id AND l.login_date > f.d)) / COUNT(*), 2) FROM f;`,
    ],
    sample: APP.sample,
    hidden: [APP.boundaries, APP.sparse],
  },
  ...MORE_PROBLEMS,
];
