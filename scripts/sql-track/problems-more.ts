/**
 * SQL track problems 21–50, written for CSWork like 1–20 (problems.ts), so the
 * track covers the usual SQL-50 ground: filtering, joins, aggregation,
 * subqueries, window functions, strings and dates. Same shape and the same
 * build checks: every accepted query must agree on every dataset and every
 * wrong query must fail some hidden one.
 */
import { APP, COMPANY, SCHOOL, SHOP, type Data } from './datasets';
import type { SqlProblem } from './problems';

/** A second shop: repeat buyers, a product sold only in a cancelled order, weekends, mixed-case domains. */
const SHOP_EXTRA: Data = {
  customers: [
    [1, 'Ana', 'ana@mail.com', 'Austin'],
    [2, 'Bram', 'bram@shop.io', 'Boston'],
    [3, 'Cleo', 'CLEO@Shop.io', null],
    [4, 'Dmitri', 'dmitri@mail.com', 'Boston'],
    [5, 'Esme', 'esme@web.org', 'Austin'],
  ],
  products: [
    [1, 'Atlas', 'Books', 20],
    [2, 'Novel', 'Books', 12],
    [3, 'Dice', 'Games', 5],
    [4, 'Pan', 'Kitchen', 35],
    [5, 'Hose', 'Garden', 18],
  ],
  orders: [
    [1, 1, '2024-03-02', 'paid'],
    [2, 1, '2024-03-04', 'paid'],
    [3, 2, '2024-03-09', 'cancelled'],
    [4, 3, '2024-03-10', 'paid'],
    [5, 3, '2024-03-10', 'paid'],
    [6, null, '2024-03-11', 'paid'],
    [7, 5, '2024-04-01', 'paid'],
    [8, 1, '2024-04-20', 'cancelled'],
    [9, 1, '2024-04-21', 'paid'],
    [10, 1, '2024-04-21', 'paid'],
  ],
  order_items: [
    [1, 1, 1, 20],
    [1, 3, 2, 5],
    [2, 2, 1, 12],
    [3, 5, 1, 18],
    [3, 2, 1, 12],
    [4, 1, 2, 18],
    [4, 2, 1, 12],
    [5, 3, 4, 5],
    [5, 3, 1, 5],
    [6, 3, 1, 5],
    [7, 4, 2, 30],
    [7, 2, 3, 12],
    [8, 1, 1, 20],
    [8, 4, 1, 35],
    [9, 3, 2, 5],
    [10, 2, 1, 12],
  ],
};

/** Hire dates on the boundaries: New Year's Day, the day before, a leap day. */
const COMPANY_DATES: Data = {
  departments: [
    [1, 'Core'],
    [2, 'Ops'],
  ],
  employees: [
    [1, 'Ada', 2, null, 5000, '2021-01-01'],
    [2, 'Bo', null, 1, 4000, '2022-03-03'],
    [3, 'Cy', 1, null, 6000, '2018-01-02'],
    [4, 'Di', 2, 1, 4500, '2020-12-31'],
    [5, 'Ed', 1, 3, 5000, '2024-02-29'],
    [6, 'Flo', 2, 1, 5000, '2020-01-01'],
  ],
};

/** Shared top scores, a course nobody sat. */
const SCHOOL_TIES: Data = {
  courses: [
    [1, 'Art'],
    [2, 'Math'],
    [3, 'Music'],
  ],
  enrollments: [
    [1, 1, 95],
    [2, 1, 95],
    [3, 1, 80],
    [1, 2, null],
    [2, 2, 70],
    [3, 3, null],
  ],
};

export const MORE_PROBLEMS: SqlProblem[] = [
  {
    id: 'sql-21',
    group: 'basics',
    difficulty: '简单',
    title: { zh: '部门 1 以外的新员工', en: 'New Hires Outside Department 1' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '找出 2021-01-01 当天及以后入职、并且不在部门 1 的员工。没有部门（`department_id` 为 NULL）的员工也算「不在部门 1」。',
      en: 'Find the employees hired on or after 2021-01-01 who are not in department 1. Employees without a department (`department_id` is NULL) count as not in department 1.',
    },
    columns: [
      ['id', '员工编号', 'employee id'],
      ['name', '员工姓名', 'employee name'],
      ['hire_date', '入职日期', 'hire date'],
    ],
    explanation: {
      zh: '2021 年及以后入职的有 Dan、Finn、Gia、Hugo、Iris、Jack。Dan 在部门 1，排除；Iris 没有部门，也算不在部门 1。',
      en: 'Dan, Finn, Gia, Hugo, Iris and Jack were hired in 2021 or later. Dan is in department 1 and is left out; Iris has no department, which counts as not in department 1.',
    },
    hints: {
      zh: ['`NULL <> 1` 的结果是 NULL，不是真：要单独写 `department_id IS NULL`。', "日期是 'YYYY-MM-DD' 文本，可以直接比较大小；「当天及以后」用 `>=`。"],
      en: ['`NULL <> 1` is NULL, not true: test `department_id IS NULL` separately.', "Dates are 'YYYY-MM-DD' text and compare directly; \"on or after\" is `>=`."],
    },
    reference: `SELECT id, name, hire_date
FROM employees
WHERE hire_date >= '2021-01-01'
  AND (department_id IS NULL OR department_id <> 1);`,
    accepted: [
      "SELECT id, name, hire_date FROM employees WHERE hire_date >= '2021-01-01' AND department_id IS NOT 1;",
      "SELECT id, name, hire_date FROM employees WHERE hire_date >= '2021-01-01' AND COALESCE(department_id, 0) <> 1;",
    ],
    wrong: [
      "SELECT id, name, hire_date FROM employees WHERE hire_date >= '2021-01-01' AND department_id <> 1;",
      "SELECT id, name, hire_date FROM employees WHERE hire_date > '2021-01-01' AND (department_id IS NULL OR department_id <> 1);",
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY_DATES, COMPANY.ties],
  },
  {
    id: 'sql-22',
    group: 'basics',
    difficulty: '简单',
    title: { zh: '价格区间内的商品', en: 'Products in a Price Range' },
    schema: 'shop',
    tables: ['products'],
    ordered: true,
    task: {
      zh: '列出标价在 25 到 60 之间（含 25 和 60）的商品，按价格从高到低排序，价格相同时按商品名升序。',
      en: 'List the products with a list price from 25 to 60 inclusive, most expensive first, breaking ties by product name ascending.',
    },
    columns: [
      ['name', '商品名', 'product name'],
      ['category', '类目', 'category'],
      ['price', '标价', 'list price'],
    ],
    explanation: {
      zh: 'Chef Knife 标价 80，超出范围；Puzzle Box 正好 25，BETWEEN 两端都包含。',
      en: 'Chef Knife costs 80 and is out of range; Puzzle Box costs exactly 25, and BETWEEN includes both ends.',
    },
    hints: {
      zh: ['`x BETWEEN a AND b` 等于 `x >= a AND x <= b`。', '本题比较行的顺序：价格相同的商品也要按名字排好。'],
      en: ['`x BETWEEN a AND b` means `x >= a AND x <= b`.', 'Row order is compared here: products with the same price must be sorted by name too.'],
    },
    reference: `SELECT name, category, price
FROM products
WHERE price BETWEEN 25 AND 60
ORDER BY price DESC, name;`,
    accepted: ['SELECT name, category, price FROM products WHERE price >= 25 AND price <= 60 ORDER BY 3 DESC, 1 ASC;'],
    wrong: [
      'SELECT name, category, price FROM products WHERE price > 25 AND price < 60 ORDER BY price DESC, name;',
      'SELECT name, category, price FROM products WHERE price BETWEEN 25 AND 60 ORDER BY price DESC, name DESC;',
      'SELECT name, category, price FROM products WHERE price BETWEEN 25 AND 60 ORDER BY price, name;',
    ],
    sample: { products: SHOP.sample.products },
    hidden: [
      {
        products: [
          [1, 'Mug', 'Kitchen', 25],
          [2, 'Atlas', 'Books', 40],
          [3, 'Dice', 'Games', 25],
          [4, 'Cup', 'Kitchen', 61],
          [5, 'Book', 'Books', 60],
          [6, 'Pen', 'Office', 24],
        ],
      },
      SHOP.edges,
    ],
  },
  {
    id: 'sql-23',
    group: 'basics',
    difficulty: '简单',
    title: { zh: '工资分档', en: 'Salary Bands' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: "给每位员工标上工资档：9000 及以上为 `'high'`，5000 到 8999 为 `'mid'`，5000 以下为 `'low'`。",
      en: "Label every employee with a pay band: `'high'` for 9000 or more, `'mid'` for 5000 to 8999, and `'low'` below 5000.",
    },
    columns: [
      ['name', '员工姓名', 'employee name'],
      ['salary', '工资', 'salary'],
      ['band', "工资档：'high'、'mid' 或 'low'", "band: 'high', 'mid' or 'low'"],
    ],
    explanation: {
      zh: 'Ben 和 Chloe 正好 9000，属于 high；Hugo 正好 5000，属于 mid；Iris 4500 是 low。',
      en: 'Ben and Chloe earn exactly 9000, which is high; Hugo earns exactly 5000, which is mid; Iris at 4500 is low.',
    },
    hints: {
      zh: ['`CASE WHEN … THEN … WHEN … THEN … ELSE … END` 从上往下取第一个成立的分支，条件的先后顺序很重要。'],
      en: ['`CASE WHEN … THEN … WHEN … THEN … ELSE … END` takes the first branch that holds, so the order of the conditions matters.'],
    },
    reference: `SELECT name, salary,
       CASE WHEN salary >= 9000 THEN 'high'
            WHEN salary >= 5000 THEN 'mid'
            ELSE 'low' END AS band
FROM employees;`,
    accepted: [
      "SELECT name, salary, CASE WHEN salary < 5000 THEN 'low' WHEN salary < 9000 THEN 'mid' ELSE 'high' END FROM employees;",
    ],
    wrong: [
      "SELECT name, salary, CASE WHEN salary > 9000 THEN 'high' WHEN salary >= 5000 THEN 'mid' ELSE 'low' END FROM employees;",
      "SELECT name, salary, CASE WHEN salary >= 5000 THEN 'mid' WHEN salary >= 9000 THEN 'high' ELSE 'low' END FROM employees;",
      "SELECT name, salary, CASE WHEN salary >= 9000 THEN 'high' WHEN salary > 5000 THEN 'mid' ELSE 'low' END FROM employees;",
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.flat],
  },
  {
    id: 'sql-24',
    group: 'joins',
    difficulty: '简单',
    title: { zh: '买过图书的客户', en: 'Book Buyers' },
    schema: 'shop',
    tables: ['customers', 'products', 'orders', 'order_items'],
    task: {
      zh: "找出在已支付订单中买过 `'Books'` 类目商品的客户，每位客户只输出一次。",
      en: "Find the customers who bought a product in the `'Books'` category in a paid order, each customer once.",
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
    ],
    explanation: {
      zh: 'Alice（订单 1）、Cara（订单 4 和 8）、Elle（订单 7）买过图书，Cara 只输出一次；订单 6 是游客订单，没有客户。',
      en: 'Alice (order 1), Cara (orders 4 and 8) and Elle (order 7) bought books, and Cara is listed once; order 6 is a guest order with no customer.',
    },
    hints: {
      zh: ['客户、订单、明细、商品四张表连起来；同一位客户买过多次就会有多行，用 `DISTINCT` 去重，或者改写成 `EXISTS`。'],
      en: ['Join customers, orders, items and products; a customer who bought books twice gives two rows, so use `DISTINCT` or rewrite it with `EXISTS`.'],
    },
    reference: `SELECT DISTINCT c.id, c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
JOIN products p ON p.id = i.product_id
WHERE o.status = 'paid' AND p.category = 'Books';`,
    accepted: [
      `SELECT c.id, c.name FROM customers c WHERE EXISTS (
  SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
  WHERE o.customer_id = c.id AND o.status = 'paid' AND p.category = 'Books');`,
    ],
    wrong: [
      `SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id
JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' AND p.category = 'Books';`,
      `SELECT DISTINCT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id
JOIN products p ON p.id = i.product_id WHERE p.category = 'Books';`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-25',
    group: 'joins',
    difficulty: '简单',
    title: { zh: '员工与上级', en: 'Employees and Their Managers' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '列出每一位员工和其直属上级的姓名。没有上级（`manager_id` 为 NULL）或上级编号指向不存在的员工时，上级姓名为 NULL。',
      en: "List every employee with their direct manager's name. The manager's name is NULL when `manager_id` is NULL or points to an employee who does not exist.",
    },
    columns: [
      ['employee', '员工姓名', 'employee name'],
      ['manager', '上级姓名，或 NULL', "manager's name, or NULL"],
    ],
    explanation: {
      zh: 'Ava 和 Eve 没有上级，Hugo 的上级编号 42 不存在，这三行的上级都是 NULL；其余 7 人都能找到上级，一共 10 行。',
      en: "Ava and Eve have no manager and Hugo's manager id 42 does not exist, so those three rows have a NULL manager; the other 7 have one, 10 rows in all.",
    },
    hints: {
      zh: ['自连接用 `LEFT JOIN`，找不到上级的员工才不会丢。', '连接条件是「上级的 id 等于员工的 manager_id」，方向别写反。'],
      en: ['Use a `LEFT JOIN` for the self-join so employees without a manager stay.', "The condition is the manager's id equals the employee's manager_id; mind the direction."],
    },
    reference: `SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;`,
    accepted: ['SELECT e.name, (SELECT m.name FROM employees m WHERE m.id = e.manager_id) FROM employees e;'],
    wrong: [
      'SELECT e.name, m.name FROM employees e JOIN employees m ON m.id = e.manager_id;',
      'SELECT e.name, m.name FROM employees e LEFT JOIN employees m ON e.id = m.manager_id;',
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-26',
    group: 'joins',
    difficulty: '中等',
    title: { zh: '没卖出去的商品', en: 'Products Never Sold' },
    schema: 'shop',
    tables: ['products', 'orders', 'order_items'],
    task: {
      zh: '找出从未在任何已支付订单中卖出过的商品。只出现在已取消订单里的商品也算没卖出去。',
      en: 'Find the products never sold in a paid order. A product that appears only in cancelled orders was never sold.',
    },
    columns: [
      ['id', '商品编号', 'product id'],
      ['name', '商品名', 'product name'],
    ],
    explanation: {
      zh: 'Tea Set 从未出现在任何订单里。Puzzle Box 和 Chef Knife 虽然在已取消的订单 3、9 里出现过，但也在已支付订单里卖出过，不输出。',
      en: 'Tea Set never appears in any order. Puzzle Box and Chef Knife appear in the cancelled orders 3 and 9, but were also sold in paid orders, so they are not listed.',
    },
    hints: {
      zh: ['`NOT EXISTS (子查询)`：子查询里把明细和订单连起来，并限定 `status = \'paid\'`。', '如果用 LEFT JOIN，订单状态的条件要放进被连接的子查询里，放在 WHERE 会把它变回内连接。'],
      en: ["`NOT EXISTS (subquery)`: join items to orders inside it and require `status = 'paid'`.", 'With a LEFT JOIN, put the status condition inside the joined subquery; in WHERE it turns back into an inner join.'],
    },
    reference: `SELECT p.id, p.name
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM order_items i
  JOIN orders o ON o.id = i.order_id
  WHERE i.product_id = p.id AND o.status = 'paid'
);`,
    accepted: [
      `SELECT p.id, p.name FROM products p LEFT JOIN (
  SELECT i.product_id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status = 'paid'
) s ON s.product_id = p.id WHERE s.product_id IS NULL;`,
    ],
    wrong: [
      'SELECT id, name FROM products WHERE id NOT IN (SELECT product_id FROM order_items);',
      `SELECT DISTINCT p.id, p.name FROM products p LEFT JOIN order_items i ON i.product_id = p.id LEFT JOIN orders o ON o.id = i.order_id
WHERE o.status <> 'paid' OR i.order_id IS NULL;`,
    ],
    sample: { ...SHOP.sample, products: [...SHOP.sample.products, [6, 'Tea Set', 'Kitchen', 40]] },
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-27',
    group: 'joins',
    difficulty: '中等',
    title: { zh: '选课成绩矩阵', en: 'Score Grid' },
    schema: 'school',
    tables: ['courses', 'enrollments'],
    task: {
      zh: "`enrollments` 里出现过的每位学生，和每一门课程都配成一行：选了课且参加了考试为 `'sat'`，选了课但缺考为 `'absent'`，没选这门课为 `'not enrolled'`。同时给出分数（后两种情况为 NULL）。",
      en: "Pair every student who appears in `enrollments` with every course, one row each: `'sat'` if they enrolled and sat the exam, `'absent'` if they enrolled but missed it, and `'not enrolled'` otherwise. Include the score (NULL in the last two cases).",
    },
    columns: [
      ['student_id', '学生编号', 'student id'],
      ['title', '课程名', 'course title'],
      ['status', "'sat'、'absent' 或 'not enrolled'", "'sat', 'absent' or 'not enrolled'"],
      ['score', '分数或 NULL', 'score or NULL'],
    ],
    explanation: {
      zh: '4 名学生 × 4 门课共 16 行。学生 1 考了 Algebra 和 Biology，Chemistry、Drama 没选；学生 3 选了 Algebra 但缺考，是 absent。两种 NULL 分数要靠「有没有匹配到选课记录」来区分。',
      en: 'Four students times four courses make 16 rows. Student 1 sat Algebra and Biology and did not take Chemistry or Drama; student 3 enrolled in Algebra but missed it, so absent. The two kinds of NULL score differ in whether an enrollment row matched.',
    },
    hints: {
      zh: ['先 `CROSS JOIN` 出所有 (学生, 课程) 组合，再 `LEFT JOIN enrollments`。', '判断「没选课」看的是 `e.student_id IS NULL`，不是 `e.score IS NULL`。'],
      en: ['`CROSS JOIN` all (student, course) pairs first, then `LEFT JOIN enrollments`.', 'Test "not enrolled" with `e.student_id IS NULL`, not `e.score IS NULL`.'],
    },
    reference: `WITH students AS (SELECT DISTINCT student_id FROM enrollments)
SELECT s.student_id, c.title,
       CASE WHEN e.student_id IS NULL THEN 'not enrolled'
            WHEN e.score IS NULL THEN 'absent'
            ELSE 'sat' END AS status,
       e.score
FROM students s
CROSS JOIN courses c
LEFT JOIN enrollments e ON e.student_id = s.student_id AND e.course_id = c.id;`,
    wrong: [
      `SELECT e.student_id, c.title, CASE WHEN e.score IS NULL THEN 'absent' ELSE 'sat' END, e.score
FROM enrollments e JOIN courses c ON c.id = e.course_id;`,
      `WITH s AS (SELECT DISTINCT student_id FROM enrollments)
SELECT s.student_id, c.title, CASE WHEN e.score IS NULL THEN 'not enrolled' ELSE 'sat' END, e.score
FROM s CROSS JOIN courses c LEFT JOIN enrollments e ON e.student_id = s.student_id AND e.course_id = c.id;`,
      `WITH s AS (SELECT DISTINCT student_id FROM enrollments)
SELECT s.student_id, c.title, CASE WHEN e.student_id IS NULL THEN 'not enrolled' WHEN e.score IS NULL THEN 'absent' ELSE 'sat' END, e.score
FROM s CROSS JOIN courses c LEFT JOIN enrollments e ON e.course_id = c.id WHERE e.student_id = s.student_id;`,
    ],
    sample: SCHOOL.sample,
    hidden: [SCHOOL.rounding, SCHOOL_TIES],
  },
  {
    id: 'sql-28',
    group: 'grouping',
    difficulty: '中等',
    title: { zh: '平均客单价', en: 'Average Order Value' },
    schema: 'shop',
    tables: ['customers', 'orders', 'order_items'],
    task: {
      zh: '一笔订单的金额是其明细 `quantity * unit_price` 之和。对每位有已支付订单的客户，求已支付订单数和这些订单的平均金额（`ROUND(x, 2)`）。只统计至少包含一件商品的订单，游客订单不算。',
      en: 'An order is worth the sum of `quantity * unit_price` over its items. For each customer with paid orders, give the number of paid orders and their average value (`ROUND(x, 2)`). Count only orders with at least one item; guest orders are left out.',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
      ['orders', '已支付订单数', 'paid orders'],
      ['avg_order_value', '平均订单金额', 'average order value'],
    ],
    explanation: {
      zh: 'Alice 的三笔已支付订单是 115、80、180，平均 125；Cara 是 115 和 300，平均 207.5；Elle 只有 255。按明细行求平均会得到别的数。',
      en: "Alice's three paid orders are worth 115, 80 and 180, averaging 125; Cara's are 115 and 300, averaging 207.5; Elle has one of 255. Averaging the item rows gives other numbers.",
    },
    hints: {
      zh: ['先按订单聚合出每笔订单的金额，再按客户求平均：两层 GROUP BY。', '或者用 总金额 ÷ `COUNT(DISTINCT o.id)`，别忘了先乘 `1.0`。'],
      en: ['Aggregate each order to its value first, then average per customer: two levels of GROUP BY.', 'Or divide the total by `COUNT(DISTINCT o.id)`, multiplying by `1.0` first.'],
    },
    reference: `WITH totals AS (
  SELECT o.id, o.customer_id, SUM(i.quantity * i.unit_price) AS total
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid' AND o.customer_id IS NOT NULL
  GROUP BY o.id
)
SELECT c.id, c.name, COUNT(*) AS orders, ROUND(AVG(t.total), 2) AS avg_order_value
FROM totals t
JOIN customers c ON c.id = t.customer_id
GROUP BY c.id, c.name;`,
    accepted: [
      `SELECT c.id, c.name, COUNT(DISTINCT o.id), ROUND(1.0 * SUM(i.quantity * i.unit_price) / COUNT(DISTINCT o.id), 2)
FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY c.id;`,
    ],
    wrong: [
      `SELECT c.id, c.name, COUNT(DISTINCT o.id), ROUND(AVG(i.quantity * i.unit_price), 2)
FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY c.id;`,
      `SELECT c.id, c.name, COUNT(DISTINCT o.id), SUM(i.quantity * i.unit_price) / COUNT(DISTINCT o.id)
FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY c.id;`,
      `SELECT c.id, c.name, COUNT(DISTINCT o.id), ROUND(1.0 * SUM(i.quantity * i.unit_price) / COUNT(DISTINCT o.id), 2)
FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id GROUP BY c.id;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-29',
    group: 'grouping',
    difficulty: '简单',
    title: { zh: '多种商品的订单', en: 'Orders With Several Products' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    task: {
      zh: '找出包含至少 2 种不同商品的已支付订单，给出商品种数和总件数（`quantity` 之和）。同一种商品可能在一笔订单里出现在多行明细中。',
      en: 'Find the paid orders with at least 2 different products, with the number of different products and the total units (the sum of `quantity`). The same product may appear on several item rows of one order.',
    },
    columns: [
      ['order_id', '订单编号', 'order id'],
      ['products', '不同商品的种数', 'number of different products'],
      ['units', '总件数', 'total units'],
    ],
    explanation: {
      zh: '订单 1、4 各有两种商品（各 3 件），订单 7 有三种（4 件）。订单 3 只有一种商品，而且已取消。',
      en: 'Orders 1 and 4 have two products each (3 units each) and order 7 has three (4 units). Order 3 has one product and was cancelled anyway.',
    },
    hints: {
      zh: ['`COUNT(DISTINCT product_id)` 数种类，`COUNT(*)` 数的是明细行。'],
      en: ['`COUNT(DISTINCT product_id)` counts products; `COUNT(*)` counts item rows.'],
    },
    reference: `SELECT o.id AS order_id, COUNT(DISTINCT i.product_id) AS products, SUM(i.quantity) AS units
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid'
GROUP BY o.id
HAVING COUNT(DISTINCT i.product_id) >= 2;`,
    wrong: [
      `SELECT o.id, COUNT(*), SUM(i.quantity) FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY o.id HAVING COUNT(*) >= 2;`,
      `SELECT o.id, COUNT(DISTINCT i.product_id), SUM(i.quantity) FROM orders o JOIN order_items i ON i.order_id = o.id
GROUP BY o.id HAVING COUNT(DISTINCT i.product_id) >= 2;`,
      `SELECT o.id, COUNT(DISTINCT i.product_id), SUM(i.quantity) FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY o.id HAVING COUNT(DISTINCT i.product_id) > 2;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.shuffled],
  },
  {
    id: 'sql-30',
    group: 'grouping',
    difficulty: '简单',
    title: { zh: '类目价格概览', en: 'Category Price Summary' },
    schema: 'shop',
    tables: ['products'],
    task: {
      zh: '对每个类目，给出商品数、最低标价、最高标价和平均标价（`ROUND(x, 1)` 保留一位小数）。',
      en: 'For each category, give the number of products and the lowest, highest and average list price (the average rounded with `ROUND(x, 1)`).',
    },
    columns: [
      ['category', '类目', 'category'],
      ['products', '商品数', 'number of products'],
      ['min_price', '最低标价', 'lowest price'],
      ['max_price', '最高标价', 'highest price'],
      ['avg_price', '平均标价', 'average price'],
    ],
    explanation: {
      zh: 'Books 有 30 和 45 两件，平均 37.5；Games 是 25 和 60，平均 42.5；Kitchen 只有 80。',
      en: 'Books has two products at 30 and 45, averaging 37.5; Games has 25 and 60, averaging 42.5; Kitchen has one at 80.',
    },
    hints: {
      zh: ['`MIN`、`MAX`、`AVG`、`COUNT` 可以写在同一个 GROUP BY 里。', '`ROUND(x)` 不写位数会取整。'],
      en: ['`MIN`, `MAX`, `AVG` and `COUNT` can share one GROUP BY.', '`ROUND(x)` without a digit count rounds to a whole number.'],
    },
    reference: `SELECT category, COUNT(*) AS products, MIN(price) AS min_price, MAX(price) AS max_price,
       ROUND(AVG(price), 1) AS avg_price
FROM products
GROUP BY category;`,
    wrong: [
      'SELECT category, COUNT(*), MIN(price), MAX(price), ROUND(AVG(price)) FROM products GROUP BY category;',
      'SELECT category, COUNT(*), MIN(price), MAX(price), SUM(price) / COUNT(*) FROM products GROUP BY category;',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP_EXTRA],
  },
  {
    id: 'sql-31',
    group: 'grouping',
    difficulty: '中等',
    title: { zh: '各课程优秀率', en: 'Share of Top Scores' },
    schema: 'school',
    tables: ['courses', 'enrollments'],
    task: {
      zh: '80 分及以上算优秀。对每门至少有一人参加考试的课程，求参加考试人数、优秀人数和优秀率（优秀人数 ÷ 参加考试人数，`ROUND(x, 2)`）。缺考（`score` 为 NULL）不算参加考试。',
      en: 'A score of 80 or more is a top score. For each course where at least one student sat the exam, give the number who sat, the number of top scores and their share (top scores divided by students who sat, `ROUND(x, 2)`). A NULL score is an absence, not a sitting.',
    },
    columns: [
      ['title', '课程名', 'course title'],
      ['sat', '参加考试人数', 'students who sat'],
      ['top', '优秀人数', 'top scores'],
      ['top_rate', '优秀率', 'share of top scores'],
    ],
    explanation: {
      zh: 'Algebra 有两人参加考试（90 和 75），一人优秀，优秀率 0.5；Biology 一人考了 88，优秀率 1。Chemistry 没人参加考试，不输出。',
      en: 'Two students sat Algebra (90 and 75) and one is a top score, a share of 0.5; one sat Biology with 88, a share of 1. Nobody sat Chemistry, so it is left out.',
    },
    hints: {
      zh: ['`SUM(score >= 80)`：比较的结果是 1 或 0，NULL 会被 SUM 跳过。', '分母用 `COUNT(score)`，它不计 NULL。'],
      en: ['`SUM(score >= 80)`: a comparison is 1 or 0, and SUM skips NULLs.', 'Divide by `COUNT(score)`, which skips NULLs.'],
    },
    reference: `SELECT c.title, COUNT(e.score) AS sat, SUM(e.score >= 80) AS top,
       ROUND(1.0 * SUM(e.score >= 80) / COUNT(e.score), 2) AS top_rate
FROM courses c
JOIN enrollments e ON e.course_id = c.id
GROUP BY c.id, c.title
HAVING COUNT(e.score) > 0;`,
    accepted: [
      `SELECT c.title, COUNT(*), SUM(CASE WHEN e.score >= 80 THEN 1 ELSE 0 END),
       ROUND(AVG(CASE WHEN e.score >= 80 THEN 1.0 ELSE 0 END), 2)
FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.score IS NOT NULL GROUP BY c.id;`,
    ],
    wrong: [
      `SELECT c.title, COUNT(e.score), SUM(e.score >= 80), ROUND(1.0 * SUM(e.score >= 80) / COUNT(*), 2)
FROM courses c JOIN enrollments e ON e.course_id = c.id GROUP BY c.id HAVING COUNT(e.score) > 0;`,
      `SELECT c.title, COUNT(e.score), SUM(e.score > 80), ROUND(1.0 * SUM(e.score > 80) / COUNT(e.score), 2)
FROM courses c JOIN enrollments e ON e.course_id = c.id GROUP BY c.id HAVING COUNT(e.score) > 0;`,
      `SELECT c.title, COUNT(e.score), SUM(e.score >= 80), SUM(e.score >= 80) / COUNT(e.score)
FROM courses c JOIN enrollments e ON e.course_id = c.id GROUP BY c.id HAVING COUNT(e.score) > 0;`,
    ],
    sample: SCHOOL.sample,
    hidden: [SCHOOL.rounding, SCHOOL.zero],
  },
  {
    id: 'sql-32',
    group: 'grouping',
    difficulty: '中等',
    title: { zh: '各城市的订单状态', en: 'Order Status by City' },
    schema: 'shop',
    tables: ['customers', 'orders'],
    task: {
      zh: "按客户所在城市统计已支付和已取消的订单数，每个城市一行；`city` 为 NULL 的客户归到 `'Unknown'`。游客订单不计入；没有订单的城市不输出。",
      en: "Count paid and cancelled orders by the customer's city, one row per city, with a NULL `city` grouped as `'Unknown'`. Guest orders are left out, and cities without orders are not listed.",
    },
    columns: [
      ['city', '城市或 Unknown', 'city or Unknown'],
      ['paid', '已支付订单数', 'paid orders'],
      ['cancelled', '已取消订单数', 'cancelled orders'],
    ],
    explanation: {
      zh: 'Austin 的 Alice 和 Cara 共有 5 笔已支付、1 笔已取消；Boston 的 Bob 和 Elle 各 1 笔。游客订单 6 不属于任何城市；Dev 城市未知但没有订单，所以没有 Unknown 这一行。',
      en: "Austin's Alice and Cara have 5 paid orders and 1 cancelled; Boston's Bob and Elle have 1 of each. Guest order 6 belongs to no city, and Dev's city is unknown but he has no orders, so there is no Unknown row.",
    },
    hints: {
      zh: ["条件聚合：`SUM(status = 'paid')` 或 `COUNT(CASE WHEN status = 'paid' THEN 1 END)`，把行转成列。", "`COUNT(x = 'paid')` 数的是非 NULL 的比较结果，0 也算一个。"],
      en: ["Conditional aggregation turns rows into columns: `SUM(status = 'paid')` or `COUNT(CASE WHEN status = 'paid' THEN 1 END)`.", "`COUNT(x = 'paid')` counts every non-NULL comparison, including the zeros."],
    },
    reference: `SELECT COALESCE(c.city, 'Unknown') AS city,
       SUM(o.status = 'paid') AS paid,
       SUM(o.status = 'cancelled') AS cancelled
FROM orders o
JOIN customers c ON c.id = o.customer_id
GROUP BY COALESCE(c.city, 'Unknown');`,
    accepted: [
      `SELECT COALESCE(c.city, 'Unknown'), COUNT(CASE WHEN o.status = 'paid' THEN 1 END), COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END)
FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.city;`,
    ],
    wrong: [
      `SELECT COALESCE(c.city, 'Unknown'), COUNT(o.status = 'paid'), COUNT(o.status = 'cancelled')
FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY COALESCE(c.city, 'Unknown');`,
      `SELECT COALESCE(c.city, 'Unknown'), SUM(o.status = 'paid'), SUM(o.status = 'cancelled')
FROM orders o LEFT JOIN customers c ON c.id = o.customer_id GROUP BY COALESCE(c.city, 'Unknown');`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP_EXTRA],
  },
  {
    id: 'sql-33',
    group: 'subqueries',
    difficulty: '简单',
    title: { zh: '高于公司平均工资', en: 'Above the Company Average' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '找出工资严格高于全公司平均工资的员工（平均值按所有员工计算，包括没有部门的人），并在每一行附上这个平均值（`ROUND(x, 2)`）。',
      en: 'Find the employees paid strictly more than the company-wide average salary (over all employees, including those without a department), and show that average on every row (`ROUND(x, 2)`).',
    },
    columns: [
      ['name', '员工姓名', 'employee name'],
      ['salary', '工资', 'salary'],
      ['company_avg', '全公司平均工资', 'company average salary'],
    ],
    explanation: {
      zh: '10 人工资总和 74500，平均 7450。Ava、Ben、Chloe、Eve、Finn 高于它。',
      en: 'The 10 salaries add up to 74500, an average of 7450. Ava, Ben, Chloe, Eve and Finn earn more.',
    },
    hints: {
      zh: ['聚合函数不能直接写在 WHERE 里；把平均值放进标量子查询 `(SELECT AVG(salary) FROM employees)`。'],
      en: ['Aggregates cannot go straight into WHERE; put the average in a scalar subquery `(SELECT AVG(salary) FROM employees)`.'],
    },
    reference: `SELECT name, salary, ROUND((SELECT AVG(salary) FROM employees), 2) AS company_avg
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);`,
    accepted: [
      `WITH a AS (SELECT AVG(salary) AS v FROM employees)
SELECT e.name, e.salary, ROUND(a.v, 2) FROM employees e CROSS JOIN a WHERE e.salary > a.v;`,
    ],
    wrong: [
      `SELECT name, salary, ROUND((SELECT AVG(salary) FROM employees), 2) FROM employees
WHERE salary >= (SELECT AVG(salary) FROM employees);`,
      `SELECT name, salary, ROUND((SELECT AVG(salary) FROM employees WHERE department_id IS NOT NULL), 2) FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees WHERE department_id IS NOT NULL);`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.flat],
  },
  {
    id: 'sql-34',
    group: 'subqueries',
    difficulty: '中等',
    title: { zh: '每门课的最高分', en: 'Top Scorers per Course' },
    schema: 'school',
    tables: ['courses', 'enrollments'],
    task: {
      zh: '对每门有人参加考试的课程，找出拿到该课最高分的学生；并列最高分的学生都要输出。',
      en: 'For each course that someone sat, find the students with its highest score; list every student tied for the top.',
    },
    columns: [
      ['title', '课程名', 'course title'],
      ['student_id', '学生编号', 'student id'],
      ['score', '最高分', 'top score'],
    ],
    explanation: {
      zh: 'Algebra 最高分是学生 1 的 90，Biology 是学生 1 的 88。Chemistry 没人参加考试，Drama 没人选，都不输出。',
      en: 'The top Algebra score is student 1’s 90 and the top Biology score is student 1’s 88. Nobody sat Chemistry and nobody took Drama, so neither is listed.',
    },
    hints: {
      zh: ['相关子查询：`score = (SELECT MAX(score) … WHERE course_id = 当前行的 course_id)`。', '`GROUP BY` 加 `MAX` 只能给出一位学生，处理不了并列。'],
      en: ["A correlated subquery: `score = (SELECT MAX(score) … WHERE course_id = the current row's course_id)`.", '`GROUP BY` with `MAX` gives one student per course and misses ties.'],
    },
    reference: `SELECT c.title, e.student_id, e.score
FROM enrollments e
JOIN courses c ON c.id = e.course_id
WHERE e.score = (SELECT MAX(x.score) FROM enrollments x WHERE x.course_id = e.course_id);`,
    accepted: [
      `SELECT title, student_id, score FROM (SELECT c.title, e.student_id, e.score,
  RANK() OVER (PARTITION BY e.course_id ORDER BY e.score DESC) AS r
  FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.score IS NOT NULL) WHERE r = 1;`,
    ],
    wrong: [
      'SELECT c.title, e.student_id, MAX(e.score) FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.score IS NOT NULL GROUP BY c.id;',
      `SELECT c.title, e.student_id, e.score FROM enrollments e JOIN courses c ON c.id = e.course_id
WHERE e.score = (SELECT MAX(score) FROM enrollments);`,
    ],
    sample: SCHOOL.sample,
    hidden: [SCHOOL_TIES, SCHOOL.rounding],
  },
  {
    id: 'sql-35',
    group: 'subqueries',
    difficulty: '困难',
    title: { zh: '比 Sales 部门所有人都挣得多', en: 'Out-earning All of Sales' },
    schema: 'company',
    tables: ['departments', 'employees'],
    task: {
      zh: "找出工资严格高于 `'Sales'` 部门每一位员工的员工（不限部门，也包括没有部门的人）。如果 Sales 部门没有员工、或者根本没有这个部门，那么「高于每一位」自然成立，所有员工都要输出。",
      en: "Find the employees (from any department, or none) paid strictly more than every employee of the `'Sales'` department. If Sales has no employees, or there is no such department, \"more than every one of them\" holds trivially and every employee is listed.",
    },
    columns: [
      ['name', '员工姓名', 'employee name'],
      ['salary', '工资', 'salary'],
    ],
    explanation: {
      zh: 'Sales 部门工资最高的是 Finn 的 8500，只有 Ava（12000）、Ben 和 Chloe（9000）比它高。',
      en: 'The top Sales salary is Finn’s 8500; only Ava (12000), Ben and Chloe (9000) earn more.',
    },
    hints: {
      zh: ['「高于所有人」等价于「不存在工资不低于我的 Sales 员工」：`NOT EXISTS`。', 'Sales 没人时 `MAX(salary)` 是 NULL，`salary > NULL` 不成立，结果会变成空。'],
      en: ['"More than everyone" means "no Sales employee earns at least as much": `NOT EXISTS`.', 'With nobody in Sales, `MAX(salary)` is NULL and `salary > NULL` is never true, so the result goes empty.'],
    },
    reference: `SELECT e.name, e.salary
FROM employees e
WHERE NOT EXISTS (
  SELECT 1 FROM employees s
  JOIN departments d ON d.id = s.department_id
  WHERE d.name = 'Sales' AND s.salary >= e.salary
);`,
    accepted: [
      `SELECT e.name, e.salary FROM employees e WHERE e.salary > (
  SELECT COALESCE(MAX(s.salary), -1) FROM employees s JOIN departments d ON d.id = s.department_id WHERE d.name = 'Sales');`,
    ],
    wrong: [
      `SELECT e.name, e.salary FROM employees e WHERE e.salary > (
  SELECT MAX(s.salary) FROM employees s JOIN departments d ON d.id = s.department_id WHERE d.name = 'Sales');`,
      `SELECT e.name, e.salary FROM employees e WHERE e.salary > (
  SELECT MIN(s.salary) FROM employees s JOIN departments d ON d.id = s.department_id WHERE d.name = 'Sales');`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.flat],
  },
  {
    id: 'sql-36',
    group: 'subqueries',
    difficulty: '中等',
    title: { zh: '从未取消过订单的客户', en: 'Never Cancelled' },
    schema: 'shop',
    tables: ['customers', 'orders'],
    task: {
      zh: '找出下过订单、并且没有任何一笔订单被取消的客户。',
      en: 'Find the customers who have placed orders and never had one cancelled.',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
    ],
    explanation: {
      zh: 'Cara 和 Elle 的订单都已支付。Alice 有一笔已取消的订单 9，Bob 只有已取消的订单；Dev 和 Femi 没下过单，也不算。',
      en: 'All of Cara’s and Elle’s orders were paid. Alice had order 9 cancelled and Bob only has a cancelled order; Dev and Femi never ordered, so they do not count either.',
    },
    hints: {
      zh: ['两个条件：`EXISTS` 有订单，`NOT EXISTS` 有取消的订单。', '也可以用 `EXCEPT`，或者 `GROUP BY` 后 `HAVING SUM(status = \'cancelled\') = 0`。'],
      en: ["Two conditions: `EXISTS` an order and `NOT EXISTS` a cancelled one.", "`EXCEPT` works too, or `GROUP BY` with `HAVING SUM(status = 'cancelled') = 0`."],
    },
    reference: `SELECT c.id, c.name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'cancelled');`,
    accepted: [
      `SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id
EXCEPT
SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status = 'cancelled';`,
      `SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING SUM(o.status = 'cancelled') = 0;`,
    ],
    wrong: [
      "SELECT DISTINCT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid';",
      "SELECT c.id, c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'cancelled');",
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-37',
    group: 'subqueries',
    difficulty: '中等',
    title: { zh: '买过最贵商品的客户', en: 'Buyers of the Priciest Product' },
    schema: 'shop',
    tables: ['customers', 'products', 'orders', 'order_items'],
    task: {
      zh: '「最贵」按商品标价 `products.price` 算，标价最高的商品可能不止一件。找出在已支付订单里买过这样的商品的客户，每位只输出一次。成交价打了折也算买过。',
      en: 'The priciest products are those with the highest list price `products.price`; there may be several. Find the customers who bought one in a paid order, each once. A discounted sale still counts.',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['name', '客户姓名', 'customer name'],
    ],
    explanation: {
      zh: 'Chef Knife 标价 80，最高。Alice 在订单 2 里买了它，Elle 在订单 7 里以折扣价 75 买到，也算；订单 9 已取消。',
      en: 'Chef Knife has the top list price, 80. Alice bought it in order 2 and Elle in order 7 at a discounted 75, which still counts; order 9 was cancelled.',
    },
    hints: {
      zh: ['`WHERE p.price = (SELECT MAX(price) FROM products)`：用标价，不用明细里的成交价。'],
      en: ['`WHERE p.price = (SELECT MAX(price) FROM products)`: the list price, not the price charged on the item.'],
    },
    reference: `SELECT DISTINCT c.id, c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
JOIN order_items i ON i.order_id = o.id
JOIN products p ON p.id = i.product_id
WHERE p.price = (SELECT MAX(price) FROM products);`,
    wrong: [
      `SELECT DISTINCT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
JOIN order_items i ON i.order_id = o.id WHERE i.unit_price = (SELECT MAX(unit_price) FROM order_items);`,
      `SELECT DISTINCT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
WHERE p.price = (SELECT MAX(price) FROM products);`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-38',
    group: 'windows',
    difficulty: '中等',
    title: { zh: '部门内工资排名', en: 'Pay Rank Within Department' },
    schema: 'company',
    tables: ['departments', 'employees'],
    task: {
      zh: '给每位有部门的员工排出部门内的工资名次：工资最高为第 1 名，工资相同名次相同，后面的名次跳过并列占用的位置（1、2、2、4）。',
      en: 'Rank every employee with a department by salary within it: the highest is 1, equal salaries share a rank, and the next rank skips the places the tie used (1, 2, 2, 4).',
    },
    columns: [
      ['department', '部门名', 'department name'],
      ['employee', '员工姓名', 'employee name'],
      ['salary', '工资', 'salary'],
      ['pay_rank', '部门内名次', 'rank within the department'],
    ],
    explanation: {
      zh: 'Engineering 里 Ava 第 1，Ben 和 Chloe 并列第 2，下一位 Dan 是第 4 名，不是第 3。Iris 没有部门，不参与。',
      en: 'In Engineering Ava is 1, Ben and Chloe share 2, and Dan comes next at 4, not 3. Iris has no department and is not ranked.',
    },
    hints: {
      zh: ['`RANK()` 并列后跳号，`DENSE_RANK()` 不跳，`ROW_NUMBER()` 不管并列。', '`PARTITION BY department_id` 让每个部门各排各的。'],
      en: ['`RANK()` skips after ties, `DENSE_RANK()` does not, and `ROW_NUMBER()` ignores ties.', '`PARTITION BY department_id` ranks each department separately.'],
    },
    reference: `SELECT d.name AS department, e.name AS employee, e.salary,
       RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS pay_rank
FROM employees e
JOIN departments d ON d.id = e.department_id;`,
    accepted: [
      `SELECT d.name, e.name, e.salary,
  1 + (SELECT COUNT(*) FROM employees x WHERE x.department_id = e.department_id AND x.salary > e.salary)
FROM employees e JOIN departments d ON d.id = e.department_id;`,
    ],
    wrong: [
      `SELECT d.name, e.name, e.salary, DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC)
FROM employees e JOIN departments d ON d.id = e.department_id;`,
      `SELECT d.name, e.name, e.salary, ROW_NUMBER() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC, e.id)
FROM employees e JOIN departments d ON d.id = e.department_id;`,
      `SELECT d.name, e.name, e.salary, RANK() OVER (ORDER BY e.salary DESC)
FROM employees e JOIN departments d ON d.id = e.department_id;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-39',
    group: 'windows',
    difficulty: '中等',
    title: { zh: '两次下单的间隔', en: 'Days Between Orders' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '对每位客户的每笔已支付订单，求它距离该客户上一笔已支付订单过了几天（订单按日期、再按 `id` 排先后）；客户的第一笔为 NULL。游客订单不参与。',
      en: "For every paid order of a registered customer, give the days since that customer's previous paid order (orders run by date, then `id`); the customer's first order gets NULL. Guest orders are left out.",
    },
    columns: [
      ['customer_id', '客户编号', 'customer id'],
      ['order_id', '订单编号', 'order id'],
      ['order_date', '订单日期', 'order date'],
      ['gap_days', '距上一笔已支付订单的天数', 'days since the previous paid order'],
    ],
    explanation: {
      zh: 'Alice 的已支付订单在 1 月 5 日、1 月 20 日、2 月 14 日，间隔 NULL、15、25；她 3 月 9 日的订单 9 已取消，不参与。Cara 两笔间隔 28 天。',
      en: "Alice's paid orders fall on January 5, January 20 and February 14: gaps of NULL, 15 and 25; her March 9 order 9 was cancelled and is left out. Cara's two orders are 28 days apart.",
    },
    hints: {
      zh: ['`LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, id)` 取同一客户的上一笔。', '`julianday(a) - julianday(b)` 是两个日期相差的天数。'],
      en: ["`LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, id)` reads the same customer's previous order.", '`julianday(a) - julianday(b)` is the number of days between two dates.'],
    },
    reference: `SELECT customer_id, id AS order_id, order_date,
       julianday(order_date)
         - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, id)) AS gap_days
FROM orders
WHERE status = 'paid' AND customer_id IS NOT NULL;`,
    accepted: [
      `SELECT o.customer_id, o.id, o.order_date, julianday(o.order_date) - julianday((
  SELECT p.order_date FROM orders p WHERE p.customer_id = o.customer_id AND p.status = 'paid'
  AND (p.order_date < o.order_date OR (p.order_date = o.order_date AND p.id < o.id))
  ORDER BY p.order_date DESC, p.id DESC LIMIT 1))
FROM orders o WHERE o.status = 'paid' AND o.customer_id IS NOT NULL;`,
    ],
    wrong: [
      `SELECT customer_id, id, order_date, julianday(order_date) - julianday(LAG(order_date) OVER (ORDER BY order_date, id))
FROM orders WHERE status = 'paid' AND customer_id IS NOT NULL;`,
      `SELECT customer_id, id, order_date, julianday(order_date) - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY id))
FROM orders WHERE status = 'paid' AND customer_id IS NOT NULL;`,
      `SELECT customer_id, id, order_date, julianday(order_date) - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, id))
FROM orders WHERE customer_id IS NOT NULL;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.shuffled, SHOP_EXTRA],
  },
  {
    id: 'sql-40',
    group: 'windows',
    difficulty: '中等',
    title: { zh: '商品占类目销售额的比例', en: 'Share of Category Revenue' },
    schema: 'shop',
    tables: ['products', 'orders', 'order_items'],
    task: {
      zh: '对每件在已支付订单中卖出过的商品，求它的销售额（`quantity * unit_price` 之和）以及占所在类目销售额的比例（`ROUND(x, 2)`）。',
      en: 'For each product sold in paid orders, give its revenue (the sum of `quantity * unit_price`) and its share of its category’s revenue (`ROUND(x, 2)`).',
    },
    columns: [
      ['category', '类目', 'category'],
      ['product', '商品名', 'product name'],
      ['revenue', '商品销售额', 'product revenue'],
      ['share', '占类目销售额的比例', 'share of the category revenue'],
    ],
    explanation: {
      zh: 'Books 共 525：SQL Basics 390（0.74），Graph Theory 135（0.26）。Games 共 320：Chess Set 295（0.92），Puzzle Box 25（0.08）。Kitchen 只有 Chef Knife，占 1。',
      en: 'Books makes 525: SQL Basics 390 (0.74) and Graph Theory 135 (0.26). Games makes 320: Chess Set 295 (0.92) and Puzzle Box 25 (0.08). Kitchen only has Chef Knife, a share of 1.',
    },
    hints: {
      zh: ['先按商品聚合出销售额，再用 `SUM(revenue) OVER (PARTITION BY category)` 求类目合计：窗口函数不会把行合并。'],
      en: ['Aggregate to one revenue per product first, then `SUM(revenue) OVER (PARTITION BY category)` gives the category total without collapsing rows.'],
    },
    reference: `SELECT category, product, revenue,
       ROUND(1.0 * revenue / SUM(revenue) OVER (PARTITION BY category), 2) AS share
FROM (
  SELECT p.category, p.name AS product, SUM(i.quantity * i.unit_price) AS revenue
  FROM order_items i
  JOIN orders o ON o.id = i.order_id
  JOIN products p ON p.id = i.product_id
  WHERE o.status = 'paid'
  GROUP BY p.id, p.category, p.name
);`,
    accepted: [
      `WITH r AS (SELECT p.category, p.name, SUM(i.quantity * i.unit_price) AS revenue FROM order_items i
  JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY p.id)
SELECT a.category, a.name, a.revenue, ROUND(1.0 * a.revenue / (SELECT SUM(b.revenue) FROM r b WHERE b.category = a.category), 2) FROM r a;`,
    ],
    wrong: [
      `SELECT category, product, revenue, ROUND(1.0 * revenue / SUM(revenue) OVER (), 2) FROM (
  SELECT p.category, p.name AS product, SUM(i.quantity * i.unit_price) AS revenue FROM order_items i
  JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY p.id);`,
      `SELECT category, product, revenue, revenue / SUM(revenue) OVER (PARTITION BY category) FROM (
  SELECT p.category, p.name AS product, SUM(i.quantity * i.unit_price) AS revenue FROM order_items i
  JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id WHERE o.status = 'paid' GROUP BY p.id);`,
      `SELECT category, product, revenue, ROUND(1.0 * revenue / SUM(revenue) OVER (PARTITION BY category), 2) FROM (
  SELECT p.category, p.name AS product, SUM(i.quantity * i.unit_price) AS revenue FROM order_items i
  JOIN products p ON p.id = i.product_id GROUP BY p.id);`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-41',
    group: 'windows',
    difficulty: '困难',
    title: { zh: '最近三单的移动平均', en: 'Three-Order Moving Average' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    task: {
      zh: '订单金额是其明细 `quantity * unit_price` 之和。对每位客户的每笔已支付订单（至少一件商品，游客订单除外），求这笔和该客户之前最多两笔已支付订单的平均金额（订单按日期、再按 `id` 排先后，`ROUND(x, 2)`）。',
      en: "An order is worth the sum of `quantity * unit_price` over its items. For every paid order of a registered customer (with at least one item), average its value with up to two of that customer's previous paid orders (orders run by date, then `id`; `ROUND(x, 2)`).",
    },
    columns: [
      ['customer_id', '客户编号', 'customer id'],
      ['order_id', '订单编号', 'order id'],
      ['total', '订单金额', 'order value'],
      ['moving_avg', '最近三单的平均金额', 'average of the last three orders'],
    ],
    explanation: {
      zh: 'Alice 的已支付订单依次是 115、80、180：移动平均是 115、97.5、125。Cara 是 115、300：115、207.5。',
      en: "Alice's paid orders are worth 115, 80 and 180 in turn, so the moving averages are 115, 97.5 and 125. Cara's are 115 and 300: 115 and 207.5.",
    },
    hints: {
      zh: ['先按订单聚合出金额，再用 `AVG(total) OVER (PARTITION BY customer_id ORDER BY order_date, id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`。', '不写 ROWS 子句时，窗口默认从第一行累计到当前行。'],
      en: ['Aggregate each order’s value first, then `AVG(total) OVER (PARTITION BY customer_id ORDER BY order_date, id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`.', 'Without a ROWS clause the window runs from the first row to the current one.'],
    },
    reference: `WITH totals AS (
  SELECT o.id, o.customer_id, o.order_date, SUM(i.quantity * i.unit_price) AS total
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid' AND o.customer_id IS NOT NULL
  GROUP BY o.id
)
SELECT customer_id, id AS order_id, total,
       ROUND(AVG(total) OVER (
         PARTITION BY customer_id ORDER BY order_date, id
         ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ), 2) AS moving_avg
FROM totals;`,
    wrong: [
      `WITH t AS (SELECT o.id, o.customer_id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o
  JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' AND o.customer_id IS NOT NULL GROUP BY o.id)
SELECT customer_id, id, total, ROUND(AVG(total) OVER (PARTITION BY customer_id ORDER BY order_date, id), 2) FROM t;`,
      `WITH t AS (SELECT o.id, o.customer_id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o
  JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' AND o.customer_id IS NOT NULL GROUP BY o.id)
SELECT customer_id, id, total, ROUND(AVG(total) OVER (PARTITION BY customer_id ORDER BY order_date, id ROWS BETWEEN 3 PRECEDING AND CURRENT ROW), 2) FROM t;`,
      `WITH t AS (SELECT o.id, o.customer_id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o
  JOIN order_items i ON i.order_id = o.id WHERE o.status = 'paid' AND o.customer_id IS NOT NULL GROUP BY o.id)
SELECT customer_id, id, total, ROUND(AVG(total) OVER (ORDER BY order_date, id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) FROM t;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.edges],
  },
  {
    id: 'sql-42',
    group: 'windows',
    difficulty: '困难',
    title: { zh: '部门工资中位数', en: 'Median Salary per Department' },
    schema: 'company',
    tables: ['departments', 'employees'],
    task: {
      zh: '求每个有员工的部门的工资中位数：人数为奇数时取正中间的工资，偶数时取中间两个的平均值。',
      en: 'Find the median salary of every department with employees: the middle salary for an odd headcount, the average of the two middle ones for an even headcount.',
    },
    columns: [
      ['department', '部门名', 'department name'],
      ['median_salary', '工资中位数', 'median salary'],
    ],
    explanation: {
      zh: 'Engineering 4 人排序后是 7000、9000、9000、12000，中间两个都是 9000；Sales 3 人取中间的 8000；Support 2 人取 (5000 + 5500) / 2 = 5250。Legal 没有员工，不输出。',
      en: 'Engineering’s four salaries sort to 7000, 9000, 9000, 12000 and both middle ones are 9000; Sales has three, so the middle 8000; Support has two, (5000 + 5500) / 2 = 5250. Legal has no employees and is left out.',
    },
    hints: {
      zh: ['`ROW_NUMBER()` 给部门内排序，`COUNT(*) OVER (PARTITION BY …)` 给出人数 n。', '中间位置是 `(n + 1) / 2` 和 `(n + 2) / 2`（整数除法），n 为奇数时两者相同。'],
      en: ['`ROW_NUMBER()` orders each department and `COUNT(*) OVER (PARTITION BY …)` gives its size n.', 'The middle positions are `(n + 1) / 2` and `(n + 2) / 2` (integer division), the same row when n is odd.'],
    },
    reference: `SELECT department, AVG(salary) AS median_salary
FROM (
  SELECT d.name AS department, e.department_id, e.salary,
         ROW_NUMBER() OVER (PARTITION BY e.department_id ORDER BY e.salary) AS rn,
         COUNT(*) OVER (PARTITION BY e.department_id) AS n
  FROM employees e
  JOIN departments d ON d.id = e.department_id
)
WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY department_id, department;`,
    wrong: [
      'SELECT d.name, AVG(e.salary) FROM employees e JOIN departments d ON d.id = e.department_id GROUP BY d.id;',
      `SELECT department, salary FROM (SELECT d.name AS department, e.salary,
  ROW_NUMBER() OVER (PARTITION BY e.department_id ORDER BY e.salary) AS rn, COUNT(*) OVER (PARTITION BY e.department_id) AS n
  FROM employees e JOIN departments d ON d.id = e.department_id) WHERE rn = (n + 1) / 2;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-43',
    group: 'windows',
    difficulty: '困难',
    title: { zh: '最长连续登录', en: 'Longest Login Streak' },
    schema: 'app',
    tables: ['logins'],
    task: {
      zh: '对每位用户，求其最长的连续登录天数（连续的自然日；同一天多次登录只算一天；跨月、跨年也算连续）。',
      en: 'For each user, find their longest run of consecutive calendar days with a login (several logins on one day count once; runs may cross month and year boundaries).',
    },
    columns: [
      ['user_id', '用户编号', 'user id'],
      ['longest_streak', '最长连续登录天数', 'longest streak in days'],
    ],
    explanation: {
      zh: '用户 1 在 2 月 27–29 日连续 3 天（28 日登录两次只算一天）；用户 2 的两次登录不相邻，最长 1 天；用户 3 是 3 月 1–3 日，3 天；用户 4 是 2 天。',
      en: 'User 1 has February 27–29, 3 days (two logins on the 28th count once); user 2’s two logins are not adjacent, so 1; user 3 has March 1–3, 3 days; user 4 has 2.',
    },
    hints: {
      zh: ['先对 (user_id, login_date) 去重。', '「日期减序号」在一段连续日期内是同一个值：按它分组，组的大小就是一段的长度，再取最大。'],
      en: ['Deduplicate (user_id, login_date) first.', '"Date minus row number" is constant within a run: group by it, the group size is the run length, then take the maximum.'],
    },
    reference: `WITH days AS (
  SELECT DISTINCT user_id, login_date FROM logins
), runs AS (
  SELECT user_id,
         julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS run
  FROM days
)
SELECT user_id, MAX(length) AS longest_streak
FROM (SELECT user_id, run, COUNT(*) AS length FROM runs GROUP BY user_id, run)
GROUP BY user_id;`,
    wrong: [
      `WITH r AS (SELECT user_id, julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS run FROM logins)
SELECT user_id, MAX(n) FROM (SELECT user_id, run, COUNT(*) AS n FROM r GROUP BY user_id, run) GROUP BY user_id;`,
      'SELECT user_id, COUNT(DISTINCT login_date) FROM logins GROUP BY user_id;',
    ],
    sample: APP.sample,
    hidden: [APP.boundaries, APP.sparse],
  },
  {
    id: 'sql-44',
    group: 'strings',
    difficulty: '简单',
    title: { zh: '邮箱域名统计', en: 'Email Domains' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '邮箱的域名是 `@` 之后的部分，不区分大小写。统计每个域名（全小写）有多少位客户。',
      en: 'An email’s domain is the part after the `@`, case-insensitive. Count the customers per domain, in lowercase.',
    },
    columns: [
      ['domain', '全小写的域名', 'domain in lowercase'],
      ['customers', '客户数', 'number of customers'],
    ],
    explanation: {
      zh: 'mail.com 有 Ana 和 Dmitri；Bram 的 shop.io 和 Cleo 的 Shop.io 转小写后是同一个域名；web.org 只有 Esme。',
      en: "mail.com has Ana and Dmitri; Bram's shop.io and Cleo's Shop.io are the same domain in lowercase; web.org has only Esme.",
    },
    hints: {
      zh: ["`INSTR(email, '@')` 给出 @ 的位置，`SUBSTR(email, 位置 + 1)` 取出它后面的部分。", '按转小写后的值分组。'],
      en: ["`INSTR(email, '@')` finds the @ and `SUBSTR(email, position + 1)` takes what follows.", 'Group by the lowercased value.'],
    },
    reference: `SELECT LOWER(SUBSTR(email, INSTR(email, '@') + 1)) AS domain, COUNT(*) AS customers
FROM customers
GROUP BY LOWER(SUBSTR(email, INSTR(email, '@') + 1));`,
    wrong: [
      "SELECT SUBSTR(email, INSTR(email, '@') + 1), COUNT(*) FROM customers GROUP BY SUBSTR(email, INSTR(email, '@') + 1);",
      "SELECT LOWER(SUBSTR(email, INSTR(email, '@'))), COUNT(*) FROM customers GROUP BY 1;",
    ],
    sample: { customers: SHOP_EXTRA.customers },
    hidden: [SHOP.sample, SHOP.edges],
  },
  {
    id: 'sql-45',
    group: 'strings',
    difficulty: '中等',
    title: { zh: '邮箱脱敏', en: 'Masked Emails' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: "把每位客户的邮箱脱敏：保留第一个字符，`@` 前其余部分换成 `***`，`@` 和域名原样保留，大小写不变。例如 `'alice@mail.com'` 变成 `'a***@mail.com'`。",
      en: "Mask every customer's email: keep the first character, replace the rest of the part before the `@` with `***`, and keep the `@` and the domain as they are, letter case included. For example `'alice@mail.com'` becomes `'a***@mail.com'`.",
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['masked', '脱敏后的邮箱', 'masked email'],
    ],
    explanation: {
      zh: 'ana@mail.com 变成 a***@mail.com；CLEO@Shop.io 变成 C***@Shop.io，大小写原样保留。',
      en: 'ana@mail.com becomes a***@mail.com; CLEO@Shop.io becomes C***@Shop.io, letter case unchanged.',
    },
    hints: {
      zh: ["`||` 拼接字符串：`SUBSTR(email, 1, 1) || '***' || SUBSTR(email, INSTR(email, '@'))`。"],
      en: ["`||` concatenates: `SUBSTR(email, 1, 1) || '***' || SUBSTR(email, INSTR(email, '@'))`."],
    },
    reference: `SELECT id, SUBSTR(email, 1, 1) || '***' || SUBSTR(email, INSTR(email, '@')) AS masked
FROM customers;`,
    accepted: ["SELECT id, substr(email, 1, 1) || '***@' || substr(email, instr(email, '@') + 1) FROM customers;"],
    wrong: [
      "SELECT id, SUBSTR(email, 1, 1) || '***' || SUBSTR(email, INSTR(email, '@') + 1) FROM customers;",
      "SELECT id, LOWER(SUBSTR(email, 1, 1) || '***' || SUBSTR(email, INSTR(email, '@'))) FROM customers;",
    ],
    sample: { customers: SHOP_EXTRA.customers },
    hidden: [SHOP.edges, SHOP.sample],
  },
  {
    id: 'sql-46',
    group: 'strings',
    difficulty: '中等',
    title: { zh: '格式不合法的邮箱', en: 'Malformed Emails' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '一个邮箱合法，当且仅当：恰好有一个 `@`；`@` 前面至少有一个字符；`@` 后面的域名里至少有一个 `.`，并且域名不以 `.` 开头、也不以 `.` 结尾。找出邮箱不合法的客户。',
      en: 'An email is valid when it has exactly one `@`, at least one character before it, and a domain after it that contains a `.` and neither starts nor ends with `.`. Find the customers whose email is not valid.',
    },
    columns: [
      ['id', '客户编号', 'customer id'],
      ['email', '邮箱', 'email'],
    ],
    explanation: {
      zh: 'bo@@mail.com 有两个 @；cy.mail.com 没有 @；@mail.com 的 @ 前为空；ed@mailcom 的域名没有点；gus@mail. 的域名以点结尾。flo.ray@mail.co.uk 合法：点可以出现在 @ 前面。',
      en: 'bo@@mail.com has two @; cy.mail.com has none; @mail.com has nothing before the @; ed@mailcom has no dot in its domain; gus@mail. ends its domain with a dot. flo.ray@mail.co.uk is valid: a dot may come before the @.',
    },
    hints: {
      zh: ["数某个字符出现几次：`LENGTH(email) - LENGTH(REPLACE(email, '@', ''))`。", "`LIKE '%_@_%._%'` 这类写法放过了两个 @ 和以点开头的域名。"],
      en: ["Count a character: `LENGTH(email) - LENGTH(REPLACE(email, '@', ''))`.", "Patterns like `LIKE '%_@_%._%'` let through two @ signs and a domain starting with a dot."],
    },
    reference: `WITH parts AS (
  SELECT id, email, SUBSTR(email, INSTR(email, '@') + 1) AS domain FROM customers
)
SELECT id, email
FROM parts
WHERE NOT (
  LENGTH(email) - LENGTH(REPLACE(email, '@', '')) = 1
  AND INSTR(email, '@') > 1
  AND domain LIKE '%.%'
  AND domain NOT LIKE '.%'
  AND domain NOT LIKE '%.'
);`,
    accepted: [
      `SELECT id, email FROM customers
WHERE email NOT GLOB '?*@*.*' OR email GLOB '*@*@*' OR email GLOB '*@.*' OR email GLOB '*.';`,
    ],
    wrong: [
      "SELECT id, email FROM customers WHERE email NOT LIKE '%_@_%._%';",
      "SELECT id, email FROM customers WHERE NOT (INSTR(email, '@') > 1 AND INSTR(email, '.') > 0);",
    ],
    sample: {
      customers: [
        [1, 'Ann', 'ann@mail.com', 'Austin'],
        [2, 'Bo', 'bo@@mail.com', 'Boston'],
        [3, 'Cy', 'cy.mail.com', null],
        [4, 'Di', '@mail.com', 'Denver'],
        [5, 'Ed', 'ed@mailcom', 'Austin'],
        [6, 'Flo', 'flo.ray@mail.co.uk', 'Boston'],
        [7, 'Gus', 'gus@mail.', 'Denver'],
      ],
    },
    hidden: [
      {
        customers: [
          [1, 'Hal', 'hal@x.io', 'Austin'],
          [2, 'Ivy', 'ivy@.co.uk', null],
          [3, 'Jay', 'j@y@z.com', 'Boston'],
          [4, 'Kai', 'kai.b@mailcom', 'Denver'],
          [5, 'Liv', 'liv@mail.com', null],
        ],
      },
      SHOP.sample,
    ],
  },
  {
    id: 'sql-47',
    group: 'strings',
    difficulty: '简单',
    title: { zh: '按姓名首字母统计', en: 'Customers by Initial' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '按姓名的首字母统计客户数，首字母一律输出为大写（有的姓名录入时是小写开头，`amy` 和 `Abe` 都算 A）。',
      en: 'Count customers by the first letter of their name, output in uppercase (some names were entered in lowercase: `amy` and `Abe` both count under A).',
    },
    columns: [
      ['initial', '大写首字母', 'initial in uppercase'],
      ['customers', '客户数', 'number of customers'],
    ],
    explanation: {
      zh: 'amy 和 Abe 都归到 A，共 2 位；bo 归到 B；Cal 归到 C。',
      en: 'amy and Abe both go under A, 2 customers; bo goes under B and Cal under C.',
    },
    hints: {
      zh: ['`UPPER(SUBSTR(name, 1, 1))`，并按这个表达式分组。'],
      en: ['`UPPER(SUBSTR(name, 1, 1))`, and group by that expression.'],
    },
    reference: `SELECT UPPER(SUBSTR(name, 1, 1)) AS initial, COUNT(*) AS customers
FROM customers
GROUP BY UPPER(SUBSTR(name, 1, 1));`,
    wrong: [
      'SELECT UPPER(SUBSTR(name, 1, 1)), COUNT(*) FROM customers GROUP BY SUBSTR(name, 1, 1);',
      'SELECT SUBSTR(name, 1, 1), COUNT(*) FROM customers GROUP BY SUBSTR(name, 1, 1);',
    ],
    sample: {
      customers: [
        [1, 'amy', 'amy@mail.com', null],
        [2, 'Abe', 'abe@mail.com', 'Austin'],
        [3, 'bo', 'bo@mail.com', 'Boston'],
        [4, 'Cal', 'cal@mail.com', null],
      ],
    },
    hidden: [
      {
        customers: [
          [1, 'zed', 'zed@mail.com', null],
          [2, 'Zoe', 'zoe@mail.com', 'Austin'],
          [3, 'Zia', 'zia@mail.com', 'Boston'],
          [4, 'eve', 'eve@mail.com', null],
        ],
      },
      SHOP.sample,
    ],
  },
  {
    id: 'sql-48',
    group: 'dates',
    difficulty: '简单',
    title: { zh: '每年入职人数', en: 'Hires per Year' },
    schema: 'company',
    tables: ['employees'],
    ordered: true,
    task: {
      zh: '统计每一年（`YYYY`）入职的员工人数，只列出有人入职的年份，按年份升序输出。',
      en: 'Count the employees hired in each year (`YYYY`), listing only years with hires, sorted by year ascending.',
    },
    columns: [
      ['year', '年份 YYYY', 'year as YYYY'],
      ['hires', '入职人数', 'number of hires'],
    ],
    explanation: {
      zh: '2018 年 Ava 和 Eve 入职，2021 年 Dan 和 Hugo，2022 年 Finn 和 Jack，其余年份各 1 人。',
      en: '2018 brought Ava and Eve, 2021 Dan and Hugo, 2022 Finn and Jack, and the other years one hire each.',
    },
    hints: {
      zh: ["`strftime('%Y', hire_date)` 取年份，`'%m'` 取月份（不带年）。"],
      en: ["`strftime('%Y', hire_date)` gives the year; `'%m'` gives the month without the year."],
    },
    reference: `SELECT strftime('%Y', hire_date) AS year, COUNT(*) AS hires
FROM employees
GROUP BY year
ORDER BY year;`,
    accepted: ['SELECT substr(hire_date, 1, 4), COUNT(*) FROM employees GROUP BY 1 ORDER BY 1;'],
    wrong: [
      "SELECT strftime('%Y', hire_date) AS year, COUNT(*) AS hires FROM employees GROUP BY year ORDER BY hires DESC, year;",
      "SELECT strftime('%Y', hire_date) AS year, COUNT(*) FROM employees GROUP BY hire_date ORDER BY year;",
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY.ties, COMPANY_DATES],
  },
  {
    id: 'sql-49',
    group: 'dates',
    difficulty: '中等',
    title: { zh: '周末订单', en: 'Weekend Orders' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: "找出在周六或周日下的已支付订单，并标出是 `'Sat'` 还是 `'Sun'`。",
      en: "Find the paid orders placed on a Saturday or Sunday, labelled `'Sat'` or `'Sun'`.",
    },
    columns: [
      ['order_id', '订单编号', 'order id'],
      ['order_date', '订单日期', 'order date'],
      ['day', "'Sat' 或 'Sun'", "'Sat' or 'Sun'"],
    ],
    explanation: {
      zh: '2024 年 1 月 20 日是星期六，订单 2 已支付；同一天的订单 3 和 3 月 9 日（星期六）的订单 9 都已取消。',
      en: 'January 20, 2024 is a Saturday and order 2 was paid; order 3 on the same day and order 9 on Saturday March 9 were both cancelled.',
    },
    hints: {
      zh: ["`strftime('%w', d)` 返回文本 '0'–'6'，'0' 是星期日、'6' 是星期六。", "它返回的是文本：和数字 0、6 比较不会相等，要和 '0'、'6' 比。"],
      en: ["`strftime('%w', d)` returns the text '0'–'6', where '0' is Sunday and '6' Saturday.", "It is text: compared with the numbers 0 and 6 it never matches; compare with '0' and '6'."],
    },
    reference: `SELECT id AS order_id, order_date,
       CASE strftime('%w', order_date) WHEN '0' THEN 'Sun' ELSE 'Sat' END AS day
FROM orders
WHERE status = 'paid' AND strftime('%w', order_date) IN ('0', '6');`,
    accepted: [
      "SELECT id, order_date, CASE WHEN CAST(strftime('%w', order_date) AS INTEGER) = 6 THEN 'Sat' ELSE 'Sun' END FROM orders WHERE status = 'paid' AND CAST(strftime('%w', order_date) AS INTEGER) IN (0, 6);",
    ],
    wrong: [
      "SELECT id, order_date, CASE strftime('%w', order_date) WHEN '0' THEN 'Sun' ELSE 'Sat' END FROM orders WHERE status = 'paid' AND strftime('%w', order_date) IN (0, 6);",
      "SELECT id, order_date, CASE strftime('%w', order_date) WHEN '7' THEN 'Sun' ELSE 'Sat' END FROM orders WHERE status = 'paid' AND strftime('%w', order_date) IN ('6', '7');",
      "SELECT id, order_date, CASE strftime('%w', order_date) WHEN '0' THEN 'Sun' ELSE 'Sat' END FROM orders WHERE strftime('%w', order_date) IN ('0', '6');",
    ],
    sample: SHOP.sample,
    hidden: [SHOP_EXTRA, SHOP.shuffled],
  },
  {
    id: 'sql-50',
    group: 'dates',
    difficulty: '中等',
    title: { zh: '工龄（整年）', en: 'Full Years of Service' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '截至 2025-01-01，每位员工已经满了几个整年？入职周年当天算满。2 月 29 日入职的人按 2 月 29 日计周年（不影响本题答案）。',
      en: 'As of 2025-01-01, how many full years has each employee served? The anniversary day itself counts. Someone hired on February 29 has that date as their anniversary (which does not change any answer here).',
    },
    columns: [
      ['name', '员工姓名', 'employee name'],
      ['years', '满的整年数', 'full years served'],
    ],
    explanation: {
      zh: 'Ava 于 2018-04-02 入职，2024-04-02 满 6 年，第 7 个周年还没到，所以是 6；Iris 2024-01-08 入职，还不满 1 年，是 0。',
      en: 'Ava joined on 2018-04-02 and reached 6 years on 2024-04-02; her 7th anniversary has not come, so 6. Iris joined on 2024-01-08 and has not served a full year: 0.',
    },
    hints: {
      zh: ["年份相减，再看今年的周年到没到：`strftime('%m-%d', hire_date) > '01-01'` 时减 1。", '天数除以 365 会被闰年带偏。'],
      en: ["Subtract the years, then take one off if this year's anniversary is still ahead: `strftime('%m-%d', hire_date) > '01-01'`.", 'Dividing days by 365 drifts with leap years.'],
    },
    reference: `SELECT name,
       2025 - CAST(strftime('%Y', hire_date) AS INTEGER)
         - (strftime('%m-%d', hire_date) > '01-01') AS years
FROM employees;`,
    accepted: [
      "SELECT name, CAST(strftime('%Y', '2025-01-01') AS INTEGER) - CAST(substr(hire_date, 1, 4) AS INTEGER) - CASE WHEN substr(hire_date, 6) > '01-01' THEN 1 ELSE 0 END FROM employees;",
    ],
    wrong: [
      "SELECT name, 2025 - CAST(strftime('%Y', hire_date) AS INTEGER) FROM employees;",
      "SELECT name, CAST((julianday('2025-01-01') - julianday(hire_date)) / 365 AS INTEGER) FROM employees;",
      "SELECT name, 2025 - CAST(strftime('%Y', hire_date) AS INTEGER) - (strftime('%m-%d', hire_date) >= '01-01') FROM employees;",
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY_DATES, COMPANY.ties],
  },
];
