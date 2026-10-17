'use client';
import { useState } from 'react';
import { JOB_BLOCKED_MAX, JOB_BLOCKED_NOTE } from '@/lib/job-tags';
import { api } from '@/lib/types';

// Styles: app/company/jobs.css, imported by the pages that show these.
const NOTE_URL = `/api/oj/notes?target=${encodeURIComponent(JOB_BLOCKED_NOTE)}`;

/** What blocking does, for the toggle and the list. */
export const blockedHelp = (zh: boolean) =>
  zh
    ? '屏蔽后，这些公司的岗位不再出现在岗位列表、招聘日历和每日新岗位消息里；关注公司的动态照常推送。'
    : 'Blocked companies’ roles stay out of the openings list, the hiring calendar and the daily new-roles notice; news from companies you follow still arrives.';

const savedList = (body: string): string[] => {
  try {
    const slugs: unknown = JSON.parse(body);
    return Array.isArray(slugs) ? slugs.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s)) : [];
  } catch {
    return [];
  }
};
/**
 * Blocks or unblocks one company in the learner's private note career:jobs-blocked
 * (lib/server/my-practice.ts), read fresh so a change made elsewhere is kept; none left removes the
 * note. Returns the new list; throws Error('full') past JOB_BLOCKED_MAX, any other error when not saved.
 */
export async function putBlocked(slug: string, on: boolean) {
  const saved = savedList((await api<{ body: string }>(`oj/notes?target=${encodeURIComponent(JOB_BLOCKED_NOTE)}`)).body);
  const list = on ? [...new Set([...saved, slug])] : saved.filter((s) => s !== slug);
  if (list.length > JOB_BLOCKED_MAX) throw new Error('full');
  const response = await fetch(NOTE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: list.length ? JSON.stringify(list) : '' }),
  });
  if (!response.ok) throw new Error(String(response.status));
  return list;
}
export const blockError = (error: unknown, zh: boolean) =>
  error instanceof Error && error.message === 'full'
    ? zh
      ? `最多屏蔽 ${JOB_BLOCKED_MAX} 家公司，请先取消几家。`
      : `You can block up to ${JOB_BLOCKED_MAX} companies; unblock some first.`
    : zh
      ? '没有保存成功，请重试。'
      : 'Not saved. Please try again.';

/** The company page's block button; signed out (blocked null), a sign-in link. */
export function BlockToggle({ zh, slug, name, blocked }: { zh: boolean; slug: string; name: string; blocked: string[] | null }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [list, setList] = useState(blocked ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!blocked)
    return (
      <a className="job-block-signin" href="/?view=account">
        {t('登录后可屏蔽公司', 'Sign in to block companies')}
      </a>
    );
  const on = list.includes(slug);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setList(await putBlocked(slug, !on));
    } catch (e) {
      setError(blockError(e, zh));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="job-block">
      <button type="button" aria-disabled={busy} onClick={() => void toggle()}>
        {on ? t('取消屏蔽', 'Unblock') : t('不看这家公司', 'Block this company')}
        <span className="sr-only">
          {t('：', ': ')}
          {name}
        </span>
      </button>
      {/* Always there, so the change is announced. */}
      <output>{on ? blockedHelp(zh) : ''}</output>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/** /career/jobs: "N blocked · Manage", each one unblocked on its own; the page reloads to show its roles again. */
export function BlockedList({ zh, blocked, names }: { zh: boolean; blocked: string[]; names: Record<string, string> }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function unblock(slug: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await putBlocked(slug, false);
      location.reload();
    } catch (e) {
      setError(blockError(e, zh));
      setBusy(false);
    }
  }
  if (!blocked.length) return null;
  return (
    <details className="job-blocked">
      <summary>{zh ? `已屏蔽 ${blocked.length} 家 · 管理` : `${blocked.length} blocked ${blocked.length === 1 ? 'company' : 'companies'} · Manage`}</summary>
      <p>{blockedHelp(zh)}</p>
      <ul>
        {blocked.map((slug) => (
          <li key={slug}>
            <span>{names[slug] ?? slug}</span>
            <button type="button" aria-disabled={busy} onClick={() => void unblock(slug)}>
              {t('取消屏蔽', 'Unblock')}
              <span className="sr-only">
                {t('：', ': ')}
                {names[slug] ?? slug}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
