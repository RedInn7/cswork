'use client';
import { useEffect, useRef, useState } from 'react';
import {
  agenda,
  expeditePlan,
  localStamp,
  medianDays,
  parseRetro,
  RETRO_QUESTIONS,
  RETRO_SCORES,
  scheduleIssues,
  STAGE_NAMES,
  trackerStats,
  warmupIssues,
  type AgendaEvent,
  type Application,
  type RetroEntry,
  type RetroQuestion,
} from '@/lib/applications';
import { trackerOpenJs } from '@/lib/autofill-bookmarklet';
import { SOURCES } from '@/lib/experience';
import { readLocale } from '@/lib/i18n';
import { COMPETENCIES } from '@/lib/story-bank';
import { api } from '@/lib/types';

// The weekly goal, a JSON note ({ weekly }) like the other wave-8 career notes (lib/server/my-practice.ts).
const GOAL = `oj/notes?target=${encodeURIComponent('career:goal')}`;
/** Fewer applications from a channel than this show counts but no rate. */
const RATE_MIN = 5;
const days = (n: number, zh: boolean) => (zh ? `${n.toFixed(1)} 天` : `${n.toFixed(1)} d`);

/** The board's numbers (lib/applications.ts trackerStats), folded away until opened, and the weekly goal. */
export function TrackerStats({ items, now, zh }: { items: readonly Application[]; now: number; zh: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const i = zh ? 0 : 1;
  const [goal, setGoal] = useState(0);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    let live = true;
    api<{ body?: string }>(GOAL).then(
      (r) => {
        try {
          const weekly = Number((JSON.parse(r.body || '{}') as { weekly?: unknown }).weekly);
          if (live && Number.isInteger(weekly) && weekly > 0) {
            setGoal(weekly);
            setDraft(String(weekly));
          }
        } catch {}
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  async function saveGoal(event: { preventDefault(): void }) {
    event.preventDefault();
    const weekly = Math.min(50, Math.max(0, Math.floor(Number(draft) || 0)));
    const ok = await fetch(`/api/${GOAL}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // 0 clears the goal: an empty note is removed.
      body: JSON.stringify({ body: weekly ? JSON.stringify({ weekly }) : '' }),
    }).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) setGoal(weekly);
    setNote(ok ? t('已保存', 'Saved') : t('保存失败，请稍后再试', 'Could not save; try again later'));
  }

  const s = trackerStats(items, now, goal);
  const median = medianDays(items, 'applied', 'oa');
  return (
    <details className="tracker-stats">
      <summary>
        {t('求职数据', 'Search stats')} ·{' '}
        {goal ? t(`本周已投 ${s.thisWeek}/${goal}`, `${s.thisWeek}/${goal} sent this week`) : t(`本周已投 ${s.thisWeek}`, `${s.thisWeek} sent this week`)}
      </summary>
      <div className="tracker-stats-grid">
        <section aria-labelledby="tracker-stats-channels">
          <h3 id="tracker-stats-channels">{t('各渠道回复率', 'Replies by channel')}</h3>
          <p className="tracker-stats-help">
            {t(`回复：拿到 OA 或更进一步。少于 ${RATE_MIN} 份不算比例。`, `Reply: an OA or further. Under ${RATE_MIN} sent, no rate.`)}
          </p>
          {s.channels.length ? (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('渠道', 'Channel')}</th>
                  <th scope="col">{t('已投', 'Sent')}</th>
                  <th scope="col">{t('回复', 'Replies')}</th>
                  <th scope="col">{t('回复率', 'Rate')}</th>
                </tr>
              </thead>
              <tbody>
                {s.channels.map((c) => (
                  <tr key={c.channel}>
                    <th scope="row">{SOURCES[c.channel]?.[i] ?? t('未填', 'Not set')}</th>
                    <td>{c.sent}</td>
                    <td>{c.replied}</td>
                    <td>{c.sent >= RATE_MIN ? `${Math.round((100 * c.replied) / c.sent)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{t('还没有已投递的记录。', 'Nothing sent yet.')}</p>
          )}
        </section>
        <section aria-labelledby="tracker-stats-stays">
          <h3 id="tracker-stats-stays">{t('各阶段平均停留', 'Average days per stage')}</h3>
          {s.stays.length ? (
            <ul>
              {s.stays.map((x) => (
                <li key={x.stage}>
                  {STAGE_NAMES[x.stage][i]}
                  {t('：', ': ')}
                  {days(x.days, zh)} <small>({x.n})</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('卡片换过阶段后才有数据。', 'Shows up once cards change stage.')}</p>
          )}
          {median !== null && <p>{t(`投递到 OA 的中位数：${days(median, zh)}`, `Median from applied to OA: ${days(median, zh)}`)}</p>}
        </section>
        <section aria-labelledby="tracker-stats-rejected">
          <h3 id="tracker-stats-rejected">{t('被拒前在哪个阶段', 'Rejected after')}</h3>
          {s.rejectedAfter.length ? (
            <ul>
              {s.rejectedAfter.map((x) => (
                <li key={x.stage}>
                  {STAGE_NAMES[x.stage][i]}
                  {t('：', ': ')}
                  {x.n}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('暂无记录。', 'None recorded.')}</p>
          )}
        </section>
        <section aria-labelledby="tracker-stats-goal">
          <h3 id="tracker-stats-goal">{t('每周目标', 'Weekly goal')}</h3>
          <p>
            {t(`本周（周一起）已投 ${s.thisWeek} 份`, `${s.thisWeek} sent this week (from Monday)`)}
            {goal > 0 && t(`，连续达标 ${s.streak} 周`, `, goal met ${s.streak} ${s.streak === 1 ? 'week' : 'weeks'} in a row`)}
          </p>
          <form className="tracker-goal" onSubmit={saveGoal}>
            <label>
              {t('每周投递', 'Applications a week')}
              <input type="number" min={0} max={50} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <button type="submit">{t('保存目标', 'Save goal')}</button>
            <small aria-live="polite">{note}</small>
          </form>
        </section>
      </div>
    </details>
  );
}

const KINDS: Record<AgendaEvent['kind'], [string, string]> = {
  oa: ['OA 截止', 'OA due'],
  interview: ['面试', 'Interview'],
  next: ['跟进', 'Follow up'],
  offer: ['Offer 截止', 'Offer deadline'],
};
const WEEKDAYS = [
  ['周日', 'Sun'],
  ['周一', 'Mon'],
  ['周二', 'Tue'],
  ['周三', 'Wed'],
  ['周四', 'Thu'],
  ['周五', 'Fri'],
  ['周六', 'Sat'],
];

/**
 * Above the stats: clashes in the next two weeks, the expedite plan while an offer deadline is
 * ahead (lib/applications.ts scheduleIssues, expeditePlan), and the next seven days folded away.
 * Nothing when no dated step is ahead.
 */
export function SchedulePanel({ items, now, zh }: { items: readonly Application[]; now: number; zh: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const i = zh ? 0 : 1;
  const events = agenda(items, now);
  if (!events.length) return null;
  const issues = scheduleIssues(items, now);
  const plan = expeditePlan(items, now);
  const names = new Map(items.map((a) => [a.id, a.company]));
  const list = (ids: string[]) => ids.map((id) => names.get(id)).join(t('、', ', '));
  const d = new Date(now);
  const week = Array.from({ length: 7 }, (_, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k));
  return (
    <section className="tracker-schedule" aria-labelledby="tracker-schedule">
      <h2 id="tracker-schedule">{t('日程', 'Schedule')}</h2>
      {issues.length > 0 && (
        <ul className="tracker-clashes" aria-label={t('日程冲突', 'Schedule clashes')}>
          {issues.map((x) => (
            <li key={`${x.kind}:${x.day}:${x.ids.join()}`}>
              <strong>{x.day}</strong>{' '}
              {x.kind === 'overlap'
                ? t(`两场面试开始时间相隔不到 90 分钟：${list(x.ids)}`, `two interviews start under 90 minutes apart: ${list(x.ids)}`)
                : x.kind === 'oa-pile'
                  ? t(`${x.ids.length} 个 OA 同一天截止：${list(x.ids)}，可以提前做掉一部分`, `${x.ids.length} OAs due the same day: ${list(x.ids)}; consider doing some early`)
                  : t(
                      `${names.get(x.ids[0])} 的 offer 截止当天还有 ${list(x.ids.slice(1))} 的面试或 OA`,
                      `${names.get(x.ids[0])}'s offer deadline falls on the same day as an interview or OA at ${list(x.ids.slice(1))}`,
                    )}
            </li>
          ))}
        </ul>
      )}
      {plan && plan.rows.length > 0 && (
        <div className="tracker-expedite">
          <h3>
            {t(
              `${plan.offer.company} 的 offer ${localStamp(plan.deadline)} 截止，其他流程赶得上吗`,
              `${plan.offer.company}'s offer expires ${localStamp(plan.deadline)}: will your other processes finish in time?`,
            )}
          </h3>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('公司', 'Company')}</th>
                <th scope="col">{t('阶段', 'Stage')}</th>
                <th scope="col">{t('预计出结果', 'Likely decision')}</th>
                <th scope="col">
                  <span className="sr-only">{t('操作', 'Action')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map(({ a, eta, late, overdue }) => (
                <tr key={a.id} data-late={late ? '' : undefined}>
                  <th scope="row">{a.company}</th>
                  <td>{STAGE_NAMES[a.stage][i]}</td>
                  <td>
                    {eta === null
                      ? t('未知，建议问 recruiter 时间线', 'Unknown: ask the recruiter for a timeline')
                      : overdue
                        ? t('已超过通常时长，建议问 recruiter', 'Past the usual timeline: ask the recruiter')
                        : `${localStamp(eta, false)} · ${late ? t('晚于截止', 'after the deadline') : t('赶得上', 'in time')}`}
                    {eta !== null && <small> ({a.process ? t('面经中位数', 'member write-ups') : t('你看板上的中位数', 'your board’s median')})</small>}
                  </td>
                  <td>
                    <a
                      href={`/career/templates?${new URLSearchParams({ template: 'expedite', application: a.id, offer: plan.offer.id })}`}
                    >
                      {t('请求加速', 'Ask to speed up')}
                      <span className="sr-only"> {a.company}</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tracker-stats-help">
            {t(
              '预计时间先看这家公司面经里从投递到 offer 的中位数，没有时用你看板上从这个阶段到 offer 的中位数。赶不上就早点联系 recruiter，说明你有截止日期。',
              'Estimates use the company’s median from application to offer in member write-ups, else your board’s median from that stage to an offer. If one won’t make it, tell the recruiter about your deadline early.',
            )}
          </p>
        </div>
      )}
      <details className="tracker-week">
        <summary>{t('未来 7 天', 'Next 7 days')}</summary>
        <ol>
          {week.map((day) => {
            const key = localStamp(day.getTime(), false);
            const on = events.filter((e) => localStamp(e.at, false) === key);
            return (
              <li key={key}>
                <h3>
                  {WEEKDAYS[day.getDay()][i]} <small>{key.slice(5)}</small>
                </h3>
                {on.length ? (
                  <ul>
                    {on.map((e) => (
                      <li key={`${e.kind}:${e.a.id}`} data-kind={e.kind}>
                        <time dateTime={new Date(e.at).toISOString()}>{localStamp(e.at).slice(11)}</time> {KINDS[e.kind][i]} · {e.a.company}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('无安排', 'Nothing')}</p>
                )}
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

/**
 * The "Save to tracker" bookmarklet (/career/tracker): on a job page it opens the tracker with
 * the page title, site name (or host) and address filled in, and any selected text as the job
 * description in the #fragment, which browsers never send to a server. React blocks javascript:
 * hrefs, so the link gets it after mount.
 */
export function TrackerBookmarklet({ zh }: { zh: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = ref.current;
    if (!link) return;
    const open = JSON.stringify(`${location.origin}/career/tracker?add=1`);
    link.setAttribute('href', `javascript:${trackerOpenJs(open)}`);
    // Clicked here it would only open this page again: it is for dragging to the bookmarks bar.
    const stay = (e: Event) => e.preventDefault();
    link.addEventListener('click', stay);
    return () => link.removeEventListener('click', stay);
  }, []);
  return (
    <div className="tracker-bookmarklet">
      <a ref={ref} href="/career/tracker?add=1">
        {zh ? '存到投递看板' : 'Save to tracker'}
      </a>
      <p>
        {zh
          ? '把这个按钮拖到浏览器的书签栏。在招聘页上点它（可以先选中职位描述），会打开这里并填好公司、岗位、链接和选中的文字，你确认后保存。选中的文字放在网址 # 后面，不经过服务器，点保存才存进你的账号。'
          : 'Drag this button to your bookmarks bar. On a job page, click it (select the job description first if you like): this page opens with the company, role, link and selected text filled in, saved when you confirm. The text travels after the # in the address, which never reaches a server, and is stored in your account only when you save.'}
      </p>
    </div>
  );
}

/** Above the schedule: interview order hints (lib/applications.ts warmupIssues); nothing when there are none. */
export function WarmupHints({ items, now, zh }: { items: readonly Application[]; now: number; zh: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const issues = warmupIssues(items, now);
  if (!issues.length) return null;
  const names = new Map(items.map((a) => [a.id, a.company]));
  return (
    <section className="tracker-warmup" aria-labelledby="tracker-warmup">
      <h2 id="tracker-warmup">{t('面试顺序', 'Interview order')}</h2>
      <ul>
        {issues.map(({ kind, ids: [id, ...rest] }) => (
          <li key={`${kind}:${id}`}>
            {kind === 'dream-first'
              ? t(
                  `梦想公司 ${names.get(id)} 的面试是你第一场真面，建议先约一两家练手公司热身。`,
                  `Your interview at ${names.get(id)}, a dream company, would be your first real one: try to fit in one or two practice companies first.`,
                )
              : t(
                  `梦想公司 ${names.get(id)} 已经投了，练手公司 ${rest.map((x) => names.get(x)).join('、')} 还在“想投”：尽快投出去，它们的面试才能排在前面。`,
                  `You have applied to ${names.get(id)}, a dream company, while practice companies (${rest.map((x) => names.get(x)).join(', ')}) are still at Saved: send those soon so their interviews come first.`,
                )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const ROUNDS = ['phone', 'onsite'] as const;
type Round = (typeof ROUNDS)[number];
/** The card's latest interview stage: its own, else the last one logged, else phone. */
const lastRound = (a: Application): Round =>
  [a.stage, ...a.stageLog.map(([s]) => s).reverse()].find((s): s is Round => s === 'phone' || s === 'onsite') ?? 'phone';
type Draft = { target: string | null; stage: Round; at: string; score: string; questions: RetroQuestion[]; stuck: string; themes: string[] };
const blankQuestion = (): RetroQuestion => ({ text: '', problem: '', similar: false });
const inputTime = (at: number) => localStamp(at).replace(' ', 'T');

async function putRetro(target: string, body: string) {
  const r = await fetch(`/api/oj/notes?target=${encodeURIComponent(target)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
    body: JSON.stringify({ body }),
  });
  const result: unknown = await r.json().catch(() => null);
  if (!r.ok) throw new Error(result && typeof result === 'object' && 'error' in result ? String(result.error) : `HTTP ${r.status}`);
}

/**
 * A card's private interview retros (user notes retro:<card id>/<base36 time>): the form for a new
 * or chosen round and the earlier rounds. Saving marks the linked site problems to redo, so they
 * come up first in the review session; the themes feed the story bank's "no story yet" list.
 */
export function RetroPanel({
  a,
  rounds,
  stage,
  now,
  zh,
  onChange,
  onClose,
}: {
  a: Application;
  /** This card's retros. */
  rounds: readonly RetroEntry[];
  /** The round a stage move just finished. */
  stage?: Round;
  now: number;
  zh: boolean;
  onChange: (entry: RetroEntry, removed?: boolean) => void;
  onClose: () => void;
}) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const i = zh ? 0 : 1;
  const formRef = useRef<HTMLFormElement>(null);
  const fresh = (): Draft => ({
    target: null,
    stage: stage ?? lastRound(a),
    at: inputTime(a.interviewAt !== null && a.interviewAt <= now ? a.interviewAt : now),
    score: '',
    questions: [blankQuestion()],
    stuck: '',
    themes: [],
  });
  const [draft, setDraft] = useState(fresh);
  const isLp = (id: string) => COMPETENCIES.find((c) => c.id === id)?.lp;
  // Its own state: tied to the picked themes it would snap shut (and hide the focused box) on unchecking the last one.
  const [lpOpen, setLpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; review: boolean } | null>(null);
  const [error, setError] = useState('');
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
  };
  const setQuestion = (k: number, patch: Partial<RetroQuestion>) =>
    set({ questions: draft.questions.map((q, j) => (j === k ? { ...q, ...patch } : q)) });
  const edit = (next: Draft) => {
    setDraft(next);
    if (next.themes.some(isLp)) setLpOpen(true);
    setNote(null);
    setError('');
    formRef.current?.querySelector('select')?.focus();
  };

  async function save(event: { preventDefault(): void }) {
    event.preventDefault();
    // The server checks with the same function (lib/server/my-practice.ts).
    const retro = parseRetro(
      JSON.stringify({
        company: a.company,
        stage: draft.stage,
        at: new Date(draft.at).getTime(),
        score: Number(draft.score),
        questions: draft.questions
          .map((q) => ({ text: q.text.trim(), problem: q.problem.trim().toLowerCase(), similar: q.similar }))
          .filter((q) => q.text || q.problem),
        stuck: draft.stuck.trim(),
        themes: draft.themes,
      }),
    );
    if (!retro) return setError(t('请选好时间和自评，题号写成 lc-146 或 oa-… 这样的格式。', 'Pick the time and a rating, and write problem ids like lc-146 or oa-….'));
    const target = draft.target ?? `retro:${a.id}/${Date.now().toString(36)}`;
    setBusy(true);
    setError('');
    try {
      await putRetro(target, JSON.stringify(retro));
      onChange({ ...retro, target, card: a.id });
      setDraft((d) => ({ ...d, target }));
      const problems = [...new Set(retro.questions.flatMap((q) => (q.problem ? [`problem:${q.problem}`] : [])))];
      const marked =
        !problems.length ||
        (await api('oj/marks', { targets: problems, mark: 'redo' }).then(
          () => true,
          () => false,
        ));
      setNote({
        text: !problems.length
          ? t('已保存', 'Saved')
          : marked
            ? t(`已保存，${problems.length} 道关联题已标记重做，复习时排在前面。`, `Saved. ${problems.length} linked ${problems.length === 1 ? 'problem is' : 'problems are'} marked to redo and come first in review.`)
            : t('已保存，但关联题没能标记重做，稍后再保存一次。', 'Saved, but the linked problems could not be marked to redo; save again later.'),
        review: problems.length > 0 && marked,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(r: RetroEntry) {
    if (!window.confirm(t('删除这条复盘？', 'Delete this retro?'))) return;
    try {
      await putRetro(r.target, '');
      onChange(r, true);
      if (draft.target === r.target) edit(fresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const theme = (c: (typeof COMPETENCIES)[number]) => {
    const on = draft.themes.includes(c.id);
    return (
      <label key={c.id} className="visa-check">
        <input
          type="checkbox"
          checked={on}
          disabled={!on && draft.themes.length >= 8}
          onChange={() => set({ themes: on ? draft.themes.filter((x) => x !== c.id) : [...draft.themes, c.id] })}
        />
        {c.name[i]}
      </label>
    );
  };
  return (
    <form ref={formRef} className="resume-form visa-form tracker-retro" onSubmit={save} aria-labelledby="tracker-retro-h">
      <fieldset>
        <legend id="tracker-retro-h">
          {draft.target ? t('编辑复盘', 'Edit retro') : t('面试复盘', 'Interview retro')} · {a.company}
        </legend>
        <p className="tracker-notes tracker-retro-help">
          {t(
            '只有你能看到。趁记得清楚，记下被问到的题、自评和卡住的地方。',
            'Only you see this. While it is fresh, note the questions, how it went and where you got stuck.',
          )}
        </p>
        <label>
          {t('轮次', 'Round')}
          <select value={draft.stage} onChange={(e) => set({ stage: e.target.value as Round })}>
            {ROUNDS.map((s) => (
              <option key={s} value={s}>
                {STAGE_NAMES[s][i]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('面试时间', 'When')}
          <input type="datetime-local" required value={draft.at} onChange={(e) => set({ at: e.target.value })} />
        </label>
        <label>
          {t('自评', 'How it went')}
          <select required value={draft.score} onChange={(e) => set({ score: e.target.value })}>
            <option value="">{t('选一个', 'Pick one')}</option>
            {RETRO_SCORES.map((s, k) => (
              <option key={k} value={k + 1}>
                {k + 1} · {s[i]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="tracker-notes tracker-retro-qs">
          <legend>
            {t('被问到的题', 'Questions asked')}{' '}
            <small>{t('能对上站内题就填题号（如 lc-146），保存后加入“标记重做”', 'add a site problem id (e.g. lc-146) when one matches; saving marks it to redo')}</small>
          </legend>
          <ol>
            {draft.questions.map((q, k) => (
              <li key={k}>
                <input
                  maxLength={200}
                  value={q.text}
                  onChange={(e) => setQuestion(k, { text: e.target.value })}
                  aria-label={t(`第 ${k + 1} 题`, `Question ${k + 1}`)}
                  placeholder={k ? '' : t('例如：合并区间，追问了原地做法', 'e.g. Merge intervals, then in place')}
                />
                <input
                  maxLength={200}
                  pattern="lc-\d{1,6}|oa-[a-z0-9\-]{1,180}"
                  value={q.problem}
                  onChange={(e) => setQuestion(k, { problem: e.target.value, ...(!e.target.value.trim() && { similar: false }) })}
                  aria-label={t(`第 ${k + 1} 题对应的站内题（题号，如 lc-146）`, `Site problem for question ${k + 1} (id, e.g. lc-146)`)}
                  placeholder="lc-146"
                />
                <label className="visa-check">
                  <input
                    type="checkbox"
                    checked={q.similar}
                    disabled={!q.problem.trim()}
                    onChange={(e) => setQuestion(k, { similar: e.target.checked })}
                  />
                  {t('类似', 'Similar')}
                  <span className="sr-only">{t(`：第 ${k + 1} 题只是和这道题类似`, `: question ${k + 1} only resembled it`)}</span>
                </label>
                <button
                  type="button"
                  onClick={() => set({ questions: draft.questions.filter((_, j) => j !== k) })}
                  aria-label={t(`去掉第 ${k + 1} 题`, `Remove question ${k + 1}`)}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={draft.questions.length >= RETRO_QUESTIONS}
            onClick={() => set({ questions: [...draft.questions, blankQuestion()] })}
          >
            {t('再加一题', 'Add a question')}
          </button>
        </fieldset>
        <label className="tracker-notes">
          {t('卡在哪里', 'Where you got stuck')} <small>{draft.stuck.length}/600</small>
          <textarea rows={3} maxLength={600} value={draft.stuck} onChange={(e) => set({ stuck: e.target.value })} />
        </label>
        <fieldset className="tracker-notes tracker-retro-themes">
          <legend>
            {t('行为面问到的主题', 'Behavioral themes asked')}{' '}
            <small>{t('最多 8 个；还没有故事的，故事库会提醒你补上', 'up to 8; the story bank lists the ones you have no story for')}</small>
          </legend>
          <div>{COMPETENCIES.filter((c) => !c.lp).map(theme)}</div>
          <details open={lpOpen} onToggle={(e) => setLpOpen(e.currentTarget.open)}>
            <summary>Amazon Leadership Principles</summary>
            <div>{COMPETENCIES.filter((c) => c.lp).map(theme)}</div>
          </details>
        </fieldset>
      </fieldset>
      <div className="resume-actions">
        <button type="submit" disabled={busy}>
          {t('保存复盘', 'Save retro')}
        </button>
        {draft.target && (
          <button type="button" className="is-quiet" onClick={() => edit(fresh())}>
            {t('再记一轮', 'Add another round')}
          </button>
        )}
        <button type="button" className="is-quiet" onClick={onClose}>
          {t('关闭', 'Close')}
        </button>
        <small aria-live="polite">
          {note?.text}
          {note?.review && (
            <>
              {' '}
              <a href="/?view=review-session">{t('去复习', 'Review now')}</a>
            </>
          )}
        </small>
      </div>
      {error && (
        <p className="resume-error" role="alert">
          {error}
        </p>
      )}
      {rounds.length > 0 && (
        <section className="tracker-retro-list" aria-labelledby="tracker-retro-list">
          <h3 id="tracker-retro-list">{t('已写的复盘', 'Retros so far')}</h3>
          <ul>
            {[...rounds]
              .sort((x, y) => y.at - x.at)
              .map((r) => (
                <li key={r.target} aria-current={draft.target === r.target || undefined}>
                  <span>
                    <time dateTime={new Date(r.at).toISOString()}>{localStamp(r.at)}</time> · {STAGE_NAMES[r.stage][i]} · {RETRO_SCORES[r.score - 1][i]} ·{' '}
                    {t(`${r.questions.length} 题`, `${r.questions.length} ${r.questions.length === 1 ? 'question' : 'questions'}`)}
                  </span>
                  {r.stuck && <small>{r.stuck}</small>}
                  <span>
                    <button
                      type="button"
                      onClick={() =>
                        edit({
                          target: r.target,
                          stage: r.stage,
                          at: inputTime(r.at),
                          score: String(r.score),
                          questions: r.questions.length ? r.questions : [blankQuestion()],
                          stuck: r.stuck,
                          themes: r.themes,
                        })
                      }
                    >
                      {t('编辑', 'Edit')}
                      <span className="sr-only"> {localStamp(r.at)}</span>
                    </button>
                    <button type="button" onClick={() => void remove(r)}>
                      {t('删除', 'Delete')}
                      <span className="sr-only"> {localStamp(r.at)}</span>
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </form>
  );
}
