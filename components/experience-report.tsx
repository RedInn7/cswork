'use client';
import { Component, useState, type ReactNode } from 'react';
import { api } from '@/lib/types';
import { problemAppHref } from '@/lib/classic-lists';
import { oaLine, ROUND_LABELS, type MemberOa, type MemberQuestion } from '@/lib/experience';
import { useLocale, useT } from '@/lib/i18n';
import { OaMarkdown } from './oa-library';
import '@/app/experience-submissions.css';

type Plain = { text: string; children: ReactNode };
/** Shows `text` as written when its children throw while rendering. */
class PlainOnError extends Component<Plain, { failed: boolean; text: string }> {
  state = { failed: false, text: this.props.text };
  static getDerivedStateFromProps(props: Plain, state: { text: string }) {
    return props.text === state.text ? null : { failed: false, text: props.text };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <pre className="xs-plain">{this.props.text}</pre> : this.props.children;
  }
}

/**
 * OaMarkdown that falls back to plain text when it can't render, e.g. a post nesting quotes
 * thousands deep overflows the renderer's stack: the page and its review buttons stay usable.
 */
export function SafeMarkdown({ body, math }: { body: string; math?: boolean }) {
  return (
    <PlainOnError text={body}>
      <OaMarkdown body={body} math={math} />
    </PlainOnError>
  );
}

const REASONS: [string, string, string][] = [
  ['nda', '涉及保密协议（NDA）', 'Breaks an NDA'],
  ['personal', '泄露他人个人信息', "Exposes someone's personal details"],
  ['spam', '广告或灌水', 'Spam or advertising'],
  ['inaccurate', '明显不实', 'Clearly inaccurate'],
  ['offensive', '冒犯或骚扰', 'Offensive or harassing'],
  ['other', '其他', 'Something else'],
];

/** "Report" under a member's post: a reason and an optional note for the teachers. */
export function ReportExperience({ id }: { id: string }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  async function send(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!reason) return;
    setState('sending');
    setError('');
    try {
      await api(`oj/experiences/${encodeURIComponent(id)}/flag`, { reason, note: note.trim() });
      setState('sent');
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  }
  if (state === 'sent')
    return (
      <output className="xs-report">
        {t('已收到举报，老师会尽快处理。', 'Thanks. A teacher will look at it soon.')}
      </output>
    );
  return (
    <details className="xs-report">
      <summary>{t('举报这篇面经', 'Report this post')}</summary>
      <form onSubmit={send}>
        <label className="xs-field">
          <span>{t('原因', 'Reason')}</span>
          <select required value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{t('请选择', 'Choose one')}</option>
            {REASONS.map(([value, zh, en]) => (
              <option key={value} value={value}>
                {t(zh, en)}
              </option>
            ))}
          </select>
        </label>
        <label className="xs-field">
          <span>
            {t('补充说明', 'Details')} <small>{t('选填', 'optional')}</small>
          </span>
          <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && (
          <p className="xs-error" role="alert">
            {error}
          </p>
        )}
        <div className="xs-foot">
          <button type="submit" className="xs-submit" disabled={!reason || state === 'sending'}>
            {state === 'sending' ? t('提交中…', 'Sending…') : t('提交举报', 'Send report')}
          </button>
        </div>
      </form>
    </details>
  );
}

export type MemberInfo = {
  id: string;
  handle: string | null;
  status: 'pending' | 'approved' | 'rejected';
  public: boolean;
  mine: boolean;
  note: string;
  oa?: MemberOa | null;
};

/** "LC 146 · LRU Cache" for a linked LeetCode problem, the title alone for an OA one. */
const problemLabel = (q: MemberQuestion, zh: boolean) => {
  const title = (!zh && q.titleEn) || q.title;
  const lc = /^lc-(\d+)$/.exec(q.problem)?.[1];
  return lc ? (title ? `LC ${lc} · ${title}` : `LC ${lc}`) : title || q.problem;
};

/**
 * A post's questions, each with its round and, when it links a site problem, a way to practise
 * it; a public post with any link also offers the whole loop as a timed mock. No hooks: the
 * server-rendered page uses it too.
 */
export function MemberQuestions({
  id,
  questions,
  zh,
  live,
  className,
}: {
  id: string;
  questions: readonly MemberQuestion[];
  zh: boolean;
  /** Public: only then can a mock be drawn from it. */
  live: boolean;
  className: string;
}) {
  if (!questions.length) return null;
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <section className={`${className} xs-questions`} aria-labelledby="xs-questions-h">
      <h2 id="xs-questions-h">{t('被问到的题目', 'Questions asked')}</h2>
      <ol>
        {questions.map((q, i) => (
          <li key={i}>
            {q.round && (
              <span className="xs-q-round">
                {Object.hasOwn(ROUND_LABELS, q.round) ? ROUND_LABELS[q.round][zh ? 0 : 1] : q.round}
              </span>
            )}
            {q.text}
            {q.problem && (
              <a className="xs-q-go" href={problemAppHref(q.problem)}>
                {t('去做 ', 'Practise ')}
                {problemLabel(q, zh)}
                {q.similar && t('（类似）', ' (similar)')}
              </a>
            )}
          </li>
        ))}
      </ol>
      {live && questions.some((q) => q.problem) && (
        <a className="xs-loop" href={`/?${new URLSearchParams({ view: 'mock', experience: id })}`}>
          {t('按这场面经模拟', 'Practise this loop as a timed mock')}
        </a>
      )}
    </section>
  );
}

/**
 * The part of a member's post the library has no equivalent for: who wrote it (a public handle
 * at most), its review status for the author, the questions asked and a report control.
 */
export function MemberPost({ member, questions }: { member: MemberInfo; questions: readonly MemberQuestion[] }) {
  const t = useT();
  const zh = useLocale() !== 'en';
  const oa = oaLine(member.oa, zh);
  return (
    <>
      {!member.public && (
        <output className="xs-notice" data-status={member.status}>
          {member.status === 'pending'
            ? t('这篇面经正在审核，只有你和老师能看到。', 'This post is in review. Only you and the teachers can see it.')
            : member.status === 'rejected'
              ? t('这篇面经没有公开。', 'This post is not published.')
              : t('这篇面经被多人举报，暂时隐藏，等老师复核。', 'Several readers reported this post; it is hidden until a teacher reviews it.')}
          {member.note && (
            <>
              {' '}
              {t('审核意见：', 'Review note: ')}
              {member.note}
            </>
          )}
        </output>
      )}
      {oa && <p className="xs-byline xs-oa">{oa}</p>}
      <MemberQuestions id={member.id} questions={questions} zh={zh} live={member.public} className="rd-card ct-body" />
      <div className="xs-byline">
        <span className="rd-badge is-member">{t('学员投稿', 'Member submission')}</span>
        <span>
          {member.handle ? (
            <>
              {t('作者', 'By')} <a href={`/u/${member.handle}`}>@{member.handle}</a>
            </>
          ) : (
            t('CSWork 学员分享，经老师审核', 'Shared by a CSWork member, reviewed by a teacher')
          )}
        </span>
        {member.public && (
          <a href={`/library/experience-ugc/${member.id}`}>{t('公开页面', 'Public page')}</a>
        )}
        {member.public && !member.mine && <ReportExperience id={member.id} />}
      </div>
    </>
  );
}
