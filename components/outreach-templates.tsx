'use client';
import { useEffect, useState } from 'react';
import { localStamp, type Application } from '@/lib/applications';
import {
  fillTemplate,
  OUTREACH_TEMPLATES,
  PLACEHOLDERS,
  placeholdersIn,
  type Placeholder,
} from '@/lib/content/outreach-templates';
import type { Contact } from '@/lib/server/contacts';
import { api } from '@/lib/types';
import '@/app/career-outreach.css';

type Values = Partial<Record<Placeholder, string>>;
const MY_NAME = 'cswork:outreach:my-name';
/** Still to write: an unfilled {placeholder} or a [bracketed] hint. */
const BLANKS = /(\{\w+\}|\[[^\]\n]+\])/;

/**
 * What a tracker card or a contact (with the card it is linked to) fills in; `offerId`, a card
 * holding an offer, fills in the other company and its deadline (the tracker's expedite plan).
 */
function valuesFrom(source: string, applications: Application[], contacts: Contact[], offerId = ''): Values | null {
  const [kind, id] = [source.slice(0, 2), source.slice(2)];
  const contact = kind === 'c:' ? contacts.find((c) => c.id === id) : undefined;
  const card = applications.find((a) => a.id === (kind === 'a:' ? id : contact?.applicationId));
  if (!card && !contact) return null;
  const offer = offerId ? applications.find((a) => a.id === offerId) : undefined;
  return {
    ...(contact && { name: contact.name }),
    company: contact?.company || card?.company || '',
    role: card?.role ?? '',
    interviewDate: localStamp(card?.interviewAt ?? null, false),
    ...(card?.offerDeadline != null && { deadline: localStamp(card.offerDeadline, false) }),
    ...(offer && { otherCompany: offer.company, deadline: localStamp(offer.offerDeadline, false) }),
  };
}

/** /career/templates: pick a message, fill it in from a card, a contact or by hand, then copy or open it in a mail app. */
export function OutreachTemplates({ zh, signedIn }: { zh: boolean; signedIn: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const [id, setId] = useState(OUTREACH_TEMPLATES[0].id);
  // The message's language, which may differ from the site's.
  const [lang, setLang] = useState<'zh' | 'en'>(zh ? 'zh' : 'en');
  const msgLang = lang === 'zh' ? 'zh-CN' : 'en';
  const [values, setValues] = useState<Values>({});
  const [applications, setApplications] = useState<Application[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    let live = true;
    // ?template=<id>, and ?contact=<id> or ?application=<id> from the contacts page and the guide,
    // with ?offer=<id> from the tracker's expedite plan.
    const query = new URLSearchParams(location.search);
    const wanted = query.get('template');
    if (OUTREACH_TEMPLATES.some((x) => x.id === wanted)) setId(wanted!);
    try {
      const myName = localStorage.getItem(MY_NAME);
      if (myName) setValues((v) => ({ ...v, myName }));
    } catch {}
    if (!signedIn) return;
    const from = query.get('contact') ? `c:${query.get('contact')}` : query.get('application') ? `a:${query.get('application')}` : '';
    void Promise.all([
      api<{ items: Application[] }>('oj/applications').then((r) => r.items, () => []),
      api<{ items: Contact[] }>('oj/contacts').then((r) => r.items, () => []),
    ]).then(([a, c]) => {
      if (!live) return;
      setApplications(a);
      setContacts(c);
      const filled = from && valuesFrom(from, a, c, query.get('offer') ?? '');
      if (!filled) return;
      setSource(from);
      setValues((v) => ({ ...v, ...filled }));
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  const template = OUTREACH_TEMPLATES.find((x) => x.id === id)!;
  const text = template[lang];
  const subject = fillTemplate(text.subject, values);
  const body = fillTemplate(text.body, values);
  const fields = placeholdersIn(`${text.subject}\n${text.body}`) as Placeholder[];
  const pick = (next: string) => {
    setSource(next);
    const filled = valuesFrom(next, applications, contacts);
    if (filled) setValues((v) => ({ ...v, ...filled }));
  };
  const edit = (key: Placeholder, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key !== 'myName') return;
    try {
      localStorage.setItem(MY_NAME, value);
    } catch {}
  };
  const copy = async (what: string, label: string) => {
    try {
      await navigator.clipboard.writeText(what);
      setStatus(t(`已复制${label}。`, `${label} copied.`));
    } catch {
      setStatus(t('无法自动复制，请在预览里选中文字手动复制。', 'Couldn’t copy automatically. Select the text in the preview and copy it.'));
    }
  };
  const marked = (value: string) =>
    value.split(BLANKS).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
  return (
    <div className="outreach">
      <fieldset className="outreach-picker">
        <legend>{t('选择模板', 'Choose a template')}</legend>
        {OUTREACH_TEMPLATES.map((x) => (
          <label key={x.id}>
            <input type="radio" name="outreach-template" value={x.id} checked={x.id === id} onChange={() => setId(x.id)} />
            <span>{x.title[zh ? 0 : 1]}</span>
          </label>
        ))}
      </fieldset>
      <p className="outreach-tip">
        {template.tip[zh ? 0 : 1]}
        {template.offer && (
          <>
            {' '}
            <a href="/career/offers">
              {t('先在 offer 对比里算清几份 offer 的四年总额 →', 'Compare your offers’ four-year totals first →')}
            </a>
          </>
        )}
      </p>

      <form className="resume-form visa-form" onSubmit={(e) => e.preventDefault()} aria-label={t('填写模板', 'Fill in the template')}>
        <fieldset>
          <legend>{t('填写', 'Fill in')}</legend>
          <label>
            {t('邮件语言', 'Message language')}
            <select value={lang} onChange={(e) => setLang(e.target.value as 'zh' | 'en')}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {signedIn ? (
            <label>
              {t('从投递卡或联系人填写', 'Fill from a card or contact')}
              <select value={source} onChange={(e) => pick(e.target.value)}>
                <option value="">{t('手动填写', 'Type it in')}</option>
                {applications.length > 0 && (
                  <optgroup label={t('投递卡', 'Applications')}>
                    {applications.map((a) => (
                      <option key={a.id} value={`a:${a.id}`}>
                        {a.company}
                        {a.role ? ` · ${a.role}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {contacts.length > 0 && (
                  <optgroup label={t('联系人', 'Contacts')}>
                    {contacts.map((c) => (
                      <option key={c.id} value={`c:${c.id}`}>
                        {c.name}
                        {c.company ? ` · ${c.company}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          ) : (
            <p className="outreach-signin">
              {t('登录后可以直接用投递卡或联系人填写。', 'Sign in to fill these in from your applications or contacts.')}{' '}
              <a href="/?view=account">{t('登录', 'Sign in')}</a>
            </p>
          )}
          {fields.map((key) => (
            <label key={key}>
              {PLACEHOLDERS[key][zh ? 0 : 1]}
              <input maxLength={120} autoComplete="off" value={values[key] ?? ''} onChange={(e) => edit(key, e.target.value)} />
            </label>
          ))}
        </fieldset>
      </form>

      <section className="outreach-preview" aria-labelledby="outreach-preview-title">
        <h2 id="outreach-preview-title">{t('预览', 'Preview')}</h2>
        <p className="outreach-subject">
          <strong>{t('主题：', 'Subject: ')}</strong>
          <span lang={msgLang}>{marked(subject)}</span>
        </p>
        <div className="outreach-body" lang={msgLang}>{marked(body)}</div>
        <small>
          {t('高亮的部分还要你自己填写或改写。', 'Highlighted parts are still yours to fill in or rewrite.')}
        </small>
      </section>
      <div className="resume-actions">
        <button type="button" onClick={() => void copy(body, t('正文', 'Body'))}>
          {t('复制正文', 'Copy body')}
        </button>
        <button type="button" className="is-quiet" onClick={() => void copy(subject, t('主题', 'Subject'))}>
          {t('复制主题', 'Copy subject')}
        </button>
        <a className="outreach-mailto" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
          {t('在邮件应用中打开', 'Open in your mail app')}
        </a>
        <output aria-live="polite">{status}</output>
      </div>
    </div>
  );
}
