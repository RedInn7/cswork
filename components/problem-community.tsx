'use client';
import { useEffect, useId, useState } from 'react';
import { ListPlus, MessageSquareQuote } from 'lucide-react';
import { employerSlug } from '@/lib/oa-company-brands';
import { api } from '@/lib/types';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from './ui/popover';
import '@/app/learner-cloud.css';

type T = (zh: string, en: string) => string;
type MenuList = { id: string; title: string; count: number; has: boolean; visibility: string };
export type ReportSummary = {
  problemId: string;
  months: number;
  total: number;
  last: string | null;
  companies: { slug: string; name: string; n: number }[];
  mine: { month: string; company: string; round: string }[];
};
const ROUNDS: [string, string, string][] = [
  ['oa', 'OA', 'OA'],
  ['phone', '电面', 'Phone screen'],
  ['onsite', 'VO / 现场', 'Onsite / VO'],
];
const monthOf = (time: number) => new Date(time).toISOString().slice(0, 7);
/** Answers are shown only when they have the summary's shape. */
const isSummary = (s: Partial<ReportSummary> | null | undefined): s is ReportSummary =>
  typeof s?.total === 'number' && Array.isArray(s.companies) && Array.isArray(s.mine);

/** The star row's "add to list": the learner's lists with a tick where this problem is in. */
export function ListMenu({ problemId, english }: { problemId: string; english: boolean }) {
  const t: T = (zh, en) => (english ? en : zh);
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MenuList[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    api<{ items: MenuList[] }>(`oj/lists?problem=${encodeURIComponent(problemId)}`).then(
      (r) => live && setLists(Array.isArray(r.items) ? r.items : []),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [open, problemId]);
  async function toggle(list: MenuList) {
    const on = !list.has;
    const flip = (has: boolean) =>
      setLists((all) =>
        all?.map((l) => (l.id === list.id ? { ...l, has, count: l.count + (has ? 1 : -1) } : l)) ?? all,
      );
    flip(on);
    setError('');
    try {
      await api(`oj/lists/${list.id}/items`, { problemId, on });
    } catch (e) {
      flip(!on);
      setError((e as Error).message);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const made = await api<{ id: string; title: string; visibility: string; items: unknown[] }>('oj/lists', {
        title: title.trim(),
        problemIds: [problemId],
      });
      setLists((all) => [
        { id: made.id, title: made.title, visibility: made.visibility, count: made.items.length, has: true },
        ...(all ?? []),
      ]);
      setTitle('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const inAny = !!lists?.some((l) => l.has);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="cs-mark"
        data-mark="list"
        data-on={inAny || undefined}
        aria-label={t('加入题单', 'Add to a list')}
        title={t('加入题单', 'Add to a list')}
      >
        <ListPlus size={17} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="cloud-pop">
        <PopoverTitle className="cloud-pop-title">{t('加入题单', 'Add to a list')}</PopoverTitle>
        {lists === null && !error ? (
          <p className="cloud-pop-note">{t('正在加载…', 'Loading…')}</p>
        ) : lists?.length ? (
          <ul className="cloud-pop-lists">
            {lists.map((l) => (
              <li key={l.id}>
                <label>
                  <input type="checkbox" checked={l.has} onChange={() => void toggle(l)} />
                  <span>{l.title}</span>
                  <small>
                    {l.count}
                    {l.visibility === 'public' ? t(' · 公开', ' · public') : ''}
                  </small>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          lists && <p className="cloud-pop-note">{t('还没有题单，建一个吧。', 'No lists yet. Start one.')}</p>
        )}
        <form className="cloud-pop-new" onSubmit={(e) => void create(e)}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={t('新题单名称', 'New list name')}
            aria-label={t('新题单名称', 'New list name')}
          />
          <button type="submit" disabled={busy || !title.trim()}>
            {t('新建并加入', 'Create')}
          </button>
        </form>
        {error && (
          <p className="cloud-pop-error" role="alert">
            {error}
          </p>
        )}
        <a className="cloud-pop-link" href="/?view=lists">
          {t('管理我的题单', 'Manage my lists')} →
        </a>
      </PopoverContent>
    </Popover>
  );
}

/** "最近被问 N 次" for a summary, or null when nobody reported it lately. */
export function askedLabel(total: number, t: T) {
  return total > 0 ? t(`最近被问 ${total} 次`, `Asked ${total}× lately`) : null;
}

/**
 * "I was asked this": the recent count on the star row, and a short form (company,
 * round, month). Reporters are never shown; the learner sees and can withdraw their own.
 */
export function AskedReport({ problemId, english }: { problemId: string; english: boolean }) {
  const t: T = (zh, en) => (english ? en : zh);
  // An OA problem preselects its own employer.
  const oaCompany = /^oa-(.+)-\d+$/.exec(problemId)?.[1];
  const suggested = oaCompany ? employerSlug(oaCompany) : '';
  const id = useId();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<{ slug: string; name: string }[] | null>(null);
  const [company, setCompany] = useState('');
  const [round, setRound] = useState('');
  const [month, setMonth] = useState(() => monthOf(Date.now()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let live = true;
    api<ReportSummary>(`oj/reports?problem=${encodeURIComponent(problemId)}`).then(
      (s) => live && isSummary(s) && setSummary(s),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [problemId]);
  useEffect(() => {
    if (!open || companies) return;
    api<{ items: { slug: string; name: string }[] }>('oj/reports/companies').then(
      (r) => {
        if (!Array.isArray(r.items)) return setCompanies([]);
        setCompanies(r.items);
        if (suggested && r.items.some((c) => c.slug === suggested)) setCompany((c) => c || suggested);
      },
      () => setCompanies([]),
    );
  }, [open, companies, suggested]);
  async function send(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      const next = await api<ReportSummary>(path, body);
      if (isSummary(next)) setSummary(next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const label = askedLabel(summary?.total ?? 0, t);
  const roundName = (value: string) => {
    const r = ROUNDS.find(([key]) => key === value);
    return r ? t(r[1], r[2]) : value;
  };
  const now = Date.now();
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDone(false);
      }}
    >
      <PopoverTrigger
        className="cs-asked"
        data-count={summary?.total || undefined}
        aria-label={
          label
            ? t(`我面试被问到过（${label}）`, `I was asked this (${label})`)
            : t('我面试被问到过', 'I was asked this')
        }
        title={t('我面试被问到过', 'I was asked this')}
      >
        <MessageSquareQuote size={16} aria-hidden="true" />
        {label && <span aria-hidden="true">{summary!.total}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="cloud-pop cloud-asked">
        <PopoverTitle className="cloud-pop-title">{t('我面试被问到过', 'I was asked this')}</PopoverTitle>
        <p className="cloud-pop-note">
          {summary && label
            ? t(
                `近 ${summary.months} 个月 ${summary.total} 位学员报告，最近一次 ${summary.last}。`,
                `${summary.total} learner${summary.total > 1 ? 's' : ''} reported it in the last ${summary.months} months, latest ${summary.last}.`,
              )
            : t('还没有人报告过。被问到过就告诉大家。', 'Nobody has reported it yet. Asked in an interview? Say so.')}
          {summary?.companies.length ? (
            <span className="cloud-asked-companies">
              {summary.companies.map((c) => `${c.name} ${c.n}`).join(' · ')}
            </span>
          ) : null}
        </p>
        {summary?.mine.length ? (
          <ul className="cloud-asked-mine" aria-label={t('你的报告', 'Your reports')}>
            {summary.mine.map((m) => (
              <li key={m.month}>
                <span>
                  {m.month}
                  {m.company ? ` · ${companies?.find((c) => c.slug === m.company)?.name ?? m.company}` : ''}
                  {m.round ? ` · ${roundName(m.round)}` : ''}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send('oj/reports/withdraw', { problemId, month: m.month })}
                >
                  {t('撤回', 'Withdraw')}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {done ? (
          <p className="cloud-pop-done" role="status">
            {t('已记录，谢谢！报告人不会公开。', "Thanks, it's recorded. Reporters are never shown.")}
          </p>
        ) : (
          <form
            className="cloud-asked-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send('oj/reports', {
                problemId,
                company: company || null,
                round: round || null,
                month,
              }).then((sent) => sent && setDone(true));
            }}
          >
            <label htmlFor={`${id}-company`}>{t('公司', 'Company')}</label>
            <select id={`${id}-company`} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">{t('不说 / 其他', 'Rather not say / other')}</option>
              {companies?.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <fieldset>
              <legend>{t('轮次', 'Round')}</legend>
              {ROUNDS.map(([value, zh, en]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`${id}-round`}
                    value={value}
                    checked={round === value}
                    onChange={() => setRound(value)}
                  />
                  {t(zh, en)}
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${id}-month`}>{t('面试月份', 'Month')}</label>
            <input
              id={`${id}-month`}
              type="month"
              required
              value={month}
              max={monthOf(now)}
              min={monthOf(now - 700 * 86400000)}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button type="submit" disabled={busy || !month}>
              {t('提交报告', 'Report')}
            </button>
          </form>
        )}
        {error && (
          <p className="cloud-pop-error" role="alert">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
