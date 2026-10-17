'use client';
import { useEffect, useRef, useState } from 'react';
import { httpsLink, localStamp, NOTES_MAX, type Application } from '@/lib/applications';
import type { Contact } from '@/lib/server/contacts';
import { api } from '@/lib/types';
import '@/app/career-outreach.css';

type Form = {
  id: string | null;
  name: string;
  company: string;
  role: string;
  howMet: string;
  url: string;
  last: string;
  next: string;
  notes: string;
  applicationId: string;
};
const toForm = (c?: Contact): Form => ({
  id: c?.id ?? null,
  name: c?.name ?? '',
  company: c?.company ?? '',
  role: c?.role ?? '',
  howMet: c?.howMet ?? '',
  url: c?.url ?? '',
  last: localStamp(c?.lastContactAt ?? null, false),
  next: localStamp(c?.nextAt ?? null, false),
  notes: c?.notes ?? '',
  applicationId: c?.applicationId ?? '',
});
// A bare date would parse as UTC: local midnight instead.
const fromDate = (value: string) => (value ? new Date(`${value}T00:00`).getTime() : null);
/** The start of tomorrow here: a follow-up dated before it is due. */
function tomorrow() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
const ADD = '.contacts [data-add]';

/** /career/contacts: the signed-in learner's job-search contacts, follow-ups due first. */
export function Contacts({ zh }: { zh: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const [items, setItems] = useState<Contact[] | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [company, setCompany] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refocus, setRefocus] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editing = form && (form.id ?? '');
  useEffect(() => {
    let live = true;
    api<{ items: Contact[] }>('oj/contacts').then(
      (r) => live && setItems(r.items),
      (e: unknown) => live && (setItems([]), setError(e instanceof Error ? e.message : String(e))),
    );
    // The cards a contact can be linked to.
    api<{ items: Application[] }>('oj/applications').then(
      (r) => live && setApplications(r.items),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!refocus) return;
    document.querySelector<HTMLElement>(refocus)?.focus();
    setRefocus(null);
  }, [refocus]);
  useEffect(() => {
    if (editing !== null) formRef.current?.querySelector('input')?.focus();
  }, [editing]);
  const close = (to: string | null = form?.id ? `[data-id="${form.id}"] .tracker-card-actions button` : ADD) => {
    setRefocus(to);
    setForm(null);
  };

  async function send(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      return await api<{ item?: Contact }>(path, body);
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
    const url = form.url.trim();
    if (url && !httpsLink(url)) return setError(t('链接需要以 https:// 开头', 'Links must start with https://'));
    const r = await send(form.id ? `oj/contacts/${form.id}` : 'oj/contacts', {
      name: form.name.trim(),
      company: form.company,
      role: form.role,
      howMet: form.howMet,
      url,
      lastContactAt: fromDate(form.last),
      nextAt: fromDate(form.next),
      notes: form.notes,
      applicationId: form.applicationId || null,
    });
    if (!r?.item) return;
    const item = r.item;
    setItems((list) => [item, ...(list ?? []).filter((c) => c.id !== item.id)]);
    close(`[data-id="${item.id}"] .tracker-card-actions button`);
  }
  async function remove(id: string) {
    if (!window.confirm(t('删除这个联系人？', 'Delete this contact?'))) return;
    if (await send(`oj/contacts/${id}/delete`, {})) {
      setItems((list) => (list ?? []).filter((c) => c.id !== id));
      close(ADD);
    }
  }
  const set = (patch: Partial<Form>) => setForm((f) => f && { ...f, ...patch });

  if (!items) return <p className="visa-empty">{t('正在读取联系人…', 'Loading your contacts…')}</p>;
  const end = tomorrow();
  const due = (c: Contact) => c.nextAt !== null && c.nextAt < end;
  const companies = [...new Set(items.map((c) => c.company).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  // Follow-ups due first, oldest first; then everyone else as last changed.
  const shown = items
    .filter((c) => !company || c.company === company)
    .sort((a, b) => Number(due(b)) - Number(due(a)) || (due(a) ? a.nextAt! - b.nextAt! : 0));
  const dueCount = items.filter(due).length;
  const card = (id: string | null) => applications.find((a) => a.id === id);
  return (
    <div className="contacts">
      <div className="resume-actions">
        <button type="button" data-add onClick={() => setForm(toForm())} disabled={busy}>
          {t('添加联系人', 'Add contact')}
        </button>
        {(companies.length > 1 || company) && (
          <label className="contacts-filter">
            {t('公司', 'Company')}
            <select value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">{t('全部', 'All')}</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <small>
          {dueCount
            ? t(`${dueCount} 位该跟进了，排在最前面。`, `${dueCount} to follow up, listed first.`)
            : t('设了跟进日期的联系人到期后会排在最前面。', 'Contacts whose follow-up date arrives move to the top.')}
        </small>
      </div>
      {error && (
        <p className="resume-error" role="alert">
          {error}
        </p>
      )}

      {form && (
        <form
          ref={formRef}
          className="resume-form visa-form"
          onSubmit={save}
          aria-label={form.id ? t('编辑联系人', 'Edit contact') : t('添加联系人', 'Add contact')}
        >
          <fieldset>
            <legend>{form.id ? t('编辑联系人', 'Edit contact') : t('添加联系人', 'Add contact')}</legend>
            <label>
              {t('姓名或称呼', 'Name')}
              <input required maxLength={100} autoComplete="off" value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label>
              {t('公司', 'Company')}
              <input
                maxLength={100}
                list="contacts-companies"
                autoComplete="off"
                value={form.company}
                onChange={(e) => set({ company: e.target.value })}
              />
            </label>
            <datalist id="contacts-companies">
              {[...new Set(applications.map((a) => a.company))].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <label>
              {t('对方的职位', 'Their role')}
              <input maxLength={120} value={form.role} onChange={(e) => set({ role: e.target.value })} />
            </label>
            <label>
              {t('怎么认识的', 'How you met')} <small>{t('比如校友、实习同事、招聘会', 'e.g. alumni, internship team, career fair')}</small>
              <input maxLength={200} value={form.howMet} onChange={(e) => set({ howMet: e.target.value })} />
            </label>
            <label>
              {t('主页链接', 'Profile link')} <small>https://</small>
              <input type="url" maxLength={500} value={form.url} onChange={(e) => set({ url: e.target.value })} />
            </label>
            <label>
              {t('上次联系', 'Last contact')}
              <input type="date" value={form.last} onChange={(e) => set({ last: e.target.value })} />
            </label>
            <label>
              {t('下次跟进', 'Next follow-up')}
              <input type="date" value={form.next} onChange={(e) => set({ next: e.target.value })} />
            </label>
            <label>
              {t('关联投递', 'Linked application')}
              <select value={form.applicationId} onChange={(e) => set({ applicationId: e.target.value })}>
                <option value="">{t('不关联', 'None')}</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company}
                    {a.role ? ` · ${a.role}` : ''}
                  </option>
                ))}
              </select>
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

      {shown.length ? (
        <ul className="contacts-list">
          {shown.map((c) => {
            const linked = card(c.applicationId);
            return (
              <li key={c.id} className="tracker-card" data-id={c.id} data-due={due(c) ? 'soon' : undefined}>
                <p className="tracker-company">{c.name}</p>
                {(c.role || c.company) && <p className="tracker-role">{[c.role, c.company].filter(Boolean).join(' · ')}</p>}
                {c.howMet && <p className="tracker-role">{c.howMet}</p>}
                {c.nextAt !== null && (
                  <p className={due(c) ? 'tracker-due' : 'tracker-role'}>
                    {due(c) ? t('该跟进了：', 'Follow up now: ') : t('下次跟进：', 'Next follow-up: ')}
                    <time dateTime={new Date(c.nextAt).toISOString()}>{localStamp(c.nextAt, false)}</time>
                  </p>
                )}
                {c.lastContactAt !== null && (
                  <p className="tracker-role">
                    {t('上次联系：', 'Last contact: ')}
                    {localStamp(c.lastContactAt, false)}
                  </p>
                )}
                {c.notes && <p className="contacts-notes">{c.notes}</p>}
                <p className="tracker-links">
                  {linked && (
                    <a href="/career/tracker">
                      {t('投递：', 'Application: ')}
                      {linked.company}
                    </a>
                  )}
                  {c.url && (
                    <a href={c.url} rel="noopener noreferrer">
                      {t('主页', 'Profile')}
                    </a>
                  )}
                  <a href={`/career/templates?contact=${encodeURIComponent(c.id)}`}>{t('写消息', 'Write a message')}</a>
                </p>
                <div className="tracker-card-actions">
                  <button type="button" onClick={() => setForm(toForm(c))}>
                    {t('编辑', 'Edit')}
                    <span className="sr-only"> {c.name}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !form && (
          <p className="visa-empty">
            {items.length
              ? t('这家公司还没有联系人。', 'No contacts at this company.')
              : t('还没有联系人。点「添加联系人」记下第一位。', 'No contacts yet. Use “Add contact” to record the first one.')}
          </p>
        )
      )}
    </div>
  );
}
