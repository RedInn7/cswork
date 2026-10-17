/**
 * SQL track problems 51–62 (advanced: recursive CTEs, JSON columns, window
 * frames and more analytic functions) and 71–78 (index design: the learner
 * submits CREATE INDEX statements and the judge checks each target query's
 * result and EXPLAIN QUERY PLAN, lib/server/sql-judge.ts). Written for CSWork
 * like 1–50, with the same build checks. The index problems' plans were
 * checked to be the same on SQLite 3.42–3.53; ANALYZE never runs, so they do
 * not depend on the data.
 */
import { COMPANY, SHOP, type Data } from './datasets';
import type { SqlProblem } from './problems';

/** Bo and Cy manage each other; a chain six levels deep; same-day hires and salaries; a one-person department. */
const COMPANY_LOOP: Data = {
  departments: [
    [1, 'Core'],
    [2, 'Edge'],
    [3, 'Lab'],
  ],
  employees: [
    [1, 'Ada', 1, null, 9000, '2019-01-01'],
    [2, 'Bo', 1, 3, 5000, '2020-01-01'],
    [3, 'Cy', 1, 2, 5200, '2020-01-01'],
    [4, 'Di', 1, 1, 7000, '2020-06-01'],
    [5, 'Ed', 2, 4, 6000, '2022-03-01'],
    [6, 'Flo', 2, 5, 6000, '2022-03-01'],
    [7, 'Gus', 2, 6, 4000, '2021-05-01'],
    [8, 'Hal', null, 7, 3000, '2023-01-01'],
    [9, 'Ivy', 3, 1, 6500, '2023-04-01'],
  ],
};

/** A bike: bolts reach it on two paths with the same count; a basket that is not part of it. */
const BOM_SAMPLE: Data = {
  products: [
    [1, 'Bike', 'Assembly', 400],
    [2, 'Wheel', 'Assembly', 60],
    [3, 'Frame', 'Assembly', 150],
    [4, 'Spoke', 'Part', 1],
    [5, 'Tire', 'Assembly', 25],
    [6, 'Bolt', 'Part', 1],
    [7, 'Bell', 'Part', 8],
    [8, 'Tube', 'Part', 6],
    [9, 'Basket', 'Assembly', 30],
  ],
  product_parts: [
    [1, 2, 2],
    [1, 3, 1],
    [1, 6, 4],
    [2, 4, 32],
    [2, 5, 1],
    [2, 6, 2],
    [3, 6, 6],
    [5, 8, 1],
    [9, 6, 3],
  ],
};
/** A chain three levels deep, and the bottom part also used directly. */
const BOM_DEEP: Data = {
  products: [
    [1, 'Drone', 'Assembly', 300],
    [2, 'Arm', 'Assembly', 40],
    [3, 'Motor', 'Assembly', 20],
    [4, 'Magnet', 'Part', 2],
    [5, 'Prop', 'Part', 3],
  ],
  product_parts: [
    [1, 2, 4],
    [2, 3, 1],
    [3, 4, 6],
    [1, 4, 2],
    [2, 5, 2],
  ],
};
/** Two routes with equal products of quantities, and a part listed twice on one assembly. */
const BOM_TWICE: Data = {
  products: [
    [1, 'Desk', 'Assembly', 200],
    [2, 'Left leg', 'Assembly', 20],
    [3, 'Right leg', 'Assembly', 20],
    [4, 'Screw', 'Part', 1],
    [5, 'Panel', 'Part', 50],
  ],
  product_parts: [
    [1, 2, 2],
    [1, 3, 2],
    [2, 4, 1],
    [3, 4, 1],
    [1, 5, 1],
    [1, 5, 1],
  ],
};
/** Product 1 is a part with nothing to assemble. */
const BOM_LEAF: Data = {
  products: [
    [1, 'Nail', 'Part', 1],
    [2, 'Crate', 'Assembly', 9],
  ],
  product_parts: [[2, 1, 12]],
};

/** Ten paid orders, two on one day, a later id with an earlier date, a cancelled one and one without items. */
const SHOP_BUSY: Data = {
  orders: [
    [1, 1, '2024-05-01', 'paid'],
    [2, 2, '2024-05-02', 'paid'],
    [3, 1, '2024-05-02', 'paid'],
    [4, 3, '2024-05-04', 'cancelled'],
    [5, 2, '2024-05-05', 'paid'],
    [6, 4, '2024-05-06', 'paid'],
    [7, 1, '2024-05-08', 'paid'],
    [8, 3, '2024-05-09', 'paid'],
    [9, 2, '2024-05-10', 'paid'],
    [10, 4, '2024-05-03', 'paid'],
    [11, 1, '2024-05-12', 'paid'],
    [12, 5, '2024-05-12', 'paid'],
  ],
  order_items: [
    [1, 1, 1, 10],
    [2, 1, 2, 10],
    [3, 2, 1, 40],
    [4, 2, 5, 40],
    [5, 3, 3, 15],
    [6, 1, 1, 70],
    [7, 2, 2, 20],
    [8, 3, 1, 5],
    [9, 1, 4, 25],
    [10, 3, 2, 30],
    [11, 2, 1, 90],
  ],
};

const EVENTS_SAMPLE: Data = {
  events: [
    [1, 1, '2024-03-01 09:00:00', '{"type":"view","page":"/home","ms":1200,"tags":["new","mobile"]}'],
    [2, 1, '2024-03-01 09:10:00', '{"type":"click","page":"/item","ms":300,"tags":["promo"]}'],
    [3, 1, '2024-03-01 09:40:00', '{"type":"view","page":null,"tags":[]}'],
    [4, 1, '2024-03-01 10:20:00', '{"type":"buy","page":"/cart","ms":900}'],
    [5, 2, '2024-03-01 09:05:00', '{"type":"view","ms":500,"tags":["mobile","mobile"]}'],
    [6, 2, '2024-03-01 09:50:00', '{"type":"view","page":"/home","tags":["ad"]}'],
    [7, 2, '2024-03-02 09:00:00', '{"type":"click","ms":100}'],
    [8, 3, '2024-03-01 23:50:00', '{"type":"view","page":"/home","ms":800,"tags":["new"]}'],
    [9, 3, '2024-03-02 00:15:00', '{"type":"click","page":"/item","ms":200,"tags":["promo","new"]}'],
  ],
};
/** Exactly 30 minutes, 30 minutes and a second, a repeated timestamp; every buy lacks a page. */
const EVENTS_EDGES: Data = {
  events: [
    [1, 4, '2024-03-03 08:00:00', '{"type":"buy","ms":400,"tags":["promo"]}'],
    [2, 4, '2024-03-03 08:30:00', '{"type":"buy","ms":0,"tags":["promo","promo"]}'],
    [3, 4, '2024-03-03 09:00:01', '{"type":"view","page":null,"ms":50}'],
    [4, 4, '2024-03-03 09:00:01', '{"type":"view","page":"/home","tags":["mobile"]}'],
    [5, 5, '2024-03-03 08:15:00', '{"type":"view","page":null,"tags":["promo"]}'],
    [6, 5, '2024-03-03 08:44:59', '{"type":"buy","tags":[]}'],
    [7, 5, '2024-03-03 09:15:00', '{"type":"view","page":"/item","ms":75}'],
  ],
};
/** Ids out of time order, users interleaved, a type that never reports ms. */
const EVENTS_SHUFFLED: Data = {
  events: [
    [1, 7, '2024-03-05 12:00:00', '{"type":"share","page":"/item","tags":["ad","new"]}'],
    [2, 6, '2024-03-05 11:00:00', '{"type":"view","page":"/home","ms":250}'],
    [3, 7, '2024-03-05 11:45:00', '{"type":"view","ms":125,"tags":["ad"]}'],
    [4, 6, '2024-03-05 11:20:00', '{"type":"share","page":null}'],
    [5, 7, '2024-03-05 11:15:00', '{"type":"view","page":"/home","ms":175,"tags":["new"]}'],
    [6, 6, '2024-03-05 13:00:00', '{"type":"view","page":"/cart","ms":300,"tags":["ad"]}'],
  ],
};
/** One user, one event, no tags. */
const EVENTS_SINGLE: Data = {
  events: [[1, 9, '2024-03-07 18:30:00', '{"type":"view","page":"/home","tags":[]}']],
};

export const ADVANCED_PROBLEMS: SqlProblem[] = [
  {
    id: 'sql-51',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '组织架构每层人数', en: 'Headcount per Org Level' },
    schema: 'company',
    tables: ['employees'],
    ordered: true,
    task: {
      zh: '`manager_id` 为 NULL 的员工是第 1 层，他们的直接下属是第 2 层，依此类推。如果一名员工往上找上级时遇到不存在的编号，或者几个人互为上级、绕成一个圈，就永远到不了第 1 层，这样的员工不计入任何一层。统计每层有多少人，按层号从小到大排列。',
      en: 'Employees whose `manager_id` is NULL are level 1, their direct reports are level 2, and so on. An employee whose chain of managers hits an id that does not exist, or loops (people who manage each other), never reaches level 1 and is in no level. Count the employees on each level, ordered by level.',
    },
    columns: [
      ['level', '层号，从 1 开始', 'level, from 1'],
      ['headcount', '这一层的人数', 'employees on that level'],
    ],
    explanation: {
      zh: 'Ava 和 Eve 是第 1 层；Ben、Chloe、Iris（上级 Ava）和 Finn、Gia（上级 Eve）是第 2 层；Dan（上级 Ben）是第 3 层。Hugo 的上级 42 不存在，Jack 的上级是 Hugo，两人都不计入。',
      en: 'Ava and Eve are level 1; Ben, Chloe and Iris (under Ava) and Finn and Gia (under Eve) are level 2; Dan (under Ben) is level 3. Hugo’s manager 42 does not exist and Jack reports to Hugo, so neither is counted.',
    },
    hints: {
      zh: [
        '递归 CTE 从 `manager_id IS NULL` 的员工出发，每一轮把下属连进来，层号加 1。',
        '从上往下走只会到达树里的人，绕圈的人从顶层永远走不到，所以不会死循环。',
      ],
      en: [
        'Start a recursive CTE from the employees with `manager_id IS NULL` and join their reports in each round, adding 1 to the level.',
        'Walking down from the top only reaches people in the tree; a loop is never reached from the top, so the recursion ends.',
      ],
    },
    reference: `WITH RECURSIVE tree(id, level) AS (
  SELECT id, 1 FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, t.level + 1
  FROM employees e
  JOIN tree t ON e.manager_id = t.id
)
SELECT level, COUNT(*) AS headcount
FROM tree
GROUP BY level
ORDER BY level;`,
    accepted: [
      `WITH RECURSIVE t(id, depth) AS (SELECT id, 0 FROM employees WHERE manager_id IS NULL
UNION SELECT e.id, t.depth + 1 FROM t JOIN employees e ON e.manager_id = t.id)
SELECT depth + 1, COUNT(*) FROM t GROUP BY depth ORDER BY depth;`,
    ],
    wrong: [
      `WITH RECURSIVE tree(id, level) AS (SELECT id, 1 FROM employees e
WHERE manager_id IS NULL OR NOT EXISTS (SELECT 1 FROM employees m WHERE m.id = e.manager_id)
UNION ALL SELECT e.id, t.level + 1 FROM employees e JOIN tree t ON e.manager_id = t.id)
SELECT level, COUNT(*) FROM tree GROUP BY level ORDER BY level;`,
      `WITH RECURSIVE tree(id, level) AS (SELECT id, 1 FROM employees WHERE manager_id IS NULL
UNION ALL SELECT e.id, t.level + 1 FROM employees e JOIN tree t ON e.manager_id = t.id)
SELECT level, COUNT(*) FROM tree WHERE level <= 3 GROUP BY level ORDER BY level;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY_LOOP, COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-52',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '汇报链路径', en: 'Reporting Chain' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '对每位能一路往上找到顶层员工（`manager_id` 为 NULL）的员工，写出从顶层到他本人的姓名链，用 ` > `（两边各一个空格）连接，例如 `Ava > Ben > Dan`。顶层员工的链只有自己的名字。上级编号不存在、或者上级关系绕成圈的员工不出现在结果里。',
      en: 'For every employee whose managers lead up to a top-level employee (`manager_id` is NULL), write the chain of names from the top down to them joined by ` > ` (a space on each side), such as `Ava > Ben > Dan`. A top-level employee’s chain is their own name. Employees under a manager id that does not exist, or in a loop of managers, are left out.',
    },
    columns: [
      ['id', '员工编号', 'employee id'],
      ['chain', '从顶层到本人的姓名链', 'names from the top down to them'],
    ],
    explanation: {
      zh: 'Dan 的上级是 Ben，Ben 的上级是 Ava，所以 Dan 的链是 `Ava > Ben > Dan`。Hugo 的上级 42 不存在，Jack 在 Hugo 下面，两人都没有链。',
      en: 'Dan reports to Ben and Ben to Ava, so Dan’s chain is `Ava > Ben > Dan`. Hugo’s manager 42 does not exist and Jack is under Hugo, so neither has a chain.',
    },
    hints: {
      zh: ['递归 CTE 每一轮带着上一层的路径往下走：`path || \' > \' || e.name`。', '从顶层往下拼，名字的顺序自然就是从上到下。'],
      en: ["Carry the path down one level per round: `path || ' > ' || e.name`.", 'Building from the top down puts the names in top-to-bottom order for free.'],
    },
    reference: `WITH RECURSIVE chain(id, path) AS (
  SELECT id, name FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, c.path || ' > ' || e.name
  FROM employees e
  JOIN chain c ON e.manager_id = c.id
)
SELECT id, path AS chain FROM chain;`,
    accepted: [
      `WITH RECURSIVE c AS (SELECT id, name AS chain FROM employees WHERE manager_id IS NULL
UNION ALL SELECT e.id, printf('%s > %s', c.chain, e.name) FROM c JOIN employees e ON e.manager_id = c.id)
SELECT * FROM c;`,
    ],
    wrong: [
      `WITH RECURSIVE chain(id, path) AS (SELECT id, name FROM employees WHERE manager_id IS NULL
UNION ALL SELECT e.id, e.name || ' > ' || c.path FROM employees e JOIN chain c ON e.manager_id = c.id)
SELECT id, path FROM chain;`,
      `WITH RECURSIVE chain(id, path) AS (SELECT id, name FROM employees e
WHERE manager_id IS NULL OR NOT EXISTS (SELECT 1 FROM employees m WHERE m.id = e.manager_id)
UNION ALL SELECT e.id, c.path || ' > ' || e.name FROM employees e JOIN chain c ON e.manager_id = c.id)
SELECT id, path FROM chain;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY_LOOP, COMPANY.ties, COMPANY.topTie],
  },
  {
    id: 'sql-53',
    group: 'advanced',
    difficulty: '困难',
    title: { zh: '物料清单展开', en: 'Bill of Materials' },
    schema: 'shop',
    tables: ['products', 'product_parts'],
    task: {
      zh: '`product_parts` 的一行表示：组装 1 个 `product_id` 需要 `quantity` 个 `part_id`，而零件本身也可能由别的零件组装。没有任何零件的产品是基础零件。要组装 1 个编号为 1 的产品，每种基础零件一共需要多少个？数量沿着组装路径相乘，同一种零件出现在多条路径上时把各条路径的数量相加。组装关系不会成环。产品 1 本身是基础零件时结果为空。',
      en: 'A `product_parts` row says one `product_id` takes `quantity` units of `part_id`, and a part may itself be assembled from other parts. A product with no parts is a base part. To build one unit of product 1, how many units of each base part are needed in total? Quantities multiply along an assembly path, and a part reached on several paths adds them up. There are no cycles. If product 1 is a base part itself, the result is empty.',
    },
    columns: [
      ['part_id', '基础零件编号', 'base part id'],
      ['name', '零件名称', 'part name'],
      ['units', '组装 1 个产品 1 需要的总数', 'units needed for one product 1'],
    ],
    explanation: {
      zh: '1 辆 Bike 需要 2 个 Wheel、1 个 Frame 和 4 个 Bolt。每个 Wheel 有 32 根 Spoke、1 个 Tire 和 2 个 Bolt，Tire 里有 1 根 Tube，Frame 有 6 个 Bolt。所以 Spoke 是 2 × 32 = 64，Tube 是 2 × 1 × 1 = 2，Bolt 是 4 + 2 × 2 + 6 = 14。Basket 不属于 Bike，它的 Bolt 不算。',
      en: 'A Bike takes 2 Wheels, 1 Frame and 4 Bolts. Each Wheel has 32 Spokes, 1 Tire and 2 Bolts, a Tire holds 1 Tube, and the Frame has 6 Bolts. So Spokes are 2 × 32 = 64, Tubes 2 × 1 × 1 = 2 and Bolts 4 + 2 × 2 + 6 = 14. The Basket is not part of the Bike, so its Bolts do not count.',
    },
    hints: {
      zh: [
        '递归 CTE 的每一行是「某个零件，按这条路径需要多少个」，往下展开时把数量相乘。',
        '用 `UNION ALL`：两条路径算出同样的（零件，数量）时，`UNION` 会把它们合并成一行。',
      ],
      en: [
        'Each row of the recursive CTE is "a part and how many units this path needs"; multiply the quantities as you expand.',
        'Use `UNION ALL`: when two paths give the same (part, units), `UNION` merges them into one row.',
      ],
    },
    reference: `WITH RECURSIVE need(part_id, units) AS (
  SELECT part_id, quantity FROM product_parts WHERE product_id = 1
  UNION ALL
  SELECT p.part_id, n.units * p.quantity
  FROM need n
  JOIN product_parts p ON p.product_id = n.part_id
)
SELECT n.part_id, pr.name, SUM(n.units) AS units
FROM need n
JOIN products pr ON pr.id = n.part_id
WHERE NOT EXISTS (SELECT 1 FROM product_parts x WHERE x.product_id = n.part_id)
GROUP BY n.part_id, pr.name;`,
    accepted: [
      `WITH RECURSIVE walk(item, mult) AS (SELECT 1, 1 UNION ALL
SELECT p.part_id, w.mult * p.quantity FROM walk w JOIN product_parts p ON p.product_id = w.item)
SELECT w.item, pr.name, SUM(w.mult) FROM walk w JOIN products pr ON pr.id = w.item
WHERE w.item <> 1 AND w.item NOT IN (SELECT product_id FROM product_parts) GROUP BY w.item;`,
    ],
    wrong: [
      `WITH RECURSIVE need(part_id, units) AS (SELECT part_id, quantity FROM product_parts WHERE product_id = 1
UNION SELECT p.part_id, n.units * p.quantity FROM need n JOIN product_parts p ON p.product_id = n.part_id)
SELECT n.part_id, pr.name, SUM(n.units) FROM need n JOIN products pr ON pr.id = n.part_id
WHERE NOT EXISTS (SELECT 1 FROM product_parts x WHERE x.product_id = n.part_id) GROUP BY n.part_id, pr.name;`,
      `WITH RECURSIVE need(part_id, units) AS (SELECT part_id, quantity FROM product_parts WHERE product_id = 1
UNION ALL SELECT p.part_id, p.quantity FROM need n JOIN product_parts p ON p.product_id = n.part_id)
SELECT n.part_id, pr.name, SUM(n.units) FROM need n JOIN products pr ON pr.id = n.part_id
WHERE NOT EXISTS (SELECT 1 FROM product_parts x WHERE x.product_id = n.part_id) GROUP BY n.part_id, pr.name;`,
      `WITH RECURSIVE need(part_id, units) AS (SELECT part_id, quantity FROM product_parts WHERE product_id = 1
UNION ALL SELECT p.part_id, n.units * p.quantity FROM need n JOIN product_parts p ON p.product_id = n.part_id)
SELECT n.part_id, pr.name, SUM(n.units) FROM need n JOIN products pr ON pr.id = n.part_id GROUP BY n.part_id, pr.name;`,
    ],
    sample: BOM_SAMPLE,
    hidden: [BOM_DEEP, BOM_TWICE, BOM_LEAF],
  },
  {
    id: 'sql-54',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '每日营收补零', en: 'Daily Revenue with Empty Days' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    ordered: true,
    task: {
      zh: '从最早的下单日期到最晚的下单日期（不论订单状态，两端都包含），每一天输出一行：日期和当天已支付订单（`status = \'paid\'`）的营收，即 `quantity * unit_price` 之和。没有已支付营收的日子写 0。按日期从早到晚排列。数据保证至少有一个订单。',
      en: "For every calendar day from the earliest to the latest order date (any status, both ends included), output the day and that day's revenue from paid orders (`status = 'paid'`), the sum of `quantity * unit_price`. Days without paid revenue show 0. Order by day. There is always at least one order.",
    },
    columns: [
      ['day', "日期，'YYYY-MM-DD'", "date, 'YYYY-MM-DD'"],
      ['revenue', '当天已支付营收，没有为 0', "that day's paid revenue, 0 if none"],
    ],
    explanation: {
      zh: '订单日期从 2024-01-05 到 2024-03-09，共 65 天，每天一行。比如 1 月 5 日的订单 1 营收 2 × 30 + 55 = 115；1 月 6 日没有订单，写 0；1 月 20 日只有订单 2 是已支付的（80），订单 3 已取消。',
      en: 'Orders run from 2024-01-05 to 2024-03-09, 65 days, one row each. On January 5 order 1 brings 2 × 30 + 55 = 115; January 6 has no orders and shows 0; on January 20 only order 2 is paid (80), order 3 was cancelled.',
    },
    hints: {
      zh: [
        "递归 CTE 生成日期序列：从 `MIN(order_date)` 开始，每轮 `date(day, '+1 day')`，到 `MAX(order_date)` 为止。",
        '日期序列 LEFT JOIN 每日营收，再用 `COALESCE(x, 0)` 补零。',
      ],
      en: [
        "Generate the days with a recursive CTE: start at `MIN(order_date)` and add `date(day, '+1 day')` each round until `MAX(order_date)`.",
        'LEFT JOIN the daily revenue onto the days and fill the gaps with `COALESCE(x, 0)`.',
      ],
    },
    reference: `WITH RECURSIVE days(day) AS (
  SELECT MIN(order_date) FROM orders
  UNION ALL
  SELECT date(day, '+1 day') FROM days
  WHERE day < (SELECT MAX(order_date) FROM orders)
), revenue AS (
  SELECT o.order_date AS day, SUM(i.quantity * i.unit_price) AS amount
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid'
  GROUP BY o.order_date
)
SELECT d.day, COALESCE(r.amount, 0) AS revenue
FROM days d
LEFT JOIN revenue r ON r.day = d.day
ORDER BY d.day;`,
    accepted: [
      `WITH RECURSIVE n(k) AS (SELECT 0 UNION ALL SELECT k + 1 FROM n
WHERE k < (SELECT julianday(MAX(order_date)) - julianday(MIN(order_date)) FROM orders))
SELECT date((SELECT MIN(order_date) FROM orders), '+' || k || ' days') AS day,
(SELECT COALESCE(SUM(i.quantity * i.unit_price), 0) FROM orders o JOIN order_items i ON i.order_id = o.id
 WHERE o.status = 'paid' AND o.order_date = date((SELECT MIN(order_date) FROM orders), '+' || k || ' days'))
FROM n ORDER BY day;`,
    ],
    wrong: [
      `SELECT o.order_date, COALESCE(SUM(CASE WHEN o.status = 'paid' THEN i.quantity * i.unit_price END), 0)
FROM orders o LEFT JOIN order_items i ON i.order_id = o.id GROUP BY o.order_date ORDER BY o.order_date;`,
      `WITH RECURSIVE days(day) AS (SELECT MIN(order_date) FROM orders UNION ALL SELECT date(day, '+1 day') FROM days
WHERE date(day, '+1 day') < (SELECT MAX(order_date) FROM orders))
SELECT d.day, COALESCE((SELECT SUM(i.quantity * i.unit_price) FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' AND o.order_date = d.day), 0) FROM days d ORDER BY d.day;`,
      `WITH RECURSIVE days(day) AS (SELECT MIN(order_date) FROM orders UNION ALL SELECT date(day, '+1 day') FROM days
WHERE day < (SELECT MAX(order_date) FROM orders))
SELECT d.day, COALESCE((SELECT SUM(i.quantity * i.unit_price) FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.order_date = d.day), 0) FROM days d ORDER BY d.day;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-55',
    group: 'advanced',
    difficulty: '简单',
    title: { zh: '按事件类型统计耗时', en: 'Time Spent by Event Type' },
    schema: 'app',
    tables: ['events'],
    task: {
      zh: '`payload` 是一个 JSON 对象，一定有字符串字段 `type`，可能有数字字段 `ms`（停留的毫秒数）。按 `type` 分组，统计事件数，以及带 `ms` 的事件的平均 `ms`，用 `ROUND(x, 1)` 保留一位小数。没有 `ms` 的事件不参与平均，但仍计入事件数；某个类型一个 `ms` 都没有时平均值为 NULL。',
      en: 'Each `payload` is a JSON object with a string field `type` and maybe a number field `ms` (milliseconds spent). Per `type`, count the events and average `ms` over the events that have it, rounded with `ROUND(x, 1)`. Events without `ms` stay out of the average but still count as events; a type with no `ms` at all averages to NULL.',
    },
    columns: [
      ['type', '事件类型', 'event type'],
      ['events', '事件数', 'number of events'],
      ['avg_ms', '平均 ms，没有则为 NULL', 'average ms, NULL if none'],
    ],
    explanation: {
      zh: 'view 有 5 个事件，其中 3 个带 ms：(1200 + 500 + 800) / 3 = 833.3。click 有 3 个，平均 (300 + 100 + 200) / 3 = 200。buy 只有一个，900。',
      en: 'view has 5 events, 3 with ms: (1200 + 500 + 800) / 3 = 833.3. click has 3, averaging (300 + 100 + 200) / 3 = 200. buy has one, 900.',
    },
    hints: {
      zh: ["`json_extract(payload, '$.ms')` 取出字段，字段不存在时得到 NULL。", '`AVG` 本来就跳过 NULL，`COUNT(*)` 计所有行。'],
      en: ["`json_extract(payload, '$.ms')` reads a field and gives NULL when it is absent.", '`AVG` already skips NULLs; `COUNT(*)` counts every row.'],
    },
    reference: `SELECT json_extract(payload, '$.type') AS type,
       COUNT(*) AS events,
       ROUND(AVG(json_extract(payload, '$.ms')), 1) AS avg_ms
FROM events
GROUP BY json_extract(payload, '$.type');`,
    accepted: [
      `SELECT payload ->> '$.type', COUNT(*), ROUND(SUM(payload ->> '$.ms') * 1.0 / NULLIF(COUNT(payload ->> '$.ms'), 0), 1)
FROM events GROUP BY 1;`,
    ],
    wrong: [
      `SELECT json_extract(payload, '$.type'), COUNT(*), ROUND(AVG(COALESCE(json_extract(payload, '$.ms'), 0)), 1)
FROM events GROUP BY 1;`,
      `SELECT json_extract(payload, '$.type'), COUNT(json_extract(payload, '$.ms')), ROUND(AVG(json_extract(payload, '$.ms')), 1)
FROM events GROUP BY 1;`,
    ],
    sample: EVENTS_SAMPLE,
    hidden: [EVENTS_EDGES, EVENTS_SHUFFLED, EVENTS_SINGLE],
  },
  {
    id: 'sql-56',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '展开 JSON 标签数组', en: 'Users per Tag' },
    schema: 'app',
    tables: ['events'],
    task: {
      zh: '`payload` 里可能有 `tags`，一个字符串数组（可能为空数组，也可能没有这个字段）。对每个出现过的标签，统计有多少位不同的用户至少有一个带这个标签的事件。同一个事件的数组里重复出现的标签只算一次。',
      en: 'A `payload` may have `tags`, an array of strings (possibly empty, or the field may be absent). For every tag that appears, count the distinct users with at least one event carrying it. A tag repeated within one event’s array counts once.',
    },
    columns: [
      ['tag', '标签', 'tag'],
      ['users', '带过这个标签的不同用户数', 'distinct users with an event carrying it'],
    ],
    explanation: {
      zh: 'new 出现在用户 1 的事件 1 和用户 3 的事件 8、9 里，共 2 位用户。mobile 出现在用户 1 和用户 2 的事件里（用户 2 的数组里写了两次），也是 2 位。promo 是用户 1 和 3，ad 只有用户 2。',
      en: 'new is on user 1’s event 1 and user 3’s events 8 and 9: 2 users. mobile is on events of users 1 and 2 (listed twice in user 2’s array): 2 users too. promo is users 1 and 3, and ad only user 2.',
    },
    hints: {
      zh: [
        "表值函数 `json_each(payload, '$.tags')` 把数组的每个元素变成一行，元素在 `value` 列里。",
        '`FROM events e, json_each(...)` 是内连接：没有标签的事件自然不出现。',
      ],
      en: [
        "The table-valued function `json_each(payload, '$.tags')` turns each array element into a row, with the element in `value`.",
        '`FROM events e, json_each(...)` is an inner join: events without tags simply produce no rows.',
      ],
    },
    reference: `SELECT t.value AS tag, COUNT(DISTINCT e.user_id) AS users
FROM events e, json_each(e.payload, '$.tags') t
GROUP BY t.value;`,
    accepted: [
      `SELECT j.value, COUNT(DISTINCT e.user_id) FROM events e JOIN json_each(json_extract(e.payload, '$.tags')) j GROUP BY j.value;`,
    ],
    wrong: [
      `SELECT t.value, COUNT(*) FROM events e, json_each(e.payload, '$.tags') t GROUP BY t.value;`,
      `SELECT t.value, COUNT(DISTINCT e.user_id) FROM events e LEFT JOIN json_each(e.payload, '$.tags') t GROUP BY t.value;`,
    ],
    sample: EVENTS_SAMPLE,
    hidden: [EVENTS_EDGES, EVENTS_SHUFFLED, EVENTS_SINGLE],
  },
  {
    id: 'sql-57',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '缺失的键和 null 值', en: 'Missing Key or Null Value' },
    schema: 'app',
    tables: ['events'],
    task: {
      zh: '`payload` 里的 `page` 有三种情况：字符串；JSON 的 `null`（新版客户端不知道页面时这样写）；整个字段不存在（旧版客户端从不发送）。按 `type` 分组，分别统计 `page` 字段不存在的事件数和 `page` 为 `null` 的事件数，没有就写 0。',
      en: 'The `page` in a `payload` is a string, a JSON `null` (the new client sends that when it does not know the page), or absent altogether (the old client never sends it). Per `type`, count the events whose `page` is absent and those whose `page` is `null`, writing 0 when there are none.',
    },
    columns: [
      ['type', '事件类型', 'event type'],
      ['missing', '没有 page 字段的事件数', 'events without a page field'],
      ['nulls', 'page 为 null 的事件数', 'events whose page is null'],
    ],
    explanation: {
      zh: 'view 里事件 5 没有 page 字段，事件 3 的 page 是 null；click 里事件 7 没有 page；buy 唯一的事件有 page，两项都是 0。',
      en: 'Among views, event 5 has no page field and event 3 has a null page; among clicks, event 7 has no page; the only buy has a page, so both counts are 0.',
    },
    hints: {
      zh: [
        '`json_extract` 对「不存在」和「null」都返回 SQL 的 NULL，分不出来。',
        "`json_type(payload, '$.page')` 字段不存在时返回 NULL，值为 null 时返回文本 'null'。",
      ],
      en: [
        '`json_extract` returns SQL NULL for both an absent field and a null one, so it cannot tell them apart.',
        "`json_type(payload, '$.page')` is NULL when the field is absent and the text 'null' when its value is null.",
      ],
    },
    reference: `SELECT json_extract(payload, '$.type') AS type,
       SUM(CASE WHEN json_type(payload, '$.page') IS NULL THEN 1 ELSE 0 END) AS missing,
       SUM(CASE WHEN json_type(payload, '$.page') = 'null' THEN 1 ELSE 0 END) AS nulls
FROM events
GROUP BY json_extract(payload, '$.type');`,
    accepted: [
      `SELECT json_extract(payload, '$.type'), COUNT(*) - COUNT(json_type(payload, '$.page')),
COUNT(*) FILTER (WHERE json_type(payload, '$.page') = 'null') FROM events GROUP BY 1;`,
    ],
    wrong: [
      `SELECT json_extract(payload, '$.type'), SUM(json_extract(payload, '$.page') IS NULL), 0 FROM events GROUP BY 1;`,
      `SELECT json_extract(payload, '$.type'), SUM(json_type(payload, '$.page') IS NULL), SUM(json_type(payload, '$.page') = 'null')
FROM events GROUP BY 1;`,
    ],
    sample: EVENTS_SAMPLE,
    hidden: [EVENTS_EDGES, EVENTS_SHUFFLED, EVENTS_SINGLE],
  },
  {
    id: 'sql-58',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '客户消费四分组', en: 'Spending Quartiles' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    ordered: true,
    task: {
      zh: '只看在已支付订单里买过东西的客户（游客订单的 `customer_id` 为 NULL，不算）。每位客户的消费额是他已支付订单里 `quantity * unit_price` 之和。按消费额从高到低、相同时编号小的在前排好，用 `NTILE(4)` 分成 4 组，消费最高的一组是 1。按组号、消费额从高到低、客户编号从小到大排列。',
      en: 'Only customers who bought something in a paid order count (guest orders have a NULL `customer_id` and do not). A customer’s spending is the sum of `quantity * unit_price` over their paid orders. Sort them by spending, highest first and the smaller id first on ties, and split them into 4 groups with `NTILE(4)`, group 1 being the top spenders. Order by group, then spending from high to low, then customer id.',
    },
    columns: [
      ['customer_id', '客户编号', 'customer id'],
      ['spending', '消费额', 'spending'],
      ['quartile', '组号 1–4，1 消费最高', 'group 1–4, 1 the top'],
    ],
    explanation: {
      zh: '客户 3 消费 115 + 300 = 415，客户 1 消费 115 + 80 + 180 = 375，客户 5 消费 255；客户 2 只有取消的订单。3 位客户分 4 组，NTILE 把他们依次放进第 1、2、3 组。',
      en: 'Customer 3 spent 115 + 300 = 415, customer 1 spent 115 + 80 + 180 = 375 and customer 5 spent 255; customer 2 only has a cancelled order. With 3 customers and 4 groups, NTILE puts them into groups 1, 2 and 3 in turn.',
    },
    hints: {
      zh: [
        '`NTILE(n) OVER (ORDER BY …)` 把行尽量平均地分成 n 组，多出来的行放进编号小的组。',
        '窗口的 ORDER BY 要写全平局规则（再按编号），否则分组可能不确定。',
      ],
      en: [
        '`NTILE(n) OVER (ORDER BY …)` splits the rows into n groups as evenly as it can, the extra rows going to the lower-numbered groups.',
        'Spell out the tie-break (then by id) in the window’s ORDER BY, or the grouping may not be stable.',
      ],
    },
    reference: `WITH spend AS (
  SELECT o.customer_id, SUM(i.quantity * i.unit_price) AS spending
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid' AND o.customer_id IS NOT NULL
  GROUP BY o.customer_id
)
SELECT customer_id, spending,
       NTILE(4) OVER (ORDER BY spending DESC, customer_id) AS quartile
FROM spend
ORDER BY quartile, spending DESC, customer_id;`,
    accepted: [
      `WITH s AS (SELECT o.customer_id AS c, SUM(i.quantity * i.unit_price) AS v FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' AND o.customer_id IS NOT NULL GROUP BY 1),
r AS (SELECT c, v, ROW_NUMBER() OVER (ORDER BY v DESC, c) - 1 AS k, COUNT(*) OVER () AS n FROM s)
SELECT c, v, CASE WHEN k < (n % 4) * (n / 4 + 1) THEN k / (n / 4 + 1) + 1 ELSE (k - (n % 4)) / (n / 4) + 1 END AS q
FROM r ORDER BY q, v DESC, c;`,
    ],
    wrong: [
      `WITH s AS (SELECT o.customer_id AS c, SUM(i.quantity * i.unit_price) AS v FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' AND o.customer_id IS NOT NULL GROUP BY 1)
SELECT c, v, NTILE(4) OVER (ORDER BY v, c) AS q FROM s ORDER BY q, v DESC, c;`,
      `WITH s AS (SELECT o.customer_id AS c, SUM(i.quantity * i.unit_price) AS v FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' AND o.customer_id IS NOT NULL GROUP BY 1)
SELECT c, v, (ROW_NUMBER() OVER (ORDER BY v DESC, c) - 1) * 4 / COUNT(*) OVER () + 1 AS q FROM s ORDER BY q, v DESC, c;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-59',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '部门内薪资百分位', en: 'Salary Percent Rank' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '对有部门的员工，计算他的薪资在本部门里的百分位排名：`(名次 - 1) / (部门人数 - 1)`，名次按薪资从低到高、薪资相同名次相同（和 RANK 一样），部门只有一人时为 0。用 `ROUND(x, 2)` 保留两位小数。没有部门的员工不出现。',
      en: 'For each employee in a department, compute the percent rank of their salary within the department: `(rank - 1) / (department size - 1)`, where rank goes from the lowest salary up and equal salaries share a rank (like RANK), and it is 0 for a one-person department. Round with `ROUND(x, 2)`. Employees without a department are left out.',
    },
    columns: [
      ['id', '员工编号', 'employee id'],
      ['department_id', '部门编号', 'department id'],
      ['pct', '百分位排名，0 到 1', 'percent rank, 0 to 1'],
    ],
    explanation: {
      zh: '部门 1 有 4 人：Dan 7000 最低为 0，Ben 和 Chloe 都是 9000，并列第 2 名，(2 - 1) / 3 = 0.33，Ava 12000 为 1。部门 2 的 Gia、Eve、Finn 依次是 0、0.5、1。Iris 没有部门，不出现。',
      en: 'Department 1 has 4 people: Dan’s 7000 is lowest at 0, Ben and Chloe share 9000 and rank 2, (2 - 1) / 3 = 0.33, and Ava’s 12000 is 1. Department 2’s Gia, Eve and Finn get 0, 0.5 and 1. Iris has no department and is left out.',
    },
    hints: {
      zh: ['`PERCENT_RANK() OVER (PARTITION BY … ORDER BY …)` 正好就是这个公式。', '先用 WHERE 去掉没有部门的员工：NULL 也会自成一个分区。'],
      en: ['`PERCENT_RANK() OVER (PARTITION BY … ORDER BY …)` is exactly this formula.', 'Filter out employees without a department first: NULL forms a partition of its own too.'],
    },
    reference: `SELECT id, department_id,
       ROUND(PERCENT_RANK() OVER (PARTITION BY department_id ORDER BY salary), 2) AS pct
FROM employees
WHERE department_id IS NOT NULL;`,
    accepted: [
      `SELECT e.id, e.department_id, ROUND(CASE WHEN n.c = 1 THEN 0 ELSE 1.0 * (SELECT COUNT(*) FROM employees x
WHERE x.department_id = e.department_id AND x.salary < e.salary) / (n.c - 1) END, 2)
FROM employees e JOIN (SELECT department_id, COUNT(*) AS c FROM employees GROUP BY department_id) n
ON n.department_id = e.department_id;`,
    ],
    wrong: [
      `SELECT id, department_id, ROUND(CUME_DIST() OVER (PARTITION BY department_id ORDER BY salary), 2) FROM employees WHERE department_id IS NOT NULL;`,
      `SELECT id, department_id, ROUND(PERCENT_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC), 2) FROM employees WHERE department_id IS NOT NULL;`,
      `SELECT id, department_id, ROUND(PERCENT_RANK() OVER (PARTITION BY department_id ORDER BY salary), 2) FROM employees;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY_LOOP, COMPANY.topTie, COMPANY.flat],
  },
  {
    id: 'sql-60',
    group: 'advanced',
    difficulty: '困难',
    title: { zh: '按 30 分钟间隔切分会话', en: 'Sessions with a 30-Minute Gap' },
    schema: 'app',
    tables: ['events'],
    task: {
      zh: '把每位用户的事件按时间排好。和同一用户上一个事件相隔超过 30 分钟（严格大于 1800 秒）的事件开始一个新会话，相隔正好 30 分钟仍属同一会话；用户的第一个事件总是开始一个会话。对每个会话输出用户编号、会话第一个事件的时间和会话里的事件数。同一时刻可能有多个事件。',
      en: 'Put each user’s events in time order. An event more than 30 minutes (strictly over 1800 seconds) after the same user’s previous event starts a new session; exactly 30 minutes stays in the session, and a user’s first event always starts one. For each session output the user id, the time of its first event and its number of events. Several events may share a timestamp.',
    },
    columns: [
      ['user_id', '用户编号', 'user id'],
      ['started', "会话开始时间，'YYYY-MM-DD HH:MM:SS'", "session start, 'YYYY-MM-DD HH:MM:SS'"],
      ['events', '会话里的事件数', 'events in the session'],
    ],
    explanation: {
      zh: '用户 1 在 9:00、9:10、9:40 的事件之间最多隔 30 分钟，是一个会话；10:20 隔了 40 分钟，开始新会话。用户 2 的三个事件间隔都超过 30 分钟，各自成一个会话。用户 3 在 23:50 和次日 0:15 相隔 25 分钟，跨过午夜也是同一个会话。',
      en: 'User 1’s events at 9:00, 9:10 and 9:40 are at most 30 minutes apart, one session; 10:20 comes 40 minutes later and starts another. User 2’s three events are each over 30 minutes apart, three sessions. User 3’s events at 23:50 and 0:15 the next day are 25 minutes apart, one session across midnight.',
    },
    hints: {
      zh: [
        "`LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)` 取上一个事件的时间；`strftime('%s', ts)` 把时间变成秒数，整数相减没有误差。",
        '「是否开始新会话」记成 0 / 1，再按时间做累计求和，就得到每个事件所在的会话编号。',
      ],
      en: [
        "`LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)` reads the previous event’s time; `strftime('%s', ts)` turns a time into seconds, and integer differences are exact.",
        'Mark "starts a new session" as 0 or 1 and take a running sum over time: that is each event’s session number.',
      ],
    },
    reference: `WITH gaps AS (
  SELECT user_id, ts,
         CASE WHEN strftime('%s', ts) - strftime('%s', LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)) <= 1800
              THEN 0 ELSE 1 END AS new_session
  FROM events
), numbered AS (
  SELECT user_id, ts,
         SUM(new_session) OVER (PARTITION BY user_id ORDER BY ts ROWS UNBOUNDED PRECEDING) AS session
  FROM gaps
)
SELECT user_id, MIN(ts) AS started, COUNT(*) AS events
FROM numbered
GROUP BY user_id, session;`,
    accepted: [
      `WITH s AS (SELECT user_id, ts, CASE WHEN EXISTS (SELECT 1 FROM events p WHERE p.user_id = e.user_id AND p.ts < e.ts
AND unixepoch(e.ts) - unixepoch(p.ts) <= 1800) OR EXISTS (SELECT 1 FROM events p WHERE p.user_id = e.user_id AND p.ts = e.ts AND p.id < e.id)
THEN 0 ELSE 1 END AS starts FROM events e)
SELECT a.user_id, a.ts, (SELECT COUNT(*) FROM events b WHERE b.user_id = a.user_id AND b.ts >= a.ts
AND b.ts < COALESCE((SELECT MIN(c.ts) FROM s c WHERE c.user_id = a.user_id AND c.starts = 1 AND c.ts > a.ts), '9999'))
FROM s a WHERE a.starts = 1;`,
    ],
    wrong: [
      `WITH g AS (SELECT user_id, ts, CASE WHEN strftime('%s', ts) - strftime('%s', LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)) < 1800
THEN 0 ELSE 1 END AS n FROM events),
k AS (SELECT user_id, ts, SUM(n) OVER (PARTITION BY user_id ORDER BY ts ROWS UNBOUNDED PRECEDING) AS s FROM g)
SELECT user_id, MIN(ts), COUNT(*) FROM k GROUP BY user_id, s;`,
      `WITH g AS (SELECT user_id, ts, CASE WHEN strftime('%s', ts) - strftime('%s', LAG(ts) OVER (ORDER BY ts)) <= 1800
THEN 0 ELSE 1 END AS n FROM events),
k AS (SELECT user_id, ts, SUM(n) OVER (PARTITION BY user_id ORDER BY ts ROWS UNBOUNDED PRECEDING) AS s FROM g)
SELECT user_id, MIN(ts), COUNT(*) FROM k GROUP BY user_id, s;`,
      `WITH g AS (SELECT user_id, ts, CASE WHEN strftime('%s', ts) - strftime('%s', LAG(ts) OVER (PARTITION BY user_id ORDER BY id)) <= 1800
THEN 0 ELSE 1 END AS n, id FROM events),
k AS (SELECT user_id, ts, SUM(n) OVER (PARTITION BY user_id ORDER BY id) AS s FROM g)
SELECT user_id, MIN(ts), COUNT(*) FROM k GROUP BY user_id, s;`,
    ],
    sample: EVENTS_SAMPLE,
    hidden: [EVENTS_EDGES, EVENTS_SHUFFLED, EVENTS_SINGLE],
  },
  {
    id: 'sql-61',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '最近 7 单的移动平均', en: 'Moving Average of the Last 7 Orders' },
    schema: 'shop',
    tables: ['orders', 'order_items'],
    ordered: true,
    task: {
      zh: '只看已支付且有明细的订单，订单金额是它明细的 `quantity * unit_price` 之和。把这些订单按 `order_date`、再按 `id` 排好。对每个订单，求它和它前面最多 6 个订单（一共最多 7 个）金额的平均值，用 `ROUND(x, 2)` 保留两位小数。按同样的顺序输出。',
      en: 'Take the paid orders that have items; an order’s total is the sum of `quantity * unit_price` over its items. Sort them by `order_date`, then `id`. For each order, average its total with up to 6 orders right before it (at most 7 in all), rounded with `ROUND(x, 2)`. Output in that order.',
    },
    columns: [
      ['id', '订单编号', 'order id'],
      ['order_date', '下单日期', 'order date'],
      ['total', '订单金额', 'order total'],
      ['moving_avg', '最近至多 7 单的平均金额', 'average of the last 7 orders at most'],
    ],
    explanation: {
      zh: '7 个订单依次是 115、80、115、180、30、255、300。第 3 单的平均值是 (115 + 80 + 115) / 3 = 103.33；第 7 单正好凑满 7 个，平均 1075 / 7 = 153.57。',
      en: 'The 7 orders total 115, 80, 115, 180, 30, 255 and 300. The third averages (115 + 80 + 115) / 3 = 103.33; the seventh has exactly 7 and averages 1075 / 7 = 153.57.',
    },
    hints: {
      zh: [
        '`AVG(x) OVER (ORDER BY … ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` 按行数取窗口。',
        '只写 ORDER BY 不写帧时，默认帧是从第一行到当前行（以及和它并列的行），得到的是累计平均。',
      ],
      en: [
        '`AVG(x) OVER (ORDER BY … ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` frames the window by row count.',
        'With an ORDER BY and no frame, the default frame runs from the first row to the current one (and its ties): a running average.',
      ],
    },
    reference: `WITH totals AS (
  SELECT o.id, o.order_date, SUM(i.quantity * i.unit_price) AS total
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'paid'
  GROUP BY o.id, o.order_date
)
SELECT id, order_date, total,
       ROUND(AVG(total) OVER (ORDER BY order_date, id ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS moving_avg
FROM totals
ORDER BY order_date, id;`,
    accepted: [
      `WITH t AS (SELECT o.id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY o.id), r AS (SELECT *, ROW_NUMBER() OVER (ORDER BY order_date, id) AS rn FROM t)
SELECT a.id, a.order_date, a.total, ROUND((SELECT AVG(b.total) FROM r b WHERE b.rn BETWEEN a.rn - 6 AND a.rn), 2)
FROM r a ORDER BY a.rn;`,
    ],
    wrong: [
      `WITH t AS (SELECT o.id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY o.id)
SELECT id, order_date, total, ROUND(AVG(total) OVER (ORDER BY order_date, id), 2) FROM t ORDER BY order_date, id;`,
      `WITH t AS (SELECT o.id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY o.id)
SELECT id, order_date, total, ROUND(AVG(total) OVER (ORDER BY order_date, id ROWS 7 PRECEDING), 2) FROM t ORDER BY order_date, id;`,
      `WITH t AS (SELECT o.id, o.order_date, SUM(i.quantity * i.unit_price) AS total FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid' GROUP BY o.id)
SELECT id, order_date, total, ROUND(AVG(total) OVER (ORDER BY id ROWS 6 PRECEDING), 2) FROM t ORDER BY order_date, id;`,
    ],
    sample: SHOP.sample,
    hidden: [SHOP_BUSY, SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-62',
    group: 'advanced',
    difficulty: '中等',
    title: { zh: '部门里最新入职的人', en: 'Latest Hire in the Department' },
    schema: 'company',
    tables: ['employees'],
    task: {
      zh: '在每位有部门的员工旁边，写出本部门最近入职的人的名字：`hire_date` 最晚的那位，同一天入职的取编号大的。没有部门的员工不出现。',
      en: 'Next to every employee in a department, show the name of the department’s most recent hire: the latest `hire_date`, and the larger id among people hired that same day. Employees without a department are left out.',
    },
    columns: [
      ['id', '员工编号', 'employee id'],
      ['name', '员工姓名', 'employee name'],
      ['latest_hire', '本部门最近入职的人', 'the department’s most recent hire'],
    ],
    explanation: {
      zh: '部门 1 最晚入职的是 2021-03-08 的 Dan，部门 2 是 2023-02-01 的 Gia，部门 3 是 2022-10-03 的 Jack。部门里每个人旁边都写这个名字。',
      en: 'Department 1’s latest hire is Dan (2021-03-08), department 2’s is Gia (2023-02-01) and department 3’s is Jack (2022-10-03). Everyone in a department gets that name.',
    },
    hints: {
      zh: [
        '`LAST_VALUE` 的默认帧只到当前行为止，所以它返回的是当前行自己。',
        '把帧写成 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`，或者倒过来排序用 `FIRST_VALUE`。',
      ],
      en: [
        '`LAST_VALUE`’s default frame ends at the current row, so it returns the current row itself.',
        'Write the frame as `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, or sort the other way and use `FIRST_VALUE`.',
      ],
    },
    reference: `SELECT id, name,
       LAST_VALUE(name) OVER (
         PARTITION BY department_id
         ORDER BY hire_date, id
         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS latest_hire
FROM employees
WHERE department_id IS NOT NULL;`,
    accepted: [
      `SELECT id, name, FIRST_VALUE(name) OVER (PARTITION BY department_id ORDER BY hire_date DESC, id DESC)
FROM employees WHERE department_id IS NOT NULL;`,
    ],
    wrong: [
      `SELECT id, name, LAST_VALUE(name) OVER (PARTITION BY department_id ORDER BY hire_date, id) FROM employees WHERE department_id IS NOT NULL;`,
      `SELECT id, name, MAX(name) OVER (PARTITION BY department_id) FROM employees WHERE department_id IS NOT NULL;`,
      `SELECT id, name, FIRST_VALUE(name) OVER (PARTITION BY department_id ORDER BY hire_date DESC, id) FROM employees WHERE department_id IS NOT NULL;`,
    ],
    sample: COMPANY.sample,
    hidden: [COMPANY_LOOP, COMPANY.ties, COMPANY.topTie],
  },
  // Index design: the learner submits CREATE INDEX statements.
  {
    id: 'sql-71',
    group: 'indexing',
    difficulty: '中等',
    title: { zh: '等值列在前，范围列在后', en: 'Equality First, Range Last' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '客服页面要列出某位客户某个月的订单。最多建 1 个索引，让 SQLite 用它同时定位客户和日期范围。',
      en: 'The support page lists one customer’s orders in one month. Create at most 1 index that lets SQLite use it to find both the customer and the date range.',
    },
    columns: [],
    explanation: {
      zh: '样例输出 `query 1: ok` 是索引建对之后的样子。如果只在 customer_id 上建索引，这一行会是 `query 1: SEARCH orders USING INDEX idx (customer_id=?)`：SQLite 先找出这位客户的全部订单，再一条条检查日期，日期范围没有用上索引。',
      en: 'The sample output `query 1: ok` is what the right index gives. With an index on customer_id alone the line reads `query 1: SEARCH orders USING INDEX idx (customer_id=?)`: SQLite finds all of the customer’s orders and checks their dates one by one, so the date range never uses the index.',
    },
    hints: {
      zh: ['复合索引里，等值比较的列放前面，范围比较的列放后面。', '范围条件之后的列，索引就帮不上忙了。'],
      en: ['In a composite index, put the columns compared with = first and the column compared by range last.', 'Columns after a range condition no longer narrow the search.'],
    },
    index: {
      max: 1,
      queries: [
        {
          sql: "SELECT id, order_date FROM orders WHERE customer_id = 3 AND order_date >= '2024-02-01' AND order_date < '2024-03-01'",
          need: 'customer_id=\\? AND order_date>\\? AND order_date<\\?',
        },
      ],
    },
    reference: 'CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date);',
    accepted: [
      'create index if not exists orders_by_customer on orders(customer_id, order_date, status)',
      'CREATE INDEX a ON orders (customer_id, order_date DESC);',
    ],
    wrong: [
      '-- no index',
      'CREATE INDEX idx ON orders (order_date, customer_id);',
      'CREATE INDEX idx ON orders (customer_id);',
      'CREATE INDEX idx ON orders (customer_id, date(order_date));',
      'CREATE INDEX a ON orders (customer_id); CREATE INDEX b ON orders (order_date);',
      // A quoted name that spells out the needed plan text.
      'CREATE INDEX "x (customer_id=? AND order_date>? AND order_date<?)" ON orders (customer_id);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-72',
    group: 'indexing',
    difficulty: '中等',
    title: { zh: '覆盖索引', en: 'A Covering Index' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '订单历史页面只要日期和状态。最多建 1 个索引，让这条查询只读索引、完全不回表（计划里出现 COVERING INDEX）。',
      en: 'The order history page needs only the date and the status. Create at most 1 index so this query reads the index alone and never the table (the plan says COVERING INDEX).',
    },
    columns: [],
    explanation: {
      zh: '只在 customer_id 上建索引时，输出是 `query 1: SEARCH orders USING INDEX idx (customer_id=?)`：能定位到这位客户，但每找到一行都要回表读取 order_date 和 status。题目要的是计划里出现 COVERING INDEX。',
      en: 'With an index on customer_id alone the output is `query 1: SEARCH orders USING INDEX idx (customer_id=?)`: it finds the customer, but every match goes back to the table for order_date and status. The task wants COVERING INDEX in the plan.',
    },
    hints: {
      zh: ['查询用到的所有列都在索引里时，SQLite 不必再读表。', '用来查找的列放在最前面。'],
      en: ['When every column the query touches is in the index, SQLite need not read the table.', 'The column you search on goes first.'],
    },
    index: {
      max: 1,
      queries: [
        {
          sql: 'SELECT order_date, status FROM orders WHERE customer_id = 1',
          need: 'USING COVERING INDEX \\w+ \\(customer_id=\\?\\)',
        },
      ],
    },
    reference: 'CREATE INDEX idx_orders_history ON orders (customer_id, order_date, status);',
    accepted: ['CREATE INDEX h ON orders (customer_id, status, order_date);'],
    wrong: [
      'CREATE INDEX idx ON orders (customer_id);',
      'CREATE INDEX idx ON orders (customer_id, order_date);',
      'CREATE INDEX idx ON orders (order_date, status, customer_id);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-73',
    group: 'indexing',
    difficulty: '中等',
    title: { zh: '让索引替你排序', en: 'Let the Index Sort' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '对账任务按日期顺序读取所有已支付订单。最多建 1 个索引，让 SQLite 按状态查找，并且直接按索引顺序输出，不再额外排序（计划里没有 USE TEMP B-TREE FOR ORDER BY）。',
      en: 'A reconciliation job reads all paid orders in date order. Create at most 1 index so SQLite searches by status and returns the rows in index order with no extra sort (no USE TEMP B-TREE FOR ORDER BY in the plan).',
    },
    columns: [],
    explanation: {
      zh: '只在 status 上建索引时，输出是 `query 1: SEARCH orders USING INDEX idx (status=?) | USE TEMP B-TREE FOR ORDER BY`：找到的行还得放进临时 B 树按日期再排一次。',
      en: 'With an index on status alone the output is `query 1: SEARCH orders USING INDEX idx (status=?) | USE TEMP B-TREE FOR ORDER BY`: the rows it finds still go through a temporary B-tree to be sorted by date.',
    },
    hints: {
      zh: ['等值条件的列在前，ORDER BY 的列紧跟在后。', '索引条目本身是有序的，顺着读就不用再排序。'],
      en: ['The equality column first, the ORDER BY column right after it.', 'Index entries are stored in order; reading them in order needs no sort.'],
    },
    index: {
      max: 1,
      queries: [
        {
          sql: "SELECT id, order_date FROM orders WHERE status = 'paid' ORDER BY order_date",
          need: '\\(status=\\?\\)',
        },
      ],
    },
    reference: 'CREATE INDEX idx_orders_status_date ON orders (status, order_date);',
    accepted: ['CREATE INDEX s ON orders (status, order_date, customer_id);'],
    wrong: [
      'CREATE INDEX idx ON orders (status);',
      'CREATE INDEX idx ON orders (order_date, status);',
      'CREATE INDEX idx ON orders (order_date);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-74',
    group: 'indexing',
    difficulty: '中等',
    title: { zh: '表达式索引', en: 'An Expression Index' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '登录时按忽略大小写的邮箱找客户，查询里写的是 `lower(email) = …`，不能改。最多建 1 个索引，让这条查询用上它。',
      en: 'Sign-in looks customers up by email ignoring case, and the query compares `lower(email) = …`, which cannot change. Create at most 1 index that this query uses.',
    },
    columns: [],
    explanation: {
      zh: '在 email 上建普通索引时，输出是 `query 1: SCAN customers`：索引里存的是原始邮箱，而查询比较的是 lower(email)，SQLite 只能逐行计算再比较。',
      en: 'With a plain index on email the output is `query 1: SCAN customers`: the index stores the raw addresses while the query compares lower(email), so SQLite computes it row by row.',
    },
    hints: {
      zh: ['索引的列可以是一个表达式，前提是它和查询里写的完全一致。', '对列套了函数的条件，用不上这一列的普通索引。'],
      en: ['An index entry can be an expression, as long as it matches the query’s expression exactly.', 'A condition that wraps a column in a function cannot use that column’s plain index.'],
    },
    index: {
      max: 1,
      queries: [{ sql: "SELECT id, name FROM customers WHERE lower(email) = 'alice@mail.com'", need: '<expr>=\\?' }],
    },
    reference: 'CREATE INDEX idx_customers_email_lower ON customers (lower(email));',
    accepted: ['CREATE INDEX e ON customers (lower(email), name);'],
    wrong: [
      'CREATE INDEX idx ON customers (email);',
      'CREATE INDEX idx ON customers (email COLLATE NOCASE);',
      'CREATE INDEX idx ON customers (upper(email));',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-75',
    group: 'indexing',
    difficulty: '困难',
    title: { zh: 'LIKE 前缀搜索', en: 'A LIKE Prefix Search' },
    schema: 'shop',
    tables: ['customers'],
    task: {
      zh: '后台搜索框按名字前缀找客户，用的是 `name LIKE \'Al%\'`。SQLite 的 LIKE 默认不区分大小写。最多建 1 个索引，让 SQLite 把这个前缀变成索引上的范围查找（计划里是 name>? AND name<?）。',
      en: "The admin search box finds customers by a name prefix with `name LIKE 'Al%'`. SQLite's LIKE ignores case by default. Create at most 1 index that lets SQLite turn the prefix into a range search on the index (name>? AND name<? in the plan).",
    },
    columns: [],
    explanation: {
      zh: '在 name 上建普通索引时，输出是 `query 1: SCAN customers USING COVERING INDEX idx`：SQLite 把整个索引读了一遍，没能变成范围查找，因为普通索引区分大小写，而 LIKE 不区分。',
      en: 'With a plain index on name the output is `query 1: SCAN customers USING COVERING INDEX idx`: SQLite reads the whole index instead of a range, because a plain index is case-sensitive and LIKE is not.',
    },
    hints: {
      zh: ['索引的排序规则要和 LIKE 的比较方式一致。', '列后面可以写 `COLLATE …` 指定索引的排序规则。'],
      en: ['The index must sort the way LIKE compares.', 'Write `COLLATE …` after the column to choose the index’s collation.'],
    },
    index: {
      max: 1,
      queries: [{ sql: "SELECT id, name FROM customers WHERE name LIKE 'Al%'", need: 'name>\\? AND name<\\?' }],
    },
    reference: 'CREATE INDEX idx_customers_name_nocase ON customers (name COLLATE NOCASE);',
    accepted: ['CREATE INDEX n ON customers (name COLLATE NOCASE, city);'],
    wrong: [
      'CREATE INDEX idx ON customers (name);',
      'CREATE INDEX idx ON customers (lower(name));',
      'CREATE INDEX idx ON customers (name COLLATE RTRIM);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-76',
    group: 'indexing',
    difficulty: '中等',
    title: { zh: 'OR 两边各用一个索引', en: 'One Index per OR Branch' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '这条查询找某位客户的订单，或者某一天的订单。最多建 2 个索引，让 OR 的两边都能用索引查找，不再扫全表（计划里是 MULTI-INDEX OR）。',
      en: 'This query finds one customer’s orders or one day’s orders. Create at most 2 indexes so each side of the OR searches an index and the table is never scanned (MULTI-INDEX OR in the plan).',
    },
    columns: [],
    explanation: {
      zh: '只建一个 (customer_id, order_date) 索引时，输出是 `query 1: SCAN orders USING COVERING INDEX idx`：复合索引只帮得上以 customer_id 开头的条件，OR 的另一边还是要逐行检查，于是整个索引都被读了一遍。',
      en: 'With a single index on (customer_id, order_date) the output is `query 1: SCAN orders USING COVERING INDEX idx`: a composite index only helps conditions on customer_id, the other side of the OR still checks every row, so the whole index is read.',
    },
    hints: {
      zh: ['一个复合索引只对以它第一列开头的条件有用。', '两个单列索引可以分别服务 OR 的两边。'],
      en: ['A composite index only helps conditions on its leading column.', 'Two single-column indexes can serve the two sides of an OR.'],
    },
    index: {
      max: 2,
      queries: [
        { sql: "SELECT id FROM orders WHERE customer_id = 2 OR order_date = '2024-03-01'", need: 'MULTI-INDEX OR' },
      ],
    },
    reference: `CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_date ON orders (order_date);`,
    accepted: [
      'CREATE INDEX a ON orders (customer_id, order_date); CREATE INDEX b ON orders (order_date, customer_id);',
    ],
    wrong: [
      'CREATE INDEX idx ON orders (customer_id);',
      'CREATE INDEX idx ON orders (customer_id, order_date);',
      'CREATE INDEX a ON orders (customer_id); CREATE INDEX b ON orders (order_date); CREATE INDEX c ON orders (status);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-77',
    group: 'indexing',
    difficulty: '中等',
    title: { zh: '给外键建索引', en: 'Index the Foreign Key' },
    schema: 'shop',
    tables: ['orders', 'order_items', 'products'],
    task: {
      zh: '这条查询列出某一天所有订单的商品和数量。`products.id` 是主键，已经能直接查找；`order_items.order_id` 指向 `orders.id`，却没有索引。最多建 2 个索引，让三张表都通过索引或主键查找，没有一张被扫描。',
      en: 'This query lists the products and quantities of one day’s orders. `products.id` is the primary key and already supports lookups; `order_items.order_id` points at `orders.id` but has no index. Create at most 2 indexes so all three tables are reached through an index or the primary key and none is scanned.',
    },
    columns: [],
    explanation: {
      zh: '只在 orders(order_date) 上建索引时，输出是 `query 1: SCAN i | SEARCH o USING INTEGER PRIMARY KEY (rowid=?) | SEARCH p USING INTEGER PRIMARY KEY (rowid=?)`：SQLite 从扫描整张 order_items 开始，再按主键找订单和商品。',
      en: 'With an index on orders(order_date) alone the output is `query 1: SCAN i | SEARCH o USING INTEGER PRIMARY KEY (rowid=?) | SEARCH p USING INTEGER PRIMARY KEY (rowid=?)`: SQLite starts by scanning all of order_items and then finds each order and product by primary key.',
    },
    hints: {
      zh: ['主键那一侧已经有索引了，连接时缺的是外键那一侧。', 'WHERE 里过滤的列也需要一个索引作为起点。'],
      en: ['The primary key side already has an index; the join is missing one on the foreign key side.', 'The column filtered in WHERE needs an index to start from too.'],
    },
    index: {
      max: 2,
      queries: [
        {
          sql: `SELECT p.name, i.quantity FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id WHERE o.order_date = '2024-03-01'`,
          need: '^(?=.*\\(order_date=\\?\\))(?=.*\\(order_id=\\?\\))',
        },
      ],
    },
    reference: `CREATE INDEX idx_orders_date ON orders (order_date);
CREATE INDEX idx_items_order ON order_items (order_id);`,
    accepted: [
      'CREATE INDEX d ON orders (order_date); CREATE INDEX i ON order_items (order_id, product_id, quantity);',
    ],
    wrong: [
      'CREATE INDEX idx ON orders (order_date);',
      'CREATE INDEX idx ON order_items (order_id);',
      'CREATE INDEX a ON orders (order_date); CREATE INDEX b ON order_items (product_id);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
  {
    id: 'sql-78',
    group: 'indexing',
    difficulty: '困难',
    title: { zh: '一个索引服务三条查询', en: 'One Index, Three Queries' },
    schema: 'shop',
    tables: ['orders'],
    task: {
      zh: '客户中心有三条按客户查订单的查询，但这张表的写入很多，只允许再建 1 个索引。让三条查询都用这个索引查找：查询 1 和 3 要同时用上客户和状态，查询 3 还不能额外排序，查询 2 不能扫全表。',
      en: 'The customer center runs three queries on one customer’s orders, but the table takes many writes, so only 1 more index is allowed. Make all three search that index: queries 1 and 3 must use both the customer and the status, query 3 must not sort separately, and query 2 must not scan the table.',
    },
    columns: [],
    explanation: {
      zh: '建 (customer_id, status) 时，查询 1 和 2 都是 ok，查询 3 的输出是 `query 3: SEARCH orders USING INDEX idx (customer_id=? AND status=?) | USE TEMP B-TREE FOR ORDER BY`：找得到，但还要额外排序。',
      en: 'With (customer_id, status), queries 1 and 2 are ok, and query 3 prints `query 3: SEARCH orders USING INDEX idx (customer_id=? AND status=?) | USE TEMP B-TREE FOR ORDER BY`: it finds the rows but still sorts them separately.',
    },
    hints: {
      zh: ['复合索引的任意最左前缀都能单独使用。', '先排等值条件的列，再排 ORDER BY 的列。'],
      en: ['Any leftmost prefix of a composite index can be used on its own.', 'Equality columns first, then the ORDER BY column.'],
    },
    index: {
      max: 1,
      queries: [
        { sql: "SELECT COUNT(*) FROM orders WHERE customer_id = 1 AND status = 'paid'", need: 'customer_id=\\? AND status=\\?' },
        { sql: 'SELECT id, order_date FROM orders WHERE customer_id = 1', need: 'customer_id=\\?' },
        {
          sql: "SELECT id FROM orders WHERE customer_id = 1 AND status = 'paid' ORDER BY order_date",
          need: 'customer_id=\\? AND status=\\?',
        },
      ],
    },
    reference: 'CREATE INDEX idx_orders_customer_status_date ON orders (customer_id, status, order_date);',
    accepted: ['CREATE INDEX c ON orders (customer_id, status, order_date, id);'],
    wrong: [
      'CREATE INDEX idx ON orders (customer_id, status);',
      'CREATE INDEX idx ON orders (customer_id, order_date, status);',
      'CREATE INDEX idx ON orders (status, customer_id, order_date);',
      'CREATE INDEX a ON orders (customer_id, status, order_date); CREATE INDEX b ON orders (customer_id);',
    ],
    sample: SHOP.sample,
    hidden: [SHOP.edges, SHOP.shuffled],
  },
];
