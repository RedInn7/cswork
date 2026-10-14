/**
 * Timed mock OA: the draw, the score and the exam clock. Pure and shared by the
 * API (lib/server/mock-oa.ts) and the browser (components/mock-oa.tsx); the
 * session lives only in this browser's localStorage (v1: no cross-device history).
 */
export type Slot = 'easy' | 'medium' | 'hard';
export type Scoring = 'tests' | 'gca';
export type MockSource = 'mixed' | 'oa' | 'lc';
export const SLOTS: readonly Slot[] = ['easy', 'medium', 'hard'];
const RANK: Record<Slot, number> = { easy: 0, medium: 1, hard: 2 };

/** Catalogue difficulty (简单/中等/困难, or the English word) as a slot. */
export function slotOf(difficulty?: string | null): Slot | null {
  const value = (
    { 简单: 'easy', 中等: 'medium', 困难: 'hard' } as Record<string, Slot>
  )[difficulty || ''];
  return value ?? (SLOTS.includes(difficulty as Slot) ? (difficulty as Slot) : null);
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

export type PoolItem = { id: string; difficulty: Slot | null; oa: boolean };
/** Lexicographic a < b. */
function before(a: number[], b: number[]) {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
  return false;
}

/**
 * One problem per slot, in slot order, or null when the pool is too small.
 * Per slot the best candidate wins by: not just seen (exclude) > fits the slot's
 * difficulty > not solved yet > closest difficulty > random. LeetCode difficulty is
 * reliable, so it fits only its own slot; OA labels are mostly a default 中等, so an
 * OA problem fits any slot within one step (a medium fits every slot).
 */
export function drawMock({
  pool,
  slots,
  solved = new Set(),
  exclude = new Set(),
  random = Math.random,
}: {
  pool: readonly PoolItem[];
  slots: readonly Slot[];
  solved?: ReadonlySet<string>;
  exclude?: ReadonlySet<string>;
  random?: () => number;
}): string[] | null {
  const left = [...new Map(pool.map((item) => [item.id, item])).values()];
  if (left.length < slots.length) return null;
  // Fisher–Yates first: the stable scan below then breaks ties at random.
  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  const picked: string[] = [];
  for (const slot of slots) {
    let best = -1,
      bestKey: number[] = [];
    left.forEach((item, index) => {
      const distance =
        item.difficulty === null
          ? 1
          : Math.abs(RANK[item.difficulty] - RANK[slot]);
      const fits = item.oa ? distance <= 1 : distance === 0;
      const key = [
        +exclude.has(item.id),
        +!fits,
        +solved.has(item.id),
        distance,
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
};
export type MockState = { active: MockSession | null; history: MockSession[] };
export const MOCK_HISTORY = 30;
export const WARN_MINUTES = [10, 5] as const;

export const mockDeadline = (s: MockSession) =>
  (s.startedAt ?? 0) + s.minutes * 60000;

/** Phase, time left and the warning level (10 or 5 minutes left, else 0). */
export function mockClock(s: MockSession, now: number) {
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

/** Server-time window of the exam's submissions; a few seconds of slack for clock jitter. */
export function reportWindow(s: MockSession) {
  const end = s.finishedAt ?? mockDeadline(s);
  return {
    from: Math.round((s.startedAt ?? s.createdAt) + s.skew - 5000),
    to: Math.round(end + s.skew + 5000),
  };
}

/** The finished session goes to the top of the history (newest first, capped). */
export function archiveMock(state: MockState, s: MockSession): MockState {
  return {
    active: state.active?.id === s.id ? null : state.active,
    history: [s, ...state.history.filter((h) => h.id !== s.id)].slice(
      0,
      MOCK_HISTORY,
    ),
  };
}

/** A running session whose time ran out while the tab was closed finishes now. */
export function settleMockState(state: MockState, now: number): MockState {
  const a = state.active;
  if (!a?.startedAt || mockClock(a, now).phase !== 'finished') return state;
  return archiveMock(state, finishMock(a, now, 'timeout'));
}

/** Submissions in the exam window: per question todo / tried / ac. */
export function questionStates(
  s: MockSession,
  submissions: readonly { problem_id: string; status: string; created_at: number }[],
) {
  const { from, to } = reportWindow(s);
  return s.ids.map((id) => {
    const mine = submissions.filter(
      (x) =>
        x.problem_id === id &&
        x.created_at >= from &&
        x.created_at <= to &&
        x.status !== 'cancelled',
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
    Number.isFinite(s.skew ?? 0)
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
