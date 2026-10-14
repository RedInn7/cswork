'use client';
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CornerDownLeft, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { companyHubPath, oaProblemPath } from '@/lib/oa-company-brands';
import { ojRequest } from '@/lib/oj-client';
import { STOP_NAMES } from '@/lib/route-stops';
import '@/app/command-palette.css';

// Loaded with the first answer, so every page doesn't carry the Markdown renderer.
const StatementMarkdown = lazy(() => import('./statement-markdown').then((m) => ({ default: m.StatementMarkdown })));

/**
 * ⌘K / Ctrl+K site search, mounted once in app/layout.tsx: problems, OA problems, Line 500
 * topics, companies, library pages and (signed in) course lessons, merged into one keyboard
 * list. With AI on, the last row asks the question of the site's own pages (lib/server/ai-ask.ts)
 * and the answer cites them. Pages open it with openCommandPalette(); selected text on lecture
 * and library pages opens it as context (SelectionAsk).
 */
export type PaletteGroup = 'problems' | 'oa' | 'topics' | 'companies' | 'content' | 'lessons';
export type PaletteHit = { group: PaletteGroup; key: string; title: string; meta?: string; href: string };
const GROUPS: PaletteGroup[] = ['problems', 'oa', 'topics', 'companies', 'content', 'lessons'];
const GROUP_NAMES: Record<PaletteGroup, [string, string]> = {
  problems: ['题目', 'Problems'],
  oa: ['OA 真题', 'OA problems'],
  topics: ['专题', 'Topics'],
  companies: ['公司', 'Companies'],
  content: ['内容库', 'Library'],
  lessons: ['课时', 'Lessons'],
};
const PER_GROUP = 5;
const TYPE_NAMES: Record<string, [string, string]> = {
  coding_question: ['编程题', 'Coding'],
  interview_question: ['面试题', 'Question'],
  experience: ['面经', 'Experience'],
  concept: ['概念', 'Concept'],
  article: ['文章', 'Article'],
  cheatsheet: ['速查表', 'Cheatsheet'],
  algorithm: ['算法教程', 'Tutorial'],
};
const has = (text: string, q: string) => text.toLocaleLowerCase().includes(q);

/** Line 500 topics whose name (either language) or slug contains the query. */
export function topicHits(query: string, zh: boolean): PaletteHit[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  return Object.entries(STOP_NAMES)
    .filter(([slug, names]) => has(slug.replace(/-/g, ' '), q) || names.some((n) => has(n, q)))
    .map(([slug, names]) => ({ group: 'topics' as const, key: slug, title: names[zh ? 0 : 1], meta: zh ? '代码模板与练习' : 'Template & practice', href: `/topics/${slug}` }));
}
/** Employers with a company page whose name or slug contains the query, prefix matches first. */
export function companyHits(query: string, companies: readonly { slug: string; name: string }[]): PaletteHit[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  return companies
    .filter((c) => has(c.name, q) || has(c.slug, q))
    .sort((a, b) => Number(!a.name.toLocaleLowerCase().startsWith(q)) - Number(!b.name.toLocaleLowerCase().startsWith(q)))
    .map((c) => ({ group: 'companies' as const, key: c.slug, title: c.name, href: companyHubPath(c.slug) }));
}
/** One keyboard list: groups in a fixed order, at most PER_GROUP rows each. */
export function mergeHits(found: Partial<Record<PaletteGroup, PaletteHit[]>>) {
  return GROUPS.flatMap((g) => (found[g] ?? []).slice(0, PER_GROUP));
}

type Json = Record<string, unknown>;
/** A GET for the palette: the parsed body, or the status when it failed (401 tells us signed out). */
async function read(url: string, signal: AbortSignal): Promise<Json | Json[] | number> {
  try {
    const response = await fetch(url, { signal, headers: { 'X-Locale': document.documentElement.lang.startsWith('zh') ? 'zh' : 'en' } });
    return response.ok ? ((await response.json()) as Json | Json[]) : response.status;
  } catch {
    return 0;
  }
}
const items = (value: Json | Json[] | number) =>
  (typeof value === 'number' ? [] : Array.isArray(value) ? value : ((value.items as Json[] | undefined) ?? [])) as Json[];
const text = (value: unknown) => (typeof value === 'string' ? value : '');

let companies: Promise<{ slug: string; name: string }[]> | null = null;
let signedOut = false;
/** Every remote group for this query, each one failing alone. */
async function searchSite(query: string, zh: boolean, signal: AbortSignal) {
  const q = encodeURIComponent(query);
  const pick = (value: unknown, other: unknown) => (zh ? text(value) || text(other) : text(other) || text(value));
  const problems = (async () => {
    // Signed out, only the curated line is searchable; remember that instead of asking twice.
    let found = signedOut ? 401 : await read(`/api/oj/library?collection=all&q=${q}`, signal);
    if (found === 401) {
      signedOut = true;
      found = await read(`/api/oj/library?q=${q}`, signal);
    }
    return items(found)
      .filter((p) => p.judgeProblemId)
      .map((p) => ({
        group: 'problems' as const,
        key: text(p.id),
        title: `${p.number}. ${pick(p.titleZh, p.titleEn)}`,
        meta: text(p.difficulty),
        href: `/?view=problem&problem=${encodeURIComponent(text(p.judgeProblemId))}`,
      }));
  })();
  const oa = read(`/api/oj/oa-library?q=${q}`, signal).then((page) =>
    items(page).map((p) => ({
      group: 'oa' as const,
      key: text(p.id),
      title: text(p.title),
      meta: `${text(p.companyName)} #${p.number}`,
      href: oaProblemPath(text(p.companySlug), text(p.id)),
    })),
  );
  const content = read(`/api/content/list?type=search&q=${q}`, signal).then((page) =>
    items(page).map((c) => {
      const type = text(c.type);
      return {
        group: 'content' as const,
        key: `${type}/${text(c.slug)}`,
        title: pick(c.titleZh, c.title),
        meta: [Object.hasOwn(TYPE_NAMES, type) ? TYPE_NAMES[type][zh ? 0 : 1] : type, text((c.company as Json | null)?.name)].filter(Boolean).join(' · '),
        // Partial pages are not public; the workspace shows what there is.
        href: c.partial
          ? `/?${new URLSearchParams({ view: 'content', type, slug: text(c.slug) })}`
          : `/library/${encodeURIComponent(type)}/${encodeURIComponent(text(c.slug))}`,
      };
    }),
  );
  const lessons = signedOut
    ? Promise.resolve([])
    : read(`/api/search?q=${q}`, signal).then((found) => {
        if (found === 401) signedOut = true;
        return items(found).map((l) => ({ group: 'lessons' as const, key: text(l.id), title: text(l.title), meta: text(l.summary), href: `/?view=lesson&lesson=${encodeURIComponent(text(l.id))}` }));
      });
  companies ??= read('/api/oj/reports/companies', new AbortController().signal).then((list) => {
    const value = items(list) as { slug: string; name: string }[];
    if (!value.length) companies = null;
    return value;
  });
  const [p, o, c, l, all] = await Promise.all([problems, oa, content, lessons, companies]);
  return { problems: p, oa: o, content: c, lessons: l, topics: topicHits(query, zh), companies: companyHits(query, all) };
}

/** Same-tab navigation: the workspace follows its own URLs without a reload. */
function go(href: string) {
  if (location.pathname === '/' && href.startsWith('/?')) {
    history.pushState(null, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0 });
  } else location.assign(href);
}

type Answer = { text: string | null; sources: { n: number; title: string; url: string; type: string }[]; remaining?: number };
const OPEN = 'cswork:palette';
/** Opens the palette; `context` is selected text to ask about. */
export function openCommandPalette(detail: { context?: string } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail }));
}
const AskContext = createContext<((context: string) => void) | null>(null);
/** Ask AI about some text, or null when AI is off. */
export const useAskAi = () => useContext(AskContext);

export function CommandPalette({ ai, children }: { ai: boolean; children?: ReactNode }) {
  const ask = useCallback((context: string) => openCommandPalette({ context }), []);
  return (
    <AskContext.Provider value={ai ? ask : null}>
      {children}
      <Palette ai={ai} />
    </AskContext.Provider>
  );
}

function Palette({ ai }: { ai: boolean }) {
  const zh = useLocale() === 'zh';
  const t = (a: string, b: string) => (zh ? a : b);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [context, setContext] = useState('');
  const [hits, setHits] = useState<PaletteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const show = (event: Event) => {
      setContext(((event as CustomEvent<{ context?: string }>).detail?.context ?? '').trim().slice(0, 1500));
      setAnswer(null);
      setError('');
      setOpen(true);
    };
    window.addEventListener('keydown', key);
    window.addEventListener(OPEN, show);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener(OPEN, show);
    };
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      // Modal: focus stays inside and Esc closes. Old engines get a plain open dialog.
      if (typeof node.showModal === 'function') node.showModal();
      else node.setAttribute('open', '');
      input.current?.focus();
    } else if (!open && node.open) {
      if (typeof node.close === 'function') node.close();
      else node.removeAttribute('open');
    }
  }, [open]);

  const q = query.trim();
  const searchable = q.length >= 2 || /[㐀-鿿]/.test(q);
  useEffect(() => {
    if (!open || !searchable) {
      setHits([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    // Topics and companies match locally; the rest after a pause in typing.
    const timer = setTimeout(() => {
      searchSite(q, zh, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setHits(mergeHits(found));
          setActive(0);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, zh, open, searchable]);

  const canAsk = ai && (searchable || !!context);
  const rows = hits.length + (canAsk ? 1 : 0);
  // With selected text, the question is about it: the ask row comes first.
  const askIndex = canAsk ? (context ? 0 : hits.length) : -1;
  const hitAt = (index: number) => hits[context && canAsk ? index - 1 : index];
  const optionId = (index: number) => `${id}-option-${index}`;

  const askAi = async () => {
    const question = q || t('这段内容讲的是什么？', 'What does this passage mean?');
    setAsking(true);
    setError('');
    setAnswer(null);
    try {
      setAnswer(await ojRequest<Answer>('ai/ask', { question, locale: zh ? 'zh' : 'en', ...(context && { context }) }));
    } catch (caught) {
      const failure = caught as Error & { status?: number | string };
      if (failure.status === 401) {
        setError(t('登录后才能问 AI。', 'Sign in to ask the AI.'));
        window.dispatchEvent(new Event('cswork:auth-required'));
      } else
        setError(
          failure.status === 'timeout'
            ? t('AI 响应超时，请稍后再试', 'The AI took too long. Please try again')
            : zh
              ? failure.message
              : englishMessage(failure.message),
        );
    } finally {
      setAsking(false);
    }
  };
  const choose = (index: number) => {
    if (index === askIndex) return void askAi();
    const hit = hitAt(index);
    if (!hit) return;
    setOpen(false);
    go(hit.href);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!rows) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : rows - 1)) % rows);
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      choose(Math.min(active, rows - 1));
    }
  };
  // Plain left clicks stay in the tab through go(); modified clicks open the link as usual.
  const click = (index: number) => (event: React.MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    choose(index);
  };

  const askRow = canAsk && (
    <li
      key="ask"
      id={optionId(askIndex)}
      role="option"
      aria-selected={active === askIndex}
      className="cmdk-ask"
      onMouseEnter={() => setActive(askIndex)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => choose(askIndex)}
    >
      <Sparkles size={15} aria-hidden="true" />
      <span className="cmdk-title">
        {context
          ? q
            ? t(`就选中的内容问 AI：「${q}」`, `Ask AI about the selection: “${q}”`)
            : t('让 AI 解释选中的内容', 'Ask AI to explain the selection')
          : t(`问 AI：「${q}」`, `Ask AI: “${q}”`)}
      </span>
      <span className="cmdk-meta">{t('基于站内内容回答', 'Answers from CSWork pages')}</span>
    </li>
  );
  let index = context && canAsk ? 1 : 0;
  return (
    <dialog
      ref={dialog}
      className="cmdk"
      aria-label={t('搜索全站', 'Search CSWork')}
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === dialog.current) setOpen(false);
      }}
    >
      {open && (
        <div className="cmdk-panel">
          <div className="cmdk-bar">
            <Search size={17} aria-hidden="true" />
            <input
              ref={input}
              role="combobox"
              aria-expanded={rows > 0}
              aria-controls={`${id}-list`}
              aria-activedescendant={rows ? optionId(Math.min(active, rows - 1)) : undefined}
              aria-autocomplete="list"
              aria-label={t('搜索题目、OA、专题、公司和内容', 'Search problems, OA, topics, companies and the library')}
              placeholder={
                context
                  ? t('就选中的内容提问…', 'Ask about the selected text…')
                  : t('搜索题目、OA、专题、公司…', 'Search problems, OA, topics, companies…')
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
            {searching && <LoaderCircle size={15} className="cmdk-spin" aria-hidden="true" />}
            <kbd>Esc</kbd>
          </div>
          {context && (
            <div className="cmdk-context">
              <span>{t('选中的内容', 'Selected text')}</span>
              <q>{context.length > 160 ? `${context.slice(0, 160)}…` : context}</q>
              <button type="button" onClick={() => setContext('')}>
                {t('移除', 'Remove')}
              </button>
            </div>
          )}
          <div aria-live="polite" className="cmdk-answer-region">
            {asking && (
              <p className="cmdk-status">
                <LoaderCircle size={14} className="cmdk-spin" aria-hidden="true" /> {t('正在查站内内容并作答…', 'Reading CSWork pages…')}
              </p>
            )}
            {error && (
              <p className="cmdk-error" role="alert">
                {error}
              </p>
            )}
            {answer && (
              <section className="cmdk-answer" aria-label={t('AI 回答', 'AI answer')}>
                {answer.text ? (
                  <>
                    <Suspense fallback={<p>{answer.text}</p>}>
                      <StatementMarkdown body={answer.text} className="cs-statement-markdown cmdk-answer-text" plain />
                    </Suspense>
                    {!!answer.sources.length && (
                      <ol className="cmdk-sources" aria-label={t('引用来源', 'Sources')}>
                        {answer.sources.map((s) => (
                          <li key={s.n}>
                            <span className="cmdk-source-n">[{s.n}]</span>
                            <a href={s.url}>{s.title}</a>
                          </li>
                        ))}
                      </ol>
                    )}
                    <p className="cmdk-fine">
                      {t('AI 只根据上面的站内页面作答，也可能出错；不会给出编程题的完整解法。', 'The AI answers only from the pages above and can be wrong; it never gives full solutions.')}
                      {answer.remaining !== undefined && (zh ? ` 今天还剩 ${answer.remaining} 次。` : ` ${answer.remaining} left today.`)}
                    </p>
                  </>
                ) : (
                  <p>{t('站内没有找到能回答这个问题的内容，换个说法或关键词试试。', 'No CSWork page covers this yet. Try other words.')}</p>
                )}
              </section>
            )}
          </div>
          <ul id={`${id}-list`} role="listbox" className="cmdk-list" aria-label={t('搜索结果', 'Results')}>
            {context && askRow}
            {GROUPS.map((group) => {
              const rowsOf = hits.filter((h) => h.group === group);
              if (!rowsOf.length) return null;
              return (
                <li key={group} role="presentation" className="cmdk-group" data-group={group}>
                  <p id={`${id}-${group}`} className="cmdk-group-name" aria-hidden="true">
                    {GROUP_NAMES[group][zh ? 0 : 1]}
                  </p>
                  <ul role="group" aria-labelledby={`${id}-${group}`}>
                    {rowsOf.map((hit) => {
                      const i = index++;
                      return (
                        <li key={hit.key} role="presentation">
                          <a
                            id={optionId(i)}
                            role="option"
                            aria-selected={active === i}
                            href={hit.href}
                            tabIndex={-1}
                            onMouseEnter={() => setActive(i)}
                            onClick={click(i)}
                          >
                            <span className="cmdk-title">{hit.title}</span>
                            {hit.meta && <span className="cmdk-meta">{hit.meta}</span>}
                            <CornerDownLeft size={13} className="cmdk-enter" aria-hidden="true" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
            {!context && askRow}
          </ul>
          {canAsk && !answer && (
            <p className="cmdk-fine cmdk-ask-note">
              {t(
                '「问 AI」会把你的问题、选中的文字和匹配到的站内内容发送给 Anthropic，不含邮箱和姓名。',
                'Ask AI sends your question, any selected text and the matching CSWork pages to Anthropic, never your email or name.',
              )}
            </p>
          )}
          {searchable && !searching && !hits.length && !answer && (
            <p className="cmdk-empty">{t('没有匹配的结果。', 'No matches.')}</p>
          )}
          {!searchable && !context && (
            <p className="cmdk-empty">
              {t('试试：双指针、Amazon、LRU、系统设计', 'Try: two pointers, Amazon, LRU, system design')}
            </p>
          )}
          <footer className="cmdk-foot" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t('选择', 'move')}
            </span>
            <span>
              <kbd>↵</kbd> {t('打开', 'open')}
            </span>
            <span>
              <kbd>{typeof navigator !== 'undefined' && /Mac|iP/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd>
              <kbd>K</kbd> {t('开关', 'toggle')}
            </span>
          </footer>
        </div>
      )}
    </dialog>
  );
}

/** A header button that opens the palette, with its shortcut. */
export function PaletteButton({ className = '' }: { className?: string }) {
  const zh = useLocale() === 'zh';
  // The server can't know the platform: ⌘K until the browser says otherwise.
  const [mod, setMod] = useState('⌘');
  useEffect(() => {
    if (!/Mac|iP/.test(navigator.platform)) setMod('Ctrl ');
  }, []);
  return (
    <button type="button" className={`cmdk-trigger ${className}`} onClick={() => openCommandPalette()}>
      <Search size={14} aria-hidden="true" />
      <span>{zh ? '搜索' : 'Search'}</span>
      <kbd aria-hidden="true">{mod}K</kbd>
    </button>
  );
}

/**
 * Wraps lecture and library text: selecting some of it floats an "Ask AI" button that opens the
 * palette with the selection as context. Without AI it renders the children as they are.
 */
export function SelectionAsk({ children, className }: { children: ReactNode; className?: string }) {
  const ask = useAskAi();
  const zh = useLocale() === 'zh';
  const box = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number; text: string } | null>(null);
  const measure = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!selection || selection.isCollapsed || text.length < 2 || !box.current?.contains(selection.anchorNode)) return setSpot(null);
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSpot({ x: rect.left + rect.width / 2, y: rect.bottom, text: text.slice(0, 1500) });
  }, []);
  useEffect(() => {
    if (!spot) return;
    const clear = () => {
      if (window.getSelection()?.isCollapsed ?? true) setSpot(null);
    };
    const hide = () => setSpot(null);
    document.addEventListener('selectionchange', clear);
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    return () => {
      document.removeEventListener('selectionchange', clear);
      window.removeEventListener('scroll', hide, { capture: true });
    };
  }, [spot]);
  const style = useMemo(() => (spot ? { left: `${spot.x}px`, top: `${spot.y + 8}px` } : undefined), [spot]);
  if (!ask) return <div className={className}>{children}</div>;
  return (
    <div ref={box} className={className} onMouseUp={measure} onKeyUp={measure}>
      {children}
      {spot && (
        <button
          type="button"
          className="cmdk-selection-ask"
          style={style}
          // Keep the selection while the button takes the click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            ask(spot.text);
            setSpot(null);
          }}
        >
          <Sparkles size={14} aria-hidden="true" /> {zh ? '问 AI' : 'Ask AI'}
        </button>
      )}
    </div>
  );
}
