'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { CompanyFollowButton } from './company-follow-button';
import { agenda, type Application } from '@/lib/applications';
import { classicList } from '@/lib/classic-lists';
import { PLAN_TOPICS_PARAM } from '@/lib/jd-skills';
import { readMockState, SLOTS, type Slot } from '@/lib/mock-oa';
import { ojRequest } from '@/lib/oj-client';
import { masteredStops, openStart, type PlacementResult } from '@/lib/placement';
import { ROUTE_SLUGS, STOP_NAMES, type RouteStop } from '@/lib/route-stops';
import {
  addDays,
  buildPlan,
  DEFAULT_GOAL,
  LEGACY_TARGET_KEY,
  loadGoal,
  localDay,
  MAX_WEEKS,
  mergeGoals,
  normalizeGoal,
  oaDateInRange,
  PLAN_POOLS,
  planGroups,
  planIcs,
  planStorageKey,
  planWeeks,
  PLAN_VIEW_KEY,
  reportedHref,
  suggestStartStop,
  TODAY_TARGET_KEY,
  type Plan,
  type PlanGroupBy,
  type PlanOrder,
  type PlanCompany,
  type PlanEvent,
  type PlanGoal,
  type PlanPool,
  type PlanProblem,
  type PlanSprint,
  type PlanWeek,
  type SprintGroup,
} from '@/lib/study-plan';
import '@/app/study-plan.css';

/**
 * One `planTodo` entry of the curated list: [problem id, difficulty, stop index, stage
 * index, rating]. A classic list's problems off the line have stop null and no stage.
 */
export type PlanTodo = readonly [
  id: string,
  difficulty: string,
  stop: number | null,
  stage?: number,
  rating?: number | null,
];
type PoolView = {
  groups: {
    items: {
      judgeProblemId: string | null;
      difficulty: string;
      solved: boolean;
      stop: { slug: string } | null;
      stage: number | null;
      rating: number | null;
    }[];
  }[];
  sequence: string[];
};
const toProblem = ([id, difficulty, stop, stage, rating]: PlanTodo): PlanProblem => ({
  id,
  difficulty,
  stop: stop ?? undefined,
  stage,
  rating,
});
/** A pool's name: Line 500 or the classic list's. */
const poolName = (pool: PlanPool, english: boolean) => {
  const list = pool === 'line' ? null : classicList(pool);
  return list ? (english ? list.nameEn : list.nameZh) : english ? 'Line 500' : '500 路';
};
type Preset = PlanCompany & { pool?: { total: number } };
type OaPage = {
  items: { id: string; difficulty?: string; progress?: string }[];
  total: number;
};

type CompanyProblem = PlanProblem & { solved: boolean };

/** The target company's judgeable OA problems. */
async function companyProblems(aliases: string[], signal: AbortSignal, pages = 4) {
  const found = new Map<string, CompanyProblem>();
  await Promise.all(
    aliases.map(async (alias) => {
      // ponytail: 4 pages (120 problems) outlast any sprint week; aliases the
      // OA bank merged into another company answer 400 and add nothing.
      for (let page = 1; page <= pages; page++) {
        const data = await ojRequest<OaPage>(
          `oa-library?${new URLSearchParams({ company: alias, ready: '1', page: String(page) })}`,
          undefined,
          signal,
        ).catch(() => null);
        for (const item of data?.items ?? [])
          found.set(item.id, {
            id: item.id,
            difficulty: item.difficulty,
            solved: item.progress === 'solved',
          });
        if (!data || page * 30 >= data.total) return;
      }
    }),
  );
  return [...found.values()];
}

const PLAN_NOTE = `/api/oj/notes?target=${encodeURIComponent('pref:plan')}`;
/** The goal into the account (pref:plan); a failed save stays in this browser and goes up next visit (mergeGoals). */
const pushGoal = (goal: PlanGoal) =>
  fetch(PLAN_NOTE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: JSON.stringify(goal) }),
  }).catch(() => {});

/**
 * The sprint goal (this browser's, merged with the account's pref:plan when signed in),
 * the plan it makes from the line's `planTodo` and the tracker's OA and interview dates,
 * and today's target: the plan's daily count (0 on a mock OA, OA or tracker date), else
 * the "n a day" picker. `sequence` and `activity` tell which of today's ACs belonged to
 * the plan this morning. While a mock OA runs here, no OA problems are fetched: their
 * progress would give its verdicts away.
 */
export function useStudyPlan(
  userId: string | null | undefined,
  todo: readonly PlanTodo[] | undefined,
  sequence: readonly string[] | undefined,
  activity: readonly { problem_id: string; created_at: number }[],
) {
  const [goal, setGoal] = useState<PlanGoal | null>(null);
  const latest = useRef<PlanGoal | null>(null);
  const [today, setToday] = useState('');
  const [sealed, setSealed] = useState(false);
  // This browser keeps a copy of the goal: the page shows it at once, and it is all a guest has.
  function keep(next: PlanGoal) {
    latest.current = next;
    setGoal(next);
    try {
      localStorage.setItem(planStorageKey(userId), JSON.stringify(next));
      // The AC dialog falls back to it on days this page was not opened.
      localStorage.setItem(LEGACY_TARGET_KEY, String(next.dailyTarget));
    } catch {}
  }
  useEffect(() => {
    let saved = DEFAULT_GOAL;
    try {
      saved = loadGoal(localStorage, userId);
    } catch {}
    latest.current = saved;
    // oxlint-disable-next-line react/react-compiler -- The goal and the local day exist only in the browser, after hydration.
    setGoal(saved);
    setToday(localDay());
    setSealed(!!userId && !!readMockState(userId).active);
    if (!userId) return;
    const controller = new AbortController();
    // Not ojRequest: it cannot PUT, and its 401 opens the sign-in dialog (as in daily-goal.tsx).
    // A failed read (429, 5xx) is not "no plan": merge only after a 200 (an empty body is the empty account).
    fetch(PLAN_NOTE, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ body?: unknown }>;
      })
      .then((note) => {
        let remote: PlanGoal | null = null;
        try {
          if (typeof note?.body === 'string' && note.body) remote = normalizeGoal(JSON.parse(note.body));
        } catch {}
        // A save made while this was loading is the local side.
        const local = latest.current ?? saved;
        const merged = mergeGoals(local, remote);
        if (merged.goal !== local) keep(merged.goal);
        if (merged.push) void pushGoal(merged.goal);
      })
      .catch(() => {});
    return () => controller.abort();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- keep reads only userId.
  }, [userId]);
  function save(next: PlanGoal) {
    const stamped = { ...next, updatedAt: Date.now() };
    keep(stamped);
    if (userId && stamped.status !== 'new') void pushGoal(stamped);
  }
  const aliases =
    goal?.status === 'planned' && goal.company && !sealed ? goal.company.aliases.join(',') : '';
  const [company, setCompany] = useState<{ aliases: string; problems: CompanyProblem[] }>({
    aliases: '',
    problems: [],
  });
  useEffect(() => {
    if (!aliases) return;
    const controller = new AbortController();
    void companyProblems(aliases.split(','), controller.signal).then((problems) => {
      if (!controller.signal.aborted) setCompany({ aliases, problems });
    });
    return () => controller.abort();
  }, [aliases]);
  // A classic list pool: its judgeable unsolved problems in the list's own order.
  const pool = goal?.status === 'planned' && goal.pool !== 'line' ? goal.pool : '';
  const [listed, setListed] = useState<{ pool: string; todo: PlanTodo[]; sequence: string[] }>({
    pool: '',
    todo: [],
    sequence: [],
  });
  useEffect(() => {
    if (!pool) return;
    const controller = new AbortController();
    ojRequest<PoolView>(`library?${new URLSearchParams({ collection: pool })}`, undefined, controller.signal).then(
      (view) => {
        // A number listed in two groups is planned once.
        const seen = new Set<string>();
        const todo = view.groups
          .flatMap((group) => group.items)
          .flatMap((item): PlanTodo[] => {
            const id = item.judgeProblemId;
            if (!id || item.solved || seen.has(id)) return [];
            seen.add(id);
            const stop = item.stop ? ROUTE_SLUGS.indexOf(item.stop.slug) : -1;
            return [[id, item.difficulty, stop < 0 ? null : stop, item.stage ?? undefined, item.rating]];
          });
        setListed({ pool, todo, sequence: view.sequence });
      },
      () => {},
    );
    return () => controller.abort();
  }, [pool]);
  // The application tracker's OA deadlines and interviews still ahead, signed in only.
  const tracking = !!userId && goal?.status === 'planned' && goal.tracker;
  const [apps, setApps] = useState<Application[]>([]);
  useEffect(() => {
    if (!tracking) return;
    const controller = new AbortController();
    ojRequest<{ items?: Application[] }>('applications', undefined, controller.signal).then(
      (data) => setApps(Array.isArray(data.items) ? data.items : []),
      () => {},
    );
    return () => controller.abort();
  }, [tracking]);
  const dates = useMemo(
    () =>
      tracking && today
        ? // From today's local day on (agenda's own `now` would make this render impure).
          agenda(apps, 0).flatMap((e) => {
            const date = localDay(new Date(e.at));
            return (e.kind === 'oa' || e.kind === 'interview') && date >= today
              ? [
                  {
                    id: e.a.id,
                    kind: e.kind,
                    date,
                    company: e.a.company,
                    slug: e.a.companySlug,
                    onsite: e.kind === 'interview' && e.a.stage === 'onsite',
                    preset: e.a.links?.mock?.replace(/^\/mock-oa\//, '') || null,
                  },
                ]
              : [];
          })
        : [],
    [tracking, today, apps],
  );
  // Mock OA presets give the length and the OA problems of a tracker company.
  const wantPresets = dates.some((e) => e.preset);
  const [presets, setPresets] = useState<Preset[]>([]);
  useEffect(() => {
    if (!wantPresets) return;
    const controller = new AbortController();
    ojRequest<{ companies: Preset[] }>('mock-oa/presets', undefined, controller.signal).then(
      (value) => setPresets(value.companies),
      () => {},
    );
    return () => controller.abort();
  }, [wantPresets]);
  // ponytail: page 1 for the 3 nearest presets keeps a page load to a few oa-library requests
  // (120 a minute, shared with the rest of the site); later sprints ride the line until they come close.
  const near = sealed ? '' : [...new Set(dates.flatMap((e) => (e.preset ? [e.preset] : [])))].slice(0, 3).join(',');
  const [sprintPool, setSprintPool] = useState<{ near: string; problems: Map<string, CompanyProblem[]> }>({
    near: '',
    problems: new Map(),
  });
  useEffect(() => {
    if (!near || !presets.length) return;
    const controller = new AbortController();
    void Promise.all(
      near.split(',').map(async (slug) => {
        const preset = presets.find((c) => c.slug === slug);
        return [slug, preset ? await companyProblems(preset.aliases, controller.signal, 1) : []] as const;
      }),
    ).then((entries) => {
      if (!controller.signal.aborted) setSprintPool({ near, problems: new Map(entries) });
    });
    return () => controller.abort();
  }, [near, presets]);
  const plan = useMemo(() => {
    const source = pool ? (listed.pool === pool ? listed : null) : todo ? { todo, sequence } : null;
    if (goal?.status !== 'planned' || !source || !today) return null;
    // Today's ACs left `todo` (or will once the lists refresh) but still count
    // toward today's goal.
    const solvedToday = new Set(
      activity.flatMap((a) =>
        localDay(new Date(a.created_at)) === today ? [a.problem_id] : [],
      ),
    );
    const all = company.aliases === aliases ? company.problems : [];
    const pooled = sprintPool.near === near ? sprintPool.problems : new Map<string, CompanyProblem[]>();
    return buildPlan({
      goal,
      today,
      line: source.todo.flatMap((entry) => (solvedToday.has(entry[0]) ? [] : [toProblem(entry)])),
      company: all.filter((p) => !p.solved && !solvedToday.has(p.id)),
      done: {
        line: source.sequence?.filter((id) => solvedToday.has(id)).length ?? 0,
        company: all.filter((p) => solvedToday.has(p.id)).length,
      },
      tracker: {
        events: dates.map(
          (e): PlanEvent => ({ ...e, minutes: presets.find((c) => c.slug === e.preset)?.minutes ?? 90 }),
        ),
        problems: new Map(
          [...pooled].map(([slug, list]) => [slug, list.filter((p) => !p.solved && !solvedToday.has(p.id))]),
        ),
      },
    });
  }, [goal, today, todo, sequence, pool, listed, activity, company, aliases, dates, presets, sprintPool, near]);
  const day = plan?.days[0];
  const from = plan && goal?.pool === 'line' ? goal.startStop : 0;
  const target =
    day?.mock || day?.oa || day?.event ? 0 : plan?.daily || goal?.dailyTarget || DEFAULT_GOAL.dailyTarget;
  useEffect(() => {
    if (!goal || !today) return;
    try {
      localStorage.setItem(TODAY_TARGET_KEY, JSON.stringify({ date: today, n: target }));
    } catch {}
  }, [goal, today, target]);
  return {
    goal,
    plan,
    today,
    save,
    target,
    /** The line's first unsolved problem from a later start stop: where the trip starts. */
    start: from > 0 ? todo?.find(([, , stop]) => (stop ?? 0) >= from) : undefined,
  };
}

const monthDay = (date: string) => `${+date.slice(5, 7)}/${+date.slice(8, 10)}`;
/** "Google OA 10/24" or "Meta 面试 10/25". */
const dateLabel = (s: PlanEvent, english: boolean) =>
  `${s.company} ${s.kind === 'oa' ? 'OA' : english ? 'interview' : '面试'} ${monthDay(s.date)}`;
/** "A and B", or "A, B and C". */
const both = (items: string[], english: boolean) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(english ? ', ' : '、')}${english ? ' and ' : ' 和 '}${items.at(-1)}`;
/** Why a tracker sprint is short, and what to drop. */
function tightNote(group: SprintGroup, today: string, english: boolean) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const short = group.events.find((s) => s.days.length < 2) ?? group.events[0];
  const n = short.days.length;
  const days = t(`${n} 天`, `${n} ${n === 1 ? 'day' : 'days'}`);
  if (group.events.length > 1) {
    const dates = both(group.events.map((s) => dateLabel(s, english)), english);
    return t(
      `${dates} 挨得太近，冲刺段已合并，${short.company} 只分到 ${days}：建议先做更早那家的高频题，略过另一家的模拟 OA。`,
      `${dates} are close together, so their sprints are merged and ${short.company} gets only ${days}: do the earlier company’s most reported problems first and skip the other’s mock OA.`,
    );
  }
  if (short.date === today)
    return t(`今天就是 ${dateLabel(short, false)}，祝顺利！`, `${dateLabel(short, true)} is today. Good luck!`);
  return t(
    `${dateLabel(short, false)} 很近了，只排得下 ${days} 冲刺：先做这家的高频题。`,
    `${dateLabel(short, true)} is close, so its sprint gets only ${days}: start with its most reported problems.`,
  );
}
const hours = (minutes: number) => Math.round(minutes / 6) / 10;
/** A week's problem time, without its mock OAs. */
const practice = (week: PlanWeek) =>
  hours(week.days.reduce((sum, day) => sum + (day.mock ? 0 : day.minutes), 0));

/** The sprint plan in the line's announce panel: first-visit card, form, summary and weeks. */
export function StudyPlan({
  goal,
  plan,
  today,
  onSave,
  stops,
  english,
  signedIn = false,
}: {
  goal: PlanGoal | null;
  plan: Plan | null;
  today: string;
  onSave: (goal: PlanGoal) => void;
  stops: RouteStop[];
  english: boolean;
  /** The tracker option needs an account. */
  signedIn?: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [editing, setEditing] = useState(false);
  // Stops handed over in the URL (/career/jd's gaps): the form opens with them as its topics, unsaved.
  const [handed, setHanded] = useState<string[] | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const topics = url.searchParams.get(PLAN_TOPICS_PARAM)?.split(',').filter((slug) => ROUTE_SLUGS.includes(slug));
    if (!topics?.length) return;
    url.searchParams.delete(PLAN_TOPICS_PARAM);
    window.history.replaceState(window.history.state, '', url);
    // oxlint-disable-next-line react/react-compiler -- The URL is read only in the browser, after hydration.
    setHanded(topics);
    setEditing(true);
  }, []);
  // How the week list groups (week / stop / difficulty) and orders stops; this browser remembers.
  const [view, setView] = useState<{ by: PlanGroupBy; order: PlanOrder }>({ by: 'week', order: 'plan' });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAN_VIEW_KEY) || 'null');
      if (['week', 'topic', 'difficulty'].includes(saved?.by) && ['plan', 'difficulty'].includes(saved?.order))
        // oxlint-disable-next-line react/react-compiler -- The saved view exists only in the browser, after hydration.
        setView({ by: saved.by, order: saved.order });
    } catch {}
  }, []);
  const changeView = (next: { by: PlanGroupBy; order: PlanOrder }) => {
    setView(next);
    try {
      localStorage.setItem(PLAN_VIEW_KEY, JSON.stringify(next));
    } catch {}
  };
  const refocus = useRef(false);
  const entry = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // The control that moved focus unmounts; land on whichever view replaced it.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (heading.current ?? entry.current)?.focus();
  });
  if (!goal) return null;
  const close = (next?: PlanGoal) => {
    if (next) onSave(next);
    setEditing(false);
    setHanded(null);
    refocus.current = true;
  };
  if (editing)
    return (
      <PlanForm
        // The account's copy can land after the form opened (a ?planTopics= handoff): start over from it.
        key={goal.updatedAt}
        goal={
          handed
            ? { ...goal, topics: handed, startStop: Math.min(goal.startStop, ...handed.map((slug) => ROUTE_SLUGS.indexOf(slug))) }
            : goal
        }
        today={today || localDay()}
        stops={stops}
        english={english}
        handoff={Boolean(handed)}
        signedIn={signedIn}
        onDone={close}
      />
    );
  if (goal.status === 'new')
    return (
      <section className="route-plan route-plan-card" aria-labelledby="route-plan-ask">
        <p className="route-plan-kicker">{t('冲刺计划', 'Sprint plan')}</p>
        <h3 id="route-plan-ask" className="route-plan-title" ref={heading} tabIndex={-1}>
          {t('离 OA 还有多久？', 'When is your OA?')}
        </h3>
        <p className="route-plan-text">
          {t(
            '填上 OA 日期、目标公司和每周能练的时间，500 路会排成每天的行程，最后一周换成目标公司的题和两次模拟 OA。',
            'Add your OA date, target company and weekly hours. The line becomes a daily trip, and the last week switches to that company’s problems and two mock OAs.',
          )}
        </p>
        <div className="route-plan-actions">
          <Button className="route-cta" onClick={() => setEditing(true)}>
            {t('定制我的计划', 'Plan my sprint')}
          </Button>
          <button
            type="button"
            className="route-plan-link"
            onClick={() => close({ ...goal, status: 'skipped' })}
          >
            {t('先跳过', 'Skip for now')}
          </button>
        </div>
      </section>
    );
  if (goal.status !== 'planned' || !plan)
    return (
      <button
        ref={entry}
        type="button"
        className="route-plan-link route-plan-entry"
        onClick={() => setEditing(true)}
      >
        <CalendarPlus size={14} aria-hidden="true" />
        {goal.status === 'planned'
          ? t('调整冲刺计划', 'Edit sprint plan')
          : t('按 OA 日期定制冲刺计划', 'Plan a sprint to your OA')}
      </button>
    );

  const weeks = planWeeks(plan.days);
  const week = weeks[0];
  const company = goal.company;
  const mockHref = `/mock-oa${company ? `/${company.slug}` : ''}`;
  // A tracker sprint's mock OA is its own company's.
  const mockOf = (day: { sprintFor?: PlanSprint }) => (day.sprintFor ? `/mock-oa/${day.sprintFor.preset}` : mockHref);
  const todayMock = plan.days[0]?.mock;
  const mockName = plan.days[0]?.sprintFor?.company ?? company?.name;
  const tracked = plan.sprints.reduce((sum, group) => sum + group.events.length, 0);
  const stopLabel = (index: number) => {
    const stop = stops[index];
    return stop ? `${stop.code} ${english ? stop.shortEn : stop.shortZh}` : '';
  };
  // A tracker sprint's OA problems carry its company; the rest are the target company's.
  const oaLabel = (name?: string) => (name ? t(`${name} OA 题`, `${name} OA`) : t('公司 OA 题', 'Company OA problems'));
  const n = week?.problems ?? 0;
  const d = plan.daysLeft;
  function download() {
    const ics = planIcs({ plan: plan!, goal: goal!, now: new Date(), origin: window.location.origin, english });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cswork-sprint-plan.ics';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="route-plan" aria-labelledby="route-plan-title">
      <h3 id="route-plan-title" className="route-plan-title" ref={heading} tabIndex={-1}>
        {plan.expired ? (
          t('OA 日期已过，更新一下计划吧', 'Your OA date has passed. Update your plan.')
        ) : d === 0 ? (
          t('今天就是 OA 日，祝你顺利！', 'Your OA is today. Good luck!')
        ) : d === null ? (
          english ? (
            <>
              This week: <strong>{n}</strong> planned
            </>
          ) : (
            <>
              本周计划 <strong>{n}</strong> 题
            </>
          )
        ) : english ? (
          <>
            <strong>{d}</strong> {d === 1 ? 'day' : 'days'} to your OA · This week: <strong>{n}</strong> planned
          </>
        ) : (
          <>
            距 OA 还有 <strong>{d}</strong> 天 · 本周计划 <strong>{n}</strong> 题
          </>
        )}
      </h3>
      <p className="route-plan-text">
        {[
          plan.todo
            ? t(`每天 ${plan.daily} 题`, `${plan.daily} a day`)
            : plan.filtered
              ? t('筛选后没有待做的题', 'Nothing left under your filters')
              : goal.pool === 'line'
                ? t('线路上可判的题都通过了', 'Every problem on the line is solved')
                : t('题单里可判的题都通过了', 'Every judgeable problem on the list is solved'),
          t(`每周 ${goal.weeklyHours} 小时`, `${goal.weeklyHours} h a week`),
          goal.pool !== 'line' && t(`题池 ${poolName(goal.pool, false)}`, `Pool: ${poolName(goal.pool, true)}`),
          company && t(`目标 ${company.name}`, `Target: ${company.name}`),
          tracked > 0 && t(`看板 ${tracked} 个日期`, `${tracked} tracker ${tracked === 1 ? 'date' : 'dates'}`),
          goal.pool === 'line' &&
            goal.startStop > 0 &&
            stops[goal.startStop] &&
            t(`从 ${stopLabel(goal.startStop)} 出发`, `From ${stopLabel(goal.startStop)}`),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {!plan.todo && plan.filtered > 0 ? (
        <p className="route-plan-note">
          {t(
            '放宽难度或知识点，或者换一个题池，再保存一次。',
            'Widen the difficulty or topics, or pick another pool, and save again.',
          )}
        </p>
      ) : plan.cut > 0 ? (
        <p className="route-plan-note">
          {t(
            `时间排不下全部：每个知识点都留一部分，先排基础题和难度分低的题，另外 ${plan.cut} 题没有排进来。`,
            `Not enough days for everything: every topic keeps a share, foundation and lower-rated problems first; ${plan.cut} more are left out.`,
          )}
        </p>
      ) : null}
      {plan.sprints
        .filter((group) => group.tight)
        .map((group) => (
          <p key={`${group.events[0].id}-${group.events[0].kind}`} className="route-plan-note">
            {tightNote(group, today, english)}
          </p>
        ))}
      {plan.skipped > 0 && (
        <p className="route-plan-note">
          {t(
            `看板上有 ${plan.skipped} 个日期落在 OA 前的最后一周，那一周按原计划冲刺，不再另排。`,
            `${plan.skipped} tracker ${plan.skipped === 1 ? 'date falls' : 'dates fall'} in the last week before your OA, which keeps its own sprint.`,
          )}
        </p>
      )}
      {!!todayMock && (
        <a className="route-plan-mock" href={mockOf(plan.days[0])}>
          {t(`今天：模拟 OA 第 ${todayMock} 次`, `Today: mock OA #${todayMock}`)}
          {mockName ? ` · ${mockName}` : ''}
        </a>
      )}
      <div className="route-plan-actions">
        <button type="button" className="route-plan-link" onClick={download}>
          <CalendarPlus size={14} aria-hidden="true" />
          {t('加到日历（.ics）', 'Add to calendar (.ics)')}
        </button>
        <button type="button" className="route-plan-link" onClick={() => setEditing(true)}>
          {t('调整计划', 'Edit plan')}
        </button>
        {company && <CompanyFollowButton slug={company.slug} name={company.name} zh={!english} hint className="route-plan-link" />}
        <button
          type="button"
          className="route-plan-link"
          aria-describedby="route-plan-regenerate"
          onClick={() => onSave({ ...goal, shuffle: (goal.shuffle % 999_999) + 1 })}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t('重新生成', 'Regenerate')}
        </button>
        <span id="route-plan-regenerate" className="sr-only">
          {t('换一种知识点搭配，只重排还没做的题', 'Mixes the topics another way; only unsolved problems move')}
        </span>
      </div>
      <details className="route-plan-weeks">
        <summary>
          {t('按周查看', 'Week by week')}
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="route-plan-view">
          <label>
            {t('分组', 'Group')}
            <select
              value={view.by}
              onChange={(event) => changeView({ ...view, by: event.target.value as PlanGroupBy })}
            >
              <option value="week">{t('按周', 'By week')}</option>
              <option value="topic">{t('按专题', 'By topic')}</option>
              <option value="difficulty">{t('按难度', 'By difficulty')}</option>
            </select>
          </label>
          {view.by === 'topic' && (
            <label>
              {t('排序', 'Order')}
              <select
                value={view.order}
                onChange={(event) => changeView({ ...view, order: event.target.value as PlanOrder })}
              >
                <option value="plan">{t('原顺序', 'Plan order')}</option>
                <option value="difficulty">{t('先易后难', 'Easier first')}</option>
              </select>
            </label>
          )}
        </div>
        {view.by !== 'week' ? (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Scrolls inside the panel, like the weeks.
          <ol
            tabIndex={0}
            data-group={view.by}
            aria-label={view.by === 'topic' ? t('按专题的计划', 'Plan by topic') : t('按难度的计划', 'Plan by difficulty')}
          >
            {planGroups(plan.days, view.by, view.order).map((g) => (
              <li key={g.key}>
                <span className="route-plan-week">
                  {g.level
                    ? { easy: t('简单', 'Easy'), medium: t('中等', 'Medium'), hard: t('困难', 'Hard') }[g.level]
                    : g.stop !== null
                      ? stopLabel(g.stop)
                      : g.key.startsWith('oa:')
                        ? oaLabel(g.company ?? company?.name)
                        : t('其他题', 'Other problems')}
                  <small>
                    {monthDay(g.first)}
                    {g.last !== g.first && `–${monthDay(g.last)}`}
                  </small>
                </span>
                <span>
                  {t(
                    `${g.problems} 题 · 约 ${hours(g.minutes)} 小时`,
                    `${g.problems} ${g.problems === 1 ? 'problem' : 'problems'} · ~${hours(g.minutes)} h`,
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The list scrolls inside the panel; keyboard users need to reach it (WCAG 2.1.1).
          <ol tabIndex={0} aria-label={t('每周计划', 'Weekly plan')}>
            {weeks.map((w, i) => (
              <li key={w.start} data-sprint={w.sprint || undefined} data-oa={w.oa || undefined}>
                <span className="route-plan-week">
                  {i === 0 ? t('本周', 'This week') : t(`第 ${i + 1} 周`, `Week ${i + 1}`)}
                  <small>
                    {monthDay(w.start)}
                    {w.end !== w.start && `–${monthDay(w.end)}`}
                  </small>
                </span>
                <span>
                  {w.problems
                    ? t(
                        `${w.problems} 题 · 约 ${practice(w)} 小时`,
                        `${w.problems} ${w.problems === 1 ? 'problem' : 'problems'} · ~${practice(w)} h`,
                      )
                    : w.oa || w.mocks
                      ? ''
                      : t('无新题', 'Nothing new')}
                </span>
                <span className="route-plan-stops">
                  {/* A mixed week holds several stops; the row names the first three. */}
                  {w.stops.slice(0, 3).map(stopLabel).join(' · ')}
                  {w.stops.length > 3 && ` +${w.stops.length - 3}`}
                </span>
                <span className="route-plan-tags">
                  {w.sprint && !(w.oa && w.days.length === 1) && (
                    <span className="route-plan-tag">{t('冲刺周', 'Sprint')}</span>
                  )}
                  {[...new Set(w.days.flatMap((day) => (day.sprintFor && !day.mock ? [day.sprintFor] : [])))].map((s) =>
                    // Without a mock OA preset the sprint rides the line: the tag links the company's reported problems.
                    s.slug && !s.preset ? (
                      <a
                        key={`${s.id}-${s.kind}`}
                        className="route-plan-tag"
                        href={reportedHref(s.slug)}
                        aria-label={t(`冲刺 ${s.company}：这家的高频题`, `Sprint ${s.company}: its most reported problems`)}
                      >
                        {t(`冲刺 ${s.company}`, `Sprint ${s.company}`)}
                      </a>
                    ) : (
                      <span key={`${s.id}-${s.kind}`} className="route-plan-tag">
                        {t(`冲刺 ${s.company}`, `Sprint ${s.company}`)}
                      </span>
                    ),
                  )}
                  {w.days
                    .filter((day) => day.mock)
                    .map((day) => (
                      <a key={day.date} className="route-plan-tag" href={mockOf(day)}>
                        {t(`模拟 OA ${monthDay(day.date)}`, `Mock OA ${monthDay(day.date)}`)}
                      </a>
                    ))}
                  {w.days.map(
                    (day) =>
                      day.event && (
                        <span key={day.date} className="route-plan-tag" data-oa>
                          {dateLabel(day.event, english)}
                        </span>
                      ),
                  )}
                  {w.oa && (
                    <span className="route-plan-tag" data-oa>
                      OA {monthDay(w.end)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}

function PlanForm({
  goal,
  today,
  stops,
  english,
  handoff,
  signedIn,
  onDone,
}: {
  goal: PlanGoal;
  today: string;
  stops: RouteStop[];
  english: boolean;
  /** The topics were handed over (?planTopics=): the learner's pick, which a placement result leaves alone. */
  handoff: boolean;
  signedIn: boolean;
  onDone: (goal?: PlanGoal) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [oaDate, setOaDate] = useState(goal.oaDate);
  const [slug, setSlug] = useState(goal.company?.slug ?? '');
  const [weekly, setWeekly] = useState(String(goal.weeklyHours));
  const [solved, setSolved] = useState(goal.solvedBefore ? String(goal.solvedBefore) : '');
  const [start, setStart] = useState(Math.min(goal.startStop, Math.max(0, stops.length - 1)));
  const [pool, setPool] = useState<PlanPool>(goal.pool);
  const [weeks, setWeeks] = useState(goal.weeks);
  const [levels, setLevels] = useState<Slot[]>(goal.difficulties);
  const [topics, setTopics] = useState<string[]>(goal.topics.length ? goal.topics : ROUTE_SLUGS);
  const [tracker, setTracker] = useState(goal.tracker);
  const [presets, setPresets] = useState<Preset[] | null>(null);
  // The latest placement quiz (/placement); placementAt moves on once a newer result is applied.
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [placementAt, setPlacementAt] = useState(goal.placementAt);
  const [unticked, setUnticked] = useState(0);
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const controller = new AbortController();
    ojRequest<{ companies: Preset[] }>('mock-oa/presets', undefined, controller.signal).then(
      (value) => setPresets(value.companies),
      () => {},
    );
    return () => controller.abort();
  }, []);
  // A result newer than the one applied unticks its known stops and moves the start past them,
  // unless that would leave no stop to plan (then it stays unapplied). Ticking one back undoes it:
  // the start moves back to it. Signed out the request fails and nothing changes. Handed-over
  // topics stay as handed (the result is applied next time); known stops are still tagged.
  // ponytail: kept from the topics as the form opened; a tick made before the fetch lands is lost.
  useEffect(() => {
    const controller = new AbortController();
    ojRequest<{ latest?: PlacementResult | null }>('speedrun/placement', undefined, controller.signal).then(
      ({ latest }) => {
        if (!latest || !Array.isArray(latest.groups)) return;
        setPlacement(latest);
        if (latest.at <= goal.placementAt || handoff) return;
        const known = masteredStops(latest);
        const kept = topics.filter((slug) => !known.has(slug));
        if (!kept.length) return;
        setTopics(kept);
        setUnticked(topics.length - kept.length);
        setStart((at) => openStart(at, known));
        setPlacementAt(latest.at);
      },
      () => {},
    );
    return () => controller.abort();
  }, [goal.placementAt]);
  // Until the presets arrive (or if they fail), keep the saved company choosable.
  const companies = presets ?? (goal.company ? [goal.company] : []);
  const known = masteredStops(placement);
  const skipped = new Set([...known].filter((slug) => !topics.includes(slug)));
  const suggestFor = (count: number) => openStart(suggestStartStop(stops.map((stop) => stop.total), count), skipped);
  const suggested = suggestFor(Number(solved));
  const stopName = (stop: RouteStop) => `${stop.code} ${english ? stop.shortEn : stop.shortZh}`;
  function submit() {
    const weeklyHours = Number(weekly);
    const solvedBefore = solved.trim() ? Number(solved) : 0;
    if (oaDate && !oaDateInRange(oaDate, today))
      return setError(t('OA 日期要在今天到一年之内。', 'Pick an OA date between today and a year from now.'));
    if (!Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 40)
      return setError(t('每周小时数填 1 到 40 之间的整数。', 'Weekly hours must be a whole number from 1 to 40.'));
    if (!Number.isInteger(solvedBefore) || solvedBefore < 0 || solvedBefore > 5000)
      return setError(t('已刷题数填 0 到 5000 之间的整数。', 'Problems solved must be a whole number from 0 to 5000.'));
    if (!levels.length) return setError(t('至少选一种难度。', 'Pick at least one difficulty.'));
    if (!topics.length) return setError(t('至少选一个知识点。', 'Pick at least one topic.'));
    const preset = companies.find((c) => c.slug === slug);
    onDone({
      ...goal,
      status: 'planned',
      oaDate,
      company: preset
        ? {
            slug: preset.slug,
            name: preset.name,
            aliases: preset.aliases,
            minutes: preset.minutes,
          }
        : null,
      weeklyHours,
      solvedBefore,
      startStop: start,
      pool,
      weeks,
      difficulties: SLOTS.filter((slot) => levels.includes(slot)),
      // Every stop is saved as "all", so stops added later join the plan.
      topics: topics.length === ROUTE_SLUGS.length ? [] : ROUTE_SLUGS.filter((slug) => topics.includes(slug)),
      placementAt,
      tracker,
    });
  }
  const levelNames: Record<Slot, string> = { easy: t('简单', 'Easy'), medium: t('中等', 'Medium'), hard: t('困难', 'Hard') };
  const allTopics = topics.length === ROUTE_SLUGS.length;
  return (
    <form
      className="route-plan route-plan-card route-plan-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="route-plan-kicker">{t('冲刺计划', 'Sprint plan')}</p>
      <div className="route-plan-fields">
        {/* Hints sit outside the labels: they are descriptions, not names. */}
        <div className="route-plan-field">
          <label htmlFor="route-plan-date">{t('OA 日期', 'OA date')}</label>
          <input
            ref={first}
            id="route-plan-date"
            type="date"
            value={oaDate}
            min={today}
            max={addDays(today, 365)}
            aria-describedby="route-plan-date-hint"
            onChange={(event) => setOaDate(event.target.value)}
          />
          <small id="route-plan-date-hint">{t('还不知道可以留空', 'Leave empty if unknown')}</small>
        </div>
        {!oaDate && (
          <div className="route-plan-field">
            <label htmlFor="route-plan-weeks">{t('计划几周', 'Plan length')}</label>
            <input
              id="route-plan-weeks"
              type="range"
              min={1}
              max={MAX_WEEKS}
              step={1}
              value={weeks}
              aria-describedby="route-plan-weeks-hint"
              onChange={(event) => setWeeks(Number(event.target.value))}
            />
            <small id="route-plan-weeks-hint" aria-live="polite">
              {t(`${weeks} 周（没有 OA 日期时）`, `${weeks} ${weeks === 1 ? 'week' : 'weeks'} (without an OA date)`)}
            </small>
          </div>
        )}
        <label>
          {t('题池', 'Problem pool')}
          <select value={pool} onChange={(event) => setPool(event.target.value as PlanPool)}>
            {PLAN_POOLS.map((p) => (
              <option key={p} value={p}>
                {poolName(p, english)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('目标公司', 'Target company')}
          <select value={slug} onChange={(event) => setSlug(event.target.value)}>
            <option value="">{t('不限', 'Any company')}</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('每周能练几小时', 'Hours a week')}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            step={1}
            value={weekly}
            onChange={(event) => setWeekly(event.target.value)}
          />
        </label>
        <label>
          {t('LeetCode 已刷题数', 'LeetCode problems solved')}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={5000}
            step={1}
            placeholder="0"
            value={solved}
            onChange={(event) => {
              setSolved(event.target.value);
              setStart(suggestFor(Number(event.target.value)));
            }}
          />
        </label>
        <fieldset className="route-plan-checks">
          <legend>{t('难度', 'Difficulty')}</legend>
          {SLOTS.map((slot) => (
            <label key={slot}>
              <input
                type="checkbox"
                checked={levels.includes(slot)}
                onChange={(event) =>
                  setLevels(event.target.checked ? [...levels, slot] : levels.filter((l) => l !== slot))
                }
              />
              {levelNames[slot]}
            </label>
          ))}
        </fieldset>
        <details
          className="route-plan-topics route-plan-wide"
          open={goal.topics.length > 0 || placementAt > goal.placementAt || undefined}
        >
          <summary>
            {t('知识点', 'Topics')}
            <span>
              {allTopics
                ? t('全部', 'All')
                : t(`已选 ${topics.length} / ${ROUTE_SLUGS.length}`, `${topics.length} of ${ROUTE_SLUGS.length}`)}
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          {placement ? (
            unticked > 0 && (
              <p className="route-plan-note" role="status">
                {t(
                  `已按定位测验取消勾选 ${unticked} 个已掌握的站，想练可以重新勾上。`,
                  `Your placement quiz unticked ${unticked} known ${unticked === 1 ? 'stop' : 'stops'}; tick any you still want to practise.`,
                )}
              </p>
            )
          ) : (
            <a className="route-plan-link" href="/placement">
              {t('不确定哪些已经掌握？先做定位测验', 'Not sure what you already know? Take the placement quiz')}
            </a>
          )}
          <a className="route-plan-link" href="/guide/practice">{t('怎么练：计时、提示和复习怎么配合', 'How to practise: the timer, hints and reviews')}</a>
          <fieldset>
            <legend className="sr-only">{t('排进计划的知识点', 'Topics to plan')}</legend>
            <button
              type="button"
              className="route-plan-link"
              onClick={() => setTopics(allTopics ? [] : ROUTE_SLUGS)}
            >
              {allTopics ? t('全部取消', 'Clear all') : t('全选', 'Select all')}
            </button>
            {ROUTE_SLUGS.map((slug, i) => (
              <label key={slug}>
                <input
                  type="checkbox"
                  checked={topics.includes(slug)}
                  onChange={(event) => {
                    setTopics(event.target.checked ? [...topics, slug] : topics.filter((s) => s !== slug));
                    // A stop before the start is never planned: ticking one moves the start back to it.
                    if (event.target.checked && i < start) setStart(i);
                  }}
                />
                {String(i + 1).padStart(2, '0')} {STOP_NAMES[slug][english ? 1 : 0]}
                {known.has(slug) && <span className="route-plan-note">{t('已掌握', 'Known')}</span>}
              </label>
            ))}
          </fieldset>
        </details>
        {signedIn && (
          <div className="route-plan-checks route-plan-wide">
            <label>
              <input
                type="checkbox"
                checked={tracker}
                aria-describedby="route-plan-tracker-hint"
                onChange={(event) => setTracker(event.target.checked)}
              />
              {t('接上投递看板', 'Use my application tracker')}
            </label>
            <small id="route-plan-tracker-hint">
              {t(
                '在看板上每个 OA 和面试日期前排 2–5 天这家的冲刺',
                'A 2–5 day company sprint before each OA and interview date on your tracker',
              )}
            </small>
          </div>
        )}
        {stops.length > 0 && pool === 'line' && (
          <div className="route-plan-field route-plan-wide">
            <label htmlFor="route-plan-start">{t('从哪一站出发', 'Start at stop')}</label>
            <select
              id="route-plan-start"
              value={start}
              aria-describedby="route-plan-start-hint"
              onChange={(event) => setStart(Number(event.target.value))}
            >
              {stops.map((stop) => (
                <option key={stop.slug} value={stop.index}>
                  {stopName(stop)}
                </option>
              ))}
            </select>
            <small id="route-plan-start-hint" aria-live="polite">
              {suggested > 0 && stops[suggested]
                ? t(
                    `按已刷题数${skipped.size ? '和定位测验' : ''}，建议从 ${stopName(stops[suggested])} 出发；之前的站不计入每日题量。`,
                    `From what you’ve solved${skipped.size ? ' and your placement quiz' : ''}, start at ${stopName(stops[suggested])}; earlier stops leave the daily count.`,
                  )
                : t('从第一站开始，按顺序走完全线。', 'Start at the first stop and ride the whole line.')}
            </small>
          </div>
        )}
      </div>
      {error && (
        <p className="route-plan-error" role="alert">
          {error}
        </p>
      )}
      <div className="route-plan-actions">
        <Button type="submit" className="route-cta">
          {t('保存计划', 'Save plan')}
        </Button>
        <button type="button" className="route-plan-link" onClick={() => onDone()}>
          {t('取消', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
