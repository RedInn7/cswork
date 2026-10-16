import { sqlite } from '@/db/sqlite';
import { slotOf, type Slot } from '@/lib/mock-oa';
import { practiceStats } from '@/lib/practice-stats';
import { lcRating } from './lc-ratings';
import { oaRating } from './oa-rating';
import { HANDLE, shownIn, type PublicCatalogue } from './learner-cloud';

/**
 * The practice leaderboard (/leaderboard) and the README badge (/u/<handle>/badge.svg).
 * Counted as the public profile counts: judge-mode ACs on problems a guest can open. Points:
 * each distinct problem adds its zerotrac rating, an OA problem the estimate its page shows
 * (oa-rating.ts), anything else 1200/1600/2000 by difficulty, and the sum over 100 is the
 * score. Only learners whose profile is visible and who switched on show_practice are listed;
 * schools and handles are read live, so opting out is immediate.
 */
const HOUR = 3600000;
const PRIOR: Record<Slot, number> = { easy: 1200, medium: 1600, hard: 2000 };
/** Listed learners a school needs before it gets a board, as contests' schoolBoards. */
export const SCHOOL_MIN = 3;
export const BOARD_SORTS = ['score', 'solved', 'streak'] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];
const MAX_ROWS = 100;
/** Each sort's key, then its tie-breakers (then the handle). */
const ORDER: Record<BoardSort, readonly BoardSort[]> = {
  score: ['score', 'solved', 'streak'],
  solved: ['solved', 'score', 'streak'],
  streak: ['streak', 'score', 'solved'],
};

/**
 * One problem's points: its contest rating, or the OA estimate the workspace shows as its rating,
 * else a prior by difficulty (unknown counts as medium).
 */
export const problemPoints = (id: string, catalogue: PublicCatalogue) =>
  lcRating(id) ??
  oaRating(id, catalogue.get(id)?.difficulty) ??
  PRIOR[slotOf(catalogue.get(id)?.difficulty) ?? 'medium'];

type Tally = { points: number; solved: number };
type Stats = Tally & { streak: number; languages: Map<string, Tally> };

/**
 * Score, distinct ACs (all and per language) and the current streak of AC days for each learner.
 * The streak is practiceStats' with the free freezes only, in this process's time zone.
 * ponytail: freezes bought with points and the learner's own zone are left out; the progress
 * page may show one day more.
 */
function statsFor(ids: readonly string[], catalogue: PublicCatalogue, now: number) {
  const shown = shownIn(catalogue);
  const byUser = new Map<string, { problem_id: string; language: string; hour: number }[]>(ids.map((id) => [id, []]));
  for (const r of sqlite()
    .prepare(
      `SELECT user_id,problem_id,language,created_at/${HOUR} AS hour FROM submissions
      WHERE user_id IN (SELECT value FROM json_each(?)) AND mode='judge' AND status='accepted'
      GROUP BY user_id,problem_id,language,hour`,
    )
    .all(JSON.stringify(ids)) as { user_id: string; problem_id: string; language: string; hour: number }[])
    if (shown(r.problem_id)) byUser.get(r.user_id)?.push(r);
  const day = new Date(now).toDateString();
  return new Map(
    [...byUser].map(([id, rows]) => {
      const all = new Set<string>();
      const languages = new Map<string, Set<string>>();
      for (const r of rows) {
        all.add(r.problem_id);
        languages.set(r.language, (languages.get(r.language) ?? new Set<string>()).add(r.problem_id));
      }
      const tally = (set: Set<string>): Tally => ({
        points: [...set].reduce((sum, p) => sum + problemPoints(p, catalogue), 0),
        solved: set.size,
      });
      const activity = rows.map((r) => ({ problem_id: r.problem_id, created_at: r.hour * HOUR }));
      const stats: Stats = {
        ...tally(all),
        streak: rows.length ? practiceStats(activity, day, false).streak : 0,
        languages: new Map([...languages].map(([l, set]) => [l, tally(set)])),
      };
      return [id, stats] as const;
    }),
  );
}

// ponytail: a per-process cache for an hour; each instance of a multi-instance deploy computes its own.
let cache: { at: number; stats: Map<string, Stats> } | null = null;
/** Stats of these learners: cached for an hour, a learner missing from the cache (just opted in) computed now. */
function cachedStats(ids: readonly string[], catalogue: PublicCatalogue, now: number) {
  if (!cache || now - cache.at > HOUR || now < cache.at) cache = { at: now, stats: statsFor(ids, catalogue, now) };
  const missing = ids.filter((id) => !cache!.stats.has(id));
  if (missing.length) for (const [id, s] of statsFor(missing, catalogue, now)) cache.stats.set(id, s);
  return cache.stats;
}

export type BoardRow = { rank: number; handle: string; score: number; solved: number; streak: number; me: boolean };

/**
 * The board: up to 100 rows by `sort` (ties share a rank), the viewer's own row wherever it is
 * (and whether they opted in at all),
 * and the schools with at least SCHOOL_MIN listed learners (most used spelling names one).
 * `school` is a school_key and `language` a judge language; only learners with an AC count.
 */
export function practiceBoard(
  catalogue: PublicCatalogue,
  { sort = 'score', school, language }: { sort?: BoardSort; school?: string; language?: string } = {},
  viewerId: string | null = null,
  now = Date.now(),
) {
  const live = sqlite()
    .prepare('SELECT user_id,handle,school,school_key FROM user_profiles WHERE visible=1 AND show_practice=1')
    .all() as { user_id: string; handle: string; school: string; school_key: string }[];
  const stats = cachedStats(
    live.map((r) => r.user_id),
    catalogue,
    now,
  );
  const listed = live.filter((r) => stats.get(r.user_id)!.solved);
  const spellings = new Map<string, Map<string, number>>();
  for (const r of listed)
    if (r.school_key) {
      const names = spellings.get(r.school_key) ?? new Map<string, number>();
      spellings.set(r.school_key, names.set(r.school, (names.get(r.school) ?? 0) + 1));
    }
  const schools = [...spellings]
    .map(([key, names]) => ({
      key,
      name: [...names].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || +(a[0] > b[0]) - +(a[0] < b[0]))[0][0],
      members: [...names.values()].reduce((a, b) => a + b, 0),
    }))
    .filter((s) => s.members >= SCHOOL_MIN)
    .sort((a, b) => b.members - a.members || a.key.localeCompare(b.key));
  const board = schools.find((s) => s.key === school);
  const entries = listed.flatMap((r) => {
    if (school && r.school_key !== board?.key) return [];
    const s = stats.get(r.user_id)!;
    const tally = language ? s.languages.get(language) : s;
    if (!tally?.solved) return [];
    const score = Math.round(tally.points / 100);
    return [{ handle: r.handle, score, solved: tally.solved, streak: s.streak, me: r.user_id === viewerId }];
  });
  entries.sort((a, b) => ORDER[sort].reduce((d, k) => d || b[k] - a[k], 0) || a.handle.localeCompare(b.handle));
  let rank = 0;
  const rows: BoardRow[] = entries.map((e, i) => {
    if (!i || entries[i - 1][sort] !== e[sort]) rank = i + 1;
    return { rank, ...e };
  });
  return {
    rows: rows.slice(0, MAX_ROWS),
    mine: rows.find((r) => r.me) ?? null,
    /** The viewer switched the board on, listed or not (no counted AC yet). */
    optedIn: live.some((r) => r.user_id === viewerId),
    total: rows.length,
    schools,
    school: board ?? null,
  };
}

/**
 * The badge's numbers, or null when /u/<handle> would 404. Score and rank only while the
 * learner is on the board (show_practice); otherwise distinct ACs and the streak alone.
 */
export function practiceCard(handle: string, catalogue: PublicCatalogue, now = Date.now()) {
  const profile = HANDLE.test(handle)
    ? (sqlite()
        .prepare('SELECT user_id,handle,show_practice FROM user_profiles WHERE handle=? AND visible=1')
        .get(handle) as { user_id: string; handle: string; show_practice: number } | undefined)
    : undefined;
  if (!profile) return null;
  const mine = profile.show_practice ? practiceBoard(catalogue, {}, profile.user_id, now).mine : null;
  const stats = mine ? null : statsFor([profile.user_id], catalogue, now).get(profile.user_id)!;
  return {
    handle: profile.handle,
    solved: mine?.solved ?? stats!.solved,
    streak: mine?.streak ?? stats!.streak,
    score: mine?.score ?? null,
    rank: mine?.rank ?? null,
  };
}

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A 320×60 SVG for a README: CSWork, the handle, then ACs, score and rank (when listed) and the streak. */
export function badgeSvg(card: NonNullable<ReturnType<typeof practiceCard>>, zh: boolean) {
  const facts = [
    zh ? `通过 ${card.solved}` : `${card.solved} solved`,
    card.score !== null && (zh ? `积分 ${card.score}` : `${card.score} pts`),
    card.rank !== null && (zh ? `第 ${card.rank} 名` : `rank #${card.rank}`),
    zh ? `连续 ${card.streak} 天` : `${card.streak}-day streak`,
  ].filter(Boolean);
  const line = xml(facts.join(' · '));
  const handle = xml(`@${card.handle}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="60" viewBox="0 0 320 60" role="img" aria-label="CSWork ${handle}: ${line}">
<title>CSWork ${handle}: ${line}</title>
<rect width="320" height="60" rx="8" fill="#0e1a2b"/>
<rect x="0" y="0" width="4" height="60" rx="2" fill="#ffb23f"/>
<g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif">
<text x="16" y="17" fill="#ffb23f" font-size="10" font-weight="700" letter-spacing="1.5">CSWORK</text>
<text x="16" y="35" fill="#ffffff" font-size="15" font-weight="700">${handle}</text>
<text x="16" y="51" fill="#c9d6e6" font-size="11">${line}</text>
</g>
</svg>`;
}
