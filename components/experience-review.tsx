'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import {
  EMPLOYMENT,
  RESULTS,
  ROUND_LABELS,
  seasonLabel,
  SENTIMENTS,
  SOURCES,
  type MemberDetails,
} from '@/lib/experience';
import { SafeMarkdown } from './experience-report';
import { Button } from './ui/button';
import '@/app/experience-submissions.css';

type Item = {
  id: string;
  title: string;
  company: { slug: string; name: string };
  role: string;
  result: string | null;
  rounds: string[];
  interviewDate: string | null;
  body: string;
  questions: string[];
  status: 'pending' | 'approved' | 'rejected';
  note: string;
  createdAt: number;
  flags: number;
  reasons: string[];
  shown: boolean;
  /** Published without the handle (only this queue shows it). */
  anonymous?: boolean;
  member: { handle: string | null };
  details?: MemberDetails;
};
type Queue = { pending: Item[]; flagged: Item[]; approved: Item[] };

/** Teacher dashboard: member experiences to review, reported ones, and the latest published. */
export function ExperienceReview() {
  const t = useT();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    api<Queue>('oj/experiences/review').then(
      (q) => live && (setQueue(q), setError('')),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [retry]);
  const sections: [keyof Queue, string, string][] = [
    ['pending', '待审核', 'Awaiting review'],
    ['flagged', '被举报', 'Reported'],
    ['approved', '最近发布', 'Recently published'],
  ];
  return (
    <div className="xs-review">
      <div className="lms-toolbar">
        <p className="muted">
          {t(
            '学员投稿的面经：通过后公开在面经列表和公司主页；三人举报会先自动隐藏。',
            'Member experiences: approved ones appear in the experiences list and on company pages; three reports hide one until you look.',
          )}
        </p>
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          <RefreshCw size={15} />
          {t('刷新', 'Refresh')}
        </Button>
      </div>
      {error && (
        <p className="xs-error" role="alert">
          {error}
        </p>
      )}
      {!queue
        ? !error && <output className="muted">{t('正在加载…', 'Loading…')}</output>
        : sections.map(([key, zh, en]) => (
            <section key={key} aria-labelledby={`xs-review-${key}`}>
              <h2 id={`xs-review-${key}`}>
                {t(zh, en)} <small>{queue[key].length}</small>
              </h2>
              {queue[key].length ? (
                <ul className="xs-cards">
                  {queue[key].map((item) => (
                    <ReviewCard key={item.id} item={item} onQueue={setQueue} />
                  ))}
                </ul>
              ) : (
                <p className="muted">{t('暂无', 'Nothing here')}</p>
              )}
            </section>
          ))}
    </div>
  );
}

function ReviewCard({ item, onQueue }: { item: Item; onQueue: (queue: Queue) => void }) {
  const t = useT();
  const zh = useLocale() !== 'en';
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(status: 'approved' | 'rejected') {
    setBusy(true);
    setError('');
    try {
      onQueue(await api<Queue>(`oj/experiences/${encodeURIComponent(item.id)}/review`, { status, note: note.trim() }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const result = item.result && Object.hasOwn(RESULTS, item.result) ? RESULTS[item.result] : null;
  const rounds = item.rounds.map((r) => (Object.hasOwn(ROUND_LABELS, r) ? t(...ROUND_LABELS[r]) : r));
  const pending = item.status === 'pending';
  // The optional facts publish with the post, so the reviewer sees them all (location is free text).
  const d = item.details;
  const label = (map: Readonly<Record<string, [string, string]>>, value: string) =>
    Object.hasOwn(map, value) ? t(...map[value]) : value;
  const facts = d
    ? [
        d.employment && label(EMPLOYMENT, d.employment),
        d.season && seasonLabel(d.season, zh),
        d.channel && label(SOURCES, d.channel),
        d.location && t(`地点：${d.location}`, `Location: ${d.location}`),
        d.difficulty && t(`难度 ${d.difficulty}/5`, `Difficulty ${d.difficulty}/5`),
        d.sentiment && label(SENTIMENTS, d.sentiment),
        d.durationWeeks !== null && t(`流程 ${d.durationWeeks} 周`, `${d.durationWeeks}-week process`),
      ].filter((x): x is string => !!x)
    : [];
  return (
    <li className="xs-card">
      <h3>{item.title}</h3>
      <p className="xs-card-meta">
        <span>{item.company.name}</span>
        <span>{item.role}</span>
        {!!rounds.length && <span>{rounds.join(' → ')}</span>}
        {result && <span>{t(result.zh, result.en)}</span>}
        {item.interviewDate && <span>{t(`面试于 ${item.interviewDate.slice(0, 7)}`, `Interviewed ${item.interviewDate.slice(0, 7)}`)}</span>}
        <span>{item.member.handle ? `@${item.member.handle}` : t('未公开主页', 'No public handle')}</span>
        {item.anonymous && <span>{t('匿名发布', 'Posted anonymously')}</span>}
        <span>{new Date(item.createdAt).toLocaleString()}</span>
      </p>
      {!!facts.length && (
        <p className="xs-card-meta xs-card-facts">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      )}
      {!item.shown && (
        <p className="xs-flags">
          {t('这家公司已隐藏或没有公司主页，通过后也不会公开。', 'This company is hidden or has no company page, so approving will not publish it.')}
        </p>
      )}
      {!!item.flags && (
        <p className="xs-flags">
          {t(`${item.flags} 人举报：`, `${item.flags} ${item.flags === 1 ? 'report' : 'reports'}:`)}
          {'\n'}
          {item.reasons.join('\n')}
        </p>
      )}
      <details open={pending}>
        <summary>{t('正文和题目', 'Post and questions')}</summary>
        <div>
          <SafeMarkdown body={item.body} />
          {!!item.questions.length && (
            <ol>
              {item.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          )}
        </div>
      </details>
      <div className="xs-actions">
        <label className="xs-field">
          <span>
            {t('给作者的意见', 'Note to the author')}{' '}
            <small>{t('不通过或下架时必填', 'required to reject or take down')}</small>
          </span>
          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {item.status !== 'approved' || item.flags ? (
          <button type="button" className="xs-submit" disabled={busy} onClick={() => void decide('approved')}>
            {pending ? t('通过并发布', 'Approve and publish') : t('保留并清除举报', 'Keep and clear reports')}
          </button>
        ) : null}
        <button type="button" className="xs-reject" disabled={busy || !note.trim()} onClick={() => void decide('rejected')}>
          {pending ? t('不通过', 'Reject') : t('下架', 'Take down')}
        </button>
      </div>
      {error && (
        <p className="xs-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
