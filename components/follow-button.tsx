'use client';
import { type ReactNode, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/types';

type State = { following: boolean; self: boolean; signedIn: boolean; followers: number; followees: number };

/**
 * /u/<handle>: the follower count (server-rendered, then live), `children`, and a follow or
 * unfollow button; signed out it points at signing in. Your own page has no button.
 */
export function FollowButton({
  handle,
  zh,
  followers,
  children,
}: {
  handle: string;
  zh: boolean;
  followers: number;
  children?: ReactNode;
}) {
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
  const n = state?.followers ?? followers;
  const count = (
    <a href={`/u/${handle}/followers`}>
      <b>{n}</b> {t('关注者', n === 1 ? 'follower' : 'followers')}
    </a>
  );
  if (!state || state.self)
    return (
      <>
        {count}
        {children}
      </>
    );
  if (!state.signedIn)
    return (
      <>
        {count}
        {children}
        <a className="learner-follow" href="/?view=progress">
          {t('登录后关注', 'Sign in to follow')}
        </a>
      </>
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
    <>
      {count}
      {children}
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
    </>
  );
}
