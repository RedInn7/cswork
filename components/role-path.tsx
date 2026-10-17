'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MCQ_TOPIC_NAMES } from '@/components/oa-mcq';
import {
  ROLES,
  ROUTE_DEFAULT,
  STEP_DONE,
  parseRoute,
  stepId,
  stepTitle,
  type ExtStep,
  type ResolvedStep,
  type RoleKey,
  type RoleStep,
  type RouteDoc,
} from '@/lib/content/role-paths';
import { parseMcqReview } from '@/lib/mock-oa';
import { ojRequest } from '@/lib/oj-client';
import { overdue, remainingMinutes, routeIcs, scheduleRoute } from '@/lib/route-schedule';
import { localDay } from '@/lib/study-plan';
import { RouteEditor, RouteSchedule, dayLabel, saveRoute, timeLabel } from './route-editor';
import '@/app/role-path.css';

type Role = { key: RoleKey; name: string; blurb: string };
type Count = { done: number; total: number };
/** A step on the line: one of the site's (resolved), the learner's own entry, or a ref the site no longer has. */
type Row = { id: string; step?: ResolvedStep; ext?: ExtStep; missing?: RoleStep };

/** A guest's schedules for the built-in roles, in this browser only: { [role]: RouteDoc }. */
const GUEST_KEY = 'cswork:route:v1:guest';
function readGuest(): Partial<Record<RoleKey, RouteDoc>> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '{}');
    return Object.fromEntries(
      Object.entries(raw && typeof raw === 'object' ? raw : {}).flatMap(([key, value]) => {
        const doc = parseRoute(value);
        return doc ? [[key, doc]] : [];
      }),
    );
  } catch {
    return {};
  }
}

/** What the learner has done, as the step keys name it (lib/content/role-paths.ts ResolvedStep). */
async function achievedKeys(problems: boolean, mcq: boolean, signal: AbortSignal) {
  const done = new Set<string>();
  // Signed out this answers 401 and the path stays a guest's.
  const marks = await ojRequest<{ items: { target: string; mark: string }[] }>('marks', undefined, signal);
  for (const { target, mark } of marks.items) if (mark === 'read' || mark === 'done') done.add(target);
  const [history, note] = await Promise.all([
    problems
      ? ojRequest<{ items: { problemId: string; firstAcAt: number | null }[] }>('history', undefined, signal)
      : null,
    mcq ? ojRequest<{ body: string }>(`notes?target=${encodeURIComponent('mcq:answers')}`, undefined, signal) : null,
  ]);
  for (const item of history?.items ?? []) if (item.firstAcAt) done.add(`problem:${item.problemId}`);
  for (const id of Object.keys(parseMcqReview(note?.body))) done.add(`mcq:${id}`);
  return done;
}

const noUpdates = () => () => {};
const counted = (step: ResolvedStep) => step.keys.length > 0 && !step.unavailable;
const stateOf = ({ done, total }: Count) => (done >= total * STEP_DONE ? 'done' : done > 0 ? 'active' : 'todo');

/**
 * /roadmap's role picker (?role=), the chosen role's steps as stations on one line, and its schedule.
 * Signed in, each counted step shows how much of it is done from the APIs the site already has: read
 * marks (system design and course chapters), the practice history (problems), done marks (projects and
 * frontend JS problems) and the MCQ review note. Mock interviews never count; an AI-only one reads
 * unavailable while AI is off.
 *
 * The schedule lays the steps left into weeks at the learner's hours (lib/route-schedule.ts) and is a
 * route:role-<key> note (a guest's lives in localStorage). Signed in, steps can be marked in progress or
 * skipped, the role copied into a route of one's own (?route=r-<id>, edited against `catalog`, every
 * step the site has) and "My routes" listed.
 */
export function RolePath({
  english,
  role,
  roles,
  steps,
  route = null,
  catalog,
}: {
  english: boolean;
  role: RoleKey | null;
  roles: Role[];
  steps: ResolvedStep[];
  route?: string | null;
  catalog?: Record<string, ResolvedStep>;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [done, setDone] = useState<ReadonlySet<string> | null>(null);
  // The learner's route notes by target; member stays null while loading, false for a guest.
  const [docs, setDocs] = useState<Record<string, RouteDoc>>({});
  const [member, setMember] = useState<boolean | null>(null);
  const [guest, setGuest] = useState<Partial<Record<RoleKey, RouteDoc>>>({});
  // The learner's local day, never the server's: null while rendering on the server.
  const today = useSyncExternalStore(noUpdates, localDay, () => null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const pending = useRef<{ timer?: ReturnType<typeof setTimeout>; flush?: () => Promise<void> }>({});

  useEffect(() => {
    const controller = new AbortController();
    ojRequest<{ items?: { target: string; body: string }[] }>('notes?prefix=route%3A', undefined, controller.signal).then(
      (result) => {
        setDocs(
          Object.fromEntries(
            (result.items ?? []).flatMap(({ target, body }) => {
              const doc = parseRoute(body);
              return doc ? [[target, doc]] : [];
            }),
          ),
        );
        setMember(true);
      },
      (e: Error & { status?: unknown }) => {
        if (e.status === 401) {
          setGuest(readGuest());
          setMember(false);
        } else if (!controller.signal.aborted) setError(e.message);
      },
    );
    // Links, reloads and closing the tab leave without unmounting: save on the way out (keepalive outlives the page).
    const leave = () => pending.current.flush?.();
    const hidden = () => document.visibilityState === 'hidden' && leave();
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      controller.abort();
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', hidden);
      leave();
    };
  }, []);

  const target = route ? `route:${route}` : role ? `route:role-${role}` : null;
  const doc: RouteDoc | undefined = route
    ? docs[`route:${route}`]
    : role
      ? ((member ? docs[`route:role-${role}`] : guest[role]) ?? ROUTE_DEFAULT)
      : undefined;
  const rows: Row[] = route
    ? (doc?.steps ?? []).map((s): Row => {
        const id = stepId(s);
        if (s.kind === 'ext') return { id, ext: s };
        const found = catalog?.[id];
        return found ? { id, step: { ...found, ...(s.optional && { optional: true as const }) } } : { id, missing: s };
      })
    : steps.map((s) => ({ id: stepId(s), step: s }));
  const keys = rows.flatMap((r) => r.step?.keys ?? []);
  const needProblems = keys.some((k) => k.startsWith('problem:'));
  const needMcq = keys.some((k) => k.startsWith('mcq:'));
  // A learner's route waits for its note: its steps say what to fetch.
  const ready = !!role || !!doc;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    achievedKeys(needProblems, needMcq, controller.signal).then(setDone, (e: Error & { status?: unknown }) => {
      setDone(null);
      // A guest's 401 is expected; anything else leaves a member's schedule waiting, so say why.
      if (e.status !== 401 && !controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [ready, needProblems, needMcq]);

  /** Shows the change now; a member's note saves 800 ms after the last one, a guest's goes to localStorage. */
  function update(next: RouteDoc) {
    if (!target) return;
    setSaved(false);
    if (member) {
      setDocs((all) => ({ ...all, [target]: next }));
      clearTimeout(pending.current.timer);
      const flush = () => {
        clearTimeout(pending.current.timer);
        pending.current = {};
        return saveRoute(target, next).then(
          () => setError(''),
          (e: Error) => setError(e.message),
        );
      };
      pending.current = { flush, timer: setTimeout(flush, 800) };
    } else if (role && member === false) {
      const all = { ...guest, [role]: next };
      setGuest(all);
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(all));
      } catch {
        // Private windows: the schedule lasts as long as the page.
      }
    }
  }
  async function create(next: RouteDoc) {
    const id = `r-${Date.now().toString(36)}`;
    try {
      // The role's own pending edit goes too, before the page leaves.
      await Promise.all([pending.current.flush?.(), saveRoute(`route:${id}`, next)]);
      window.location.assign(`/roadmap?route=${id}#role-path`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!target || !window.confirm(t('删除这条路线？删除后无法恢复。', 'Delete this route? This cannot be undone.'))) return;
    clearTimeout(pending.current.timer);
    pending.current = {};
    try {
      await saveRoute(target, null);
      window.location.assign('/roadmap#role-path');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const current = roles.find((r) => r.key === role);
  const counts = rows.map((r): Count =>
    r.ext
      ? { done: r.ext.done, total: r.ext.units }
      : { done: done && r.step ? r.step.keys.filter((k) => done.has(k)).length : 0, total: r.step?.keys.length ?? 0 },
  );
  // A learner's entry is done at its last unit; a site step at STEP_DONE, once progress has loaded.
  const rowState = (r: Row, c: Count) =>
    r.ext
      ? c.done >= c.total
        ? 'done'
        : c.done > 0
          ? 'active'
          : 'todo'
      : done && r.step && counted(r.step)
        ? stateOf(c)
        : undefined;
  const required = rows
    .map((r, i) => [r, counts[i]] as const)
    .filter(([r]) => r.ext || (r.step && !r.step.optional && counted(r.step)));
  const finished = required.filter(([r, c]) => rowState(r, c) === 'done').length;
  const title = (s: ResolvedStep) =>
    s.kind === 'mcq-topic'
      ? stepTitle(s.kind, MCQ_TOPIC_NAMES[s.ref] ? t(...MCQ_TOPIC_NAMES[s.ref]) : s.ref, !english)
      : s.title;
  const rowTitle = (r: Row) => (r.step ? title(r.step) : r.ext ? r.ext.title : t('内容已下线', 'Content retired'));
  const titles = Object.fromEntries(rows.map((r) => [r.id, rowTitle(r)]));

  // Until a member's progress loads (or if it fails), finished steps would schedule in full and read as behind.
  const progressKnown = member === false || (member === true && done !== null);
  const share = (r: Row, c: Count) => (r.step && counted(r.step) && c.total ? c.done / c.total : 0);
  const plan =
    doc && today && progressKnown
      ? scheduleRoute({
          steps: rows.map(
            (r) => r.ext ?? { id: r.id, minutes: r.step?.minutes ?? 0, optional: r.step?.optional, unavailable: !r.step || r.step.unavailable },
          ),
          doneShare: Object.fromEntries(rows.map((r, i) => [r.id, share(r, counts[i])])),
          state: doc.state,
          today,
          weeklyHours: doc.weeklyHours,
          targetDate: doc.targetDate,
        })
      : null;
  const behind = plan && doc && today ? overdue(doc.planned, plan.finish, today) : [];
  const plannedEnd = Object.entries(doc?.planned ?? {})
    .filter(([id]) => titles[id])
    .map(([, day]) => day)
    .sort()
    .at(-1);
  const day = (date: string) => dayLabel(date, today ?? date, english);
  const savePlan = () => {
    if (!doc || !plan) return;
    update({ ...doc, planned: plan.finish });
    setSaved(true);
  };
  const exportIcs = () => {
    if (!doc || !plan) return;
    const ics = routeIcs({
      routeId: route ?? `role-${role}`,
      name: doc.name ?? current?.name ?? t('我的路线', 'My route'),
      steps: rows.map((r) => ({ id: r.id, title: titles[r.id], href: r.step?.href })),
      finish: plan.finish,
      targetDate: doc.targetDate,
      now: new Date(),
      origin: window.location.origin,
      english,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cswork-route.ics';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const mark = (id: string, value: 'doing' | 'skip') => {
    if (!doc) return;
    const state = { ...doc.state };
    if (state[id] === value) delete state[id];
    else state[id] = value;
    update({ ...doc, state });
  };
  const setSteps = (next: NonNullable<RouteDoc['steps']>) => doc && update({ ...doc, steps: next });
  const move = (i: number, by: number) => {
    const list = [...(doc?.steps ?? [])];
    [list[i], list[i + by]] = [list[i + by], list[i]];
    setSteps(list);
  };
  const mine = Object.entries(docs).filter(([key, d]) => key.startsWith('route:r-') && d.steps);
  const named = (d: RouteDoc) => d.name ?? t('我的路线', 'My route');

  return (
    <section className="roadmap-track role-path" id="role-path" aria-labelledby="role-path-title">
      <h2 id="role-path-title">{t('按岗位的路线', 'Paths by role')}</h2>
      <p className="roadmap-lead">
        {t(
          '选一个目标岗位，按顺序走完一条线：算法站点、系统设计、SQL、选择题和一个简历项目，都指向站内已有的内容。',
          'Pick the role you are aiming for and follow one line in order: algorithm stops, system design, SQL, multiple choice and a resume project, all pointing at what the site already has.',
        )}
      </p>
      <nav aria-label={t('选择岗位', 'Choose a role')}>
        <ul className="role-path-roles">
          {roles.map((r) => (
            <li key={r.key}>
              <a href={`/roadmap?role=${r.key}#role-path`} aria-current={r.key === role ? 'page' : undefined}>
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {member && (
        <nav className="role-path-mine" aria-label={t('我的路线', 'My routes')}>
          <span>{t('我的路线', 'My routes')}</span>
          <ul className="role-path-roles">
            {mine.map(([key, d]) => (
              <li key={key}>
                <a href={`/roadmap?route=${key.slice('route:'.length)}#role-path`} aria-current={key === target ? 'page' : undefined}>
                  {named(d)}
                </a>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => create({ ...ROUTE_DEFAULT, name: t('我的路线', 'My route'), steps: [] })}>
                {t('新建空白路线', 'New blank route')}
              </button>
            </li>
          </ul>
        </nav>
      )}
      {error && (
        <p className="role-path-error" role="alert">
          {error}
        </p>
      )}
      {route && !doc && member !== null && (
        <p className="role-path-blurb">
          {member
            ? t('找不到这条路线，可能已经删除了。', 'This route was not found; it may have been deleted.')
            : t('自建路线要登录后才能查看和编辑。', 'Sign in to see and edit your own routes.')}
        </p>
      )}
      {doc && (current || route) && (
        <>
          {current ? (
            <p className="role-path-blurb">{current.blurb}</p>
          ) : (
            <p className="role-path-blurb">
              <strong>{named(doc)}</strong>
              {doc.from && ` · ${t('复制自', 'Copied from')} ${english ? ROLES[doc.from].en : ROLES[doc.from].zh}`}
            </p>
          )}
          {current && role && member && (
            <button
              type="button"
              className="role-path-fork"
              onClick={() => create({ ...doc, name: current.name, from: role, steps: ROLES[role].steps.map((s) => ({ ...s })) })}
            >
              {t('复制成我的路线', 'Copy into my own route')}
            </button>
          )}
          {behind.length > 0 && plan && (
            <div className="role-path-behind" role="status">
              <p>
                {t(
                  `落后 ${behind.length} 步：原定 ${day(plannedEnd ?? plan.end)} 走完，现在预计 ${day(plan.end)}。可以调高每周小时数，或推迟目标日。`,
                  `${behind.length} ${behind.length === 1 ? 'step' : 'steps'} behind: planned to finish on ${day(plannedEnd ?? plan.end)}, now ${day(plan.end)}. Add hours a week, or move the target date.`,
                )}
              </p>
              <button type="button" onClick={savePlan}>
                {t('按现在进度重排', 'Reschedule from here')}
              </button>
            </div>
          )}
          <p className="role-path-progress" role="status">
            {done
              ? t(`必做 ${required.length} 步，已完成 ${finished} 步。`, `${finished} of ${required.length} required steps done.`)
              : t('登录后，每一步会显示你的完成度。', 'Sign in to see how far you are on each step.')}
          </p>
          <ol className="role-path-steps">
            {rows.map((r, i) => {
              const s = r.step;
              const count = counts[i];
              const state = rowState(r, count);
              const marked = doc.state[r.id];
              const finish = plan?.finish[r.id];
              // A learner's entry: one unit more done, or one back after a slip.
              const bump = (by: number) =>
                setSteps((doc.steps ?? []).map((x, j) => (j === i && x.kind === 'ext' ? { ...x, done: x.done + by } : x)));
              return (
                <li
                  key={r.id}
                  data-state={state}
                  data-optional={s?.optional || undefined}
                  data-off={s?.unavailable || r.missing ? true : undefined}
                  data-mark={marked}
                >
                  <div className="role-path-head">
                    {s ? <a href={s.href}>{title(s)}</a> : <span className="role-path-own">{rowTitle(r)}</span>}
                    {s?.optional && <span className="role-path-tag">{t('选做', 'Optional')}</span>}
                    {s?.unavailable && (
                      <span className="role-path-tag" data-off>
                        {t('暂不可用', 'Unavailable')}
                      </span>
                    )}
                    {r.ext && <span className="role-path-tag">{t('外部条目', 'Your entry')}</span>}
                    {marked && (
                      <span className="role-path-tag" data-mark={marked}>
                        {marked === 'doing' ? t('进行中', 'In progress') : t('已跳过', 'Skipped')}
                      </span>
                    )}
                    {state && (
                      <span className="role-path-count">
                        {state === 'done' && <span className="sr-only">{t('已完成，', 'Done, ')}</span>}
                        {count.done}/{count.total}
                      </span>
                    )}
                  </div>
                  {finish && (
                    <p className="role-path-eta">
                      {timeLabel(remainingMinutes(r.ext ?? { id: r.id, minutes: s?.minutes ?? 0 }, share(r, count), false), english)}
                      {' · '}
                      {t(`预计 ${day(finish)} 完成`, `done by ${day(finish)}`)}
                    </p>
                  )}
                  {r.missing && (
                    <p className="role-path-note">
                      {t(
                        '这一步指向的内容已经下线，不计入进度和排期，可以删掉。',
                        'What this step pointed at is no longer on the site, so it is left out of progress and the schedule. You can remove it.',
                      )}
                    </p>
                  )}
                  {s?.unavailable && (
                    <p className="role-path-note">
                      {t(
                        'AI 面试官目前没有开放，这一步不计入进度。可以先用其他模拟面，或找同伴互相面试。',
                        'The AI interviewer is not available right now, so this step does not count. Try another mock interview, or practise with a peer.',
                      )}
                    </p>
                  )}
                  {s?.stops && (
                    <ul className="role-path-stops" aria-label={t('站点', 'Stops')}>
                      {s.stops.map((stop) => (
                        <li key={stop.slug}>
                          <a href={stop.href}>{stop.name}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s?.plan && (
                    <a className="role-path-plan" href={s.plan}>
                      {t('用这几站生成学习计划', 'Make a study plan from these stops')}
                    </a>
                  )}
                  {member && (
                    <div className="role-path-marks">
                      {!r.missing && !s?.unavailable && (
                        <>
                          <button type="button" aria-pressed={marked === 'doing'} onClick={() => mark(r.id, 'doing')}>
                            {t('进行中', 'In progress')}
                          </button>
                          <button type="button" aria-pressed={marked === 'skip'} onClick={() => mark(r.id, 'skip')}>
                            {t('已掌握，跳过', 'Know it, skip')}
                          </button>
                        </>
                      )}
                      {r.ext && r.ext.done < r.ext.units && (
                        <button type="button" aria-label={t(`+1：${r.ext.title}`, `+1: ${r.ext.title}`)} onClick={() => bump(1)}>
                          +1
                        </button>
                      )}
                      {r.ext && r.ext.done > 0 && (
                        <button type="button" aria-label={t(`−1：${r.ext.title}`, `−1: ${r.ext.title}`)} onClick={() => bump(-1)}>
                          −1
                        </button>
                      )}
                      {route && (
                        <>
                          <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t(`上移：${rowTitle(r)}`, `Move up: ${rowTitle(r)}`)}>
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={i === rows.length - 1}
                            onClick={() => move(i, 1)}
                            aria-label={t(`下移：${rowTitle(r)}`, `Move down: ${rowTitle(r)}`)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setSteps((doc.steps ?? []).filter((_, j) => j !== i))}
                            aria-label={t(`删除：${rowTitle(r)}`, `Remove: ${rowTitle(r)}`)}
                          >
                            {t('删除', 'Remove')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {route && member && catalog && (
            <RouteEditor english={english} doc={doc} catalog={catalog} titleOf={title} onChange={update} onDelete={remove} />
          )}
          <RouteSchedule
            english={english}
            busy={member === null}
            doc={doc}
            plan={plan}
            today={today}
            titles={titles}
            onChange={update}
            onSave={savePlan}
            onExport={exportIcs}
          />
          {saved && (
            <p className="role-path-note" role="status">
              {member ? t('排期已保存。', 'Schedule saved.') : t('排期已保存在这个浏览器里。', 'Schedule saved in this browser.')}
            </p>
          )}
          {member === false && (
            <p className="role-path-note">
              {t(
                '登录后可以把步骤标成进行中或跳过、复制成自己的路线并加入外部条目，排期也会跟着账号走。',
                'Sign in to mark steps in progress or skipped, copy the path into your own route with entries of your own, and keep the schedule with your account.',
              )}
            </p>
          )}
          <p className="roadmap-note">
            {t(
              `完成一步的标准：读完、做对或答过其中 ${STEP_DONE * 100}% 的内容；项目以标记「完成」为准。选做和模拟面不计入进度。`,
              `A step is done at ${STEP_DONE * 100}% of it read, solved or answered; a project when you mark it done. Optional steps and mock interviews do not count.`,
            )}
          </p>
        </>
      )}
    </section>
  );
}
