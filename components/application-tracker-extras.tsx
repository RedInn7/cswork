'use client';
import { useEffect, useRef, useState } from 'react';
import {
  agenda,
  expeditePlan,
  localStamp,
  medianDays,
  scheduleIssues,
  STAGE_NAMES,
  trackerStats,
  type AgendaEvent,
  type Application,
} from '@/lib/applications';
import { trackerOpenJs } from '@/lib/autofill-bookmarklet';
import { SOURCES } from '@/lib/experience';
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
