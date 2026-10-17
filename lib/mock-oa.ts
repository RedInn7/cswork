/**
 * Timed mock OA: the draw, the score and the exam clock. Pure and shared by the
 * API (lib/server/mock-oa.ts) and the browser (components/mock-oa.tsx); the
 * session lives in this browser's localStorage, and finished ones also sync to the
 * account (lib/mock-cloud.ts, lib/server/learner-cloud.ts).
 */
export type Slot = 'easy' | 'medium' | 'hard';
export type Scoring = 'tests' | 'gca';
export type MockSource = 'mixed' | 'oa' | 'lc';
export const SLOTS: readonly Slot[] = ['easy', 'medium', 'hard'];
const RANK: Record<Slot, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * What the real OA has besides coding. "None" (无) means coding only; "None (…)"
 * keeps its remark (proctoring, dropped MCQs) as a coding-only note.
 */
export function extraSections(p: { sections_zh: string; sections_en: string }, zh: boolean) {
  const text = zh ? p.sections_zh : p.sections_en;
  const none = /^(?:None|无)\s*(?:[(（](.*)[)）])?$/.exec(text);
  return none ? { codingOnly: true, text: none[1] ?? '' } : { codingOnly: false, text };
}

/** Catalogue difficulty (简单/中等/困难, or the English word) as a slot. */
export function slotOf(difficulty?: string | null): Slot | null {
  const value = (
    { 简单: 'easy', 中等: 'medium', 困难: 'hard' } as Record<string, Slot>
  )[difficulty || ''];
  return value ?? (SLOTS.includes(difficulty as Slot) ? (difficulty as Slot) : null);
}

/**
 * The difficulty a score report shows for a question, as the OA library does: a
 * LeetCode label, or an OA package's explicit 简单/困难, stands; otherwise the OA
 * estimate (a slot can hold another difficulty when the company had none to fit
 * it), else the slot it was drawn into.
 */
export function reportLevel(
  id: string,
  packaged: string | null | undefined,
  estimate: Slot | null | undefined,
  slot: Slot | undefined,
): { level: Slot; estimated: boolean } {
  const label = slotOf(packaged);
  if (label && (id.startsWith('lc-') || label !== 'medium'))
    return { level: label, estimated: false };
  if (estimate && !id.startsWith('lc-')) return { level: estimate, estimated: true };
  return { level: slot ?? 'medium', estimated: false };
}

/** Default difficulty ladder for a custom mock of n questions. */
export const LADDER: Record<number, Slot[]> = {
  1: ['medium'],
  2: ['medium', 'hard'],
  3: ['easy', 'medium', 'hard'],
  4: ['easy', 'medium', 'medium', 'hard'],
};

/** mulberry32: a tiny seedable PRNG, so a draw is reproducible in tests. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `loose`: the difficulty is a package default (an OA problem without an estimate),
 * so it fits any slot within one step. `topics`: most important first.
 */
export type PoolItem = {
  id: string;
  difficulty: Slot | null;
  loose: boolean;
  topics?: readonly string[];
};
export type TopicWeight = { slug: string; weight: number };
/** A problem's first, second and third topic count 1, 0.5 and 0.25. */
export const TOPIC_POSITION = [1, 0.5, 0.25] as const;
/** How well a problem's topics match a company's weighted topics (0 = no overlap). */
export function topicAffinity(
  topics: readonly string[] = [],
  weights: ReadonlyMap<string, number>,
) {
  return topics.reduce(
    (sum, slug, i) => sum + (TOPIC_POSITION[i] ?? 0) * (weights.get(slug) ?? 0),
    0,
  );
}
/** Topic shares over a set of problems, positions weighted 1/0.5/0.25, largest first. */
export function topicDistribution(lists: readonly (readonly string[])[]) {
  const mass = new Map<string, number>();
  for (const list of lists)
    list.forEach((slug, i) =>
      mass.set(slug, (mass.get(slug) ?? 0) + (TOPIC_POSITION[i] ?? 0)),
    );
  const total = [...mass.values()].reduce((a, b) => a + b, 0) || 1;
  return [...mass]
    .map(([slug, weight]) => ({ slug, weight, share: weight / total }))
    .sort((a, b) => b.weight - a.weight || a.slug.localeCompare(b.slug));
}
/**
 * Whole percentages of non-negative parts that add up to exactly 100 (largest
 * remainder), so rounded shares never total 99 or 101. All zero gives all zero.
 */
export function wholePercents(parts: readonly number[]) {
  const total = parts.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return parts.map(() => 0);
  const exact = parts.map((v) => (v * 100) / total);
  const whole = exact.map(Math.floor);
  const order = exact
    .map((_, i) => i)
    .sort((a, b) => exact[b] - whole[b] - (exact[a] - whole[a]) || a - b);
  for (const i of order.slice(0, 100 - whole.reduce((a, b) => a + b, 0))) whole[i]++;
  return whole;
}
// ponytail: a perfect topic match (affinity 1) is 3× as likely as no overlap; raise
// this to lean harder on the company's topics.
const AFFINITY = 2;
/** A custom mock's chosen topics as a hard filter: only problems on at least one of them. */
export const onTopics = (pool: readonly PoolItem[], topics: readonly string[] = []) =>
  topics.length ? pool.filter((item) => item.topics?.some((slug) => topics.includes(slug))) : [...pool];
/** Fewer other learners than this in a scenario and the report shows no percentile. */
export const PEER_MIN = 20;
/** Lexicographic a < b. */
function before(a: number[], b: number[]) {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
  return false;
}

/**
 * One problem per slot, in slot order, or null when the pool is too small.
 * Per slot the best candidate wins by: not just seen (exclude) > fits the slot's
 * difficulty > not solved yet > closest difficulty > a weighted random draw. A
 * difficulty fits only its own slot, except a `loose` one (a default 中等 OA label),
 * which fits any slot within one step. The random draw favours problems on the
 * company's `topics` (weight 1 + 2·affinity) without ever ruling the rest out.
 */
export function drawMock({
  pool,
  slots,
  solved = new Set(),
  exclude = new Set(),
  topics = [],
  random = Math.random,
}: {
  pool: readonly PoolItem[];
  slots: readonly Slot[];
  solved?: ReadonlySet<string>;
  exclude?: ReadonlySet<string>;
  topics?: readonly TopicWeight[];
  random?: () => number;
}): string[] | null {
  const left = [...new Map(pool.map((item) => [item.id, item])).values()];
  if (left.length < slots.length) return null;
  const weights = new Map(topics.map((t) => [t.slug, t.weight]));
  // Efraimidis–Spirakis: the largest u^(1/w) is a draw weighted by w.
  const lottery = new Map(
    left.map((item) => [
      item.id,
      random() ** (1 / (1 + AFFINITY * topicAffinity(item.topics, weights))),
    ]),
  );
  const picked: string[] = [];
  for (const slot of slots) {
    let best = -1,
      bestKey: number[] = [];
    left.forEach((item, index) => {
      const distance =
        item.difficulty === null
          ? 1
          : Math.abs(RANK[item.difficulty] - RANK[slot]);
      const fits = item.loose ? distance <= 1 : distance === 0;
      const key = [
        +exclude.has(item.id),
        +!fits,
        +solved.has(item.id),
        distance,
        -lottery.get(item.id)!,
      ];
      if (best < 0 || before(key, bestKey)) {
        best = index;
        bestKey = key;
      }
    });
    picked.push(left[best].id);
    left.splice(best, 1);
  }
  return picked;
}

export type QuestionResult = {
  passed: number;
  total: number;
  accepted: boolean;
  status?: string;
};
/** Share of a question earned: AC is 1, otherwise passed / total. */
export function questionFraction(result: QuestionResult | null | undefined) {
  if (!result) return 0;
  if (result.accepted) return 1;
  return result.total > 0 ? Math.min(1, Math.max(0, result.passed / result.total)) : 0;
}
const WEIGHT: Record<Slot, number> = { easy: 1, medium: 2, hard: 3 };
/**
 * tests: each question 0–100 by passed fraction (HackerRank style), summed.
 * gca: a CodeSignal-like estimate on its 200–600 scale, harder slots weigh more
 * (easy 1, medium 2, hard 3). It is labelled as an estimate wherever it is shown.
 */
export function scoreMock(
  results: readonly (QuestionResult | null)[],
  scoring: Scoring,
  slots: readonly Slot[],
) {
  const per = results.map((r) => Math.floor(questionFraction(r) * 100));
  if (scoring === 'tests')
    return {
      value: per.reduce((a, b) => a + b, 0),
      min: 0,
      max: results.length * 100,
      per,
      estimate: false,
    };
  const weights = results.map((_, i) => WEIGHT[slots[i]] ?? 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const earned = results.reduce(
    (sum, r, i) => sum + weights[i] * questionFraction(r),
    0,
  );
  return {
    value: Math.round(200 + (400 * earned) / total),
    min: 200,
    max: 600,
    per,
    estimate: true,
  };
}

export type Attempt = {
  status: string;
  passed: number;
  total: number;
  created_at: number;
};
const JUDGING = new Set(['queued', 'compiling', 'running']);
/**
 * One question's attempts inside the exam window, oldest first. The judge stops at
 * the first failing test, so a wrong answer's `passed` counts the tests before it.
 */
export function summarizeAttempts(list: readonly Attempt[], from: number) {
  let best: QuestionResult | null = null,
    firstAcceptedMs: number | null = null,
    pending = false,
    attempts = 0;
  for (const s of list) {
    if (s.status === 'cancelled') continue;
    attempts++;
    if (JUDGING.has(s.status)) {
      pending = true;
      continue;
    }
    const accepted = s.status === 'accepted';
    if (accepted && firstAcceptedMs === null)
      firstAcceptedMs = Math.max(0, s.created_at - from);
    const result = {
      passed: accepted ? s.total : s.passed,
      total: s.total,
      accepted,
      status: s.status,
    };
    if (!best || questionFraction(result) > questionFraction(best)) best = result;
  }
  return { attempts, best, firstAcceptedMs, pending };
}

export type MockSession = {
  id: string;
  /** Preset or custom company slug; null draws from the whole catalogue. */
  company: string | null;
  name: string | null;
  platform: string | null;
  preset: boolean;
  scoring: Scoring;
  source: MockSource;
  /** A custom mock drawn only from these Line 500 stops (kept for "draw again"). */
  topics?: string[];
  /** Drawn from this member experience's linked problems (kept for "draw again"; the account history drops it). */
  experience?: string;
  slots: Slot[];
  ids: string[];
  minutes: number;
  /** Server clock minus this browser's at the draw: submissions carry server time. */
  skew: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  reason?: 'manual' | 'timeout';
  result?: { score: number; max: number; solved: number; estimate: boolean };
  /**
   * A skill certification exam (lib/skill-tests.ts): the server keeps its clock and score, and
   * counts only submissions in `language` when it is set.
   */
  cert?: { test: string; language?: string | null };
  /**
   * The MCQ section, taken before the coding clock starts; its end is `startedAt`. Stays in
   * this browser (the account history keeps the coding part only).
   */
  mcq?: { ids: string[]; picks: number[][]; minutes: number; startedAt?: number; finishedAt?: number };
};
export type MockState = { active: MockSession | null; history: MockSession[] };
export const MOCK_HISTORY = 30;
export const WARN_MINUTES = [10, 5] as const;

/** What a clock needs: a session's coding part, or its MCQ section. */
type Clocked = Pick<MockSession, 'startedAt' | 'minutes' | 'finishedAt'>;
export const mockDeadline = (s: Clocked) =>
  (s.startedAt ?? 0) + s.minutes * 60000;

/** Phase, time left and the warning level (10 or 5 minutes left, else 0). */
export function mockClock(s: Clocked, now: number) {
  if (!s.startedAt)
    return { phase: 'ready' as const, remaining: s.minutes * 60000, warning: 0 };
  const remaining = Math.max(0, mockDeadline(s) - now);
  if (s.finishedAt || remaining <= 0)
    return { phase: 'finished' as const, remaining, warning: 0 };
  const warning = remaining <= 5 * 60000 ? 5 : remaining <= 10 * 60000 ? 10 : 0;
  return { phase: 'running' as const, remaining, warning };
}

/** h:mm:ss or mm:ss, rounded up so 0:00 means time is up. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

export function finishMock(
  s: MockSession,
  now: number,
  reason: MockSession['reason'] = 'manual',
): MockSession {
  if (s.finishedAt) return s;
  const end = Math.min(now, mockDeadline(s));
  return { ...s, finishedAt: end, reason: end < now ? 'timeout' : reason };
}

/** Clock-jitter slack on each side of the exam window. */
export const REPORT_SLACK = 5000;
/** Server-time window of the exam's submissions, widened by REPORT_SLACK. */
export function reportWindow(s: MockSession) {
  const end = s.finishedAt ?? mockDeadline(s);
  return {
    from: Math.round((s.startedAt ?? s.createdAt) + s.skew - REPORT_SLACK),
    to: Math.round(end + s.skew + REPORT_SLACK),
  };
}

/**
 * The finished session goes to the top of the history (newest first, capped). A skill exam
 * only leaves `active`: its result lives on the server (/certify), not in the mock history.
 */
export function archiveMock(state: MockState, s: MockSession): MockState {
  return {
    active: state.active?.id === s.id ? null : state.active,
    history: s.cert
      ? state.history
      : [s, ...state.history.filter((h) => h.id !== s.id)].slice(0, MOCK_HISTORY),
  };
}

/**
 * Hands in the MCQ section (at its deadline when that has passed) and starts the coding
 * clock there. Anything not in its MCQ section comes back as it is.
 */
export function finishMcq(s: MockSession, now: number): MockSession {
  if (!s.mcq?.startedAt || s.startedAt) return s;
  const end = Math.min(now, mockDeadline(s.mcq));
  return { ...s, mcq: { ...s.mcq, finishedAt: end }, startedAt: end };
}

/**
 * A running session whose time ran out while the tab was closed finishes now; an MCQ
 * section that ran out moves on to coding, whose clock started at the section's end.
 */
export function settleMockState(state: MockState, now: number): MockState {
  const a = state.active;
  if (a?.mcq?.startedAt && !a.startedAt && mockClock(a.mcq, now).phase === 'finished')
    return settleMockState({ ...state, active: finishMcq(a, now) }, now);
  if (!a?.startedAt || mockClock(a, now).phase !== 'finished') return state;
  return archiveMock(state, finishMock(a, now, 'timeout'));
}

/** Submissions in the exam window (in the exam's language, if any): per question todo / tried / ac. */
export function questionStates(
  s: MockSession,
  submissions: readonly { problem_id: string; status: string; created_at: number; language?: string }[],
) {
  const { from, to } = reportWindow(s);
  const language = s.cert?.language;
  return s.ids.map((id) => {
    const mine = submissions.filter(
      (x) =>
        x.problem_id === id &&
        x.created_at >= from &&
        x.created_at <= to &&
        x.status !== 'cancelled' &&
        (!language || x.language === language),
    );
    return mine.some((x) => x.status === 'accepted')
      ? ('ac' as const)
      : mine.length
        ? ('tried' as const)
        : ('todo' as const);
  });
}

export const mockStorageKey = (userId: string) => `cswork:mock:v1:${userId}`;

function validSession(value: unknown): value is MockSession {
  const s = value as MockSession;
  return (
    !!s &&
    typeof s.id === 'string' &&
    Array.isArray(s.ids) &&
    s.ids.every((id) => typeof id === 'string') &&
    Array.isArray(s.slots) &&
    Number.isFinite(s.minutes) &&
    Number.isFinite(s.createdAt) &&
    Number.isFinite(s.skew ?? 0) &&
    (s.mcq === undefined ||
      (Array.isArray(s.mcq?.ids) &&
        Array.isArray(s.mcq.picks) &&
        s.mcq.picks.every(Array.isArray) &&
        Number.isFinite(s.mcq.minutes)))
  );
}
/** Tolerant: anything malformed reads as an empty state. */
export function parseMockState(raw: string | null): MockState {
  try {
    const value = JSON.parse(raw || 'null');
    return {
      active: validSession(value?.active) ? value.active : null,
      history: Array.isArray(value?.history)
        ? value.history.filter(validSession).slice(0, MOCK_HISTORY)
        : [],
    };
  } catch {
    return { active: null, history: [] };
  }
}
export function readMockState(userId: string): MockState {
  try {
    return settleMockState(
      parseMockState(localStorage.getItem(mockStorageKey(userId))),
      Date.now(),
    );
  } catch {
    return { active: null, history: [] };
  }
}
/** false when storage is unavailable (private mode, quota): callers say so. */
export function writeMockState(userId: string, state: MockState) {
  try {
    localStorage.setItem(mockStorageKey(userId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function findMock(state: MockState, id: string | undefined) {
  if (!id) return null;
  return state.active?.id === id
    ? state.active
    : (state.history.find((s) => s.id === id) ?? null);
}
/** A skill exam's `cert`, read before settling: an expired one leaves `active` without a trace. */
export function mockCert(userId: string, id: string) {
  try {
    return findMock(parseMockState(localStorage.getItem(mockStorageKey(userId))), id)?.cert;
  } catch {
    return undefined;
  }
}
/** Calls back when another tab writes this user's mocks; returns the unsubscribe. */
export function watchMockState(userId: string, onChange: () => void) {
  const key = mockStorageKey(userId);
  const listener = (e: StorageEvent) => {
    if (e.key === null || e.key === key) onChange();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

/**
 * The started mock a problem belongs to: the one in ?mock=, else the running one
 * when it holds this problem (opened from the library mid-exam). Null otherwise.
 */
export function mockExamFor(
  state: MockState,
  mock: string | undefined,
  problemId: string,
  now: number,
) {
  const session = mock ? findMock(state, mock) : state.active;
  if (!session?.startedAt || !session.ids.includes(problemId)) return null;
  const running = mockClock(session, now).phase === 'running';
  return mock || running ? { session, running } : null;
}

// ---------------------------------------------------------------- multiple choice

export type McqSection = 'cs' | 'code-output' | 'quant';
export const MCQ_SECTIONS: readonly McqSection[] = ['cs', 'code-output', 'quant'];
/** `whys`: one line per choice on why it is right or wrong (newer questions). */
type McqText = { q: string; choices: string[]; explain: string; whys?: string[] };
/** One question of lib/content/oa-mcq.json. */
export type McqQuestion = {
  id: string;
  section: McqSection;
  topic: string;
  /** The snippet a code-output question asks about, the same in both languages. */
  code?: string;
  lang?: string;
  /** C++ undefined behaviour: the answer is that choice, and scripts/mcq/verify-output.mjs does not run it. */
  ub?: boolean;
  zh: McqText;
  en: McqText;
  /** Right choices; more than one means "select all that apply". */
  answer: number[];
  /** The public OA item a question was adapted from. */
  source?: string;
  /** The Line 500 stop (lib/route-stops.ts) whose topic page quizzes on it. */
  stop?: string;
};
/**
 * /oa/mcq's ?section= and ?topic=: that part of the bank, filtered on the server so a link to one
 * subject does not ship the whole bank. Unknown values are ignored; a pair matching nothing gives
 * the whole bank.
 */
export function mcqScope(bank: McqQuestion[], query: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
  const section = MCQ_SECTIONS.find((s) => s === first(query.section));
  const topic = bank.some((q) => q.topic === first(query.topic)) ? first(query.topic) : undefined;
  const items = bank.filter((q) => (!section || q.section === section) && (!topic || q.topic === topic));
  return items.length && (section || topic) ? { items, initial: { section, topic } } : { items: bank, initial: undefined };
}
/** A preset's MCQ section: how many questions, how long, and where they come from. */
export type McqConfig = {
  count: number;
  minutes: number;
  sections: McqSection[];
  topics?: string[];
};

/**
 * `count` question ids from the config's sections (and topics, when set) in a seeded random
 * order, ones not in `exclude` (recently seen) first. Topics take turns, so a big topic (DSA
 * concepts, complexity) never crowds out the small ones.
 */
export function drawMcq(
  bank: readonly McqQuestion[],
  config: Pick<McqConfig, 'count' | 'sections' | 'topics'>,
  seed: number,
  exclude: ReadonlySet<string> = new Set(),
) {
  const random = seededRandom(seed);
  const turns = new Map<string, number>();
  return bank
    .filter(
      (q) =>
        config.sections.includes(q.section) &&
        (!config.topics?.length || config.topics.includes(q.topic)),
    )
    .map((q) => ({ id: q.id, topic: q.topic, seen: +exclude.has(q.id), order: random() }))
    .sort((a, b) => a.seen - b.seen || a.order - b.order)
    .map((q) => {
      const turn = turns.get(q.topic) ?? 0;
      turns.set(q.topic, turn + 1);
      return { ...q, turn };
    })
    .sort((a, b) => a.seen - b.seen || a.turn - b.turn || a.order - b.order)
    .slice(0, config.count)
    .map((q) => q.id);
}

/** Right only when the pick is exactly the answer set: no partial credit on "select all". */
export const mcqRight = (answer: readonly number[], pick: readonly number[] = []) =>
  pick.length === answer.length && answer.every((a) => pick.includes(a));

/**
 * Spaced review of answered questions, per question id: [box, day, ...picks]. A wrong answer
 * goes to box 0; a right one moves up a box when the question is new or due. Boxes 0–3 come
 * back after 1/3/7/21 days; box 4 is mastered and does not come back. `day` is the UTC day
 * number of the answer that set the box.
 */
export type McqReview = Record<string, number[]>;
export const MCQ_REVIEW_DAYS = [1, 3, 7, 21];
export const MCQ_MASTERED = MCQ_REVIEW_DAYS.length;
export const mcqDay = (now = Date.now()) => Math.floor(now / 86_400_000);
export const mcqDue = (entry: readonly number[] | undefined, today: number) =>
  !!entry && entry[0] < MCQ_MASTERED && today - entry[1] >= MCQ_REVIEW_DAYS[entry[0]];

/** The entry after answering; a right answer before it is due keeps its box (no cramming). */
export function reviewMcq(entry: readonly number[] | undefined, answer: readonly number[], picks: number[], today: number) {
  if (!mcqRight(answer, picks)) return [0, today, ...picks];
  if (entry && !mcqDue(entry, today)) return [entry[0], entry[1], ...picks];
  return [entry ? Math.min(entry[0] + 1, MCQ_MASTERED) : 1, today, ...picks];
}

/** A stored review, keeping only well-formed entries; anything else reads as none. */
export function parseMcqReview(raw: string | null | undefined): McqReview {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, e]) =>
          Array.isArray(e) && e.length > 2 && e.every(Number.isInteger) && e[0] >= 0 && e[0] <= MCQ_MASTERED,
      ),
    ) as McqReview;
  } catch {
    return {};
  }
}

/** The review as JSON within `maxBytes`, dropping the longest-unseen entries first. */
export function fitMcqReview(review: McqReview, maxBytes: number) {
  const entries = Object.entries(review).sort((a, b) => b[1][1] - a[1][1]);
  let body = JSON.stringify(Object.fromEntries(entries));
  // ponytail: one entry at a time is O(n²) bytes, fine for a few hundred questions.
  while (new TextEncoder().encode(body).length > maxBytes && entries.length) {
    entries.pop();
    body = JSON.stringify(Object.fromEntries(entries));
  }
  return body;
}

/**
 * The MCQ section's result. It counts as one more 100-point block next to the coding
 * questions' 0–100 each.
 */
// ponytail: flat 100 for the whole section; per-question points if a preset ever needs them.
export function scoreMcq(
  bank: readonly McqQuestion[],
  mcq: Pick<NonNullable<MockSession['mcq']>, 'ids' | 'picks'>,
) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const per = mcq.ids.map((id, i) => {
    const q = byId.get(id);
    return !!q && mcqRight(q.answer, mcq.picks[i]);
  });
  const correct = per.filter(Boolean).length;
  return {
    per,
    correct,
    total: mcq.ids.length,
    points: mcq.ids.length ? Math.round((100 * correct) / mcq.ids.length) : 0,
    max: 100,
  };
}
