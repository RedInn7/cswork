'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChecklistItem } from '@/lib/content/career-checklists';
import { weekLabel } from '@/lib/intern-log';
import '@/app/career-outreach.css';

const localKey = (slug: string) => `cswork:checklist:${slug}`;
const noteUrl = (slug: string) => `/api/oj/notes?target=${encodeURIComponent(`checklist:${slug}`)}`;
/** Saves the ticked ids as the note; none ticked removes it (lib/server/my-practice.ts). */
const putDone = (slug: string, done: string[]) =>
  fetch(noteUrl(slug), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: done.length ? JSON.stringify(done) : '' }),
  }).then(
    (response) => response.ok,
    () => false,
  );
/** The saved ids still on the list; anything malformed reads as none. */
function parseDone(raw: unknown, items: ChecklistItem[]) {
  try {
    const ids: unknown = typeof raw === 'string' && raw ? JSON.parse(raw) : null;
    return Array.isArray(ids) ? items.map((i) => i.id).filter((id) => ids.includes(id)) : null;
  } catch {
    return null;
  }
}
function readLocal(slug: string) {
  try {
    return localStorage.getItem(localKey(slug));
  } catch {
    return null;
  }
}
function writeLocal(slug: string, done: string[]) {
  try {
    if (done.length) localStorage.setItem(localKey(slug), JSON.stringify(done));
    else localStorage.removeItem(localKey(slug));
  } catch {}
}

/**
 * A guide chapter's checklist (lib/content/career-checklists.ts). Signed in, the ticks are the
 * learner's private note `checklist:<chapter>`; signed out they stay in this browser and move to
 * the account on the next signed-in visit (the system design quiz does the same).
 */
export function GuideChecklist({ slug, items, zh }: { slug: string; items: ChecklistItem[]; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [done, setDone] = useState<string[]>([]);
  const [where, setWhere] = useState<'loading' | 'account' | 'device'>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  // Saves go out one at a time, so an older body never lands after a newer one.
  const queue = useRef(Promise.resolve());
  const push = (next: string[]) => {
    queue.current = queue.current.then(() => putDone(slug, next).then((ok) => setSaveFailed(!ok)));
  };

  useEffect(() => {
    let current = true;
    const local = parseDone(readLocal(slug), items);
    fetch(noteUrl(slug))
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const saved = parseDone((await response.json())?.body, items);
        if (!current) return;
        setWhere('account');
        // Ticked here while signed out (or while the account was unreachable): merged into the
        // account, and this browser's copy goes so it can't come back after everything is unticked.
        const merged = items.map((i) => i.id).filter((id) => saved?.includes(id) || local?.includes(id));
        setDone(merged);
        writeLocal(slug, []);
        if (merged.length > (saved?.length ?? 0)) push(merged);
      })
      .catch(() => {
        if (!current) return;
        setWhere('device');
        if (local) setDone(local);
      });
    return () => {
      current = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- push only reads refs.
  }, [slug, items]);

  const toggle = (id: string, on: boolean) => {
    const next = items.map((i) => i.id).filter((i) => (i === id ? on : done.includes(i)));
    setDone(next);
    if (where === 'account') push(next);
    else writeLocal(slug, next);
  };
  const percent = Math.round((100 * done.length) / items.length);
  return (
    <section className="guide-checklist" aria-labelledby="guide-checklist-title">
      <header>
        <h2 id="guide-checklist-title">{t('本章清单', 'Chapter checklist')}</h2>
        <output>{t(`完成 ${percent}%（${done.length}/${items.length}）`, `${percent}% done (${done.length}/${items.length})`)}</output>
      </header>
      <progress max={items.length} value={done.length} aria-label={t('完成进度', 'Progress')} />
      <ul>
        {items.map((item) => (
          <li key={item.id} data-done={done.includes(item.id) || undefined}>
            <label>
              {/* Off until we know where ticks go, so one made mid-load isn't overwritten by the load. */}
              <input
                type="checkbox"
                checked={done.includes(item.id)}
                disabled={where === 'loading'}
                onChange={(e) => toggle(item.id, e.target.checked)}
              />
              <span>
                {item.week !== undefined && <small className="guide-week">{weekLabel(item.week, zh)}</small>}
                {item.text[zh ? 0 : 1]}
              </span>
            </label>
            <details>
              <summary>{t('说明', 'Why')}</summary>
              <p>
                {item.detail[zh ? 0 : 1]}
                {item.href && (
                  <>
                    {' '}
                    <a href={item.href}>{t('去看看 →', 'Open →')}</a>
                  </>
                )}
              </p>
            </details>
          </li>
        ))}
      </ul>
      <small aria-live="polite">
        {where === 'device'
          ? t('未登录：勾选只保存在这个浏览器里，登录后会同步到账号。', 'Signed out: ticks stay in this browser and move to your account when you sign in.')
          : saveFailed
            ? t('保存失败，请检查网络后再勾一次。', 'Couldn’t save. Check your connection and tick again.')
            : where === 'account' && t('勾选会保存到你的账号。', 'Ticks are saved to your account.')}
      </small>
    </section>
  );
}
