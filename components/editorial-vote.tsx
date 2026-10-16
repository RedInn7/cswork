'use client';
import { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '@/lib/types';
import '@/app/ling-editorial.css';

type Vote = 'up' | 'down';

/**
 * "Helpful / not helpful" under an editorial (Line 500's or an OA's): one vote per learner, an
 * up/down mark on content:editorial/<problem id> (lib/server/my-practice.ts). Mounted once the
 * editorial has loaded, which takes an account; the owner's analytics list the editorials most
 * marked not helpful.
 */
export function EditorialVote({ problemId, english }: { problemId: string; english: boolean }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const target = `content:editorial/${problemId}`;
  const [mine, setMine] = useState<Vote | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    let live = true;
    api<{ items: { mark: string }[] }>(`oj/marks?target=${encodeURIComponent(target)}`).then(
      ({ items }) => live && setMine((items.find((m) => m.mark === 'up' || m.mark === 'down')?.mark as Vote) ?? null),
      () => {
        /* A nicety: the buttons still work, starting unpressed. */
      },
    );
    return () => {
      live = false;
    };
  }, [target]);
  async function vote(kind: Vote) {
    const before = mine;
    const on = mine !== kind;
    setMine(on ? kind : null);
    setNote('');
    try {
      await api('oj/marks', { target, mark: kind, on });
      if (on) setNote(t('谢谢反馈', 'Thanks for the feedback'));
    } catch (reason) {
      setMine(before);
      setNote(t(`没有保存：${(reason as Error).message}`, `Not saved: ${(reason as Error).message}`));
    }
  }
  const question = t('这篇题解有帮助吗？', 'Was this editorial helpful?');
  return (
    <div className="cs-editorial-vote" role="group" aria-label={question}>
      <span aria-hidden="true">{question}</span>
      {(
        [
          ['up', ThumbsUp, '有帮助', 'Helpful'],
          ['down', ThumbsDown, '没帮助', 'Not helpful'],
        ] as const
      ).map(([kind, Icon, zh, en]) => (
        <button key={kind} type="button" data-vote={kind} aria-pressed={mine === kind} onClick={() => void vote(kind)}>
          <Icon size={14} aria-hidden="true" />
          {t(zh, en)}
        </button>
      ))}
      <span className="cs-editorial-vote-note" role="status">
        {note}
      </span>
    </div>
  );
}
