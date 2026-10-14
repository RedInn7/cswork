'use client';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/types';

type Counts = { stars: number; forks: number; starred: boolean; mine: boolean };

/** /u/lists/<id>: save the list (a star) and its save and copy counts, refreshed for the reader. */
export function ListStar({ id, stars, forks, zh }: { id: string; stars: number; forks: number; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [counts, setCounts] = useState<Counts>({ stars, forks, starred: false, mine: false });
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  useEffect(() => {
    let live = true;
    api<Counts>(`oj/lists/${encodeURIComponent(id)}`).then(
      (c) => live && setCounts({ stars: c.stars, forks: c.forks, starred: c.starred, mine: c.mine }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [id]);
  async function toggle() {
    setBusy(true);
    try {
      const c = await api<Counts>(`oj/lists/${encodeURIComponent(id)}/star`, { on: !counts.starred });
      setCounts({ stars: c.stars, forks: c.forks, starred: c.starred, mine: c.mine });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setSignIn(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="list-star">
      {!counts.mine &&
        (signIn ? (
          <a href={`/?view=lists&list=${encodeURIComponent(id)}`}>{t('登录后收藏', 'Sign in to save it')}</a>
        ) : (
          <button type="button" aria-pressed={counts.starred} disabled={busy} onClick={() => void toggle()}>
            <span aria-hidden="true">{counts.starred ? '★' : '☆'}</span> {counts.starred ? t('已收藏', 'Saved') : t('收藏', 'Save')}
          </button>
        ))}
      <span>{t(`${counts.stars} 人收藏`, `${counts.stars} ${counts.stars === 1 ? 'save' : 'saves'}`)}</span>
      <span>{t(`${counts.forks} 次复制`, `${counts.forks} ${counts.forks === 1 ? 'copy' : 'copies'}`)}</span>
    </div>
  );
}
