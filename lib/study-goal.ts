// Client-safe and pure: the daily XP goal and quests of the top bar (components/daily-goal.tsx).
// lib/server/study-days.ts reads the learner's activity into events; this scores them.
import { hash } from './daily-problem';
import { seededRandom } from './mock-oa';

/** XP for each distinct item of a kind, and the most that kind earns in one local day. */
export const XP = {
  ac: [10, 60],
  mock: [15, 30],
  sd: [10, 30],
  stress: [5, 10],
  mcq: [1, 20],
  recall: [1, 10],
} as const satisfies Record<string, readonly [number, number]>;
export type StudyKind = keyof typeof XP;
export const STUDY_KINDS = Object.keys(XP) as StudyKind[];
/** One thing done: `key` names the item (a problem, a chapter, a card), counted once a day. */
export type StudyEvent = { kind: StudyKind; key: string; at: number };
/** Distinct items done per kind. */
export type DayCounts = Partial<Record<StudyKind, number>>;
/** A day a streak survives without an AC: the XP goal met, or `rest` a rest day or review break. */
export type CoveredDay = { date: string; rest: boolean };

/** Distinct items per kind per local day (YYYY-MM-DD at the Date#getTimezoneOffset `tz`). */
export function tally(events: readonly StudyEvent[], tz: number) {
  const seen = new Set<string>();
  const days = new Map<string, DayCounts>();
  for (const { kind, key, at } of events) {
    const date = new Date(at - tz * 60000).toISOString().slice(0, 10);
    const id = `${date}|${kind}|${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const counts = days.get(date) ?? {};
    counts[kind] = (counts[kind] ?? 0) + 1;
    days.set(date, counts);
  }
  return days;
}

/** A day's XP: each kind's items times its rate, up to its daily cap. */
export const xpOf = (counts: DayCounts = {}) =>
  STUDY_KINDS.reduce((sum, kind) => sum + Math.min((counts[kind] ?? 0) * XP[kind][0], XP[kind][1]), 0);

/** Covered days as practiceStats takes them: local noons, in the clock that parses them. */
export const coveredNoons = (covered: readonly CoveredDay[]) =>
  covered.map(({ date, rest }) => ({ time: Date.parse(`${date}T12:00`), rest }));

/** The quest templates: how many distinct items of the kind finish one, and where to do them. */
export const QUESTS: Record<StudyKind, { need: number; zh: string; en: string; href: string }> = {
  ac: { need: 2, zh: '通过 2 道题', en: 'Solve 2 problems', href: '/?view=problems' },
  mcq: { need: 5, zh: '答 5 道新选择题', en: 'Answer 5 new multiple-choice questions', href: '/oa/mcq' },
  sd: { need: 1, zh: '读完 1 章系统设计', en: 'Read 1 system design chapter', href: '/system-design' },
  stress: { need: 1, zh: '跑 1 次对拍或复杂度测试', en: 'Run 1 stress test or complexity probe', href: '/?view=problems' },
  mock: { need: 1, zh: '做完 1 场模拟 OA', en: 'Finish 1 mock OA', href: '/?view=mock' },
  recall: { need: 3, zh: '自评 3 张复习卡', en: 'Self-grade 3 review cards', href: '/?view=progress&tab=review' },
};

/**
 * Today's 3 quests, drawn without repeats from a PRNG seeded by `seed` (the learner and their
 * local date), so the draw holds all day. A kind weighs 1/(1 + its items in `recent7`, the 7 days
 * before today): the areas left alone come up more. A kind at Infinity is never drawn.
 * Quests only tick: they pay no points, since most of what they count is written by the browser.
 */
export function dailyQuests(seed: string, recent7: DayCounts): StudyKind[] {
  const random = seededRandom(hash(seed));
  // The system design course is taken down: its quest is never drawn.
  const pool = STUDY_KINDS.filter((kind) => kind !== 'sd');
  const picked: StudyKind[] = [];
  while (picked.length < 3) {
    const weights = pool.map((kind) => 1 / (1 + (recent7[kind] ?? 0)));
    let r = random() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= weights[i]) >= 0) i++;
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}
