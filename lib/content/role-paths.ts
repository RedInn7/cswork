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
 * - course: a beginner crash course slug (lib/content/beginner-courses.json);
 * - fe-js: a frontend JS problem group key (lib/content/frontend-js.json), judged on /frontend;
 * - mock-kind: a mock interview template id (lib/mock-interview.ts); never counted, and an AI-only
 *   template reads "unavailable" while AI is off.
 */
export type StepKind =
  | 'line-stops'
  | 'sd-part'
  | 'sql-track'
  | 'pandas'
  | 'core-group'
  | 'ml-group'
  | 'mcq-topic'
  | 'project'
  | 'course'
  | 'fe-js'
  | 'mock-kind';
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
      { kind: 'mock-kind', ref: 'phone' },
      { kind: 'mock-kind', ref: 'behavioral' },
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
      { kind: 'mcq-topic', ref: 'network' },
      { kind: 'sd-part', ref: 'tech-kafka', optional: true },
      { kind: 'project', ref: 'rate-limiter' },
      { kind: 'project', ref: 'task-queue' },
      { kind: 'project', ref: 'kv-wal', optional: true },
      { kind: 'mock-kind', ref: 'onsite' },
      { kind: 'mock-kind', ref: 'api' },
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
      { kind: 'fe-js', ref: 'timing' },
      { kind: 'fe-js', ref: 'promise' },
      { kind: 'fe-js', ref: 'internals' },
      { kind: 'mcq-topic', ref: 'web' },
      { kind: 'line-stops', ref: 'linked-list,binary-tree,grid-traversal' },
      { kind: 'mcq-topic', ref: 'security' },
      { kind: 'sd-part', ref: 'api-rest-vs-rpc-graphql' },
      { kind: 'mcq-topic', ref: 'network', optional: true },
      { kind: 'project', ref: 'feature-flags' },
      { kind: 'mock-kind', ref: 'frontend' },
      { kind: 'mock-kind', ref: 'behavioral' },
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
      { kind: 'mock-kind', ref: 'ds' },
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
      { kind: 'mock-kind', ref: 'mle' },
      { kind: 'mock-kind', ref: 'behavioral' },
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
      { kind: 'mcq-topic', ref: 'os' },
      { kind: 'mcq-topic', ref: 'linux' },
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
      { kind: 'mock-kind', ref: 'onsite' },
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
   * content:project/<slug> or content:fe-js/<slug> marked done. Empty: never counted (a mock interview).
   */
  keys: string[];
  /** A line-stops step's stops, and its study plan link (PLAN_TOPICS_PARAM). */
  stops?: { slug: string; name: string; href: string }[];
  plan?: string;
  /** An AI-only mock interview while AI is off: shown as unavailable, never counted. */
  unavailable?: true;
};
/** Step titles: a kind's label, then the name of what it points at. */
const STEP_LABELS: Record<StepKind, [string, string] | null> = {
  'line-stops': ['Line 500', 'Line 500'],
  'sd-part': ['系统设计', 'System design'],
  'sql-track': ['SQL', 'SQL'],
  pandas: ['Pandas', 'Pandas'],
  'core-group': ['Core Skills', 'Core Skills'],
  'ml-group': ['ML Coding', 'ML Coding'],
  'mcq-topic': ['选择题', 'Multiple choice'],
  project: ['简历项目', 'Resume project'],
  course: null,
  'fe-js': ['前端手写题', 'Frontend JS'],
  'mock-kind': ['模拟面试', 'Mock interview'],
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
