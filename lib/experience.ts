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
  /** The author's address was verified (no identity check beyond that). */
  verified: boolean;
};
/** Filters only member posts carry: imported experiences have none of these. */
export const MEMBER_FILTERS = ['employment', 'season', 'channel'] as const;
