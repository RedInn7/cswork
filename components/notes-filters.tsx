'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/types';
import '@/app/notes-filters.css';

type Counts = { tags?: { tag: string; count: number }[]; confidence?: Record<string, number> };

/**
 * The notes hub's tag cloud (#off-by-one ×12) and a "confidence ≤ 2" chip, from GET oj/notes/tags.
 * Each chip toggles its filter; nothing shows until some note has a tag or a low confidence.
 */
export function NoteTagChips({
  english,
  tag,
  conf,
  onTag,
  onConf,
}: {
  english: boolean;
  tag: string | null;
  conf: number | null;
  onTag: (tag: string | null) => void;
  onConf: (conf: number | null) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    let current = true;
    api<Counts>('oj/notes/tags')
      .then((result) => current && setCounts(result))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  const tags = Array.isArray(counts?.tags) ? counts.tags : [];
  const shaky = (counts?.confidence?.[1] ?? 0) + (counts?.confidence?.[2] ?? 0);
  if (!tags.length && !shaky && !tag && !conf) return null;
  return (
    <div className="note-chips" role="group" aria-label={t('按标签或把握度筛选', 'Filter by tag or confidence')}>
      {(shaky > 0 || conf) && (
        <button type="button" aria-pressed={conf === 2} onClick={() => onConf(conf === 2 ? null : 2)}>
          {t('把握度 ≤2', 'Confidence ≤2')} <span>×{shaky}</span>
        </button>
      )}
      {tags.map((chip) => (
        <button
          key={chip.tag}
          type="button"
          aria-pressed={tag === chip.tag}
          onClick={() => onTag(tag === chip.tag ? null : chip.tag)}
        >
          #{chip.tag} <span>×{chip.count}</span>
        </button>
      ))}
    </div>
  );
}
