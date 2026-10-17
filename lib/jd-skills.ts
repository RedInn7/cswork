import type { CodeLanguage } from './problems';

/**
 * The fixed skill list of the JD readiness checklist (/career/jd, components/jd-readiness.tsx):
 * the model may only pick from it (lib/server/ai-jd.ts), and each skill has its page on the site
 * and the learner data that measures it. Client-safe: no server imports.
 */
// Postings often run 5-10k characters (the resume review's JOB_CHARS is 4000): past JD_CHARS the text is cut, not refused.
export const JD_CHARS = 10_000;
export const JD_MIN = 80;
export const JD_SKILLS = [
  'dsa', 'sql', 'pandas', 'system-design', 'lld', 'concurrency', 'api-design', 'behavioral',
  'ml', 'frontend', 'python', 'java', 'cpp', 'go', 'rest-api', 'oa',
] as const;
export type JdSkill = (typeof JD_SKILLS)[number];
export const JD_ROUNDS = ['oa', 'phone-coding', 'system-design', 'behavioral', 'take-home'] as const;
export type JdRound = (typeof JD_ROUNDS)[number];
/** unmeasured: nothing on the site tracks the skill (total 0), so no verdict either way. */
export type Readiness = 'ready' | 'partial' | 'gap' | 'unmeasured';
export type JdItem = {
  skill: JdSkill;
  /** A short quote from the job description. */
  evidence: string;
  importance: 'must' | 'nice';
  status: Readiness;
  /** The learner's real count, never raised by a certificate. */
  done: number;
  /** 0: nothing on the site measures this skill. */
  total: number;
  /** A certificate in `certs` made the skill ready, whatever `done` is. */
  certified: boolean;
};
export type JdReport = { skills: JdItem[]; likelyRounds: JdRound[]; planStops: string[] };

/**
 * How the server measures a skill (lib/server/ai-jd.ts skillProgress):
 * - line: Line 500 stops with at least STOP_GOAL solved problems each, out of every stop;
 * - prefix / language: problems solved (id prefix, or accepted in that language), toward `goal`;
 * - parts: system design course parts (sdParts, named by their first chapter) whose chapters are
 *   marked read, plus `core`, a Core Skills group (lib/content/core-skills.json) whose problems are solved;
 * - stories: STAR stories in the story bank, toward `goal`;
 * - certs: judged certificates (skill exams) that make the skill ready on their own; a reading
 *   course's certificate is only chapters marked read, so it never stands in for solved problems.
 * None of them: nothing on the site tracks the skill.
 */
type Measure = {
  line?: true;
  prefix?: string;
  language?: CodeLanguage;
  parts?: string[];
  core?: string;
  stories?: true;
  goal?: number;
  certs?: string[];
};
// `hint` tells the model what the skill covers; `href` is the "practice" link (null: nothing here yet).
export const JD_SKILL_INFO: Record<JdSkill, Measure & { zh: string; en: string; hint: string; href: string | null }> = {
  dsa: {
    zh: '数据结构与算法',
    en: 'Data structures & algorithms',
    hint: 'data structures, algorithms, coding problems, problem solving, complexity',
    href: '/?view=problems',
    line: true,
    certs: ['skill:problem-solving-intermediate'],
  },
  sql: {
    zh: 'SQL',
    en: 'SQL',
    hint: 'SQL queries and relational databases',
    href: '/?view=problems&library=sql',
    prefix: 'sql-',
    goal: 30,
    certs: ['skill:sql'],
  },
  pandas: {
    zh: 'Pandas 数据处理',
    en: 'Pandas',
    hint: 'pandas, DataFrames, data wrangling in Python',
    href: '/?view=problems&library=sql',
    prefix: 'pd-',
    goal: 20,
  },
  'system-design': {
    zh: '系统设计',
    en: 'System design',
    hint: 'designing scalable, distributed systems and services',
    href: '/system-design',
    parts: ['framework'],
    certs: ['sd:system-design'],
  },
  lld: {
    zh: '面向对象设计（LLD）',
    en: 'Object-oriented design (LLD)',
    hint: 'object-oriented or low-level design, design patterns, SOLID',
    href: '/system-design/ood-interview-approach',
    parts: ['ood-interview-approach', 'lld-case-atm'],
    core: 'ood',
  },
  concurrency: {
    zh: '并发编程',
    en: 'Concurrency',
    hint: 'multithreading, locks, synchronization, asynchronous or parallel programming',
    href: '/system-design/concurrency-primitives',
    parts: ['concurrency-primitives'],
    core: 'concurrency',
  },
  'api-design': {
    zh: 'API 设计',
    en: 'API design',
    hint: 'designing APIs and service contracts: REST, RPC, GraphQL, pagination, versioning, auth',
    href: '/system-design/api-rest-vs-rpc-graphql',
    parts: ['api-rest-vs-rpc-graphql'],
  },
  behavioral: {
    zh: '行为面试',
    en: 'Behavioral',
    hint: 'communication, teamwork, ownership, leadership, working with others',
    href: '/?view=stories',
    stories: true,
    goal: 6,
  },
  ml: {
    zh: '机器学习',
    en: 'Machine learning',
    hint: 'machine learning, models, ML systems, applied data science',
    href: '/system-design/ml-design-framework',
    parts: ['ml-design-framework'],
  },
  frontend: {
    zh: '前端开发',
    en: 'Front end',
    hint: 'web front end: JavaScript, TypeScript, React, HTML, CSS',
    // The AI mock interview's front-end round; it keeps no count, so the skill stays unmeasured.
    href: '/?view=mock-interview&template=frontend',
  },
  python: {
    zh: 'Python',
    en: 'Python',
    hint: 'the Python language',
    href: '/learn/python',
    language: 'python',
    goal: 30,
    certs: ['skill:python'],
  },
  java: { zh: 'Java', en: 'Java', hint: 'the Java language', href: '/?view=problems', language: 'java', goal: 30 },
  cpp: { zh: 'C++', en: 'C++', hint: 'the C or C++ language', href: '/?view=problems', language: 'cpp', goal: 30 },
  go: { zh: 'Go', en: 'Go', hint: 'the Go (Golang) language', href: '/?view=problems', language: 'go', goal: 30 },
  'rest-api': {
    zh: 'REST API 调用',
    en: 'REST APIs',
    hint: 'building or calling REST/HTTP web services and JSON APIs',
    href: '/oa/ica',
    prefix: 'rest-',
    goal: 6,
  },
  oa: {
    zh: '在线笔试（OA）',
    en: 'Online assessment (OA)',
    hint: 'an online coding assessment or timed coding test, such as HackerRank or CodeSignal',
    href: '/oa',
    prefix: 'oa-',
    goal: 30,
  },
};
export const JD_ROUND_INFO: Record<JdRound, { zh: string; en: string; href: string }> = {
  oa: { zh: '在线笔试（OA）', en: 'Online assessment', href: '/mock-oa' },
  'phone-coding': { zh: '电话编程面', en: 'Phone coding screen', href: '/?view=mock-interview&template=phone' },
  // One design slot alone (the onsite template is two hours of coding and behavioral around it).
  'system-design': {
    zh: '系统设计面',
    en: 'System design round',
    href: '/?view=mock-interview&template=custom&mix=design.1&min=45',
  },
  behavioral: { zh: '行为面', en: 'Behavioral round', href: '/?view=mock-interview&template=behavioral' },
  'take-home': { zh: '带回家作业', en: 'Take-home project', href: '/take-home' },
};
/** The study plan's URL parameter: Line 500 stops (comma-separated slugs) to preselect as its topics. */
export const PLAN_TOPICS_PARAM = 'planTopics';
/** sessionStorage: the job description handed over once from the resume review, removed when read. */
export const JD_HANDOFF_KEY = 'cswork:jd-handoff';
