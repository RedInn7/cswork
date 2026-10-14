'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/types';
import '@/app/learner-cloud.css';

type Board = { following: number; since: number; items: { handle: string | null; n: number; me: boolean }[] };

/**
 * My progress: this week's accepted problems (LeetCode and OA, since local Monday) for me and
 * the public profiles I follow (lib/server/follows.ts), most first.
 */
export function FollowBoard({ english }: { english: boolean }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<Board>(`oj/follows/board?tz=${new Date().getTimezoneOffset()}`).then(
      (b) => live && setBoard(b),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  if (error) return null;
  const top = Math.max(1, ...(board?.items.map((i) => i.n) ?? []));
  return (
    <section className="cloud-mocks follow-board" aria-labelledby="follow-board-title">
      <div className="cloud-head">
        <h2 id="follow-board-title">{t('我关注的人 · 本周', 'People I follow · this week')}</h2>
        <p>{t('本周一起通过的 LeetCode 和 OA 题数', 'LeetCode and OA problems solved since Monday')}</p>
      </div>
      {!board ? (
        <output className="study-state">{t('正在加载…', 'Loading…')}</output>
      ) : board.following ? (
        <ol className="follow-board-rows">
          {board.items.map((row, index) => (
            <li key={row.handle ?? 'me'} data-me={row.me || undefined}>
              <span className="follow-board-rank">{index + 1}</span>
              {row.handle && !row.me ? (
                <a href={`/u/${row.handle}`}>@{row.handle}</a>
              ) : (
                <strong>{row.handle ? t(`我（@${row.handle}）`, `Me (@${row.handle})`) : t('我', 'Me')}</strong>
              )}
              <span className="follow-board-bar" style={{ '--frac': row.n / top } as React.CSSProperties} aria-hidden="true" />
              <b>{row.n}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="cloud-starred-empty">
          {t(
            '还没有关注任何人。在同学的公开主页点「关注」，这里会有一起刷题的周榜。',
            'You aren’t following anyone yet. Follow classmates from their public profile to see a weekly board here.',
          )}
        </p>
      )}
    </section>
  );
}
