'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Snowflake } from 'lucide-react';
import {
  achievements,
  COMPANY_MIN,
  newlyEarned,
  type Badge,
} from '@/lib/achievements';
import { classicListProgress } from '@/lib/classic-lists';
import { readMockState } from '@/lib/mock-oa';
import { canonicalCompany } from '@/lib/oa-company-brands';
import type { PracticeHistoryItem } from '@/lib/practice-review';
import type { ProblemSummary } from '@/lib/problems';
import { api } from '@/lib/types';
import { practiceStats, type Activity } from './practice-calendar';
import '@/app/achievements.css';

type T = (zh: string, en: string) => string;
type Section = { slug: string; solved: number; total: number };
const WEEK = 7 * 86400000;
const titleCase = (slug: string) =>
  slug.replace(/(^|-)([a-z])/g, (_, dash: string, c: string) => (dash ? ' ' : '') + c.toUpperCase());

/**
 * The progress page's badges. A stop counts as cleared on the round's progress or on
 * every on-site AC, whichever is further.
 * ponytail: the larger of the two counts, not their union; the exact union needs each stop's ids.
 */
export function progressBadges({
  sections,
  history,
  problems,
  userId,
  now,
  companyNames = new Map(),
  bought = [],
  dailyDays,
}: {
  sections: readonly Section[];
  history: readonly PracticeHistoryItem[];
  problems: readonly ProblemSummary[];
  userId?: string;
  now: number;
  /** Employer slug -> name, as the OA library lists them. */
  companyNames?: ReadonlyMap<string, string>;
  /** Streak freezes bought with points (bootstrap purchasedFreezes), as on the calendar. */
  bought?: readonly number[];
  /** Daily problems solved on their day (GET oj/points/daily); no month badges without it. */
  dailyDays?: readonly string[];
}) {
  const solved = new Set(history.flatMap((item) => (item.firstAcAt ? [item.problemId] : [])));
  const perStop = new Map<string, number>();
  for (const item of history)
    if (item.firstAcAt && item.stop) perStop.set(item.stop, (perStop.get(item.stop) ?? 0) + 1);
  const companies = new Map<string, { slug: string; name: string; solved: number; total: number }>();
  for (const { id } of problems) {
    const raw = /^oa-(.+)-\d+$/.exec(id)?.[1];
    if (!raw) continue;
    // One employer per badge, like the OA library: sig and susquehanna-... are one company.
    const slug = canonicalCompany(raw);
    const entry = companies.get(slug) ?? {
      slug,
      name: companyNames.get(slug) ?? titleCase(slug),
      solved: 0,
      total: 0,
    };
    entry.total++;
    if (solved.has(id)) entry.solved++;
    companies.set(slug, entry);
  }
  const acActivity: Activity[] = history.flatMap((item) =>
    item.acAt.map((created_at) => ({ problem_id: item.problemId, created_at })),
  );
  const first = Math.min(now, ...acActivity.map((a) => a.created_at));
  const weeks = Math.max(26, Math.ceil((now - first) / WEEK) + 2);
  const stops = sections.map((s) => ({ ...s, solved: Math.max(s.solved, perStop.get(s.slug) ?? 0) }));
  const visible = new Set(problems.map((p) => p.id));
  const count = (prefix: string) => [...solved].filter((id) => id.startsWith(prefix)).length;
  return achievements({
    stops,
    bestStreak: practiceStats(acActivity, new Date(now).toDateString(), false, [], weeks, bought).best,
    acTimes: acActivity.map((a) => a.created_at),
    companies: [...companies.values()],
    perfectMock:
      !!userId &&
      readMockState(userId).history.some((s) => !!s.result && s.result.score >= s.result.max),
    dailyDays,
    lists: classicListProgress(solved, (id) => visible.has(id)),
    domains: { line: stops.reduce((n, s) => n + s.solved, 0), sql: count('sql-'), oa: count('oa-') },
  });
}

/** Setting a badge beside the handle on the public page; offered for badges that page would show. */
type Feature = { featured: string | null; featurable: ReadonlySet<string>; onFeature: (id: string | null) => void };

function Medal({ badge, t, index, feature }: { badge: Badge; t: T; index: number; feature?: Feature }) {
  const [have, need] = badge.progress;
  // A domain shows the way to its next star until the last one.
  const done = badge.earned && (badge.group !== 'domain' || have >= need);
  const on = feature?.featured === badge.id;
  return (
    <li
      className="badge-medal"
      data-group={badge.group}
      data-earned={badge.earned || undefined}
      style={{ '--k': index } as React.CSSProperties}
    >
      <span className="badge-medal-face" aria-hidden="true">
        {badge.group === 'streak' || badge.group === 'days' ? need : <Award size={18} />}
      </span>
      <span className="badge-medal-name">{t(badge.zh, badge.en)}</span>
      <span className="badge-medal-state">{done ? t('已解锁', 'Unlocked') : `${have} / ${need}`}</span>
      {badge.earned && feature?.featurable.has(badge.id) && (
        <button
          type="button"
          className="badge-feature"
          aria-pressed={on}
          onClick={() => feature?.onFeature(on ? null : badge.id)}
        >
          {on ? t('主页展示中', 'On your profile') : t('设为展示', 'Feature')}
        </button>
      )}
    </li>
  );
}

/** A group's earned badges, then the three closest to done. */
function closest(badges: Badge[], group: Badge['group']) {
  const all = badges
    .filter((b) => b.group === group)
    .sort(
      (a, b) =>
        Number(b.earned) - Number(a.earned) ||
        b.progress[0] / b.progress[1] - a.progress[0] / a.progress[1],
    );
  return [...all.filter((b) => b.earned), ...all.filter((b) => !b.earned && b.progress[0] > 0).slice(0, 3)];
}

/**
 * The badge wall: the line's 35 stop roundels, then milestones and domain stars, daily problem
 * months, classic lists and companies. With `feature`, earned medals can go on the public page.
 */
export function BadgeWall({ badges, english, feature }: { badges: Badge[]; english: boolean; feature?: Feature }) {
  const t: T = (zh, en) => (english ? en : zh);
  const stops = badges.filter((b) => b.group === 'stop');
  const line = badges.find((b) => b.group === 'line');
  const cleared = stops.filter((b) => b.earned).length;
  const milestones = badges.filter((b) => ['streak', 'days', 'mock', 'domain'].includes(b.group));
  const months = badges.filter((b) => b.group === 'daily');
  const shownLists = closest(badges, 'list');
  const shownCompanies = closest(badges, 'company');
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div className="badge-wall">
      <section className="badge-board" aria-labelledby="badge-line-title">
        <header className="badge-board-head">
          <span className="route-roundel" data-earned={line?.earned || undefined} aria-hidden="true">
            500
          </span>
          <div>
            <h2 id="badge-line-title">{t('线路徽章', 'Line badges')}</h2>
            <p>
              {t(
                `已通关 ${cleared} / ${stops.length} 站 · 共解锁 ${earned} 枚徽章`,
                `${cleared} of ${stops.length} stops cleared · ${earned} ${earned === 1 ? 'badge' : 'badges'} unlocked`,
              )}
            </p>
          </div>
        </header>
        <ol className="badge-stops">
          {stops.map((badge, i) => (
            <li
              key={badge.id}
              data-earned={badge.earned || undefined}
              title={`${t(badge.zh, badge.en)} · ${badge.progress[0]}/${badge.progress[1]}`}
              style={
                {
                  '--k': i,
                  '--frac': badge.progress[1] ? badge.progress[0] / badge.progress[1] : 0,
                } as React.CSSProperties
              }
            >
              <span className="badge-stop-roundel" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="badge-stop-name">{t(badge.zh.replace(/站$/, ''), badge.en)}</span>
              <span className="sr-only">
                {badge.earned
                  ? t('，已通关', ', cleared')
                  : t(
                      `，已通过 ${badge.progress[0]} / ${badge.progress[1]}`,
                      `, ${badge.progress[0]} of ${badge.progress[1]} solved`,
                    )}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="badge-milestone-title">
        <h2 id="badge-milestone-title" className="badge-heading">
          {t('里程碑', 'Milestones')}
        </h2>
        <ul className="badge-medals">
          {milestones.map((badge, i) => (
            <Medal key={badge.id} badge={badge} t={t} index={i} feature={feature} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="badge-daily-title">
        <h2 id="badge-daily-title" className="badge-heading">
          {t('每日一题全勤', 'Daily problem months')}
        </h2>
        {months.length ? (
          <ul className="badge-medals">
            {months.map((badge, i) => (
              <Medal key={badge.id} badge={badge} t={t} index={i} feature={feature} />
            ))}
          </ul>
        ) : (
          <p className="badge-empty">
            {t(
              '一个北京月份里每天都做完当天的每日一题，就能拿到这个月的全勤徽章。',
              'Solve the daily problem on every day of a month (Beijing time) to earn that month’s badge.',
            )}
          </p>
        )}
      </section>
      <section aria-labelledby="badge-list-title">
        <h2 id="badge-list-title" className="badge-heading">
          {t('经典题单', 'Classic lists')}
        </h2>
        {shownLists.length ? (
          <ul className="badge-medals">
            {shownLists.map((badge, i) => (
              <Medal key={badge.id} badge={badge} t={t} index={i} feature={feature} />
            ))}
          </ul>
        ) : (
          <p className="badge-empty">
            {t(
              '把热题 100、Blind 75 这样的经典题单里能在本站判题的题全部做通，就能拿到它的徽章。',
              'Solve every problem of a classic list such as Top 100 Liked or Blind 75 that is judged here to earn its badge.',
            )}
          </p>
        )}
      </section>
      <section aria-labelledby="badge-company-title">
        <h2 id="badge-company-title" className="badge-heading">
          {t('公司 OA', 'Company OAs')}
        </h2>
        {shownCompanies.length ? (
          <ul className="badge-medals">
            {shownCompanies.map((badge, i) => (
              <Medal key={badge.id} badge={badge} t={t} index={i} feature={feature} />
            ))}
          </ul>
        ) : (
          <p className="badge-empty">
            {t(
              `把一家公司（至少 ${COMPANY_MIN} 道）可判题的 OA 全部做通，就能拿到它的徽章。`,
              `Solve every judgeable OA of a company (${COMPANY_MIN}+ problems) to earn its badge.`,
            )}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Lines under "Accepted": badges this AC unlocked (a stop or the whole line, a streak
 * milestone) and the month's streak freezes. The workspace renders it in AcceptedDialog.
 */
export function AcceptedExtras({
  problemId,
  acceptedAt,
  activity = [],
  bought,
  english,
}: {
  problemId: string;
  acceptedAt: number;
  activity?: readonly Activity[];
  /** Streak freezes bought with points. */
  bought?: readonly number[];
  english: boolean;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const [now] = useState(Date.now);
  const { streakUnlocks, after, rescued, repeat } = useMemo(() => {
    const day = new Date(now).toDateString();
    const prior = activity.filter((a) => a.created_at < acceptedAt);
    const before = practiceStats(prior, day, english, [], undefined, bought);
    const after = practiceStats(
      [...prior, { problem_id: problemId, created_at: Math.min(acceptedAt, now) }],
      day,
      english,
      [],
      undefined,
      bought,
    );
    const streakBadges = (best: number) =>
      achievements({ stops: [], bestStreak: best, acTimes: [], companies: [], perfectMock: false });
    return {
      // The wall counts the best run, so a rebuilt streak never re-unlocks a milestone.
      // ponytail: best inside the 183-day activity window; an older run is not seen here.
      streakUnlocks: newlyEarned(streakBadges(before.best), streakBadges(after.best)).filter(
        (b) => b.group === 'streak',
      ),
      after,
      rescued: before.rescue && !after.rescue,
      repeat: prior.some((a) => a.problem_id === problemId),
    };
  }, [activity, problemId, acceptedAt, now, english, bought]);
  // Keyed by the AC, so a later AC never shows an earlier one's stop.
  const key = `${problemId}@${acceptedAt}`;
  const [found, setFound] = useState<{ key: string; badges: Badge[] } | null>(null);
  useEffect(() => {
    const number = /^lc-(\d+)$/.exec(problemId)?.[1];
    // An earlier AC of this problem means its stop was already counted.
    if (!number || repeat) return;
    let current = true;
    type Page = {
      items: {
        id: string;
        judgeProblemId: string | null;
        importedSources?: string[];
        selection?: { sectionSlug: string } | null;
      }[];
      collection?: { solved: number; total: number; sections: Section[] };
    };
    api<Page>(`oj/library?${new URLSearchParams({ collection: 'ling-selected-500', q: number })}`)
      .then((page) => {
        const item = page.items.find((i) => i.judgeProblemId === problemId || i.id === problemId);
        const slug = item?.selection?.sectionSlug;
        const stop = page.collection?.sections.find((s) => s.slug === slug);
        // A LeetCode import already counted it in this round, so the stop was complete before.
        if (!current || !stop || !page.collection || item?.importedSources?.length) return;
        // A first AC that leaves its stop complete is the one that completed it.
        // ponytail: "first" means within the 183-day activity window; oj/history's firstAcAt
        // would cover older ACs at the cost of another request.
        const earned = achievements({
          stops: page.collection.sections,
          bestStreak: 0,
          acTimes: [],
          companies: [],
          perfectMock: false,
        });
        const cleared = earned.find((b) => b.id === `stop:${slug}`);
        if (cleared?.earned)
          setFound({
            key,
            badges: earned.filter((b) => b === cleared || (b.id === 'line' && b.earned)),
          });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [problemId, repeat, key]);
  const stopUnlocks = !repeat && found?.key === key ? found.badges : [];
  const unlocks = [...stopUnlocks, ...streakUnlocks];
  // Freezes matter once there is a streak to keep.
  const freezes = rescued || after.streak > 1;
  if (!unlocks.length && !freezes) return null;
  return (
    <div className="cs-accepted-extras">
      {unlocks.length > 0 && (
        <output className="cs-accepted-unlock">
          <Award size={16} aria-hidden="true" />
          {t('解锁：', 'Unlocked: ')}
          {unlocks.map((b) => t(b.zh, b.en)).join(t('、', ', '))}
        </output>
      )}
      {freezes && (
        <p className="cs-accepted-freeze">
          <Snowflake size={13} aria-hidden="true" />
          {rescued && t('已用一次保护日接上昨天 · ', 'A streak freeze covered yesterday · ')}
          {t(
            `本月还剩 ${after.freezesLeft} 次断签保护`,
            `${after.freezesLeft} streak ${after.freezesLeft === 1 ? 'freeze' : 'freezes'} left this month`,
          )}
        </p>
      )}
    </div>
  );
}
