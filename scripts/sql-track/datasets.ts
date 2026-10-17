/**
 * SQL track schemas, hand-written datasets and seeded random generators. All
 * data is invented for CSWork. Rows list values in CREATE TABLE column order.
 */
export type Value = string | number | null;
export type Data = Record<string, Value[][]>;
export type SchemaName = 'company' | 'shop' | 'school' | 'app';

export const SCHEMAS: Record<SchemaName, Record<string, string>> = {
  company: {
    departments: `CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);`,
    employees: `CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER,   -- NULL: not in any department
  manager_id INTEGER,      -- NULL: no manager
  salary INTEGER NOT NULL,
  hire_date TEXT NOT NULL  -- 'YYYY-MM-DD'
);`,
  },
  shop: {
    customers: `CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT                -- NULL: unknown
);`,
    products: `CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL   -- list price
);`,
    orders: `CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,     -- NULL: guest checkout
  order_date TEXT NOT NULL, -- 'YYYY-MM-DD'
  status TEXT NOT NULL     -- 'paid' or 'cancelled'
);`,
    order_items: `CREATE TABLE order_items (
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL -- price actually charged per unit
);`,
    product_parts: `CREATE TABLE product_parts (
  product_id INTEGER NOT NULL, -- the assembly
  part_id INTEGER NOT NULL,    -- a product it is built from
  quantity INTEGER NOT NULL    -- units of the part per assembly
);`,
  },
  school: {
    courses: `CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);`,
    enrollments: `CREATE TABLE enrollments (
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  score INTEGER            -- NULL: did not sit the exam
);`,
  },
  app: {
    logins: `CREATE TABLE logins (
  user_id INTEGER NOT NULL,
  login_date TEXT NOT NULL -- 'YYYY-MM-DD'; several logins a day are possible
);`,
    events: `CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ts TEXT NOT NULL,        -- 'YYYY-MM-DD HH:MM:SS'
  payload TEXT NOT NULL    -- a JSON object
);`,
  },
};

export const COMPANY = {
  sample: {
    departments: [[1, 'Engineering'], [2, 'Sales'], [3, 'Support'], [4, 'Legal']],
    employees: [
      [1, 'Ava', 1, null, 12000, '2018-04-02'],
      [2, 'Ben', 1, 1, 9000, '2019-07-15'],
      [3, 'Chloe', 1, 1, 9000, '2020-01-20'],
      [4, 'Dan', 1, 2, 7000, '2021-03-08'],
      [5, 'Eve', 2, null, 8000, '2018-11-30'],
      [6, 'Finn', 2, 5, 8500, '2022-05-16'],
      [7, 'Gia', 2, 5, 6000, '2023-02-01'],
      [8, 'Hugo', 3, 42, 5000, '2021-09-12'],
      [9, 'Iris', null, 1, 4500, '2024-01-08'],
      [10, 'Jack', 3, 8, 5500, '2022-10-03'],
    ],
  },
  /** Many equal salaries, an employee paid the same as the manager, people without a department. */
  ties: {
    departments: [[1, 'Research'], [2, 'Design']],
    employees: [
      [1, 'Kai', 1, null, 7000, '2019-01-01'],
      [2, 'Lea', 1, 1, 7000, '2019-02-01'],
      [3, 'Max', 1, 1, 7000, '2019-03-01'],
      [4, 'Nia', 1, 2, 6500, '2020-01-01'],
      [5, 'Omar', 1, 2, 6000, '2020-02-01'],
      [6, 'Pia', 1, 3, 5500, '2021-01-01'],
      [7, 'Quin', 2, 1, 8000, '2021-06-01'],
      [8, 'Rosa', null, null, 9000, '2022-01-01'],
      [9, 'Sam', null, 8, 9500, '2022-02-02'],
    ],
  },
  /** The top salary is shared, a manager id points at nobody, a department is empty. */
  topTie: {
    departments: [[1, 'Finance'], [2, 'Ops'], [3, 'Facilities']],
    employees: [
      [1, 'Tara', 1, null, 10000, '2018-01-01'],
      [2, 'Uma', 1, 1, 10000, '2018-05-01'],
      [3, 'Vic', 2, 77, 3000, '2020-01-01'],
      [4, 'Wes', 2, 3, 3000, '2020-06-01'],
      [5, 'Xia', 2, 3, 3200, '2021-01-01'],
    ],
  },
  /** Everyone earns the same: there is no second salary. */
  flat: {
    departments: [[1, 'Solo']],
    employees: [
      [1, 'Yara', 1, null, 5000, '2020-01-01'],
      [2, 'Zane', 1, 1, 5000, '2020-02-01'],
    ],
  },
} satisfies Record<string, Data>;

export const SHOP = {
  sample: {
    customers: [
      [1, 'Alice', 'alice@mail.com', 'Austin'],
      [2, 'Bob', 'bob@mail.com', 'Boston'],
      [3, 'Cara', 'Alice@Mail.com', 'Austin'],
      [4, 'Dev', 'dev@mail.com', null],
      [5, 'Elle', 'elle@mail.com', 'Boston'],
      [6, 'Femi', 'femi@mail.com', 'Austin'],
    ],
    products: [
      [1, 'SQL Basics', 'Books', 30],
      [2, 'Graph Theory', 'Books', 45],
      [3, 'Chess Set', 'Games', 60],
      [4, 'Puzzle Box', 'Games', 25],
      [5, 'Chef Knife', 'Kitchen', 80],
    ],
    orders: [
      [1, 1, '2024-01-05', 'paid'],
      [2, 1, '2024-01-20', 'paid'],
      [3, 2, '2024-01-20', 'cancelled'],
      [4, 3, '2024-02-02', 'paid'],
      [5, 1, '2024-02-14', 'paid'],
      [6, null, '2024-02-14', 'paid'],
      [7, 5, '2024-03-01', 'paid'],
      [8, 3, '2024-03-01', 'paid'],
      [9, 1, '2024-03-09', 'cancelled'],
    ],
    order_items: [
      [1, 1, 2, 30],
      [1, 3, 1, 55],
      [2, 5, 1, 80],
      [3, 4, 4, 25],
      [4, 2, 2, 45],
      [4, 4, 1, 25],
      [5, 3, 3, 60],
      [6, 1, 1, 30],
      [7, 5, 2, 75],
      [7, 2, 1, 45],
      [7, 3, 1, 60],
      [8, 1, 10, 30],
      [9, 5, 1, 80],
    ],
  },
  /** Guests, cancelled-only customers, same-day ties, case-only email duplicates, a 300 boundary. */
  edges: {
    customers: [
      [1, 'Gus', 'gus@mail.com', 'Denver'],
      [2, 'Hana', 'HANA@mail.com', 'Denver'],
      [3, 'Ian', 'hana@mail.com', null],
      [4, 'Jo', 'jo@mail.com', null],
      [5, 'Kim', 'Jo@Mail.com', 'Denver'],
      [6, 'Lu', 'lu@mail.com', 'Seattle'],
    ],
    products: [
      [1, 'Trowel', 'Garden', 20],
      [2, 'Seeds', 'Garden', 5],
      [3, 'Novel', 'Books', 15],
    ],
    orders: [
      [1, 1, '2024-04-01', 'paid'],
      [2, 1, '2024-04-01', 'paid'],
      [3, 1, '2024-04-03', 'paid'],
      [4, 2, '2024-04-03', 'cancelled'],
      [5, 2, '2024-04-03', 'cancelled'],
      [6, 2, '2024-04-04', 'cancelled'],
      [7, null, '2024-04-04', 'paid'],
      [8, 4, '2024-05-10', 'paid'],
      [9, 4, '2024-05-10', 'paid'],
    ],
    order_items: [
      [1, 1, 3, 20],
      [1, 3, 1, 15],
      [2, 2, 10, 5],
      [3, 1, 5, 20],
      [4, 3, 2, 15],
      [5, 1, 1, 20],
      [6, 2, 1, 5],
      [7, 1, 1, 18],
      [8, 2, 4, 5],
      [9, 3, 19, 15],
    ],
  },
  /** A larger order id with an earlier date, a guest's late order, gaps between months. */
  shuffled: {
    customers: [
      [1, 'Mo', 'mo@mail.com', 'Austin'],
      [2, 'Ned', 'ned@mail.com', 'Austin'],
      [3, 'Ola', 'ola@mail.com', 'Austin'],
    ],
    products: [
      [1, 'Lamp', 'Home', 40],
      [2, 'Mug', 'Kitchen', 12],
    ],
    orders: [
      [1, 1, '2024-06-30', 'paid'],
      [2, 1, '2024-06-01', 'paid'],
      [3, 2, '2024-05-15', 'cancelled'],
      [4, 2, '2024-05-20', 'paid'],
      [5, 3, '2024-07-01', 'paid'],
      [6, null, '2024-08-01', 'paid'],
    ],
    order_items: [
      [1, 1, 1, 40],
      [1, 2, 1, 12],
      [2, 2, 25, 12],
      [4, 1, 10, 40],
      [5, 2, 1, 12],
      [6, 1, 8, 40],
    ],
  },
} satisfies Record<string, Data>;

export const SCHOOL = {
  sample: {
    courses: [[1, 'Algebra'], [2, 'Biology'], [3, 'Chemistry'], [4, 'Drama']],
    enrollments: [
      [1, 1, 90],
      [2, 1, 75],
      [3, 1, null],
      [1, 2, 88],
      [4, 2, null],
      [2, 3, null],
      [3, 3, null],
    ],
  },
  /** Averages that need rounding; a course where only one student sat. */
  rounding: {
    courses: [[1, 'Databases'], [2, 'Economics'], [3, 'French']],
    enrollments: [
      [1, 1, 70],
      [2, 1, 80],
      [3, 1, 85],
      [1, 2, null],
      [2, 2, null],
      [3, 2, 100],
      [1, 3, 61],
      [2, 3, 62],
    ],
  },
  /** A score of 0 is a result, NULL is an absence. */
  zero: {
    courses: [[1, 'Geometry'], [2, 'History']],
    enrollments: [
      [1, 1, 0],
      [2, 1, null],
    ],
  },
} satisfies Record<string, Data>;

export const APP = {
  sample: {
    logins: [
      [1, '2024-02-27'],
      [1, '2024-02-28'],
      [1, '2024-02-28'],
      [1, '2024-02-29'],
      [1, '2024-03-02'],
      [2, '2024-02-27'],
      [2, '2024-03-01'],
      [3, '2024-03-01'],
      [3, '2024-03-02'],
      [3, '2024-03-03'],
      [4, '2024-02-28'],
      [4, '2024-02-29'],
    ],
  },
  /** A repeated day before a gap, month and year boundaries. */
  boundaries: {
    logins: [
      [5, '2024-01-01'],
      [5, '2024-01-02'],
      [5, '2024-01-02'],
      [5, '2024-01-04'],
      [6, '2024-01-30'],
      [6, '2024-01-31'],
      [6, '2024-02-01'],
      [7, '2024-12-30'],
      [7, '2024-12-31'],
      [7, '2025-01-01'],
      [7, '2025-01-02'],
    ],
  },
  /** Nobody logs in three days running; a repeat on the first day is not a return. */
  sparse: {
    logins: [
      [8, '2024-05-01'],
      [8, '2024-05-01'],
      [9, '2024-05-01'],
      [9, '2024-05-03'],
      [10, '2024-05-02'],
      [10, '2024-05-03'],
    ],
  },
} satisfies Record<string, Data>;

/** mulberry32: small, seeded, the same on every machine. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, items: readonly T[]) => items[Math.floor(rng() * items.length)];
const shuffle = <T>(rng: Rng, items: readonly T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const NAMES = [
  'Abe', 'Bea', 'Cal', 'Dee', 'Eli', 'Fay', 'Gil', 'Hal', 'Ida', 'Jon', 'Kay', 'Lev',
  'Mia', 'Nat', 'Oz', 'Pam', 'Ray', 'Sue', 'Ted', 'Una', 'Val', 'Wyn', 'Xan', 'Yul', 'Zoe',
];
const day = (base: string, offset: number) => {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const GENERATORS: Record<SchemaName, (rng: Rng) => Data> = {
  company(rng) {
    const departments = shuffle(rng, ['Engineering', 'Sales', 'Support', 'Finance', 'Design', 'Legal'])
      .slice(0, int(rng, 3, 5))
      .map((name, i) => [i + 1, name]);
    const n = int(rng, 10, 20);
    const salaries = [3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 12000];
    const employees = shuffle(rng, NAMES)
      .slice(0, n)
      .map((name, i) => {
        const id = i + 1;
        const r = rng();
        let manager: number | null = null;
        if (r >= 0.15 && n > 1) {
          manager = r < 0.22 ? int(rng, 90, 99) : int(rng, 1, n - 1);
          if (manager === id) manager = n; // never one's own manager
        }
        return [
          id,
          name,
          rng() < 0.12 ? null : int(rng, 1, departments.length),
          manager,
          pick(rng, salaries),
          day('2018-01-01', int(rng, 0, 2400)),
        ];
      });
    return { departments, employees };
  },
  shop(rng) {
    const customers: Value[][] = [];
    shuffle(rng, NAMES)
      .slice(0, int(rng, 6, 12))
      .forEach((name, i) => {
        const prior = customers.length && rng() < 0.25 ? String(pick(rng, customers)[2]) : null;
        // A reused address differs only in letter case, like a typo at signup.
        const email = prior ? prior[0].toUpperCase() + prior.slice(1) : `${name.toLowerCase()}@mail.com`;
        customers.push([i + 1, name, email, rng() < 0.2 ? null : pick(rng, ['Austin', 'Boston', 'Denver', 'Seattle'])]);
      });
    const catalogue: [string, string][] = [
      ['Atlas', 'Books'], ['Novel', 'Books'], ['Cookbook', 'Books'],
      ['Chess Set', 'Games'], ['Puzzle', 'Games'], ['Dice', 'Games'],
      ['Trowel', 'Garden'], ['Seeds', 'Garden'], ['Hose', 'Garden'],
      ['Knife', 'Kitchen'], ['Pan', 'Kitchen'], ['Mug', 'Kitchen'],
    ];
    const products = shuffle(rng, catalogue)
      .slice(0, int(rng, 5, 8))
      .map(([name, category], i) => [i + 1, name, category, int(rng, 5, 60)]);
    const orders: Value[][] = [];
    const items: Value[][] = [];
    const count = int(rng, 8, 20);
    for (let id = 1; id <= count; id++) {
      orders.push([
        id,
        rng() < 0.1 ? null : int(rng, 1, customers.length),
        day('2024-01-01', int(rng, 0, 150)),
        rng() < 0.75 ? 'paid' : 'cancelled',
      ]);
      for (const product of shuffle(rng, products).slice(0, pick(rng, [0, 1, 1, 2, 2, 3]))) {
        const price = Number(product[3]);
        items.push([id, product[0], int(rng, 1, 3), price - int(rng, 0, Math.floor(price / 5))]);
      }
    }
    // Drawn after everything else, so the older tables' random data stays the same.
    // Parts only point at higher ids: the assemblies form no cycle; product 1 always has parts.
    const parts: Value[][] = [];
    for (let id = 1; id < products.length; id++) {
      const later = products.slice(id).map((product) => Number(product[0]));
      for (const part of shuffle(rng, later).slice(0, id === 1 ? int(rng, 1, 2) : pick(rng, [0, 0, 1, 2])))
        parts.push([id, part, int(rng, 1, 4)]);
    }
    return { customers, products, orders, order_items: items, product_parts: parts };
  },
  school(rng) {
    const courses = shuffle(rng, ['Algebra', 'Biology', 'Chemistry', 'Databases', 'Economics', 'French'])
      .slice(0, int(rng, 3, 5))
      .map((title, i) => [i + 1, title]);
    const enrollments: Value[][] = [];
    for (let student = 1; student <= int(rng, 6, 12); student++)
      for (const course of courses)
        if (rng() < 0.5) enrollments.push([student, course[0], rng() < 0.2 ? null : int(rng, 40, 100)]);
    return { courses, enrollments };
  },
  app(rng) {
    const logins: Value[][] = [];
    for (let user = 1; user <= int(rng, 4, 8); user++) {
      let offset = int(rng, 0, 20);
      for (let k = int(rng, 1, 6); k > 0; k--) {
        const date = day('2024-02-15', offset);
        logins.push([user, date]);
        if (rng() < 0.2) logins.push([user, date]);
        offset += pick(rng, [1, 1, 1, 2, 2, 3, 5]);
      }
    }
    const shuffled = shuffle(rng, logins);
    // Drawn after the logins, so their random data stays the same.
    const events: Value[][] = [];
    const users = int(rng, 2, 5);
    for (let id = 1; id <= int(rng, 6, 18); id++) {
      const at = new Date(Date.UTC(2024, 2, 1 + int(rng, 0, 2), int(rng, 8, 11), int(rng, 0, 179)));
      const payload: Record<string, unknown> = { type: pick(rng, ['view', 'view', 'click', 'buy']) };
      const page = rng();
      if (page < 0.7) payload.page = pick(rng, ['/home', '/cart', '/item']);
      else if (page < 0.85) payload.page = null;
      if (rng() < 0.8) payload.ms = int(rng, 1, 40) * 25;
      const tags = pick(rng, [0, 1, 1, 2, 3, -1]);
      if (tags >= 0) payload.tags = shuffle(rng, ['new', 'promo', 'mobile', 'ad']).slice(0, tags);
      events.push([id, int(rng, 1, users), at.toISOString().slice(0, 19).replace('T', ' '), JSON.stringify(payload)]);
    }
    return { logins: shuffled, events };
  },
};
