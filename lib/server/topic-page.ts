// What a /topics/<stop> page shows beyond its template: the stop's Line 500 problems by stage
// with a warm-up, its OA questions and Core Skills, where it sits on the prerequisite graph and
// how often it is asked. Server-rendered from the list's own queries; no API of its own.
import coreFile from '@/lib/content/core-skills.json';
import whyFile from '@/lib/content/topic-why.json';
import { problemAppHref } from '@/lib/classic-lists';
import { companyTagIndex, type CompanyTag } from '@/lib/company-tags';
import { curatedEntries, type CuratedEntry } from '@/lib/ling-curated';
import { ROUTE_SLUGS, stopHeat, stopPrereqs } from '@/lib/route-stops';
import { line500Path } from '@/lib/route-templates';
import { runningContestProblems } from './contests';
import { hiddenCompanies } from './env';
import { oaReadyProblems } from './oa-judge';
import { oaLibrary } from './oa-library';
import { ensurePracticeRound } from './practice-rounds';
import { judgeProgress, studyProgress } from './practice-progress';
import { selectionOf, studyLibrarySummaries } from './study-library';

export type Status = 'solved' | 'attempted' | 'not_started';
export type PracticeRow = {
  id: string;
  number: number;
  titleZh: string;
  titleEn: string;
  difficulty: string;
  rating: number | null;
  stage: CuratedEntry['stage'];
  /** The one-line approach; empty while the problem is in the viewer's running contest or exam. */
  reason: string;
  reasonEn: string;
  judgeProblemId: string | null;
  href: string;
  /** Members only. */
  status?: Status;
};
/** A stop on the prerequisite graph; `solved` for members only. */
export type StopCount = { slug: string; total: number; solved?: number };
export type TopicPractice = {
  signedIn: boolean;
  stages: { stage: CuratedEntry['stage']; stageEn: CuratedEntry['stageEn']; rows: PracticeRow[] }[];
  focus: PracticeRow | null;
  prereqs: StopCount[];
  leadsTo: StopCount[];
  asked: ReturnType<typeof stopAsked>;
  oa: { items: { id: string; title: string; companySlug: string; companyName: string; href: string; status?: Status }[]; total: number };
  core: { id: string; titleZh: string; titleEn: string; difficulty: string; href: string; status?: Status }[];
};

const STAGES: [CuratedEntry['stage'], CuratedEntry['stageEn']][] = [
  ['基础', 'Foundation'],
  ['核心', 'Core'],
  ['进阶', 'Advanced'],
];
const bySection = new Map<string, CuratedEntry[]>();
for (const entry of curatedEntries) bySection.set(entry.sectionSlug, [...(bySection.get(entry.sectionSlug) ?? []), entry]);
const idsOf = (slug: string) => (bySection.get(slug) ?? []).map((e) => `lc-${e.number}`);
const coreById = new Map(coreFile.problems.map((p) => [p.id, p]));
const coreOf = (slug: string) =>
  ((whyFile as Record<string, { core: string[] }>)[slug]?.core ?? []).flatMap((id) => coreById.get(id) ?? []);

/** The stops that list this one as a prerequisite, in line order. */
export const stopLeadsTo = (slug: string) => ROUTE_SLUGS.filter((s) => stopPrereqs(s).includes(slug));

/**
 * The warm-up: the first judgeable Foundation problem outside the running contest, else the
 * first judgeable one (stops with no Foundation stage), else the first one left.
 */
export function pickFocus<T extends { id: string; stage: string; judgeProblemId: string | null }>(
  rows: readonly T[],
  running: ReadonlySet<string>,
) {
  const open = rows.filter((row) => !running.has(row.judgeProblemId ?? row.id));
  const basic = open.filter((row) => row.stage === '基础');
  return basic.find((row) => row.judgeProblemId) ?? open.find((row) => row.judgeProblemId) ?? open[0] ?? null;
}

/** Companies whose reports map onto these problems (the tags leave hidden ones out), their reports and the top five. */
export function stopAsked(
  ids: readonly string[],
  tags: ReadonlyMap<string, readonly Pick<CompanyTag, 'slug' | 'name' | 'count'>[]>,
) {
  const by = new Map<string, { slug: string; name: string; count: number }>();
  for (const id of ids)
    for (const { slug, name, count } of tags.get(id) ?? []) {
      const company = by.get(slug) ?? { slug, name, count: 0 };
      company.count += count;
      by.set(slug, company);
    }
  const all = [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
  return { companies: all.length, reports: all.reduce((sum, c) => sum + c.count, 0), top: all.slice(0, 5) };
}

/** Heat 0–3 per stop for the /topics index, as on the route line. */
export function topicHeat() {
  // ponytail: tags rebuilt per request, like the list API, so hidden companies drop out at once.
  const tags = companyTagIndex(hiddenCompanies());
  const companies = ROUTE_SLUGS.map((slug) => [slug, stopAsked(idsOf(slug), tags).companies] as const);
  const hottest = Math.max(1, ...companies.map(([, n]) => n));
  return Object.fromEntries(companies.map(([slug, n]) => [slug, stopHeat(n, hottest)]));
}

// ponytail: oaReadyProblems json_extracts every OA version and its first call loads the 6.7 MB
// catalog; 35 crawlable pages share one answer for 60 s, so a new OA question shows here a minute late.
let oaReady: { at: number; ids: Promise<Set<string>> } | undefined;
function readyOa() {
  if (!oaReady || Date.now() - oaReady.at > 60_000)
    oaReady = {
      at: Date.now(),
      ids: oaReadyProblems().then(
        (problems) => new Set(problems.keys()),
        (error) => {
          oaReady = undefined;
          throw error;
        },
      ),
    };
  return oaReady.ids;
}

export async function topicPractice(slug: string, userId: string | null): Promise<TopicPractice> {
  const entries = bySection.get(slug) ?? [];
  const progress = userId ? studyProgress(userId, ensurePracticeRound(userId)) : new Map();
  const running = userId ? runningContestProblems(userId) : new Set<string>();
  const state = (p?: { solved: boolean; attempted: boolean }): Status | undefined =>
    !userId ? undefined : p?.solved ? 'solved' : p?.attempted ? 'attempted' : 'not_started';
  const summaries = new Map(studyLibrarySummaries(idsOf(slug)).map((s) => [s.number, s]));
  const rows = entries.flatMap((entry): PracticeRow[] => {
    const s = summaries.get(entry.number);
    if (!s) return [];
    // The one-line approach stays home while the problem is in a running contest or exam.
    const { reason, reasonEn } = selectionOf(entry.number, running.has(s.judgeProblemId ?? s.id))!;
    return [
      {
        id: s.id,
        number: s.number,
        titleZh: s.titleZh,
        titleEn: s.titleEn,
        difficulty: s.difficulty,
        rating: s.rating,
        stage: entry.stage,
        reason,
        reasonEn,
        judgeProblemId: s.judgeProblemId,
        href: s.judgeProblemId ? problemAppHref(s.judgeProblemId) : line500Path(slug),
        status: state(progress.get(s.id)),
      },
    ];
  });
  const count = (stop: string): StopCount => {
    const ids = idsOf(stop);
    return {
      slug: stop,
      total: ids.length,
      ...(userId && { solved: ids.filter((id) => progress.get(id)?.solved).length }),
    };
  };
  const solvedOf = (map: ReadonlyMap<string, 'solved' | 'attempted'>, id: string): Status | undefined =>
    userId ? (map.get(id) ?? 'not_started') : undefined;
  const oaProgress = userId ? judgeProgress(userId, 'oa-%') : new Map<string, 'solved' | 'attempted'>();
  const oaPage = oaLibrary().list(new URLSearchParams({ topic: slug, ready: '1' }), await readyOa(), {
    progress: oaProgress,
  });
  const coreProgress = userId ? judgeProgress(userId, 'core-%') : new Map<string, 'solved' | 'attempted'>();
  return {
    signedIn: !!userId,
    stages: STAGES.map(([stage, stageEn]) => ({ stage, stageEn, rows: rows.filter((row) => row.stage === stage) })),
    focus: pickFocus(rows, running),
    prereqs: stopPrereqs(slug).map(count),
    leadsTo: stopLeadsTo(slug).map(count),
    asked: stopAsked(idsOf(slug), companyTagIndex(hiddenCompanies())),
    oa: {
      items: oaPage.items.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        companySlug: item.companySlug,
        companyName: item.companyName,
        href: problemAppHref(item.id),
        status: solvedOf(oaProgress, item.id),
      })),
      total: oaPage.total,
    },
    core: coreOf(slug).map((p) => ({
      id: p.id,
      titleZh: p.titleZh,
      titleEn: p.titleEn,
      difficulty: p.difficulty,
      href: problemAppHref(p.id),
      status: solvedOf(coreProgress, p.id),
    })),
  };
}
