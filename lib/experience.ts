/**
 * Interview experience facts kept in the content library's `extra`: the self-reported outcome,
 * the rounds and the interview date. Labels only: these samples are biased, never a pass rate.
 */
export const RESULTS: Readonly<Record<string, { zh: string; en: string; tone: 'good' | 'bad' | 'neutral' }>> = {
  Offer: { zh: '拿到 Offer', en: 'Offer', tone: 'good' },
  Rejected: { zh: '未通过', en: 'Rejected', tone: 'bad' },
  'In progress': { zh: '流程中', en: 'In progress', tone: 'neutral' },
  'No response': { zh: '无回音', en: 'No response', tone: 'neutral' },
  Withdrew: { zh: '主动退出', en: 'Withdrew', tone: 'neutral' },
};
/** [zh, en] */
export const ROUND_LABELS: Readonly<Record<string, [string, string]>> = {
  'Online Assessment': ['OA', 'OA'],
  'Technical Screen': ['技术面', 'Tech screen'],
  Onsite: ['Onsite', 'Onsite'],
  'HR Screen': ['HR 面', 'HR screen'],
  'Take-home Project': ['Take-home', 'Take-home'],
  Other: ['其他', 'Other'],
};
export type ExperienceFacts = {
  result: string | null;
  rounds: string[];
  /** YYYY-MM-DD, only when the source dates the interview itself (not when it was reported). */
  interviewDate: string | null;
};

/** SELECT columns for the facts; `t` is a table prefix such as `i.`. */
export const experienceColumns = (t = '') =>
  `json_extract(${t}extra,'$.result') AS result,json_extract(${t}extra,'$.rounds') AS rounds,` +
  `CASE json_extract(${t}extra,'$.dateBasis') WHEN 'interview' THEN json_extract(${t}extra,'$.date') END AS interview_date`;

/** Facts from those columns (rounds as JSON text) or from a parsed `extra`. Unknown values drop out. */
export function experienceFacts(r: {
  result?: unknown;
  rounds?: unknown;
  interview_date?: unknown;
}): ExperienceFacts {
  let rounds: unknown = r.rounds;
  if (typeof rounds === 'string')
    try {
      rounds = JSON.parse(rounds);
    } catch {
      rounds = [];
    }
  return {
    result: typeof r.result === 'string' && Object.hasOwn(RESULTS, r.result) ? r.result : null,
    rounds: Array.isArray(rounds) ? rounds.filter((x): x is string => typeof x === 'string') : [],
    interviewDate:
      typeof r.interview_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.interview_date)
        ? r.interview_date
        : null,
  };
}
/** A parsed `extra` → facts (its date counts only when it is the interview's). */
export const experienceFactsOf = (extra: Record<string, unknown> | null | undefined) =>
  experienceFacts({
    result: extra?.result,
    rounds: extra?.rounds,
    interview_date: extra?.dateBasis === 'interview' ? extra.date : null,
  });

/** A member-written experience's body length in characters (lib/server/experience-submissions.ts). */
export const MEMBER_BODY = { min: 80, max: 20000 } as const;

/** Optional structured facts a member gives with an experience, [zh, en] labels. */
export const SENTIMENTS: Readonly<Record<string, [string, string]>> = {
  pos: ['体验好', 'Positive'],
  neutral: ['一般', 'Neutral'],
  neg: ['体验差', 'Negative'],
};
export const SOURCES: Readonly<Record<string, [string, string]>> = {
  referral: ['内推', 'Referral'],
  online: ['网申', 'Applied online'],
  campus: ['校招 / 招聘会', 'Campus / career fair'],
  recruiter: ['猎头 / HR 联系', 'Recruiter reached out'],
  other: ['其他', 'Other'],
};
export const EMPLOYMENT: Readonly<Record<string, [string, string]>> = {
  fulltime: ['全职', 'Full-time'],
  intern: ['实习', 'Internship'],
};
export const SEASON_NAMES: Readonly<Record<string, [string, string]>> = {
  spring: ['春招', 'Spring'],
  summer: ['暑期', 'Summer'],
  fall: ['秋招', 'Fall'],
  winter: ['冬季', 'Winter'],
};
/** A hiring season, e.g. 2026-fall. */
export const SEASON = /^(\d{4})-(spring|summer|fall|winter)$/;
export const seasonLabel = (season: string, zh: boolean) => {
  const m = SEASON.exec(season);
  return m ? `${m[1]} ${SEASON_NAMES[m[2]][zh ? 0 : 1]}` : season;
};
export type MemberDetails = {
  difficulty: number | null;
  sentiment: string | null;
  channel: string | null;
  employment: string | null;
  season: string | null;
  location: string | null;
  durationWeeks: number | null;
  /** How the author prepared: weeks spent and PREP_SOURCES keys (published with the post). */
  prepWeeks: number | null;
  prepSources: string[];
  /** The author's address was verified (no identity check beyond that). */
  verified: boolean;
};
/** Where an author practised before the interview, [zh, en]. */
export const PREP_SOURCES: Readonly<Record<string, [string, string]>> = {
  cswork: ['CSWork 练习', 'CSWork practice'],
  leetcode: ['LeetCode', 'LeetCode'],
  'oa-platform': ['OA 平台题', 'OA platforms'],
  mock: ['模拟面试', 'Mock interviews'],
  books: ['书和课程', 'Books and courses'],
  other: ['其他', 'Other'],
};
/** One line for how a post's author prepared, e.g. "准备 6 周 · LeetCode、模拟面试"; null when not given. */
export function prepLine(d: Pick<MemberDetails, 'prepWeeks' | 'prepSources'> | null | undefined, zh: boolean) {
  if (!d) return null;
  const sources = (d.prepSources ?? []).filter((s) => Object.hasOwn(PREP_SOURCES, s)).map((s) => PREP_SOURCES[s][zh ? 0 : 1]);
  const weeks = d.prepWeeks ?? null;
  if (weeks === null && !sources.length) return null;
  const head = weeks === null ? (zh ? '准备' : 'Prepared with') : zh ? `准备 ${weeks} 周` : `Prepared ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  return sources.length ? `${head}${weeks === null ? (zh ? '：' : ' ') : ' · '}${sources.join(zh ? '、' : ', ')}` : head;
}
/**
 * A question of a member's post: its text, the round it came up in ('' when not said) and the
 * site problem it links to ('' for none); similar when the asked question only resembled it.
 * `title` is the linked problem's, filled in for pages (titleQuestions in lib/server).
 */
export type MemberQuestion = { text: string; round: string; problem: string; similar: boolean; title?: string; titleEn?: string };
/** Facts only member posts carry, each a filter menu: imported experiences have none of these. */
export const MEMBER_FACETS = ['employment', 'season', 'channel'] as const;
/** Filters that list member posts only: the facts, and verified=1 (authors with a verified address). */
export const MEMBER_FILTERS = [...MEMBER_FACETS, 'verified'] as const;

/** An OA round's optional outcome a member gives: the ranges the form and the server share. */
export const OA_RANGE = { solved: [0, 10], total: [1, 10], testsPct: [0, 100], minutes: [1, 300] } as const;
/** Whether the OA led to the next round, [zh, en]. */
export const OA_NEXT: Readonly<Record<string, [string, string]>> = {
  yes: ['进了下一轮', 'Moved on'],
  no: ['没进下一轮', 'Did not move on'],
  pending: ['还在等', 'Waiting'],
};
export type MemberOa = {
  solved: number | null;
  total: number | null;
  testsPct: number | null;
  minutes: number | null;
  next: string | null;
};
/** One line for a post's OA outcome, e.g. "OA 2/3 题 · 用例 85% · 70 分钟 · 进了下一轮"; null when none is given. */
export function oaLine(oa: MemberOa | null | undefined, zh: boolean) {
  if (!oa || Object.values(oa).every((v) => v === null)) return null;
  const { solved, total, testsPct, minutes, next } = oa;
  const parts = [
    solved !== null && total !== null
      ? zh ? `OA ${solved}/${total} 题` : `OA ${solved}/${total} solved`
      : total !== null
        ? zh ? `OA 共 ${total} 题` : `OA, ${total} ${total === 1 ? 'problem' : 'problems'}`
        : solved !== null
          ? zh ? `OA 做出 ${solved} 题` : `OA, ${solved} solved`
          : 'OA',
    testsPct !== null && (zh ? `用例 ${testsPct}%` : `${testsPct}% of tests`),
    minutes !== null && (zh ? `${minutes} 分钟` : `${minutes} min`),
    next && Object.hasOwn(OA_NEXT, next) && OA_NEXT[next][zh ? 0 : 1],
  ].filter((x): x is string => !!x);
  return parts.join(' · ');
}
