/**
 * Mock interview sets drawn from the content library's questions: slot kinds, templates and a
 * seedable draw. Pure (no I/O), so the server draws, and the SPA and landing pages read the
 * same templates. Texts are [zh, en].
 */
import type { RubricId } from './mock-interview-feedback';

export type Text = [zh: string, en: string];

export type KindId =
  | 'coding'
  | 'behavioral'
  | 'design'
  | 'sql'
  | 'analytics'
  | 'stats'
  | 'ml'
  | 'lld'
  | 'recruiter'
  | 'negotiation';
type Kind = {
  name: Text;
  /** Content library categories this slot draws from. */
  categories: string[];
  /** Suggested minutes when a custom set doesn't say. */
  minutes: number;
  /** The company matters more than the role (behavioral answers carry across roles). */
  companyFirst?: boolean;
  /**
   * Only with the AI interviewer: no answers to show a person (the LLD template's course
   * chapters), so never in a custom mix, a solo run or a peer interview.
   */
  aiOnly?: boolean;
};
export const KINDS: Record<KindId, Kind> = {
  coding: { name: ['编程题', 'Coding'], categories: ['Coding & Algorithms'], minutes: 25 },
  behavioral: {
    name: ['行为面试', 'Behavioral'],
    categories: ['Behavioral & Leadership'],
    minutes: 8,
    companyFirst: true,
  },
  design: {
    name: ['系统设计与基础', 'System design & fundamentals'],
    categories: ['System Design', 'Software Engineering Fundamentals'],
    minutes: 35,
  },
  sql: { name: ['SQL 与数据处理', 'SQL & data wrangling'], categories: ['Data Manipulation (SQL/Python)'], minutes: 20 },
  analytics: {
    name: ['产品分析与实验', 'Analytics & experimentation'],
    categories: ['Analytics & Experimentation'],
    minutes: 15,
  },
  stats: { name: ['统计与概率', 'Statistics & probability'], categories: ['Statistics & Math'], minutes: 12 },
  ml: { name: ['机器学习', 'Machine learning'], categories: ['Machine Learning'], minutes: 20 },
  lld: { name: ['低层设计（OOD）', 'Low-level design (OOD)'], categories: ['Low-Level Design'], minutes: 45, aiOnly: true },
  // Role-plays over lib/content/roleplay-scenarios.json (lib/server/mock-interview.ts roleplayQuestion).
  recruiter: { name: ['招聘方初筛', 'Recruiter screen'], categories: ['Recruiter Screen'], minutes: 20, aiOnly: true },
  negotiation: { name: ['Offer 谈判', 'Offer negotiation'], categories: ['Offer Negotiation'], minutes: 20, aiOnly: true },
};
/** The AI plays the recruiter, not an interviewer, and scores ROLEPLAY_RUBRIC. */
export const isRoleplay = (kind: KindId) => kind === 'recruiter' || kind === 'negotiation';
/** Fewer questions than this and the slot says its bank is small. */
export const SMALL_BANK = 30;
export const kindOf = (category: string | null): KindId | null =>
  (Object.keys(KINDS) as KindId[]).find((k) => !!category && KINDS[k].categories.includes(category)) ?? null;

export type RoleId = 'swe' | 'ds' | 'mle' | 'de' | 'pm' | 'quant';
/** Role families over the library's job titles. */
export const ROLES: Record<RoleId, { name: Text; titles: string[] }> = {
  swe: {
    name: ['软件工程师', 'Software Engineer'],
    titles: [
      'Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Backend Software Engineer',
      'Site Reliability Engineer', 'Forward Deploy Engineer',
    ],
  },
  ds: {
    name: ['数据科学 / 分析', 'Data Scientist / Analyst'],
    titles: ['Data Scientist', 'Data Analyst', 'Product Analyst', 'Analytics Engineer', 'Business Intelligence Engineer'],
  },
  mle: { name: ['机器学习工程师', 'ML Engineer'], titles: ['Machine Learning Engineer', 'Applied Scientist'] },
  de: { name: ['数据工程师', 'Data Engineer'], titles: ['Data Engineer'] },
  pm: { name: ['产品 / 项目经理', 'Product / Program Manager'], titles: ['Product Manager', 'Technical Program Manager'] },
  quant: { name: ['量化', 'Quant'], titles: ['Quantitative Researcher', 'Quantitative Trader'] },
};
export const ROUNDS: Record<string, Text> = {
  'Technical Screen': ['技术电面', 'Technical screen'],
  Onsite: ['Onsite', 'Onsite'],
  'Online Assessment': ['OA', 'Online assessment'],
  'HR Screen': ['HR 面', 'HR screen'],
};

export type Slot = { kind: KindId; minutes: number; name?: Text; optional?: boolean };
export type Template = {
  id: string;
  name: Text;
  blurb: Text;
  role: RoleId | null;
  round: string | null;
  slots: Slot[];
};
export const TEMPLATES: Template[] = [
  {
    id: 'phone',
    name: ['SWE 电话面', 'SWE phone screen'],
    blurb: ['一道行为题热身，两道编程题，约 50 分钟。', 'A behavioral warm-up, then two coding questions. About 50 minutes.'],
    role: 'swe',
    round: 'Technical Screen',
    slots: [
      { kind: 'behavioral', minutes: 5, name: ['开场热身', 'Warm-up'] },
      { kind: 'coding', minutes: 25 },
      { kind: 'coding', minutes: 20, name: ['第二道编程题', 'Second coding question'] },
    ],
  },
  {
    id: 'onsite',
    name: ['SWE Onsite 全流程', 'SWE onsite loop'],
    blurb: ['两轮编程、一轮系统设计、两轮行为面。', 'Two coding rounds, one system design round, two behavioral rounds.'],
    role: 'swe',
    round: 'Onsite',
    slots: [
      { kind: 'coding', minutes: 40 },
      { kind: 'coding', minutes: 40 },
      { kind: 'design', minutes: 45, optional: true },
      { kind: 'behavioral', minutes: 15 },
      { kind: 'behavioral', minutes: 15 },
    ],
  },
  {
    id: 'behavioral',
    name: ['行为面 / BQ', 'Behavioral (BQ) round'],
    blurb: ['五道行为题，每题 8 分钟，用 STAR 讲完一个故事。', 'Five behavioral questions, eight minutes each: one STAR story apiece.'],
    role: null,
    round: null,
    slots: Array.from({ length: 5 }, () => ({ kind: 'behavioral' as const, minutes: 8 })),
  },
  {
    id: 'ds',
    name: ['数据科学家', 'Data Scientist'],
    blurb: ['SQL、产品分析与实验、统计，加一道行为题。', 'SQL, analytics & experimentation, statistics, and one behavioral question.'],
    role: 'ds',
    round: null,
    slots: [
      { kind: 'sql', minutes: 20 },
      { kind: 'analytics', minutes: 15 },
      { kind: 'stats', minutes: 12 },
      { kind: 'behavioral', minutes: 8 },
    ],
  },
  {
    id: 'mle',
    name: ['机器学习工程师', 'ML Engineer'],
    blurb: ['机器学习、编程，加一道行为题。', 'Machine learning, coding, and one behavioral question.'],
    role: 'mle',
    round: null,
    slots: [
      { kind: 'ml', minutes: 20 },
      { kind: 'coding', minutes: 30 },
      { kind: 'behavioral', minutes: 10 },
    ],
  },
];
/** Guided low-level design with the AI interviewer: kept out of TEMPLATES, which peers share. */
export const LLD_TEMPLATE: Template = {
  id: 'lld',
  name: ['LLD 面向对象设计', 'LLD / object-oriented design'],
  blurb: [
    '一道低层设计题，和 AI 面试官一步步来：问清需求、建类、定接口、写核心代码、谈扩展，每步都有反馈。',
    'One low-level design question, step by step with the AI interviewer: clarify, model the classes, define the interfaces, write the core code, discuss extensions, with feedback on each step.',
  ],
  role: 'swe',
  round: null,
  slots: [{ kind: 'lld', minutes: 45 }],
};
/** The AI role-plays: one scenario each, the AI as the company's recruiter. */
export const ROLEPLAY_TEMPLATES: Template[] = [
  {
    id: 'recruiter',
    name: ['招聘方初筛', 'Recruiter screen'],
    blurb: [
      'AI 扮演招聘方打来的初筛电话：为什么选我们、讲一个项目、签证与担保、期望薪资、时间线。约 20 分钟，结束后才给反馈。',
      'The AI plays a recruiter on a first call: why us, one project, work authorization and sponsorship, pay expectations, timeline. About 20 minutes; feedback only at the end.',
    ],
    role: null,
    round: null,
    slots: [{ kind: 'recruiter', minutes: 20 }],
  },
  {
    id: 'negotiation',
    name: ['Offer 谈判', 'Offer negotiation'],
    blurb: [
      'AI 扮演发 offer 的招聘方：先给书面 offer，再压价、问竞争 offer、设截止期限。约 20 分钟，看你能谈到多少。',
      'The AI plays the recruiter with your written offer: it pushes back, asks about competing offers and sets an exploding deadline. About 20 minutes: see how far you get.',
    ],
    role: null,
    round: null,
    slots: [{ kind: 'negotiation', minutes: 20 }],
  },
];
/** Templates only the AI interviewer runs, kept out of TEMPLATES (which peers and solo runs share). */
export const AI_TEMPLATES: Template[] = [LLD_TEMPLATE, ...ROLEPLAY_TEMPLATES];
export const CUSTOM_NAME: Text = ['自定义', 'Custom'];

export type GuideStep = {
  id: string;
  minutes: number;
  name: Text;
  /** What the step should cover. */
  points: Text;
  /** The rubric dimensions its feedback scores. */
  rubric: RubricId[];
};
/**
 * The AI interviewer's step-by-step guide (components/mock-interview.tsx, lib/server/ai-interviewer.ts):
 * system design questions (not the fundamentals the design slot also draws) and LLD ones.
 */
export const GUIDED_STEPS: Record<'design' | 'lld', GuideStep[]> = {
  design: [
    {
      id: 'requirements',
      minutes: 5,
      name: ['需求', 'Requirements'],
      points: ['问清功能和非功能需求：用户量、读写比例、延迟、一致性。', 'Pin down functional and non-functional requirements: users, read/write ratio, latency, consistency.'],
      rubric: ['problem', 'communication'],
    },
    {
      id: 'entities',
      minutes: 5,
      name: ['核心实体', 'Core entities'],
      points: ['列出核心实体和它们的关系，估一下数据量。', 'List the core entities and how they relate; estimate the data size.'],
      rubric: ['problem'],
    },
    {
      id: 'api',
      minutes: 5,
      name: ['接口', 'API'],
      points: ['定义主要接口：请求、响应、分页和错误。', 'Define the main API: requests, responses, pagination and errors.'],
      rubric: ['coding', 'communication'],
    },
    {
      id: 'high-level',
      minutes: 10,
      name: ['整体架构', 'High-level design'],
      points: ['讲清整体架构：客户端、服务、存储、缓存、队列，走一遍主要请求。', 'Lay out the architecture: clients, services, storage, caches, queues; walk the main requests through it.'],
      rubric: ['problem', 'complexity'],
    },
    {
      id: 'deep-dives',
      minutes: 15,
      name: ['深入', 'Deep dives'],
      points: ['挑一两个瓶颈深入：扩展、分片、一致性、故障，讲清取舍。', 'Go deep on one or two bottlenecks: scaling, sharding, consistency, failures; explain the trade-offs.'],
      rubric: ['complexity', 'testing'],
    },
  ],
  lld: [
    {
      id: 'clarify',
      minutes: 5,
      name: ['澄清需求', 'Clarify'],
      points: ['问清用例、参与者和边界，说出你的假设。', 'Clarify the use cases, actors and limits; state your assumptions.'],
      rubric: ['problem', 'communication'],
    },
    {
      id: 'classes',
      minutes: 8,
      name: ['类与关系', 'Classes'],
      points: ['找出核心类、各自的职责和关系（组合、继承）。', 'Find the core classes, their responsibilities and relationships (composition, inheritance).'],
      rubric: ['problem', 'coding'],
    },
    {
      id: 'interfaces',
      minutes: 7,
      name: ['接口', 'Interfaces'],
      points: ['定义关键接口和方法签名，说明哪里可能变化。', 'Define the key interfaces and method signatures; say what is likely to change.'],
      rubric: ['coding', 'communication'],
    },
    {
      id: 'code',
      minutes: 15,
      name: ['核心代码', 'Core code'],
      points: ['在代码框里写出核心逻辑，处理并发和边界情况。', 'Write the core logic in the code box, handling concurrency and edge cases.'],
      rubric: ['coding', 'testing'],
    },
    {
      id: 'extensibility',
      minutes: 5,
      name: ['扩展', 'Extensions'],
      points: ['讨论扩展：新需求怎么加进来，用到了哪些设计原则或模式。', 'Discuss extensions: how new requirements fit in, which principles or patterns help.'],
      rubric: ['complexity', 'communication'],
    },
  ],
};
/** A question's guide: every LLD question, and design questions in the System Design category; else null. */
export const guideFor = (kind: KindId, category: string | null | undefined) =>
  kind === 'lld' ? GUIDED_STEPS.lld : kind === 'design' && category === 'System Design' ? GUIDED_STEPS.design : null;

/**
 * A template by id, or a custom one from `mix` ("coding.2-behavioral.1": counts per kind) and
 * `minutes` (the total, shared out by each kind's suggested time). Null when invalid.
 */
export function resolveTemplate(id: string | null, mix?: string | null, minutes?: string | number | null): Template | null {
  if (id !== 'custom') return [...TEMPLATES, ...AI_TEMPLATES].find((t) => t.id === id) ?? null;
  const slots: Slot[] = [];
  for (const part of (mix || '').split('-')) {
    const [kind, count] = part.split('.');
    const n = Number(count);
    if (!Object.hasOwn(KINDS, kind) || KINDS[kind as KindId].aiOnly || !Number.isInteger(n) || n < 0 || n > 5) return null;
    for (let i = 0; i < n; i++) slots.push({ kind: kind as KindId, minutes: KINDS[kind as KindId].minutes });
  }
  if (!slots.length || slots.length > 8) return null;
  const total = minutes === undefined || minutes === null || minutes === '' ? null : Number(minutes);
  if (total !== null) {
    if (!Number.isInteger(total) || total < 10 || total > 240) return null;
    const scale = total / slots.reduce((sum, s) => sum + s.minutes, 0);
    for (const s of slots) s.minutes = Math.max(3, Math.round(s.minutes * scale));
  }
  return { id: 'custom', name: CUSTOM_NAME, blurb: ['按题型自己配。', 'Pick your own mix.'], role: null, round: null, slots };
}

/** One employer under several library names: TikTok and ByteDance, Meta and Facebook. */
const ALIASES = [['tiktok', 'bytedance'], ['meta', 'facebook'], ['amazon', 'amazon-web-services']];
export const companyGroup = (slug: string) => ALIASES.find((g) => g.includes(slug)) ?? [slug];

/** FNV-1a into mulberry32: the same seed always gives the same numbers. */
function random(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = () => Math.random().toString(36).slice(2, 10);

export type PoolItem = {
  id: string;
  company: string | null;
  role: string | null;
  category: string | null;
  round: string | null;
  /** The judge problem it maps to: two companies' versions of one problem never share a set. */
  problem?: string | null;
};
export type DrawOptions = {
  seed: string;
  company?: string | null;
  role?: string | null;
  /** Overrides the template's round. */
  round?: string | null;
  /** Slot indices re-rolled, in order. */
  rerolls?: number[];
  /** Item ids to avoid; turned into extra re-rolls so the result replays from seed + rerolls alone. */
  exclude?: string[];
};
export type DrawnSlot<T> = Slot & { item: T | null; similar: boolean; pool: number };

/**
 * Each kind gets one queue: its questions shuffled by the seed, then ordered best match first
 * (the company's questions, the role's, the round's) so other companies only fill in. Slots take
 * the queue in turn, and a re-roll the next question, skipping any a slot holds (or its problem).
 * Deterministic: a share link carrying seed + rerolls reproduces the set.
 */
export function drawSet<T extends PoolItem>(pool: readonly T[], template: Template, o: DrawOptions) {
  const companies = o.company ? companyGroup(o.company) : null;
  const role = o.role || template.role;
  const titles = role && Object.hasOwn(ROLES, role) ? ROLES[role as RoleId].titles : null;
  const round = o.round || template.round;
  const atCompany = (i: T) => !companies || (!!i.company && companies.includes(i.company));
  const queues = new Map<KindId, T[]>();
  const queue = (kind: KindId) => {
    let q = queues.get(kind);
    if (!q) {
      const { categories, companyFirst } = KINDS[kind];
      const rank = (i: T) => {
        const here = Number(!atCompany(i)),
          fits = Number(!!titles && !(i.role && titles.includes(i.role)));
        return (companyFirst ? here * 2 + fits : fits * 2 + here) * 2 + Number(!!round && i.round !== round);
      };
      q = pool.filter((i) => !!i.category && categories.includes(i.category));
      const next = random(`${o.seed}:${kind}`);
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      // Stable: equal ranks keep the seed's shuffle.
      q.sort((a, b) => rank(a) - rank(b));
      queues.set(kind, q);
    }
    return q;
  };
  const slots = template.slots.filter((s) => !s.optional || queue(s.kind).length);
  const cursor = new Map<KindId, number>();
  const picks: (T | null)[] = slots.map(() => null);
  const taken = (c: T) => picks.includes(c) || (!!c.problem && picks.some((p) => p?.problem === c.problem));
  /** Moves a slot to the next free question in its queue; false (and unchanged) when none is left. */
  const reroll = (index: number) => {
    const { kind } = slots[index],
      q = queue(kind),
      n = cursor.get(kind) ?? 0;
    for (let k = 0; k < q.length; k++) {
      const candidate = q[(n + k) % q.length];
      if (!taken(candidate)) {
        picks[index] = candidate;
        cursor.set(kind, n + k + 1);
        return true;
      }
    }
    return false;
  };
  slots.forEach((_, index) => reroll(index));
  const rerolls = (o.rerolls ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < slots.length && reroll(i));
  const skip = new Set(o.exclude);
  slots.forEach((s, index) => {
    for (let tries = queue(s.kind).length; tries > 0 && picks[index] && skip.has(picks[index]!.id); tries--) {
      if (!reroll(index)) break;
      rerolls.push(index);
    }
  });
  return {
    rerolls,
    slots: slots.map(
      (s, index): DrawnSlot<T> => ({
        ...s,
        item: picks[index],
        similar: !!companies && !!picks[index] && !atCompany(picks[index]!),
        pool: queue(s.kind).length,
      }),
    ),
  };
}

/** Drawable questions per company (aliases merged), most first. */
export function companyCounts(pool: readonly (PoolItem & { companyName?: string | null })[]) {
  const groups = new Map<string, { slug: string; names: string[]; n: number; kinds: Partial<Record<KindId, number>> }>();
  for (const item of pool) {
    if (!item.company) continue;
    const slug = companyGroup(item.company)[0];
    const group = groups.get(slug) ?? { slug, names: [], n: 0, kinds: {} };
    groups.set(slug, group);
    const name = item.companyName || item.company;
    if (!group.names.includes(name)) group.names.push(name);
    group.n++;
    const kind = kindOf(item.category);
    if (kind) group.kinds[kind] = (group.kinds[kind] ?? 0) + 1;
  }
  return [...groups.values()]
    .map(({ names, ...g }) => ({ ...g, name: names.join(' / ') }))
    .sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug));
}

/** "Coding 12 · Behavioral 5" in English: the largest kinds first. */
export const kindSummary = (kinds: Partial<Record<KindId, number>>, limit = 3) =>
  (Object.entries(kinds) as [KindId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([kind, n]) => `${KINDS[kind].name[1]} ${n}`)
    .join(' · ');

export type BodyParts = {
  /** What the candidate sees. */
  question: string;
  hints: string;
  followUps: string;
  /** What a strong answer covers, clarifying questions to expect. */
  rubric: string;
  /** Approach notes and the worked solution. */
  solution: string;
};
const SECTIONS: [keyof BodyParts, RegExp][] = [
  ['hints', /^hints?\b/i],
  ['followUps', /^(follow[- ]?ups?|extensions?)\b/i],
  ['solution', /^(suggested |reference )?approach\b/i],
  [
    'rubric',
    /^(what a strong answer covers|what (this|each) part should cover|clarifying questions|what (the )?interviewers? (are |is )?(look(ing)? for|want|evaluat)|evaluation (focus|emphasis|criteria)|what good looks like|expectations\b|grading\b)/i,
  ],
];
/** An inline hint the body quotes in the question: `> **Hint: …**` and the quote lines after it. */
const QUOTED_HINT = /^\s*>\s*\*\*hints?\b/i,
  QUOTE = /^\s*>\s?/;
/**
 * Splits a question's Markdown at its `## Solution` heading and moves the interviewer-only
 * sections above it (hints, follow-ups, rubric, approach) out of the candidate's part. A moved
 * section runs to the next heading of its level or higher; one inside a part keeps the part's name.
 * A quoted `> **Hint…**` block in the question moves to the hints too.
 */
export function splitBody(body: string): BodyParts {
  const parts: Record<keyof BodyParts, string[]> = { question: [], hints: [], followUps: [], rubric: [], solution: [] };
  let into: keyof BodyParts = 'question',
    depth = 0,
    fence = false,
    quote = false,
    quotePart: string | undefined;
  // The candidate's headings by level, to name the part a moved section came from.
  const heads: string[] = [];
  // A section ends without its trailing blank lines and the rule that closed it.
  const close = () => {
    const lines = parts[into];
    while (lines.length && /^\s*(?:-{3,}|\*{3,})?\s*$/.test(lines[lines.length - 1])) lines.pop();
  };
  for (const line of body.split('\n')) {
    if (quote && QUOTE.test(line)) {
      parts.hints.push(line.replace(QUOTE, ''));
      continue;
    }
    quote = false;
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && into === 'question' && QUOTED_HINT.test(line)) {
      quote = true;
      if (parts.hints.length) parts.hints.push('');
      // Named by the heading it sat under, once for a run of hints there.
      const part = heads.slice(2).findLast(Boolean);
      if (part && part !== quotePart) parts.hints.push(`**${part}**`, '');
      quotePart = part;
      parts.hints.push(line.replace(QUOTE, ''));
      continue;
    }
    const heading = fence ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length,
        title = heading[2];
      if (level === 2 && /^solution\b/i.test(title)) {
        close();
        into = 'solution';
        depth = 2;
        continue;
      } else if (into === 'question' || level <= depth) {
        // A document titled "# Follow-up email…" is still a question.
        const section = (level > 1 || heads.length > 0) && SECTIONS.find(([, pattern]) => pattern.test(title));
        if (section) {
          close();
          into = section[0];
          depth = level;
          if (parts[into].length) parts[into].push('');
          const part = heads.slice(2, level).findLast(Boolean);
          if (part) parts[into].push(`**${part}**`, '');
          if (into === 'solution' || into === 'rubric') parts[into].push(`#### ${title}`);
          continue;
        }
        if (into !== 'question') close();
        into = 'question';
        heads.length = level;
        heads[level] = title;
      }
    }
    parts[into].push(line);
  }
  close();
  const text = (key: keyof BodyParts) =>
    parts[key]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .replace(/\n\s*(?:-{3,}|\*{3,})$/, '');
  return { question: text('question'), hints: text('hints'), followUps: text('followUps'), rubric: text('rubric'), solution: text('solution') };
}

/** Amazon's Leadership Principles a behavioral question names. */
export const PRINCIPLES: [string, RegExp][] = [
  ['Customer Obsession', /customer[- ]obsess/i],
  ['Ownership', /\bownership\b/i],
  ['Invent and Simplify', /invent and simplify/i],
  ['Are Right, A Lot', /are right,? a lot/i],
  ['Learn and Be Curious', /learn and be curious/i],
  ['Hire and Develop the Best', /hire and develop/i],
  ['Insist on the Highest Standards', /highest standards/i],
  ['Think Big', /\bthink big\b/i],
  ['Bias for Action', /bias for action/i],
  ['Frugality', /\bfrugal/i],
  ['Earn Trust', /\bearn(ing)? trust\b/i],
  ['Dive Deep', /\bdive deep\b/i],
  ['Disagree and Commit', /disagree and commit|have backbone/i],
  ['Deliver Results', /\bdeliver(ing)? results\b/i],
  ["Earth's Best Employer", /best employer/i],
  ['Broad Responsibility', /broad responsibility/i],
];
export const leadershipPrinciples = (text: string) =>
  PRINCIPLES.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
