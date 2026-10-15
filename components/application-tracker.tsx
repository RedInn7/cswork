'use client';
import { useEffect, useRef, useState } from 'react';
import {
  applicationsCsv,
  countdown,
  deadlinesIcs,
  funnel,
  httpsLink,
  localStamp,
  NOTES_MAX,
  oaOpen,
  STAGE_NAMES,
  STAGES,
  type Application,
  type Stage,
} from '@/lib/applications';
import { api } from '@/lib/types';

const ADD = '.tracker [data-add]';
type Form = {
  id: string | null;
  company: string;
  role: string;
  stage: Stage;
  applied: string;
  oa: string;
  interview: string;
  referral: string;
  link: string;
  notes: string;
};
const toForm = (a?: Application): Form => ({
  id: a?.id ?? null,
  company: a?.company ?? '',
  role: a?.role ?? '',
  stage: a?.stage ?? 'applied',
  applied: localStamp(a?.appliedAt ?? null, false),
  oa: localStamp(a?.oaDeadline ?? null).replace(' ', 'T'),
  interview: localStamp(a?.interviewAt ?? null).replace(' ', 'T'),
  referral: a?.referral ?? '',
  link: a?.link ?? '',
  notes: a?.notes ?? '',
});
// Input values are local times; a bare date would parse as UTC, so it gets a local midnight.
const fromInput = (value: string) => (value ? new Date(value.includes('T') ? value : `${value}T00:00`).getTime() : null);
const SOON = 48 * 3600000;

function download(name: string, type: string, text: string) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No Blob URLs here (an old browser or a sandbox): nothing to download.
  }
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
  const formRef = useRef<HTMLFormElement>(null);
  const editing = form && (form.id ?? '');
  useEffect(() => {
    let live = true;
    api<{ items: Application[] }>('oj/applications').then(
      (r) => live && setItems(r.items),
      (e: unknown) => live && (setItems([]), setError(e instanceof Error ? e.message : String(e))),
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
  useEffect(() => {
    if (editing !== null) formRef.current?.querySelector('input')?.focus();
  }, [editing]);
  const close = (to: string | null = form?.id ? `[data-id="${form.id}"] .tracker-card-actions button` : ADD) => {
    setRefocus(to);
    setForm(null);
  };

  const put = (item: Application) => setItems((list) => [item, ...(list ?? []).filter((a) => a.id !== item.id)]);
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
      referral: form.referral,
      link,
      notes: form.notes,
    });
    if (r?.item) {
      put(r.item);
      close();
    }
  }
  async function move(a: Application, stage: Stage) {
    // The select stays enabled (disabling it would drop focus); one move at a time.
    if (busy) return;
    const item = (await send(`oj/applications/${a.id}`, { stage }))?.item;
    if (!item) return;
    put(item);
    // An open edit form for this card would otherwise save its old stage back.
    setForm((f) => (f && f.id === item.id ? { ...f, stage: item.stage } : f));
    // A moved card is rendered in another column: give its stage select the focus back.
    setRefocus(`[data-id="${item.id}"] select`);
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
  const deadlines = items.filter((a) => oaOpen(a) && a.oaDeadline! > now).length;
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
          disabled={!deadlines}
          onClick={() =>
            download('cswork-oa-deadlines.ics', 'text/calendar', deadlinesIcs(items, location.origin, !zh))
          }
        >
          {t('导出 OA 截止日历', 'Export OA deadlines (.ics)')}
        </button>
        <small>{t('日历会在截止前 1 天和 2 小时提醒你。', 'Your calendar reminds you a day and two hours before each deadline.')}</small>
      </div>
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
            <label>
              {t('内推', 'Referral')} <small>{t('内推人或渠道，选填', 'Who referred you, optional')}</small>
              <input maxLength={120} value={form.referral} onChange={(e) => set({ referral: e.target.value })} />
            </label>
            <label>
              {t('职位链接', 'Job link')} <small>https://</small>
              <input type="url" maxLength={500} value={form.link} onChange={(e) => set({ link: e.target.value })} />
            </label>
            <label className="tracker-notes">
              {t('备注', 'Notes')}{' '}
              <small>
                {form.notes.length}/{NOTES_MAX}
              </small>
              <textarea rows={3} maxLength={NOTES_MAX} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
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

      {items.length ? (
        <div className="tracker-board">
          {STAGES.map((stage) => {
            const list = items.filter((a) => a.stage === stage);
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
                    return (
                      <li key={a.id} className="tracker-card" data-id={a.id} data-due={open && left && a.oaDeadline! - now < SOON ? 'soon' : undefined}>
                        <p className="tracker-company">{a.company}</p>
                        {a.role && <p className="tracker-role">{a.role}</p>}
                        {open && (
                          <p className="tracker-due">
                            <time dateTime={new Date(a.oaDeadline!).toISOString()}>
                              {left ? t(`OA 还剩 ${left}`, `OA due in ${left}`) : t('OA 已截止', 'OA deadline passed')}
                            </time>
                          </p>
                        )}
                        {a.interviewAt !== null && (
                          <p className="tracker-role">
                            {t('面试', 'Interview')} {localStamp(a.interviewAt)}
                          </p>
                        )}
                        {(a.links?.oa || a.links?.mock || a.link) && (
                          <p className="tracker-links">
                            {a.links?.oa && <a href={a.links.oa}>{t('这家的 OA 真题', 'Its OA problems')}</a>}
                            {a.links?.mock && <a href={a.links.mock}>{t('模拟 OA', 'Mock OA')}</a>}
                            {a.link && (
                              <a href={a.link} rel="noopener noreferrer">
                                {t('职位', 'Posting')}
                              </a>
                            )}
                          </p>
                        )}
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
