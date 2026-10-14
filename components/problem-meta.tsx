'use client';
import { useEffect, useState } from 'react';
import { Check, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { ojRequest } from '@/lib/oj-client';
import { api } from '@/lib/types';
import { problemShareUrl } from '@/lib/seo';

type Vote = 'up' | 'down';
/** GET problem-stats without a language: lib/server/problem-stats.ts plus the viewer's vote. */
type Meta = {
  acceptance: { attempted: number; accepted: number } | null;
  votes: { up: number; down: number };
  vote: Vote | null;
};

/**
 * The line under the problem title: the site's acceptance rate (hidden below the stats'
 * sample floor), up/down votes (one per learner, a mark on problem:<id>) and a share
 * button. Stats and votes need an account; sharing does not.
 */
export function ProblemMeta({
  problemId,
  title,
  english,
  signedIn,
}: {
  problemId: string;
  title: string;
  english: boolean;
  signedIn: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [mine, setMine] = useState<Vote | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    ojRequest<Meta>(`problem-stats/${encodeURIComponent(problemId)}`, undefined, controller.signal).then(
      (fresh) => {
        setMeta(fresh);
        setMine(fresh.vote ?? null);
      },
      () => {
        /* A nicety: the page never waits on or fails with it. */
      },
    );
    return () => controller.abort();
  }, [problemId, signedIn]);
  // The counts are cached server-side; this viewer's own change shows at once.
  const count = (kind: Vote) =>
    Math.max(mine === kind ? 1 : 0, (meta?.votes?.[kind] ?? 0) - (meta?.vote === kind ? 1 : 0) + (mine === kind ? 1 : 0));
  async function vote(kind: Vote) {
    const before = mine;
    const on = mine !== kind;
    setMine(on ? kind : null);
    setNote('');
    try {
      await api('oj/marks', { target: `problem:${problemId}`, mark: kind, on });
    } catch (reason) {
      setMine(before);
      setNote(t(`投票没有保存：${(reason as Error).message}`, `Vote not saved: ${(reason as Error).message}`));
    }
  }
  async function share() {
    const url = problemShareUrl(problemId);
    setNote('');
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* Dismissing the share sheet is not an error. */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote(t('链接已复制', 'Link copied'));
    } catch {
      setNote(t(`复制失败，链接：${url}`, `Couldn't copy. The link: ${url}`));
    }
  }
  const acceptance = meta?.acceptance;
  return (
    <div className="cs-problem-meta">
      {acceptance && (
        <span
          className="cs-problem-meta-rate"
          title={t(`${acceptance.accepted} / ${acceptance.attempted} 人通过`, `${acceptance.accepted} of ${acceptance.attempted} people solved it`)}
        >
          {t(
            `通过率 ${Math.round((100 * acceptance.accepted) / acceptance.attempted)}%（${acceptance.attempted} 人尝试）`,
            `${Math.round((100 * acceptance.accepted) / acceptance.attempted)}% acceptance (${acceptance.attempted} tried)`,
          )}
        </span>
      )}
      {meta && (
        <span className="cs-problem-votes" role="group" aria-label={t('这道题怎么样', 'Rate this problem')}>
          {(
            [
              ['up', ThumbsUp, '赞', 'Like'],
              ['down', ThumbsDown, '踩', 'Dislike'],
            ] as const
          ).map(([kind, Icon, zh, en]) => (
            <button
              key={kind}
              type="button"
              className="cs-problem-vote"
              data-vote={kind}
              aria-pressed={mine === kind}
              aria-label={t(`${zh}（${count(kind)}）`, `${en} (${count(kind)})`)}
              title={t(zh, en)}
              onClick={() => void vote(kind)}
            >
              <Icon size={14} aria-hidden="true" />
              <span aria-hidden="true">{count(kind)}</span>
            </button>
          ))}
        </span>
      )}
      <button
        type="button"
        className="cs-problem-share"
        aria-label={t('分享这道题', 'Share this problem')}
        title={t('分享这道题', 'Share this problem')}
        onClick={() => void share()}
      >
        {note === t('链接已复制', 'Link copied') ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Share2 size={14} aria-hidden="true" />
        )}
        <span>{t('分享', 'Share')}</span>
      </button>
      <span className="cs-problem-meta-note" role="status">
        {note}
      </span>
    </div>
  );
}
