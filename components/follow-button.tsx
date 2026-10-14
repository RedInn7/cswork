'use client';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/types';

type State = { following: boolean; self: boolean; signedIn: boolean; followers: number; followees: number };

/** /u/<handle>: follow or unfollow; signed out it points at signing in. Your own page has none. */
export function FollowButton({ handle, zh }: { handle: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<State>(`oj/follows?${new URLSearchParams({ handle })}`).then(
      (s) => live && setState(s),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [handle]);
  if (!state || state.self) return null;
  if (!state.signedIn)
    return (
      <a className="learner-follow" href="/?view=progress">
        {t('登录后关注', 'Sign in to follow')}
      </a>
    );
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      setState(await api<State>('oj/follows', { handle, on: !state!.following }));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t('请先登录', 'Please sign in first') : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="learner-follow-wrap">
      <button
        type="button"
        className="learner-follow"
        aria-pressed={state.following}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {state.following ? t('已关注', 'Following') : t('关注', 'Follow')}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
