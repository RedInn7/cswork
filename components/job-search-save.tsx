'use client';
import { useEffect, useRef, useState } from 'react';
import { JOB_SEARCH_NOTE, type JobSearch } from '@/lib/job-tags';

const NOTE_URL = `/api/oj/notes?target=${encodeURIComponent(JOB_SEARCH_NOTE)}`;

/**
 * /career/jobs: keep the current filter as the learner's one saved search (a private note,
 * lib/server/my-practice.ts). The page opens with it, and the 09:00 digest
 * (lib/server/company-follows.ts) reports new matches. An empty note removes it.
 */
export function JobSearchSave({ zh, search, saved }: { zh: boolean; search: JobSearch; saved: 'none' | 'this' | 'other' }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [state, setState] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The pressed button goes away: focus moves to the one that takes its place.
  const swapped = useRef(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const forgetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (swapped.current) (state === 'this' ? forgetRef : saveRef).current?.focus();
    swapped.current = false;
  }, [state]);
  async function put(body: string, next: typeof state) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(NOTE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      if (!response.ok) throw new Error(String(response.status));
      swapped.current = true;
      setState(next);
    } catch {
      setError(t('没有保存成功，请重试。', 'Not saved. Please try again.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="job-search-save">
      {state === 'this' ? (
        <p role="status">
          {t(
            '已保存这个筛选：不带条件打开本页时会自动套用；每天北京时间 9 点后，有新岗位符合就在站内通知你。',
            'Saved: this page opens with it, and new matches arrive as a notification after 09:00 Beijing time each day.',
          )}
        </p>
      ) : (
        <button ref={saveRef} type="button" onClick={() => void put(JSON.stringify(search), 'this')} aria-disabled={busy}>
          {state === 'other' ? t('用这个筛选替换已保存的', 'Replace my saved search with this one') : t('保存这个筛选，有新岗位时通知我', 'Save this search and tell me about new matches')}
        </button>
      )}
      {state !== 'none' && (
        <button ref={forgetRef} type="button" className="job-search-forget" onClick={() => void put('', 'none')} aria-disabled={busy}>
          {t('删除保存的筛选', 'Delete my saved search')}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
