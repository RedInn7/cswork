'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { ApiError, api } from '@/lib/types';
import { stashNoteDraft } from '@/components/problem-notes';
import { TryFirst } from '@/components/try-first';
import { RecallRate } from '@/components/recall-rate';
import { ReportIssue } from '@/components/report-issue';
import '@/app/redesign.css';

// The chapters the learner marked read (user_marks: sd:<slug>, read), fetched once for the page.
type Read = { state: 'loading' | 'guest' | 'failed' | 'ready'; slugs: ReadonlySet<string> };
const LOADING: Read = { state: 'loading', slugs: new Set() };
let read = LOADING;
let requested = false;
const listeners = new Set<() => void>();
function publish(next: Read) {
  read = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    api<{ items: { target: string }[] }>('oj/marks?mark=read').then(
      ({ items }) =>
        publish({
          state: 'ready',
          slugs: new Set(items.flatMap(({ target }) => (target.startsWith('sd:') ? [target.slice(3)] : []))),
        }),
      (error: unknown) =>
        publish({ state: error instanceof ApiError && error.status === 401 ? 'guest' : 'failed', slugs: new Set() }),
    );
  }
  return () => {
    listeners.delete(listener);
    // The next page asks again.
    if (!listeners.size) requested = false;
  };
}
const useRead = () => useSyncExternalStore(subscribe, () => read, () => LOADING);

/** A tick on a chapter the learner has read; `quiet` keeps the word for screen readers only. */
export function SdReadCheck({ slug, quiet }: { slug: string; quiet?: boolean }) {
  const t = useT();
  if (!useRead().slugs.has(slug)) return null;
  return (
    <span className="sd-read-check">
      <Check size={14} aria-hidden="true" />
      <span className={quiet ? 'sr-only' : undefined}>{t('已读', 'Read')}</span>
    </span>
  );
}

/** "Report an issue" at a chapter's end; the read marks already tell a guest from a learner. */
export function SdReportIssue({ refId }: { refId: string }) {
  const { state } = useRead();
  return <ReportIssue refId={refId} signedIn={state === 'guest' ? false : state === 'ready' || undefined} />;
}

/**
 * A /learn chapter's key points as a review card (lib/recall.ts): graded against the chapter's
 * "Key points" list. Waits for the read marks to tell a guest (this device) from a learner.
 */
export function SdRecall({ target, title, points }: { target: string; title: string; points: string[] }) {
  const { state } = useRead();
  if (state === 'loading') return null;
  return (
    <div className="rd">
      <RecallRate key={target} target={target} title={title} points={points} signedIn={state !== 'guest'} lesson />
    </div>
  );
}

/** "Read 7/27" with a bar, once a signed-in learner's marks are in. */
export function SdReadCount({ slugs }: { slugs: string[] }) {
  const t = useT();
  const { state, slugs: done } = useRead();
  if (state !== 'ready') return null;
  const n = slugs.filter((slug) => done.has(slug)).length;
  return (
    <p className="sd-read-count">
      <span className="sd-read-bar" aria-hidden="true">
        <span style={{ width: `${(100 * n) / slugs.length}%` }} />
      </span>
      {t(`已读 ${n}/${slugs.length}`, `${n} of ${slugs.length} read`)}
    </p>
  );
}

/**
 * "Continue: <chapter>", the first of `chapters` (in reading order) the learner has not marked
 * read; "Start here" before the first mark. Nothing for guests or once every chapter is read.
 */
export function SdContinue({ chapters }: { chapters: { slug: string; title: string; href: string }[] }) {
  const t = useT();
  const { state, slugs: done } = useRead();
  const next = chapters.find((chapter) => !done.has(chapter.slug));
  if (state !== 'ready' || !next) return null;
  return (
    <a className="sd-continue" href={next.href}>
      <span>{chapters.some((chapter) => done.has(chapter.slug)) ? t('继续学习', 'Continue') : t('从这里开始', 'Start here')}</span>
      {next.title}
    </a>
  );
}

/** "Mark as read" at the end of a chapter, with the course total; guests are asked to sign in. */
export function SdMarkRead({ slug, slugs }: { slug: string; slugs: string[] }) {
  const t = useT();
  const { state, slugs: done } = useRead();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The course's certificate, issued when this mark completed it (lib/server/certificates.ts).
  const [certificate, setCertificate] = useState<string | null>(null);
  if (state === 'guest')
    return (
      <div className="sd-read">
        <a className="sd-read-toggle" href="/?view=account">
          {t('登录后可以标记已读、记录课程进度', 'Sign in to mark chapters read and track your progress')}
        </a>
      </div>
    );
  const toggle = async (on: boolean) => {
    setBusy(true);
    setError('');
    try {
      const reply = await api<{ certificate?: string | null }>('oj/marks', { target: `sd:${slug}`, mark: 'read', on });
      setCertificate(reply.certificate ?? null);
      const next = new Set(read.slugs);
      if (on) next.add(slug);
      else next.delete(slug);
      publish({ ...read, slugs: next });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sd-read">
      <label className="sd-read-toggle">
        <input
          type="checkbox"
          checked={done.has(slug)}
          disabled={state === 'loading' || busy}
          onChange={(event) => void toggle(event.target.checked)}
        />
        {t('读完了，标记为已读', "I've read this chapter")}
      </label>
      <SdReadCount slugs={slugs} />
      {/* Mounted before the notice, so screen readers announce it (focus stays on the checkbox). */}
      <div role="status" className={certificate ? 'sd-read-certificate' : undefined}>
        {certificate && (
          <>
            {t('整门课都读完了，结业证书已签发：', 'You have read the whole course. Your certificate is ready: ')}
            <a href={`/certificate/${certificate}`}>{t('查看证书', 'View certificate')}</a>
          </>
        )}
      </div>
      {error && (
        <p className="sd-read-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const openKey = (slug: string) => `cswork:sd-open:${slug}`;
const draftKey = (slug: string) => `cswork:sd-draft:${slug}`;

/**
 * A case chapter's walkthrough waits behind "design it yourself first" (components/try-first.tsx,
 * the private note `sd:<slug>/draft`). It stays in the page, faded and inert, until the learner
 * writes something or skips; a chapter drafted, read or opened before opens straight away, and so
 * does a link to one of its sections. A guest's draft is kept on this device and goes to their note
 * once they sign in (the page reloads, so TryFirst cannot carry it over itself). Once open, the
 * learner grades their design against it for spaced review (components/recall-rate.tsx).
 */
export function SdTryFirst({
  slug,
  title,
  userId,
  children,
}: {
  slug: string;
  title: string;
  userId: string | null;
  children: ReactNode;
}) {
  const t = useT();
  const marked = useRead().slugs.has(slug);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const kept = localStorage.getItem(draftKey(slug)) ?? '';
      if (localStorage.getItem(openKey(slug)) || kept.trim()) setOpen(true);
      if (!userId) setDraft(kept);
      // Runs before the note's load answers, which then saves it or offers it beside a saved one.
      else if (kept && stashNoteDraft(userId, `sd:${slug}/draft`, kept)) localStorage.removeItem(draftKey(slug));
    } catch {}
    const follow = () => {
      let id = '';
      try {
        id = decodeURIComponent(location.hash.slice(1));
      } catch {}
      const target = id ? document.getElementById(id) : null;
      if (!target || !body.current?.contains(target)) return;
      setOpen(true);
      requestAnimationFrame(() => target.scrollIntoView());
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [slug, userId]);
  // Once read, it stays open even if the mark is taken off (the checkbox sits below it).
  useEffect(() => {
    if (!marked) return;
    setOpen(true);
    try {
      localStorage.setItem(openKey(slug), '1');
    } catch {}
  }, [marked, slug]);
  const shown = open || marked;
  return (
    <>
      <div className="rd sd-try">
        <p className="sd-try-brief">
          {t(
            '先花 10 分钟自己设计：需求、核心实体、API 和高层架构，各写几行。写完或者跳过之后，下面的讲解才会展开。',
            'Spend 10 minutes on your own design first: requirements, core entities, the API and the high-level architecture, a few lines each. The walkthrough below opens once you have written it or skipped.',
          )}
        </p>
        <TryFirst
          key={slug}
          userId={userId}
          target={`sd:${slug}/draft`}
          revealed={shown}
          revealOnLoad
          local={{
            value: draft,
            onChange: (value) => {
              setDraft(value);
              try {
                if (value) localStorage.setItem(draftKey(slug), value);
                else localStorage.removeItem(draftKey(slug));
              } catch {}
            },
          }}
          onReveal={(asked) => {
            setOpen(true);
            try {
              localStorage.setItem(openKey(slug), '1');
            } catch {}
            if (asked) requestAnimationFrame(() => body.current?.focus());
          }}
        />
      </div>
      <div
        ref={body}
        className="sd-walkthrough"
        tabIndex={-1}
        data-closed={shown ? undefined : ''}
        inert={!shown}
      >
        {children}
      </div>
      {shown && (
        <div className="rd">
          <RecallRate key={slug} target={`sd:${slug}`} title={title} signedIn={!!userId} />
        </div>
      )}
    </>
  );
}
