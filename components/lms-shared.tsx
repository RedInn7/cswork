'use client';
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { api } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type { LmsPage } from '@/lib/lms-types';
import { CourseDiagram } from './course-diagram';
import { AlgorithmDemo } from './algorithm-demo';
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

// Stable renderer identities preserve diagram zoom/dialog state when learning
// progress or bootstrap data refreshes the parent component.
const markdownComponents: Components = {
  pre: ({ children }) => {
    const blocks = Children.toArray(children);
    const code = blocks[0];
    if (
      blocks.length === 1 &&
      isValidElement<{ className?: string; children?: unknown }>(code) &&
      code.props.className?.split(/\s+/).includes('language-algorithm-demo') &&
      typeof code.props.children === 'string'
    )
      return <AlgorithmDemo kind={code.props.children.trim()} />;
    if (
      blocks.length === 1 &&
      isValidElement<{ className?: string; children?: unknown }>(code) &&
      code.props.className?.split(/\s+/).includes('language-mermaid') &&
      typeof code.props.children === 'string'
    )
      return <CourseDiagram source={code.props.children} />;
    return <pre>{children}</pre>;
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith('/?view=') ? undefined : '_blank'}
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) =>
    typeof src === 'string' ? <MarkdownImage src={src} alt={alt} /> : null,
};
function MarkdownImage({ src, alt }: { src: string; alt?: string }) {
  const t = useT();
  return (
    <a href={src} target="_blank" rel="noreferrer">
      {/* oxlint-disable-next-line nextjs/no-img-element -- Markdown can contain authenticated images with unknown dimensions; keep the original browser request. */}
      <img
        src={src}
        alt={alt || t('课程图示', 'Course illustration')}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </a>
  );
}

export function LessonMarkdown({
  body,
  lecture = false,
}: {
  body: string;
  lecture?: boolean;
}) {
  return (
    <article
      className={`prose-content lms-markdown${lecture ? ' lecture-markdown' : ''}`}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {body}
      </Markdown>
    </article>
  );
}

export function Pagination({
  page,
  total,
  pageSize = 20,
  busy,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  busy?: boolean;
  onPage: (page: number) => void;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="lms-pagination" aria-label={t('分页', 'Pagination')}>
      <span className="muted">
        {t(
          `共 ${total} 条 · 第 ${page} / ${pages} 页`,
          `${total} items · Page ${page} of ${pages}`,
        )}
      </span>
      <div>
        <Button
          variant="outline"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t('上一页', 'Previous')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t('下一页', 'Next')}
        </Button>
      </div>
    </nav>
  );
}

export function useCursorPage<T>(path: string) {
  const [position, setPosition] = useState<{
    path: string;
    cursor: string | null;
    previous: (string | null)[];
  }>({ path, cursor: null, previous: [] });
  const [result, setResult] = useState<{
      key: string;
      data: LmsPage<T> | null;
      error: string;
    } | null>(null),
    [retry, setRetry] = useState(0);
  const current =
    position.path === path ? position : { path, cursor: null, previous: [] };
  const requestKey = `${path}:${current.cursor || ''}:${retry}`;
  const busy = result?.key !== requestKey,
    data = busy ? null : result?.data || null,
    error = busy ? '' : result?.error || '';
  useEffect(() => {
    let active = true;
    api<LmsPage<T>>(
      path +
        (path.includes('?') ? '&' : '?') +
        new URLSearchParams(current.cursor ? { cursor: current.cursor } : {}),
    )
      .then((data) => active && setResult({ key: requestKey, data, error: '' }))
      .catch(
        (e) =>
          active &&
          setResult({
            key: requestKey,
            data: null,
            error: (e as Error).message,
          }),
      );
    return () => {
      active = false;
    };
  }, [path, current.cursor, requestKey]);
  return {
    data,
    error,
    busy,
    page: current.previous.length + 1,
    refresh: () => setRetry((n) => n + 1),
    next: () =>
      data?.nextCursor &&
      setPosition({
        path,
        cursor: data.nextCursor,
        previous: [...current.previous, current.cursor],
      }),
    previous: () =>
      current.previous.length &&
      setPosition({
        path,
        cursor: current.previous[current.previous.length - 1],
        previous: current.previous.slice(0, -1),
      }),
  };
}
export function CursorPagination({
  list,
}: {
  list: {
    data: { total: number; nextCursor: string | null } | null;
    busy: boolean;
    page: number;
    previous: () => unknown;
    next: () => unknown;
  };
}) {
  const t = useT();
  const total = list.data?.total ?? '—';
  return (
    <nav className="lms-pagination" aria-label={t('分页', 'Pagination')}>
      <span className="muted">
        {t(
          `共 ${total} 条 · 第 ${list.page} 页`,
          `${total} items · Page ${list.page}`,
        )}
      </span>
      <div>
        <Button
          variant="outline"
          disabled={list.busy || list.page <= 1}
          onClick={() => list.previous()}
        >
          {t('上一页', 'Previous')}
        </Button>
        <Button
          variant="outline"
          disabled={list.busy || !list.data?.nextCursor}
          onClick={() => list.next()}
        >
          {t('下一页', 'Next')}
        </Button>
      </div>
    </nav>
  );
}
export function useDebounced(value: string, delay = 300) {
  const [next, setNext] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setNext(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return next;
}

export function useLocalDraft(key: string, initial: string) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const [restored, setRestored] = useState(false);
  const [storageError, setStorageError] = useState('');
  const loaded = useRef(false);
  const current = useRef(value);
  useLayoutEffect(() => {
    current.current = value;
  }, [value]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && saved !== initial) {
        // oxlint-disable-next-line react/react-compiler -- Restore the browser-owned draft only when its key or saved server baseline changes.
        setValue(saved);
        setRestored(true);
      }
    } catch {
      setStorageError('浏览器无法保存草稿，请在离开前提交。');
    }
    loaded.current = true;
  }, [key, initial]);
  const update = useCallback(
    (next: string) => {
      current.current = next;
      setValue(next);
      try {
        localStorage.setItem(key, next);
        setStorageError('');
      } catch {
        setStorageError('浏览器无法保存草稿，请在离开前提交。');
      }
    },
    [key],
  );
  const clear = useCallback(() => {
    try {
      if (localStorage.getItem(key) === current.current)
        localStorage.removeItem(key);
    } catch {}
    setRestored(false);
  }, [key]);
  return {
    value,
    update,
    clear,
    restored,
    // The state keeps the Chinese text so the effects above stay language-free.
    storageError:
      storageError &&
      t(storageError, "Your browser can't save drafts. Submit before leaving."),
    loaded,
  };
}

// LessonNotes keeps its status as Chinese text (set from async saves); render picks the language.
const noteStatusEn: Record<string, string> = {
  笔记会自动保存: 'Notes save automatically',
  '正在保存…': 'Saving…',
  已保存: 'Saved',
  已保留本地草稿: 'Kept as a local draft',
  有未保存的修改: 'Unsaved changes',
};
export function LessonNotes({
  userId,
  lessonId,
  initial,
  onSaved,
}: {
  userId: string;
  lessonId: string;
  initial: string;
  onSaved: (note: string) => void;
}) {
  const t = useT();
  const draft = useLocalDraft(`cswork:notes:${userId}:${lessonId}`, initial);
  const [status, setStatus] = useState('笔记会自动保存');
  const [error, setError] = useState('');
  const latest = useRef(draft.value),
    saved = useRef(initial),
    inFlight = useRef(false),
    alive = useRef(true);
  const savedCallback = useRef(onSaved);
  useLayoutEffect(() => {
    savedCallback.current = onSaved;
    latest.current = draft.value;
  }, [onSaved, draft.value]);
  const clearDraft = draft.clear,
    draftLoaded = draft.loaded;
  const save = useCallback(async () => {
    if (inFlight.current || latest.current === saved.current) return;
    inFlight.current = true;
    if (alive.current) {
      setStatus('正在保存…');
      setError('');
    }
    try {
      while (latest.current !== saved.current) {
        const note = latest.current;
        await api('progress', { lessonId, note });
        saved.current = note;
        savedCallback.current(note);
        if (latest.current === note) clearDraft();
      }
      if (alive.current) setStatus('已保存');
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setStatus('已保留本地草稿');
      }
    } finally {
      inFlight.current = false;
    }
  }, [lessonId, clearDraft]);
  useEffect(() => {
    if (!draftLoaded.current || draft.value === saved.current) return;
    setStatus('有未保存的修改');
    const timer = setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [draft.value, draftLoaded, save]);
  useEffect(() => {
    alive.current = true;
    const flush = () => {
      if (latest.current !== saved.current && !inFlight.current)
        void fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, note: latest.current }),
          keepalive: true,
        }).catch(() => {});
    };
    const online = () => void save();
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', online);
    return () => {
      alive.current = false;
      flush();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', online);
    };
  }, [lessonId, save]);
  return (
    <div className="notes-pane">
      <label htmlFor="lesson-note">
        {t(
          '记下思路、疑问和你自己的理解',
          'Write down your ideas, questions and takeaways',
        )}
      </label>
      {draft.restored && (
        <p className="notice">
          {t(
            '已恢复这台设备上的未保存笔记。',
            'Restored unsaved notes from this device.',
          )}
        </p>
      )}
      <textarea
        id="lesson-note"
        value={draft.value}
        onChange={(e) => draft.update(e.target.value)}
        onBlur={() => void save()}
        placeholder={t('这一章我学到了…', 'In this lesson I learned…')}
        maxLength={20000}
      />
      <div className="lms-toolbar">
        <output className="muted">{t(status, noteStatusEn[status])}</output>
        <Button variant="outline" onClick={() => void save()}>
          {t('立即保存', 'Save now')}
        </Button>
      </div>
      {(error || draft.storageError) && (
        <p className="error-text" role="alert">
          {error ? t(error, englishMessage(error)) : draft.storageError}{' '}
          <Button variant="ghost" onClick={() => void save()}>
            {t('重试保存', 'Retry save')}
          </Button>
        </p>
      )}
    </div>
  );
}
