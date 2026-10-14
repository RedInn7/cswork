'use client';
import { useEffect, useRef, useState } from 'react';
import { PenLine, X } from 'lucide-react';
import { api } from '@/lib/types';
import { MEMBER_BODY, RESULTS, ROUND_LABELS } from '@/lib/experience';
import type { Navigate } from './learning';
import '@/app/learner-cloud.css';
import '@/app/experience-submissions.css';

type Mine = {
  id: string;
  slug: string;
  title: string;
  company: { slug: string; name: string };
  status: 'pending' | 'approved' | 'rejected';
  note: string;
  month: string;
  createdAt: number;
};
const STATUS: Record<Mine['status'], [string, string]> = {
  pending: ['审核中', 'In review'],
  approved: ['已发布', 'Published'],
  rejected: ['未通过', 'Not published'],
};
const ROLES = [
  'Software Engineer', 'Software Engineer Intern', 'Machine Learning Engineer', 'Data Scientist',
  'Data Engineer', 'Quant Researcher', 'Quant Developer', 'Product Manager', 'Site Reliability Engineer',
];
const QUESTIONS_MAX = 20;
const plain = (e: React.MouseEvent) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
const localMonth = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * My progress: the learner's interview experiences with their review status, and the form to
 * share one. `open` (?view=progress&tab=share) starts with the form open and scrolls to it.
 */
export function MyExperienceSubmissions({
  english,
  navigate,
  open = false,
}: {
  english: boolean;
  navigate: Navigate;
  open?: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [items, setItems] = useState<Mine[] | null>(null);
  const [writing, setWriting] = useState(open);
  const [error, setError] = useState('');
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    let live = true;
    api<{ items: Mine[] }>('oj/experiences/mine').then(
      (r) => live && setItems(Array.isArray(r.items) ? r.items : []),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (open) section.current?.scrollIntoView({ block: 'start' });
  }, [open]);
  async function withdraw(item: Mine) {
    if (!window.confirm(t(`撤回并删除「${item.title}」？`, `Withdraw and delete "${item.title}"?`))) return;
    setError('');
    try {
      await api(`oj/experiences/${encodeURIComponent(item.id)}/withdraw`, {});
      setItems((all) => all?.filter((i) => i.id !== item.id) ?? all);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section ref={section} className="cloud-mocks xs-mine" aria-labelledby="xs-mine-title">
      <div className="cloud-head">
        <h2 id="xs-mine-title">{t('我的面经投稿', 'My interview experiences')}</h2>
        <p>{t('老师审核后公开在面经列表和公司主页', 'Published to the experiences list and company pages after a teacher reviews them')}</p>
        {!writing && (
          <button type="button" className="xs-write" onClick={() => setWriting(true)}>
            <PenLine size={14} aria-hidden="true" /> {t('写一篇面经', 'Share an experience')}
          </button>
        )}
      </div>
      {writing && (
        <ExperienceForm
          english={english}
          onCancel={() => setWriting(false)}
          onDone={(created) => {
            setWriting(false);
            setItems((all) => [created, ...(all ?? [])]);
          }}
        />
      )}
      {error && (
        <p className="xs-error" role="alert">
          {error}
        </p>
      )}
      {items?.length ? (
        <ol className="cloud-mock-list xs-list">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`/?${new URLSearchParams({ view: 'content', type: 'experience', slug: item.slug })}`}
                onClick={(e) => {
                  if (!plain(e)) return;
                  e.preventDefault();
                  navigate('content', { type: 'experience', slug: item.slug });
                }}
              >
                <strong>{item.title}</strong>
                <small>
                  {item.company.name} · {t(`面试于 ${item.month}`, `Interviewed ${item.month}`)}
                </small>
              </a>
              <span className="xs-side">
                <span className="xs-status" data-status={item.status}>
                  {t(...STATUS[item.status])}
                </span>
                <button type="button" className="xs-link" onClick={() => void withdraw(item)}>
                  {t('撤回', 'Withdraw')}
                  <span className="sr-only">{`: ${item.title}`}</span>
                </button>
              </span>
              {item.note && (
                <p className="xs-note">
                  {t('审核意见：', 'Review note: ')}
                  {item.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        items &&
        !writing && (
          <p className="xs-empty">
            {t(
              '分享你亲历的面试流程和题目，帮后来的同学少走弯路。投稿不影响任何题目的公开访问。',
              'Share the process and questions from an interview you had, so the next candidate knows what to expect.',
            )}
          </p>
        )
      )}
    </section>
  );
}

type Form = {
  company: string;
  title: string;
  role: string;
  rounds: string[];
  result: string;
  month: string;
  body: string;
  questions: string;
  agree: boolean;
};

function ExperienceForm({
  english,
  onDone,
  onCancel,
}: {
  english: boolean;
  onDone: (created: Mine) => void;
  onCancel: () => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [companies, setCompanies] = useState<{ slug: string; name: string }[]>([]);
  const [now] = useState(() => Date.now());
  const [form, setForm] = useState<Form>(() => ({
    company: '', title: '', role: '', rounds: [], result: '', month: localMonth(now), body: '', questions: '', agree: false,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<{ items: { slug: string; name: string }[] }>('oj/reports/companies').then(
      (r) => live && setCompanies(Array.isArray(r.items) ? r.items : []),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const questions = form.questions.split('\n').map((q) => q.trim()).filter(Boolean);
  const length = form.body.trim().length;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // The browser checks the required fields; these two it cannot.
    if (!form.rounds.length) return setError(t('请至少选一个轮次', 'Pick at least one round'));
    if (questions.length > QUESTIONS_MAX)
      return setError(t(`题目最多 ${QUESTIONS_MAX} 行`, `At most ${QUESTIONS_MAX} questions`));
    setBusy(true);
    setError('');
    try {
      const created = await api<{ member: { id: string }; slug: string; title: string; company: Mine['company'] }>(
        'oj/experiences',
        {
          ...form,
          title: form.title.trim(),
          role: form.role.trim(),
          // Rounds go in the order they happen.
          rounds: Object.keys(ROUND_LABELS).filter((r) => form.rounds.includes(r)),
          result: form.result || null,
          questions,
        },
      );
      onDone({
        id: created.member.id,
        slug: created.slug,
        title: created.title,
        company: created.company,
        status: 'pending',
        note: '',
        month: form.month,
        createdAt: Date.now(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const earliest = localMonth(new Date(now).setFullYear(new Date(now).getFullYear() - 3));
  return (
    <form className="xs-form" onSubmit={submit} aria-labelledby="xs-form-title">
      <div className="xs-form-head">
        <div>
          <h3 id="xs-form-title">{t('分享一次面试', 'Share an interview')}</h3>
          <p>{t('支持 Markdown。提交后先由老师审核，通过后才会公开。', 'Markdown works. A teacher reviews it before anyone else can see it.')}</p>
        </div>
        <button type="button" className="xs-quiet" onClick={onCancel} aria-label={t('关闭表单', 'Close the form')}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="xs-row">
        <label className="xs-field">
          <span>{t('公司', 'Company')}</span>
          <select required value={form.company} onChange={(e) => set({ company: e.target.value })}>
            <option value="">{companies.length ? t('选择公司', 'Choose a company') : t('加载中…', 'Loading…')}</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="xs-field">
          <span>{t('岗位', 'Role')}</span>
          <input
            required
            maxLength={80}
            list="xs-roles"
            value={form.role}
            onChange={(e) => set({ role: e.target.value })}
            placeholder="Software Engineer"
          />
          <datalist id="xs-roles">
            {ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="xs-field">
          <span>{t('面试月份', 'Interview month')}</span>
          <input
            required
            type="month"
            min={earliest}
            max={localMonth(now)}
            pattern="\d{4}-\d{2}"
            placeholder="YYYY-MM"
            value={form.month}
            onChange={(e) => set({ month: e.target.value })}
          />
        </label>
      </div>
      <label className="xs-field">
        <span>{t('标题', 'Title')}</span>
        <input
          required
          minLength={4}
          maxLength={120}
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('例如：Amazon SDE 校招 OA + 三轮 VO', 'e.g. Amazon SDE new grad: OA and three onsite rounds')}
        />
      </label>
      <fieldset className="xs-group">
        <legend>
          {t('经历了哪些轮次', 'Rounds you had')} <small className="xs-hint">{t('可多选', 'pick all that apply')}</small>
        </legend>
        {Object.entries(ROUND_LABELS).map(([value, [zh, en]]) => (
          <label key={value} className="xs-chip">
            <input
              type="checkbox"
              checked={form.rounds.includes(value)}
              onChange={(e) =>
                set({ rounds: e.target.checked ? [...form.rounds, value] : form.rounds.filter((r) => r !== value) })
              }
            />
            {t(zh, en)}
          </label>
        ))}
      </fieldset>
      <fieldset className="xs-group">
        <legend>{t('结果', 'Outcome')}</legend>
        {[['', '不透露', 'Rather not say'] as const, ...Object.entries(RESULTS).map(([v, r]) => [v, r.zh, r.en] as const)].map(
          ([value, zh, en]) => (
            <label key={value || 'none'} className="xs-chip">
              <input type="radio" name="xs-result" checked={form.result === value} onChange={() => set({ result: value })} />
              {t(zh, en)}
            </label>
          ),
        )}
      </fieldset>
      <label className="xs-field">
        <span>
          {t('面试经过', 'What happened')}
          <small className="xs-count" data-over={length > MEMBER_BODY.max ? '' : undefined}>
            {t(`${length} / ${MEMBER_BODY.max} 字，至少 ${MEMBER_BODY.min}`, `${length} / ${MEMBER_BODY.max}, at least ${MEMBER_BODY.min}`)}
          </small>
        </span>
        <textarea
          required
          rows={10}
          minLength={MEMBER_BODY.min}
          maxLength={MEMBER_BODY.max}
          value={form.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder={t(
            '每一轮问了什么、怎么答的、面试官关注什么、有什么建议。不要写面试官姓名或他人的联系方式。',
            'What each round covered, how you answered, what the interviewers cared about, tips. Leave out interviewer names and anyone’s contact details.',
          )}
        />
      </label>
      <label className="xs-field">
        <span>
          {t('被问到的题目', 'Questions you were asked')}{' '}
          <small>{t(`选填，每行一题，最多 ${QUESTIONS_MAX} 题`, `optional, one per line, up to ${QUESTIONS_MAX}`)}</small>
        </span>
        <textarea
          rows={4}
          value={form.questions}
          onChange={(e) => set({ questions: e.target.value })}
          placeholder={t('例如：LRU 缓存\n设计一个短链服务', 'e.g. LRU cache\nDesign a URL shortener')}
        />
      </label>
      <label className="xs-agree">
        <input type="checkbox" required checked={form.agree} onChange={(e) => set({ agree: e.target.checked })} />
        <span>
          {t(
            '这是我本人亲历的面试，内容不违反我签署的保密协议（NDA），不包含他人的个人信息。我同意 CSWork 在老师审核后公开展示；页面不会显示我的邮箱或姓名，只有开启公开主页时才显示主页名。我可以随时撤回。',
            'This is my own interview, it breaks no NDA I signed, and it names no one’s personal details. CSWork may publish it after a teacher reviews it; my email and name never appear (only my handle, if my public profile is on). I can withdraw it at any time.',
          )}
        </span>
      </label>
      {error && (
        <p className="xs-error" role="alert">
          {error}
        </p>
      )}
      <div className="xs-foot">
        <button type="submit" className="xs-submit" disabled={busy}>
          {busy ? t('提交中…', 'Submitting…') : t('提交审核', 'Submit for review')}
        </button>
        <button type="button" className="xs-quiet" onClick={onCancel}>
          {t('取消', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
