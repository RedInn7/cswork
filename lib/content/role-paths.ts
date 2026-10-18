/**
 * Study paths by role (/roadmap?role=): ordered steps over content the site already has.
 * lib/server/role-paths.ts resolves each ref to a title, a link and the items that count it done;
 * tests/role-paths.test.ts checks every ref exists. Client-safe: plain data.
 *
 * Refs by kind:
 * - line-stops: Line 500 stop slugs, comma-separated (lib/route-stops.ts);
 * - sd-part: a system design course part, named by its first chapter (sdParts `from`);
 * - sql-track / pandas: a SQL track group key (lib/content/sql-track.json; pandas is its pd- twin),
 *   or for pandas also a pandas-only group (its pandasGroups);
 * - core-group: a Core Skills group key (lib/content/core-skills.json);
 * - ml-group: an ML Coding group key (lib/content/ml-coding.json);
 * - mcq-topic: an OA multiple-choice topic (lib/content/oa-mcq.json);
 * - project: a resume project slug (lib/content/resume-projects.json);
 * - course: a beginner crash course slug (lib/content/beginner-courses.json).
 *
 * Schedules and learner-made routes (role-paths-v2) are RouteDoc notes: route:role-<key> holds a
 * built-in role's target date, hours and step marks; route:r-<base36> a learner's own route.
 */
import * as z from 'zod/mini';
import { isDay } from '../study-plan';

export const STEP_KINDS = [
  'line-stops',
  'sd-part',
  'sql-track',
  'pandas',
  'core-group',
  'ml-group',
  'mcq-topic',
  'project',
  'course',
] as const;
export type StepKind = (typeof STEP_KINDS)[number];
/** optional: shown as "optional" and left out of the role's progress. */
export type RoleStep = { kind: StepKind; ref: string; optional?: true };

export const ROLE_KEYS = ['generalist', 'backend', 'frontend', 'data', 'ml', 'infra'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export const isRole = (value: unknown): value is RoleKey => ROLE_KEYS.includes(value as RoleKey);

const LINEAR = 'array-foundations,hash-counting,string-processing,two-pointers-windows,prefix-intervals,binary-search,stacks-heaps,greedy-scheduling';
const TREES = 'linked-list,binary-tree,binary-tree-paths,binary-tree-build,binary-search-tree';
const GRAPHS = 'grid-traversal,graph-connectivity,graph-topological,graph-shortest-path,graph-spanning-tree';
const DP_CORE = 'dp-foundations,dp-grid,dp-knapsack,dp-subsequence';
const DESIGN = 'design-containers,design-cache-index,design-trie-serialization';

export const ROLES: Record<RoleKey, { zh: string; en: string; blurbZh: string; blurbEn: string; steps: RoleStep[] }> = {
  generalist: {
    zh: '通用软件工程师',
    en: 'Software engineer (generalist)',
    blurbZh: '大多数新卒和实习岗位的面试：算法占大头，再加一轮系统设计入门、面向对象设计和行为面。',
    blurbEn: 'What most new-grad and intern loops look like: mostly algorithms, plus intro system design, object-oriented design and behavioral.',
    steps: [
      { kind: 'course', ref: 'big-o', optional: true },
      { kind: 'line-stops', ref: LINEAR },
      { kind: 'mcq-topic', ref: 'complexity' },
      { kind: 'line-stops', ref: TREES },
      { kind: 'line-stops', ref: GRAPHS },
      { kind: 'core-group', ref: 'hash-heap' },
      { kind: 'line-stops', ref: `backtracking-enumeration,${DP_CORE}` },
      { kind: 'mcq-topic', ref: 'dsa' },
      { kind: 'sd-part', ref: 'framework' },
      { kind: 'sd-part', ref: 'ood-interview-approach' },
      { kind: 'core-group', ref: 'ood' },
      { kind: 'mcq-topic', ref: 'oop', optional: true },
      { kind: 'project', ref: 'leaderboard' },
    ],
  },
  backend: {
    zh: '后端工程师',
    en: 'Backend engineer',
    blurbZh: '算法之外更看重系统设计、API、数据库和并发，简历项目最好是能讲清楚取舍的服务。',
    blurbEn: 'Beyond algorithms: system design, APIs, databases and concurrency, and a resume project whose trade-offs you can defend.',
    steps: [
      { kind: 'line-stops', ref: LINEAR },
      { kind: 'line-stops', ref: `${TREES},${GRAPHS}` },
      { kind: 'line-stops', ref: DESIGN },
      { kind: 'core-group', ref: 'hash-heap' },
      { kind: 'sd-part', ref: 'framework' },
      { kind: 'sd-part', ref: 'api-rest-vs-rpc-graphql' },
      { kind: 'sql-track', ref: 'joins' },
      { kind: 'sql-track', ref: 'grouping' },
      { kind: 'mcq-topic', ref: 'dbms' },
      { kind: 'sql-track', ref: 'indexing', optional: true },
      { kind: 'sd-part', ref: 'concurrency-primitives' },
      { kind: 'core-group', ref: 'concurrency' },
      { kind: 'core-group', ref: 'ood' },
      { kind: 'course', ref: 'network', optional: true },
      { kind: 'mcq-topic', ref: 'network' },
      { kind: 'sd-part', ref: 'tech-kafka', optional: true },
      { kind: 'project', ref: 'rate-limiter' },
      { kind: 'project', ref: 'task-queue' },
      { kind: 'project', ref: 'kv-wal', optional: true },
    ],
  },
  frontend: {
    zh: '前端工程师',
    en: 'Frontend engineer',
    blurbZh: '算法要求通常轻一些，重点是 JavaScript、浏览器和 Web 安全的基础，以及能讲清楚的前后端交互。',
    blurbEn: 'Usually lighter on algorithms; the focus is JavaScript, the browser and web security basics, and how the front end talks to services.',
    steps: [
      { kind: 'line-stops', ref: 'array-foundations,hash-counting,string-processing,two-pointers-windows,stacks-heaps' },
      { kind: 'mcq-topic', ref: 'js' },
      { kind: 'mcq-topic', ref: 'web' },
      { kind: 'line-stops', ref: 'linked-list,binary-tree,grid-traversal' },
      { kind: 'mcq-topic', ref: 'security' },
      { kind: 'sd-part', ref: 'api-rest-vs-rpc-graphql' },
      { kind: 'mcq-topic', ref: 'network', optional: true },
      { kind: 'project', ref: 'feature-flags' },
    ],
  },
  data: {
    zh: '数据分析 / 数据工程',
    en: 'Data analyst / data engineer',
    blurbZh: 'SQL 是第一关，其次是 Pandas、统计和数据管道；算法题多为简单到中等。',
    blurbEn: 'SQL comes first, then pandas, statistics and data pipelines; coding questions are mostly easy to medium.',
    steps: [
      { kind: 'course', ref: 'sql', optional: true },
      { kind: 'sql-track', ref: 'basics' },
      { kind: 'sql-track', ref: 'joins' },
      { kind: 'sql-track', ref: 'grouping' },
      { kind: 'sql-track', ref: 'subqueries' },
      { kind: 'sql-track', ref: 'windows' },
      { kind: 'sql-track', ref: 'dates' },
      { kind: 'sql-track', ref: 'advanced', optional: true },
      { kind: 'mcq-topic', ref: 'sql' },
      { kind: 'pandas', ref: 'grouping' },
      { kind: 'pandas', ref: 'windows', optional: true },
      { kind: 'pandas', ref: 'reshape' },
      { kind: 'pandas', ref: 'timeseries' },
      { kind: 'pandas', ref: 'cleaning' },
      { kind: 'mcq-topic', ref: 'probability' },
      { kind: 'mcq-topic', ref: 'stats' },
      { kind: 'mcq-topic', ref: 'numpy', optional: true },
      { kind: 'ml-group', ref: 'metrics', optional: true },
      { kind: 'line-stops', ref: 'array-foundations,hash-counting,string-processing,two-pointers-windows' },
      { kind: 'mcq-topic', ref: 'dbms', optional: true },
      { kind: 'project', ref: 'idempotent-etl' },
      { kind: 'project', ref: 'log-search', optional: true },
    ],
  },
  ml: {
    zh: '机器学习工程师',
    en: 'Machine learning engineer',
    blurbZh: '编码轮和通用软件工程师相近，另有用 numpy 手写模型、ML 系统设计和概率统计；简历项目要能体现数据处理。',
    blurbEn: 'Coding rounds like a generalist’s, plus models written from scratch in numpy, ML system design and probability; a resume project should show real data work.',
    steps: [
      { kind: 'course', ref: 'python', optional: true },
      { kind: 'line-stops', ref: LINEAR },
      { kind: 'line-stops', ref: `${TREES},${DP_CORE}` },
      { kind: 'mcq-topic', ref: 'probability' },
      { kind: 'mcq-topic', ref: 'stats' },
      { kind: 'pandas', ref: 'grouping' },
      { kind: 'pandas', ref: 'joins' },
      { kind: 'ml-group', ref: 'models' },
      { kind: 'mcq-topic', ref: 'ml' },
      { kind: 'ml-group', ref: 'deep', optional: true },
      { kind: 'sd-part', ref: 'framework' },
      { kind: 'sd-part', ref: 'ml-design-framework' },
      { kind: 'mcq-topic', ref: 'python', optional: true },
      { kind: 'project', ref: 'polite-crawler' },
      { kind: 'project', ref: 'idempotent-etl', optional: true },
    ],
  },
  infra: {
    zh: '基础设施 / SRE',
    en: 'Infrastructure / SRE',
    blurbZh: '操作系统、网络、Linux 和并发问得最深，系统设计偏存储和消息系统，项目最好是自己写过的底层组件。',
    blurbEn: 'The deepest questions are on operating systems, networking, Linux and concurrency; design leans to storage and messaging, and the best project is a low-level component you built.',
    steps: [
      { kind: 'line-stops', ref: LINEAR },
      { kind: 'line-stops', ref: `${GRAPHS},design-cache-index` },
      { kind: 'course', ref: 'os' },
      { kind: 'mcq-topic', ref: 'os' },
      { kind: 'mcq-topic', ref: 'linux' },
      { kind: 'course', ref: 'network' },
      { kind: 'mcq-topic', ref: 'network' },
      { kind: 'core-group', ref: 'concurrency' },
      { kind: 'sd-part', ref: 'concurrency-primitives' },
      { kind: 'sd-part', ref: 'framework' },
      { kind: 'sd-part', ref: 'tech-kafka' },
      { kind: 'mcq-topic', ref: 'arch', optional: true },
      { kind: 'course', ref: 'go', optional: true },
      { kind: 'project', ref: 'lru-ttl-cache' },
      { kind: 'project', ref: 'kv-wal' },
      { kind: 'project', ref: 'mini-redis', optional: true },
    ],
  },
};

/** A step as /roadmap shows it (lib/server/role-paths.ts resolveRolePath). */
export type ResolvedStep = RoleStep & {
  /** '' for an mcq-topic: components/role-path.tsx names it (its names live in a client module). */
  title: string;
  href: string;
  /**
   * What counts it done: problem:<id> solved (or ticked done), sd:<key> read, mcq:<id> answered,
   * content:project/<slug> marked done.
   */
  keys: string[];
  /** A line-stops step's stops, and its study plan link (PLAN_TOPICS_PARAM). */
  stops?: { slug: string; name: string; href: string }[];
  plan?: string;
  /** Estimated minutes to work through it all (lib/server/role-paths.ts). */
  minutes: number;
};
/** Step titles: a kind's label, then the name of what it points at. */
export const STEP_LABELS: Record<StepKind, [string, string] | null> = {
  'line-stops': ['Line 500', 'Line 500'],
  'sd-part': ['系统设计', 'System design'],
  'sql-track': ['SQL', 'SQL'],
  pandas: ['Pandas', 'Pandas'],
  'core-group': ['Core Skills', 'Core Skills'],
  'ml-group': ['ML Coding', 'ML Coding'],
  'mcq-topic': ['选择题', 'Multiple choice'],
  project: ['简历项目', 'Resume project'],
  course: null,
};
export function stepTitle(kind: StepKind, name: string, zh: boolean) {
  const label = STEP_LABELS[kind];
  return label ? `${label[zh ? 0 : 1]}${zh ? '：' : ': '}${name}` : name;
}
/** A line-stops step's name. */
export const stopsName = (stops: number, problems: number, zh: boolean) =>
  zh ? `${stops} 站，${problems} 题` : `${stops} stops, ${problems} problems`;
/** A counted step is done at this share of its keys, as a Line 500 stop is "done" at 80% solved. */
export const STEP_DONE = 0.8;

/** A learner's own entry on a route (say "CS61B lectures 1–12"): a title and units, never a link. */
export type ExtStep = { kind: 'ext'; id: string; title: string; units: number; done: number; unitMinutes: number };
export type RouteStep = RoleStep | ExtStep;
/** A route note's body. A built-in role's (from absent, steps absent) keeps only the schedule and marks. */
export type RouteDoc = {
  v: 1;
  name?: string;
  from?: RoleKey;
  steps?: RouteStep[];
  targetDate: string;
  weeklyHours: number;
  /** Step id -> marked in progress, or known already and skipped. */
  state: Record<string, 'doing' | 'skip'>;
  /** Step id -> the finish day saved with "Save schedule", to tell when the learner falls behind. */
  planned: Record<string, string>;
};
export const ROUTE_ID = /^r-[a-z0-9]{1,20}$/;
export const ROUTE_MAX_STEPS = 80;
export const ROUTE_DEFAULT: RouteDoc = { v: 1, targetDate: '', weeklyHours: 10, state: {}, planned: {} };
/** A site step is `kind:ref` (unique on a route), an entry of the learner's `ext-<6>`. */
export const stepId = (step: RouteStep) => (step.kind === 'ext' ? step.id : `${step.kind}:${step.ref}`);

// zod/mini: this module ships to the browser (components/role-path.tsx) and the full zod is heavy there.
const day = z.string().check(z.refine(isDay));
const count = (min: number, max: number) => z.int().check(z.minimum(min), z.maximum(max));
const stepKey = z.string().check(z.maxLength(420));
const few = (o: object) => Object.keys(o).length <= 200;
const routeSchema = z.strictObject({
  v: z.literal(1),
  name: z.optional(z.string().check(z.trim(), z.minLength(1), z.maxLength(60))),
  from: z.optional(z.enum(ROLE_KEYS)),
  steps: z.optional(
    z
      .array(
        z.union([
          z.strictObject({
            kind: z.enum(STEP_KINDS),
            ref: z.string().check(z.regex(/^[\w,-]{1,400}$/)),
            optional: z.optional(z.literal(true)),
          }),
          z
            .strictObject({
              kind: z.literal('ext'),
              id: z.string().check(z.regex(/^ext-[a-z0-9]{6}$/)),
              title: z.string().check(z.trim(), z.minLength(1), z.maxLength(80)),
              units: count(1, 500),
              done: count(0, 500),
              unitMinutes: z._default(count(5, 600), 60),
            })
            .check(z.refine((step) => step.done <= step.units)),
        ]),
      )
      .check(
        z.maxLength(ROUTE_MAX_STEPS),
        z.refine((steps) => new Set(steps.map(stepId)).size === steps.length),
      ),
  ),
  targetDate: z.union([z.literal(''), day]),
  weeklyHours: count(1, 40),
  state: z.record(stepKey, z.enum(['doing', 'skip'])).check(z.refine(few)),
  planned: z.record(stepKey, day).check(z.refine(few)),
});
/** Kinds of removed features (fe-js: the frontend JS track; mock-kind: mock interviews) that saved routes may still hold: dropped on read. */
const REMOVED_KINDS: unknown[] = ['fe-js', 'mock-kind'];
function dropRemoved(doc: unknown) {
  const steps = (doc as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps)) return doc;
  return { ...(doc as object), steps: steps.filter((s) => !REMOVED_KINDS.includes((s as { kind?: unknown } | null)?.kind)) };
}
/** A route note's body (JSON text, or already parsed), or null when it is not a valid route. */
export function parseRoute(body: unknown): RouteDoc | null {
  try {
    const parsed = routeSchema.safeParse(dropRemoved(typeof body === 'string' ? JSON.parse(body) : body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
/** route:role-<key> holds a built-in role's settings (no steps), route:r-<id> a learner's route (steps). */
export function routeFits(target: string, doc: RouteDoc) {
  const m = /^route:(?:role-(.+)|(r-.+))$/.exec(target);
  return !!m && (m[1] ? isRole(m[1]) && !doc.steps : ROUTE_ID.test(m[2]) && !!doc.steps);
}
