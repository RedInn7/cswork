'use client';
import { useEffect, useRef, useState } from 'react';
import {
  agenda,
  applicationsCsv,
  applicationsIcs,
  calendarItems,
  countdown,
  DAY,
  followUpDue,
  followUpOpen,
  funnel,
  httpsLink,
  JD_MAX,
  localStamp,
  NOTES_MAX,
  oaOpen,
  offerOpen,
  REFERRAL_STATUS,
  retroList,
  stageDays,
  stageSince,
  stale,
  STAGE_NAMES,
  STAGES,
  TIERS,
  tomorrowMorning,
  writeUpHref,
  type Application,
  type RetroEntry,
  type Stage,
} from '@/lib/applications';
import { SOURCES } from '@/lib/experience';
import { api } from '@/lib/types';
import { RetroPanel, SchedulePanel, TrackerStats, WarmupHints } from './application-tracker-extras';

const ADD = '.tracker [data-add]';
const KEPT_ADD = 'cswork:tracker:add';
// Resume version names (resume-jd-offline's builder keeps { name: resume } here); empty until it ships.
const RESUME_VERSIONS = 'cswork:resume:versions';

/**
 * Signed out (app/career/tracker/page.tsx): an opening's ?add=1 query, and the bookmarklet's #jd
 * fragment with it, wait in this tab until the board opens after sign-in.
 */
export function KeepTrackerAdd() {
  useEffect(() => {
    try {
      if (new URLSearchParams(location.search).get('add') === '1') sessionStorage.setItem(KEPT_ADD, location.search + location.hash);
    } catch {}
  }, []);
  return null;
}
type Form = {
  id: string | null;
  company: string;
  role: string;
  stage: Stage;
  applied: string;
  oa: string;
  interview: string;
  offer: string;
  referral: string;
  link: string;
  notes: string;
  channel: string;
  referralStatus: string;
  nextAction: string;
  next: string;
  resume: string;
  tier: string;
  /** null while a saved job description loads (it is not in the list). */
  jd: string | null;
};
const toForm = (a?: Application): Form => ({
  id: a?.id ?? null,
  company: a?.company ?? '',
  role: a?.role ?? '',
  stage: a?.stage ?? 'applied',
  applied: localStamp(a?.appliedAt ?? null, false),
  oa: localStamp(a?.oaDeadline ?? null).replace(' ', 'T'),
  interview: localStamp(a?.interviewAt ?? null).replace(' ', 'T'),
  offer: localStamp(a?.offerDeadline ?? null).replace(' ', 'T'),
  referral: a?.referral ?? '',
  link: a?.link ?? '',
  notes: a?.notes ?? '',
  channel: a?.channel ?? '',
  referralStatus: a?.referralStatus ?? '',
  nextAction: a?.nextAction ?? '',
  next: localStamp(a?.nextAt ?? null).replace(' ', 'T'),
  resume: a?.resumeVersion ?? '',
  tier: a?.tier ?? '',
  jd: a?.hasJd ? null : '',
});
// Input values are local times; a bare date would parse as UTC, so it gets a local midnight.
const fromInput = (value: string) => (value ? new Date(value.includes('T') ? value : `${value}T00:00`).getTime() : null);
const SOON = 48 * 3600000;
/** The Saved column puts practice companies first and dream ones last: interview where it matters least first. */
const TIER_ORDER: Record<string, number> = { practice: 0, target: 1, '': 2, dream: 3 };
const INTERVIEWED: readonly Stage[] = ['phone', 'onsite'];

function download(name: string, type: string, text: string) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No Blob URLs here (an old browser or a sandbox): nothing to download.
  }
}

/** A card's details, opened on demand: stage timeline, channel and referral, resume version, notes and the saved job description. */
function CardMore({ a, zh, now }: { a: Application; zh: boolean; now: number }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const i = zh ? 0 : 1;
  const [jd, setJd] = useState<string | null>(null);
  const facts = (
    [
      [t('投递日期', 'Applied on'), localStamp(a.appliedAt, false)],
      [t('渠道', 'Channel'), SOURCES[a.channel]?.[i] ?? ''],
      [t('内推状态', 'Referral status'), REFERRAL_STATUS[a.referralStatus]?.[i] ?? ''],
      [t('内推人', 'Referrer'), a.referral],
      [t('简历版本', 'Resume version'), a.resumeVersion],
    ] as const
  ).filter(([, v]) => v);
  return (
    <details
      className="tracker-more"
      onToggle={(e) => {
        if (e.currentTarget.open && a.hasJd && jd === null)
          api<{ jd: string }>(`oj/applications/${a.id}/jd`).then(
            (r) => setJd(r.jd),
            () => setJd(t('职位描述读取失败，请稍后再试。', 'Could not load the job description; try again later.')),
          );
      }}
    >
      <summary>
        {t('详情', 'Details')}
        <span className="sr-only"> {a.company}</span>
      </summary>
      {a.stageLog.length ? (
        <ol className="tracker-timeline" aria-label={t('阶段记录', 'Stage history')}>
          {stageDays(a, now).map(({ stage, at, days }, k) => (
            <li key={k}>
              {STAGE_NAMES[stage][i]} <time dateTime={new Date(at).toISOString()}>{localStamp(at, false)}</time>{' '}
              <small>{t(`${Math.floor(days)} 天`, `${Math.floor(days)} d`)}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="tracker-role">
          {t('这张卡片早于阶段记录功能，下次换阶段时开始记录。', 'Added before stage history: moves are recorded from the next one.')}
        </p>
      )}
      {facts.length > 0 && (
        <dl className="tracker-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {a.notes && <p className="tracker-text">{a.notes}</p>}
      {a.hasJd && (
        <>
          <p className="tracker-role">{t('职位描述', 'Job description')}</p>
          <div className="tracker-text">{jd ?? t('正在读取…', 'Loading…')}</div>
        </>
      )}
    </details>
  );
}

/** /career/tracker: the signed-in learner's applications as a board, stage by stage. */
export function ApplicationTracker({ zh }: { zh: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const [items, setItems] = useState<Application[] | null>(null);
  const [companies, setCompanies] = useState<{ slug: string; name: string }[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // A selector to focus once the board has re-rendered: the moved card's select, or a closed form's opener.
  const [refocus, setRefocus] = useState<string | null>(null);
  // Interview retros (user notes retro:<card id>/<time>), and the card whose retro panel is open.
  const [retros, setRetros] = useState<RetroEntry[]>([]);
  const [retroFor, setRetroFor] = useState<{ id: string; stage?: 'phone' | 'onsite' } | null>(null);
  // The browser's saved resume versions, for the form's suggestions (the board only renders client-side).
  const [versions] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(RESUME_VERSIONS) ?? '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.keys(saved).slice(0, 20) : [];
    } catch {
      return [];
    }
  });
  const formRef = useRef<HTMLFormElement>(null);
  const editing = form && (form.id ?? '');
  useEffect(() => {
    let live = true;
    // ?add=1&company=&role=&link= (an opening's "Add to tracker", app/company/jobs.tsx, or the
    // bookmarklet with #jd=<selected text>): a filled-in new card at Saved, kept only once the
    // learner saves it; the link only when it is https. Signed out, the page kept the query and
    // fragment in this tab (KeepTrackerAdd) for after sign-in. Read, both leave the address.
    let source = location.search + location.hash,
      kept = '';
    try {
      kept = sessionStorage.getItem(KEPT_ADD) ?? '';
      sessionStorage.removeItem(KEPT_ADD);
    } catch {}
    if (new URLSearchParams(location.search).get('add') === '1') history.replaceState(history.state, '', location.pathname);
    else source = kept;
    const cut = source.includes('#') ? source.indexOf('#') : source.length;
    const query = new URLSearchParams(source.slice(0, cut));
    if (query.get('add') === '1') {
      const link = (query.get('link') ?? '').trim();
      setForm({
        ...toForm(),
        stage: 'saved',
        company: (query.get('company') ?? '').slice(0, 100),
        role: (query.get('role') ?? '').slice(0, 120),
        link: link.length <= 500 && httpsLink(link) ? link : '',
        jd: (new URLSearchParams(source.slice(cut + 1)).get('jd') ?? '').slice(0, JD_MAX),
      });
    }
    api<{ items: Application[] }>('oj/applications').then(
      (r) => live && setItems(r.items),
      (e: unknown) => live && (setItems([]), setError(e instanceof Error ? e.message : String(e))),
    );
    api<{ items?: unknown }>('oj/notes?prefix=retro%3A').then(
      (r) => live && setRetros(retroList(r.items)),
      () => {},
    );
    // Name suggestions: the companies with a company page.
    api<{ items: { slug: string; name: string }[] }>('oj/reports/companies').then(
      (r) => live && setCompanies(Array.isArray(r.items) ? r.items : []),
      () => {},
    );
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      live = false;
      clearInterval(tick);
    };
  }, []);
  useEffect(() => {
    if (!refocus) return;
    document.querySelector<HTMLElement>(refocus)?.focus();
    setRefocus(null);
  }, [refocus]);
  // The form opens above the board, off-screen from a card far down: focusing it scrolls it in.
  // A form opened from the address is only drawn once the board has loaded.
  const loaded = items !== null;
  useEffect(() => {
    if (editing !== null) formRef.current?.querySelector('input')?.focus();
  }, [editing, loaded]);
  // Editing a card with a saved job description: fetch it into the form.
  const jdFor = form?.jd === null ? form.id : null;
  useEffect(() => {
    if (!jdFor) return;
    let live = true;
    api<{ jd: string }>(`oj/applications/${jdFor}/jd`).then(
      (r) => live && setForm((f) => (f && f.id === jdFor && f.jd === null ? { ...f, jd: r.jd } : f)),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [jdFor]);
  const close = (to: string | null = form?.id ? `[data-id="${form.id}"] .tracker-card-actions button` : ADD) => {
    setRefocus(to);
    setForm(null);
  };

  const put = (item: Application) => {
    setItems((list) => [item, ...(list ?? []).filter((a) => a.id !== item.id)]);
    // The other cards' process lengths come only while an offer deadline is ahead
    // (lib/server/applications.ts withLinks): a save that starts or ends one reads them all again.
    const ahead = (list: readonly Application[]) => list.some((a) => offerOpen(a) && a.offerDeadline! > Date.now());
    const list = items ?? [];
    if (ahead(list) !== ahead([item, ...list.filter((a) => a.id !== item.id)]))
      api<{ items: Application[] }>('oj/applications').then((r) => setItems(r.items), () => {});
  };
  async function send(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      return await api<{ item?: Application }>(path, body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function save(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!form) return;
    const link = form.link.trim();
    if (link && !httpsLink(link)) return setError(t('链接需要以 https:// 开头', 'Links must start with https://'));
    const r = await send(form.id ? `oj/applications/${form.id}` : 'oj/applications', {
      company: form.company.trim(),
      role: form.role,
      stage: form.stage,
      appliedAt: fromInput(form.applied),
      oaDeadline: fromInput(form.oa),
      interviewAt: fromInput(form.interview),
      // Kept when the card leaves the Offer stage (the field hides, the date stays).
      offerDeadline: fromInput(form.offer),
      referral: form.referral,
      link,
      notes: form.notes,
      channel: form.channel,
      referralStatus: form.referralStatus,
      nextAction: form.nextAction,
      nextAt: fromInput(form.next),
      resumeVersion: form.resume,
      tier: form.tier,
      // Still loading: leave the saved description as it is.
      ...(form.jd !== null && { jdText: form.jd }),
    });
    if (r?.item) {
      put(r.item);
      close();
    }
  }
  /** Changes some fields of a card from the board (its stage, follow-up). */
  async function update(a: Application, body: Partial<Pick<Application, 'stage' | 'nextAt' | 'nextAction'>>) {
    // The select stays enabled (disabling it would drop focus); one change at a time.
    if (busy) return;
    const item = (await send(`oj/applications/${a.id}`, body))?.item;
    if (!item) return null;
    put(item);
    // An open edit form for this card would otherwise save the old values back.
    setForm((f) => (f && f.id === item.id ? { ...f, stage: item.stage, nextAction: item.nextAction, next: toForm(item).next } : f));
    // A moved card is rendered in another column, a used hint button is gone: the card's stage select takes the focus.
    setRefocus(`[data-id="${item.id}"] select`);
    return item;
  }
  const openRetro = (id: string, stage?: 'phone' | 'onsite') => {
    setRetroFor({ id, stage });
    setRefocus('.tracker-retro select');
  };
  async function move(a: Application, stage: Stage) {
    const item = await update(a, { stage });
    // Moved on from a phone screen or onsite (not withdrawn: a booked round may never have happened):
    // that round's retro, unless one was written since the card got there (a retro's note id is its
    // creation time in base 36).
    const from = a.stage;
    if (
      item &&
      (from === 'phone' || from === 'onsite') &&
      STAGES.indexOf(stage) > STAGES.indexOf(from) &&
      stage !== 'withdrawn' &&
      !retros.some((r) => r.card === a.id && parseInt(r.target.slice(r.target.indexOf('/') + 1), 36) >= stageSince(a))
    )
      openRetro(a.id, from);
  }
  async function remove(id: string) {
    if (!window.confirm(t('删除这条投递记录？', 'Delete this application?'))) return;
    if (await send(`oj/applications/${id}/delete`, {})) {
      setItems((list) => (list ?? []).filter((a) => a.id !== id));
      close(ADD);
    }
  }
  const set = (patch: Partial<Form>) => setForm((f) => f && { ...f, ...patch });

  if (!items) return <p className="visa-empty">{t('正在读取投递记录…', 'Loading your applications…')}</p>;
  const f = funnel(items);
  const rate = (n: number) => (f.applied ? `${Math.round((100 * n) / f.applied)}%` : '—');
  const events = calendarItems(items, now).length;
  // Follow-ups due by the end of today, overdue ones first.
  const day = new Date(now),
    tonight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const today = items.filter((a) => followUpOpen(a) && a.nextAt! < tonight).sort((x, y) => x.nextAt! - y.nextAt!);
  const retroCard = retroFor && items.find((a) => a.id === retroFor.id);
  return (
    <div className="tracker">
      <dl className="tracker-summary">
        <div>
          <dt>{t('已投递', 'Applied')}</dt>
          <dd>{f.applied}</dd>
        </div>
        <div>
          <dt>{t('OA 率', 'OA rate')}</dt>
          <dd>{rate(f.oa)}</dd>
        </div>
        <div>
          <dt>{t('面试率', 'Interview rate')}</dt>
          <dd>{rate(f.interview)}</dd>
        </div>
        <div>
          <dt>Offer</dt>
          <dd>{f.offers}</dd>
        </div>
      </dl>
      <div className="resume-actions">
        <button type="button" data-add onClick={() => setForm(toForm())} disabled={busy}>
          {t('添加投递', 'Add application')}
        </button>
        <button
          type="button"
          className="is-quiet"
          disabled={!items.length}
          onClick={() => download('cswork-applications.csv', 'text/csv;charset=utf-8', applicationsCsv(items, !zh))}
        >
          {t('导出 CSV', 'Export CSV')}
        </button>
        <button
          type="button"
          className="is-quiet"
          disabled={!events}
          onClick={() => download('cswork-applications.ics', 'text/calendar', applicationsIcs(items, location.origin, !zh))}
        >
          {t('导出日历', 'Export calendar (.ics)')}
        </button>
        <small>
          {t(
            '包含 OA 截止（提前 1 天和 2 小时提醒）、面试（提前 1 小时）、跟进事项和 offer 截止（提前 3 天和 1 天）。',
            'OA deadlines (reminded a day and two hours before), interviews (an hour before), follow-ups and offer deadlines (3 days and a day before).',
          )}
        </small>
      </div>
      {today.length > 0 && (
        <section className="tracker-today" aria-labelledby="tracker-today">
          <h2 id="tracker-today">
            {t('今天要跟进', 'Follow up today')} <span>{today.length}</span>
          </h2>
          <ul>
            {today.map((a) => (
              <li key={a.id}>
                <strong>{a.company}</strong> {a.nextAction || t('跟进一下进度', 'Check in on progress')}{' '}
                <small>{a.nextAt! < now ? t(`已过期 · ${localStamp(a.nextAt)}`, `Overdue · ${localStamp(a.nextAt)}`) : localStamp(a.nextAt)}</small>
                <button type="button" disabled={busy} onClick={() => update(a, { nextAt: null, nextAction: '' })}>
                  {t('完成', 'Done')}
                  <span className="sr-only"> {a.company}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {items.length > 0 && <WarmupHints items={items} now={now} zh={zh} />}
      {items.length > 0 && <SchedulePanel items={items} now={now} zh={zh} />}
      {items.length > 0 && <TrackerStats items={items} now={now} zh={zh} />}
      {error && (
        <p className="resume-error" role="alert">
          {error}
        </p>
      )}

      {form && (
        <form ref={formRef} className="resume-form visa-form" onSubmit={save} aria-label={form.id ? t('编辑投递', 'Edit application') : t('添加投递', 'Add application')}>
          <fieldset>
            <legend>{form.id ? t('编辑投递', 'Edit application') : t('添加投递', 'Add application')}</legend>
            <label>
              {t('公司', 'Company')}
              <input
                required
                maxLength={100}
                list="tracker-companies"
                autoComplete="off"
                value={form.company}
                onChange={(e) => set({ company: e.target.value })}
              />
            </label>
            <datalist id="tracker-companies">
              {companies.map((c) => (
                <option key={c.slug} value={c.name} />
              ))}
            </datalist>
            <label>
              {t('岗位', 'Role')}
              <input maxLength={120} value={form.role} onChange={(e) => set({ role: e.target.value })} />
            </label>
            <label>
              {t('阶段', 'Stage')}
              <select value={form.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_NAMES[s][zh ? 0 : 1]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('档位', 'Tier')} <small>{t('先面练手，再面梦想', 'practice first, dream last')}</small>
              <select value={form.tier} onChange={(e) => set({ tier: e.target.value })}>
                <option value="">{t('未分档', 'Not set')}</option>
                {Object.entries(TIERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v[zh ? 0 : 1]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('投递日期', 'Applied on')}
              <input type="date" value={form.applied} onChange={(e) => set({ applied: e.target.value })} />
            </label>
            <label>
              {t('OA 截止', 'OA deadline')}
              <input type="datetime-local" value={form.oa} onChange={(e) => set({ oa: e.target.value })} />
            </label>
            <label>
              {t('面试时间', 'Interview')}
              <input type="datetime-local" value={form.interview} onChange={(e) => set({ interview: e.target.value })} />
            </label>
            {form.stage === 'offer' && (
              <label>
                {t('Offer 截止', 'Offer deadline')}
                <input type="datetime-local" value={form.offer} onChange={(e) => set({ offer: e.target.value })} />
              </label>
            )}
            <label>
              {t('渠道', 'Channel')}
              <select value={form.channel} onChange={(e) => set({ channel: e.target.value })}>
                <option value="">{t('未填', 'Not set')}</option>
                {Object.entries(SOURCES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v[zh ? 0 : 1]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('内推状态', 'Referral status')}
              <select value={form.referralStatus} onChange={(e) => set({ referralStatus: e.target.value })}>
                <option value="">{t('不走内推', 'No referral')}</option>
                {Object.entries(REFERRAL_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v[zh ? 0 : 1]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('内推人', 'Referrer')} <small>{t('选填', 'optional')}</small>
              <input maxLength={120} value={form.referral} onChange={(e) => set({ referral: e.target.value })} />
            </label>
            <label>
              {t('职位链接', 'Job link')} <small>https://</small>
              <input type="url" maxLength={500} value={form.link} onChange={(e) => set({ link: e.target.value })} />
            </label>
            <label>
              {t('简历版本', 'Resume version')} <small>{t('选填', 'optional')}</small>
              <input maxLength={40} list="tracker-resumes" autoComplete="off" value={form.resume} onChange={(e) => set({ resume: e.target.value })} />
            </label>
            <datalist id="tracker-resumes">
              {versions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <label>
              {t('下一步', 'Next step')} <small>{t('例如：给招聘方发邮件', 'e.g. email the recruiter')}</small>
              <input maxLength={120} value={form.nextAction} onChange={(e) => set({ nextAction: e.target.value })} />
            </label>
            <label>
              {t('跟进时间', 'Follow up on')}
              <input type="datetime-local" value={form.next} onChange={(e) => set({ next: e.target.value })} />
            </label>
            <label className="tracker-notes">
              {t('备注', 'Notes')}{' '}
              <small>
                {form.notes.length}/{NOTES_MAX}
              </small>
              <textarea rows={3} maxLength={NOTES_MAX} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            <label className="tracker-notes">
              {t('职位描述', 'Job description')}{' '}
              <small>
                {form.jd === null
                  ? t('正在读取…', 'Loading…')
                  : `${form.jd.length}/${JD_MAX} · ${t('只有你能看到，岗位下线后也能回看', 'only you see it; still here after the posting closes')}`}
              </small>
              <textarea
                rows={4}
                maxLength={JD_MAX}
                disabled={form.jd === null}
                value={form.jd ?? ''}
                onChange={(e) => set({ jd: e.target.value })}
              />
            </label>
          </fieldset>
          <div className="resume-actions">
            <button type="submit" disabled={busy}>
              {t('保存', 'Save')}
            </button>
            <button type="button" className="is-quiet" onClick={() => close()}>
              {t('取消', 'Cancel')}
            </button>
            {form.id && (
              <button type="button" className="is-quiet" disabled={busy} onClick={() => remove(form.id!)}>
                {t('删除', 'Delete')}
              </button>
            )}
          </div>
        </form>
      )}

      {retroCard && (
        <RetroPanel
          key={`${retroCard.id}:${retroFor?.stage ?? ''}`}
          a={retroCard}
          rounds={retros.filter((r) => r.card === retroCard.id)}
          stage={retroFor?.stage}
          now={now}
          zh={zh}
          onChange={(entry, removed) =>
            setRetros((list) => [...(removed ? [] : [entry]), ...list.filter((r) => r.target !== entry.target)])
          }
          onClose={() => {
            // Back to the card's Retros button, or its Edit button when it has none.
            const card = `[data-id="${retroCard.id}"]`;
            setRetroFor(null);
            setRefocus(document.querySelector(`${card} [data-retro]`) ? `${card} [data-retro]` : `${card} .tracker-card-actions button`);
          }}
        />
      )}

      {items.length ? (
        <div className="tracker-board">
          {STAGES.map((stage) => {
            const list = items.filter((a) => a.stage === stage);
            if (stage === 'saved') list.sort((x, y) => (TIER_ORDER[x.tier] ?? 2) - (TIER_ORDER[y.tier] ?? 2));
            return (
              <section
                key={stage}
                className="tracker-column"
                aria-labelledby={`tracker-${stage}`}
                data-stage={stage}
                data-empty={list.length ? undefined : ''}
              >
                <h2 id={`tracker-${stage}`}>
                  {STAGE_NAMES[stage][zh ? 0 : 1]} <span>{list.length}</span>
                </h2>
                <ul>
                  {list.map((a) => {
                    const open = oaOpen(a);
                    const left = open ? countdown(a.oaDeadline!, now, !zh) : null;
                    // At the Offer stage, never with an open OA (lib/applications.ts OA_OPEN).
                    const offer = offerOpen(a);
                    const offerLeft = offer ? countdown(a.offerDeadline!, now, !zh) : null;
                    const soon = (left && a.oaDeadline! - now < SOON) || (offerLeft && a.offerDeadline! - now < SOON);
                    const quiet = stale(a, now) ? Math.floor((now - stageSince(a)) / DAY) : 0;
                    const interviewed = a.interviewAt !== null && a.interviewAt < now;
                    const rounds = retros.filter((r) => r.card === a.id);
                    // Only while it is fresh (older ones keep the Retros button). A retro's time is to the
                    // minute (datetime-local), the interview's may not be.
                    const retroDue =
                      interviewed && now - a.interviewAt! < 14 * DAY && a.stage !== 'withdrawn' && !rounds.some((r) => r.at + 60000 > a.interviewAt!);
                    const retroable = rounds.length > 0 || INTERVIEWED.includes(a.stage) || a.stageLog.some(([s]) => INTERVIEWED.includes(s));
                    // An OA or interview still ahead gets a sprint in the study plan (components/study-plan.tsx).
                    const sprint = agenda([a], now).some((e) => e.kind === 'oa' || e.kind === 'interview');
                    return (
                      <li key={a.id} className="tracker-card" data-id={a.id} data-due={soon ? 'soon' : undefined}>
                        <p className="tracker-company">
                          {a.company}
                          {TIERS[a.tier] && (
                            <>
                              {' '}
                              <span className="tracker-tier" data-tier={a.tier}>
                                {TIERS[a.tier][zh ? 0 : 1]}
                              </span>
                            </>
                          )}
                        </p>
                        {a.role && <p className="tracker-role">{a.role}</p>}
                        {open && (
                          <p className="tracker-due">
                            <time dateTime={new Date(a.oaDeadline!).toISOString()}>
                              {left ? t(`OA 还剩 ${left}`, `OA due in ${left}`) : t('OA 已截止', 'OA deadline passed')}
                            </time>
                          </p>
                        )}
                        {offer && (
                          <p className="tracker-due">
                            <time dateTime={new Date(a.offerDeadline!).toISOString()}>
                              {offerLeft ? t(`Offer 还剩 ${offerLeft}`, `Offer expires in ${offerLeft}`) : t('Offer 已截止', 'Offer deadline passed')}
                            </time>
                            {offerLeft && (
                              <>
                                {' '}
                                <a href={`/career/templates?template=extension&application=${encodeURIComponent(a.id)}`}>
                                  {t('申请延期', 'Ask for more time')}
                                  <span className="sr-only"> {a.company}</span>
                                </a>
                              </>
                            )}
                          </p>
                        )}
                        {a.interviewAt !== null && (
                          <p className="tracker-role">
                            {t('面试', 'Interview')} {localStamp(a.interviewAt)}
                          </p>
                        )}
                        {a.nextAt !== null && (
                          <p className="tracker-next" data-due={a.nextAt < tonight ? '' : undefined}>
                            {t('跟进', 'Follow up')} {localStamp(a.nextAt)}
                            {a.nextAction && ` · ${a.nextAction}`}
                          </p>
                        )}
                        {a.closedAt !== null && (
                          <p className="tracker-closed">
                            {t(`岗位已下线（${localStamp(a.closedAt, false)} 最后一次在招）`, `Posting closed (last listed ${localStamp(a.closedAt, false)})`)}
                          </p>
                        )}
                        {quiet > 0 && (
                          <p className="tracker-hint">
                            {t(`可能已被搁置：${quiet} 天没有进展`, `Possibly ghosted: no news for ${quiet} days`)}{' '}
                            <button type="button" disabled={busy} onClick={() => move(a, 'ghosted')}>
                              {t('标记为无回音', 'Mark as no response')}
                              <span className="sr-only"> {a.company}</span>
                            </button>
                          </p>
                        )}
                        {followUpDue(a, now) && (
                          <p className="tracker-hint">
                            {t('投递一周还没消息，建议跟进一次', 'A week without news: worth a follow-up')}{' '}
                            <button type="button" disabled={busy} onClick={() => update(a, { nextAt: tomorrowMorning(now) })}>
                              {t('明天提醒我', 'Remind me tomorrow')}
                              <span className="sr-only"> {a.company}</span>
                            </button>
                          </p>
                        )}
                        {retroDue && (
                          <p className="tracker-hint">
                            {t('面试已经结束，趁记得清楚写个复盘', 'The interview is over: write a retro while it is fresh')}{' '}
                            <button type="button" onClick={() => openRetro(a.id)}>
                              {t('写复盘', 'Write a retro')}
                              <span className="sr-only"> {a.company}</span>
                            </button>
                          </p>
                        )}
                        {(a.links?.oa || a.links?.mock || a.link || a.prep || interviewed || sprint) && (
                          <p className="tracker-links">
                            {a.links?.oa && <a href={a.links.oa}>{t('这家的 OA 真题', 'Its OA problems')}</a>}
                            {a.links?.mock && <a href={a.links.mock}>{t('模拟 OA', 'Mock OA')}</a>}
                            {a.prep?.experiences && (
                              <a href={a.prep.experiences.href}>
                                {t(`面经 ${a.prep.experiences.n} 篇`, `${a.prep.experiences.n} interview ${a.prep.experiences.n === 1 ? 'experience' : 'experiences'}`)}
                              </a>
                            )}
                            {a.prep && <a href={a.prep.problems}>{t('这家的高频题', 'Its most reported problems')}</a>}
                            {interviewed && <a href={writeUpHref(a)}>{t('写这场面经', 'Write up this interview')}</a>}
                            {/* oxlint-disable-next-line next/no-html-link-for-pages -- the SPA's bank view, where the plan lives. */}
                            {sprint && <a href="/?view=problems">{t('冲刺计划', 'Sprint plan')}</a>}
                            {a.link && (
                              <a href={a.link} rel="noopener noreferrer">
                                {t('职位', 'Posting')}
                              </a>
                            )}
                          </p>
                        )}
                        <CardMore key={a.updatedAt} a={a} zh={zh} now={now} />
                        <div className="tracker-card-actions">
                          <select
                            aria-label={t(`${a.company} 的阶段`, `Stage of ${a.company}`)}
                            value={a.stage}
                            onChange={(e) => move(a, e.target.value as Stage)}
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {STAGE_NAMES[s][zh ? 0 : 1]}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setForm(toForm(a))}>
                            {t('编辑', 'Edit')}
                            <span className="sr-only"> {a.company}</span>
                          </button>
                          {retroable && (
                            <button type="button" data-retro onClick={() => openRetro(a.id)}>
                              {t(`复盘 (${rounds.length})`, `Retros (${rounds.length})`)}
                              <span className="sr-only"> {a.company}</span>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        !form && (
          <p className="visa-empty">
            {t('还没有投递记录。点「添加投递」记下第一家。', 'No applications yet. Use “Add application” to track the first one.')}
          </p>
        )
      )}
    </div>
  );
}
