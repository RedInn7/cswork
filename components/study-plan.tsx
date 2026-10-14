'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { ojRequest } from '@/lib/oj-client';
import type { RouteStop } from '@/lib/route-stops';
import {
  addDays,
  buildPlan,
  DEFAULT_GOAL,
  LEGACY_TARGET_KEY,
  loadGoal,
  localDay,
  oaDateInRange,
  planIcs,
  planStorageKey,
  planWeeks,
  suggestStartStop,
  TODAY_TARGET_KEY,
  type Plan,
  type PlanCompany,
  type PlanGoal,
  type PlanProblem,
  type PlanWeek,
} from '@/lib/study-plan';
import '@/app/study-plan.css';

/** One `planTodo` entry of the curated list: [problem id, difficulty, stop index]. */
export type PlanTodo = readonly [string, string, number];
type Preset = PlanCompany & { pool?: { total: number } };
type OaPage = {
  items: { id: string; difficulty?: string; progress?: string }[];
  total: number;
};

type CompanyProblem = PlanProblem & { solved: boolean };

/** The target company's judgeable OA problems. */
async function companyProblems(aliases: string[], signal: AbortSignal) {
  const found = new Map<string, CompanyProblem>();
  await Promise.all(
    aliases.map(async (alias) => {
      // ponytail: 4 pages (120 problems) outlast any sprint week; aliases the
      // OA bank merged into another company answer 400 and add nothing.
      for (let page = 1; page <= 4; page++) {
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

/**
 * The sprint goal on this device, the plan it makes from the line's `planTodo`,
 * and today's target: the plan's daily count (0 on a mock OA or OA day), else
 * the "n a day" picker. `sequence` and `activity` tell which of today's ACs
 * belonged to the plan this morning.
 */
export function useStudyPlan(
  userId: string | null | undefined,
  todo: readonly PlanTodo[] | undefined,
  sequence: readonly string[] | undefined,
  activity: readonly { problem_id: string; created_at: number }[],
) {
  const [goal, setGoal] = useState<PlanGoal | null>(null);
  const [today, setToday] = useState('');
  useEffect(() => {
    let saved = DEFAULT_GOAL;
    try {
      saved = loadGoal(localStorage, userId);
    } catch {}
    // oxlint-disable-next-line react/react-compiler -- The goal and the local day exist only in the browser, after hydration.
    setGoal(saved);
    setToday(localDay());
  }, [userId]);
  function save(next: PlanGoal) {
    setGoal(next);
    try {
      localStorage.setItem(planStorageKey(userId), JSON.stringify(next));
      // The AC dialog falls back to it on days this page was not opened.
      localStorage.setItem(LEGACY_TARGET_KEY, String(next.dailyTarget));
    } catch {}
  }
  const aliases =
    goal?.status === 'planned' && goal.company ? goal.company.aliases.join(',') : '';
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
  const plan = useMemo(() => {
    if (goal?.status !== 'planned' || !todo || !today) return null;
    // Today's ACs left `todo` (or will once the lists refresh) but still count
    // toward today's goal.
    const solvedToday = new Set(
      activity.flatMap((a) =>
        localDay(new Date(a.created_at)) === today ? [a.problem_id] : [],
      ),
    );
    const all = company.aliases === aliases ? company.problems : [];
    return buildPlan({
      goal,
      today,
      line: todo.flatMap(([id, difficulty, stop]) =>
        solvedToday.has(id) ? [] : [{ id, difficulty, stop }],
      ),
      company: all.filter((p) => !p.solved && !solvedToday.has(p.id)),
      done: {
        line: sequence?.filter((id) => solvedToday.has(id)).length ?? 0,
        company: all.filter((p) => solvedToday.has(p.id)).length,
      },
    });
  }, [goal, today, todo, sequence, activity, company, aliases]);
  const day = plan?.days[0];
  const from = plan ? (goal?.startStop ?? 0) : 0;
  const target =
    day?.mock || day?.oa ? 0 : plan?.daily || goal?.dailyTarget || DEFAULT_GOAL.dailyTarget;
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
    start: from > 0 ? todo?.find(([, , stop]) => stop >= from) : undefined,
  };
}

const monthDay = (date: string) => `${+date.slice(5, 7)}/${+date.slice(8, 10)}`;
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
}: {
  goal: PlanGoal | null;
  plan: Plan | null;
  today: string;
  onSave: (goal: PlanGoal) => void;
  stops: RouteStop[];
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [editing, setEditing] = useState(false);
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
    refocus.current = true;
  };
  if (editing)
    return (
      <PlanForm
        goal={goal}
        today={today || localDay()}
        stops={stops}
        english={english}
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
  const todayMock = plan.days[0]?.mock;
  const stopLabel = (index: number) => {
    const stop = stops[index];
    return stop ? `${stop.code} ${english ? stop.shortEn : stop.shortZh}` : '';
  };
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
            : t('线路上可判的题都通过了', 'Every problem on the line is solved'),
          t(`每周 ${goal.weeklyHours} 小时`, `${goal.weeklyHours} h a week`),
          company && t(`目标 ${company.name}`, `Target: ${company.name}`),
          goal.startStop > 0 && stops[goal.startStop] && t(`从 ${stopLabel(goal.startStop)} 出发`, `From ${stopLabel(goal.startStop)}`),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {!!todayMock && (
        <a className="route-plan-mock" href={mockHref}>
          {t(`今天：模拟 OA 第 ${todayMock} 次`, `Today: mock OA #${todayMock}`)}
          {company ? ` · ${company.name}` : ''}
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
      </div>
      <details className="route-plan-weeks">
        <summary>
          {t('按周查看', 'Week by week')}
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The list scrolls inside the panel; keyboard users need to reach it (WCAG 2.1.1). */}
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
                {w.stops &&
                  (w.stops[0] === w.stops[1]
                    ? stopLabel(w.stops[0])
                    : `${stopLabel(w.stops[0])} → ${stopLabel(w.stops[1])}`)}
              </span>
              <span className="route-plan-tags">
                {w.sprint && !(w.oa && w.days.length === 1) && (
                  <span className="route-plan-tag">{t('冲刺周', 'Sprint')}</span>
                )}
                {w.days
                  .filter((day) => day.mock)
                  .map((day) => (
                    <a key={day.date} className="route-plan-tag" href={mockHref}>
                      {t(`模拟 OA ${monthDay(day.date)}`, `Mock OA ${monthDay(day.date)}`)}
                    </a>
                  ))}
                {w.oa && (
                  <span className="route-plan-tag" data-oa>
                    OA {monthDay(w.end)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function PlanForm({
  goal,
  today,
  stops,
  english,
  onDone,
}: {
  goal: PlanGoal;
  today: string;
  stops: RouteStop[];
  english: boolean;
  onDone: (goal?: PlanGoal) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [oaDate, setOaDate] = useState(goal.oaDate);
  const [slug, setSlug] = useState(goal.company?.slug ?? '');
  const [weekly, setWeekly] = useState(String(goal.weeklyHours));
  const [solved, setSolved] = useState(goal.solvedBefore ? String(goal.solvedBefore) : '');
  const [start, setStart] = useState(Math.min(goal.startStop, Math.max(0, stops.length - 1)));
  const [presets, setPresets] = useState<Preset[] | null>(null);
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
  // Until the presets arrive (or if they fail), keep the saved company choosable.
  const companies = presets ?? (goal.company ? [goal.company] : []);
  const suggested = suggestStartStop(
    stops.map((stop) => stop.total),
    Number(solved),
  );
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
    });
  }
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
              setStart(
                suggestStartStop(
                  stops.map((stop) => stop.total),
                  Number(event.target.value),
                ),
              );
            }}
          />
        </label>
        {stops.length > 0 && (
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
              {suggested > 0
                ? t(
                    `按已刷题数，建议从 ${stopName(stops[suggested])} 出发；之前的站不计入每日题量。`,
                    `From what you’ve solved, start at ${stopName(stops[suggested])}; earlier stops leave the daily count.`,
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
