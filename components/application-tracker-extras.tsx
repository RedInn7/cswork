'use client';
import { useEffect, useRef, useState } from 'react';
import { medianDays, STAGE_NAMES, trackerStats, type Application } from '@/lib/applications';
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
                  {STAGE_NAMES[x.stage][i]}：{days(x.days, zh)} <small>({x.n})</small>
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
                  {STAGE_NAMES[x.stage][i]}：{x.n}
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
            <small role="status">{note}</small>
          </form>
        </section>
      </div>
    </details>
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
    const open = JSON.stringify(`${location.origin}/career/tracker?add=1`);
    ref.current?.setAttribute(
      'href',
      `javascript:(()=>{const d=document,e=encodeURIComponent,m=d.querySelector('meta[property="og:site_name"]'),` +
        `s=String(getSelection()).trim().slice(0,10000);window.open(${open}+'&company='+e(((m&&m.content)||location.hostname).slice(0,100))` +
        `+'&role='+e(d.title.slice(0,120))+'&link='+e(location.href)+(s?'#jd='+e(s):''))})()`,
    );
  }, []);
  return (
    <div className="tracker-bookmarklet">
      {/* Clicking it here would only open the tracker again: it is for dragging to the bookmarks bar. */}
      <a ref={ref} onClick={(e) => e.preventDefault()}>
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
