'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Circle, Copy, GitFork, Globe, Lock, Star, Trash2, X } from 'lucide-react';
import { api, type Boot } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { problemTitle } from '@/lib/problems';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import type { PracticeHistoryItem } from '@/lib/practice-review';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import type { Navigate } from './learning';
import { communityProblem } from './problem-community';
import '@/app/learner-cloud.css';

type T = (zh: string, en: string) => string;
/** The server's cap on problems per list. */
const LIST_ITEMS = 500;
type Summary = {
  id: string;
  title: string;
  description: string;
  visibility: 'private' | 'public';
  forkedFrom: string | null;
  count: number;
  updatedAt: number;
};
type Detail = Summary & {
  items: { problemId: string; addedAt: number }[];
  mine: boolean;
  owner: string | null;
  /** Saves and copies of the list, and whether this reader saved it. */
  stars?: number;
  forks?: number;
  starred?: boolean;
};
type Starred = Summary & { owner: string | null };
const plain = (e: React.MouseEvent) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
const LEVELS: Record<string, string> = { 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' };

/** ?view=lists: the learner's own problem lists; &list=<id> opens one (theirs or a public one). */
export function MyLists({
  boot,
  navigate,
  list,
}: {
  boot: Boot;
  navigate: Navigate;
  list?: string;
}) {
  const english = useLocale() === 'en';
  const t: T = (zh, en) => (english ? en : zh);
  return (
    <section className="study-library algorithm-library cloud-lists" lang={english ? 'en' : 'zh'}>
      {list ? (
        <ListDetail key={list} id={list} boot={boot} navigate={navigate} t={t} english={english} />
      ) : (
        <ListIndex navigate={navigate} t={t} english={english} />
      )}
    </section>
  );
}

function ListIndex({ navigate, t, english }: { navigate: Navigate; t: T; english: boolean }) {
  const [lists, setLists] = useState<Summary[] | null>(null);
  const [starred, setStarred] = useState<Starred[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<{ items: Summary[] }>('oj/lists').then(
      (r) => live && setLists(r.items),
      (e: Error) => live && setError(e.message),
    );
    // Saved lists are extra: the index still shows when they cannot load.
    api<{ items: Starred[] }>('oj/lists/starred').then(
      (r) => live && setStarred(Array.isArray(r.items) ? r.items : []),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  async function create(problemIds: string[], name: string) {
    setBusy(true);
    setError('');
    try {
      const made = await api<Summary>('oj/lists', { title: name, problemIds });
      navigate('lists', { list: made.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function fromStarred() {
    try {
      const { items } = await api<{ items: { target: string }[] }>('oj/marks?mark=star');
      const ids = items.flatMap((m) =>
        m.target.startsWith('problem:') && communityProblem(m.target.slice(8)) ? [m.target.slice(8)] : [],
      );
      if (!ids.length) {
        setError(t('还没有收藏的题。在题目页点星标收藏。', 'Nothing starred yet. Star problems on their pages first.'));
        return;
      }
      // A list holds 500 problems; the name says when the stars did not all fit.
      await create(
        ids.slice(0, LIST_ITEMS),
        ids.length > LIST_ITEMS ? t('我的收藏（前 500 道）', 'My starred (first 500)') : t('我的收藏', 'My starred'),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <header className="cloud-board">
        <p className="route-kicker">{t('个人站台 · 我的题单', 'Your platform · My lists')}</p>
        <h1>{t('我的题单', 'My lists')}</h1>
        <p>
          {t(
            '把题目收进自己的题单，设为公开后可以把链接发给同学，别人也能复制一份。',
            'Collect problems into your own lists. Make one public to share its link; others can copy it.',
          )}
        </p>
        <form
          className="cloud-board-new"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) void create([], title.trim());
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={t('题单名称，例如「字节二面前」', 'List name, e.g. "Before the onsite"')}
            aria-label={t('题单名称', 'List name')}
          />
          <button type="submit" disabled={busy || !title.trim()}>
            {t('新建题单', 'New list')}
          </button>
          <button type="button" className="is-quiet" disabled={busy} onClick={() => void fromStarred()}>
            <Star size={14} aria-hidden="true" />
            {t('收藏存为题单', 'Save starred as a list')}
          </button>
        </form>
      </header>
      {error && (
        <p className="cloud-error" role="alert">
          {t(error, englishMessage(error))}
        </p>
      )}
      {lists === null && !error ? (
        <output className="study-state">{t('正在加载…', 'Loading…')}</output>
      ) : lists?.length ? (
        <ul className="study-list progress-list cloud-list-rows">
          {lists.map((l) => (
            <li key={l.id}>
              <a
                className="study-row progress-row"
                href={`/?view=lists&list=${l.id}`}
                onClick={(e) => {
                  if (!plain(e)) return;
                  e.preventDefault();
                  navigate('lists', { list: l.id });
                }}
              >
                <span className="cloud-vis" data-public={l.visibility === 'public' || undefined}>
                  {l.visibility === 'public' ? <Globe size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                  <span className="sr-only">{l.visibility === 'public' ? t('公开', 'Public') : t('私有', 'Private')}</span>
                </span>
                <span className="study-row-main">
                  <strong>{l.title}</strong>
                  <span className="study-row-secondary">
                    {[
                      t(`${l.count} 题`, `${l.count} problem${l.count === 1 ? '' : 's'}`),
                      l.forkedFrom ? t('复制来的', 'Copied') : '',
                      new Date(l.updatedAt).toLocaleDateString(english ? 'en-US' : 'zh-CN', {
                        month: 'short',
                        day: 'numeric',
                      }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        lists && (
          <div className="study-state progress-empty">
            <p>
              {t(
                '还没有题单。在题目页标题旁点「加入题单」，或在上面新建一个。',
                'No lists yet. Use "Add to a list" next to a problem title, or start one above.',
              )}
            </p>
          </div>
        )
      )}
      <section className="cloud-starred" aria-labelledby="cloud-starred-title">
        <div className="cloud-head">
          <h2 id="cloud-starred-title">{t('我收藏的题单', 'Lists I saved')}</h2>
          <a href="/lists/community">
            {t('逛逛题单广场', 'Browse community lists')} <ArrowRight size={13} aria-hidden="true" />
          </a>
        </div>
        {starred.length ? (
          <ul className="study-list progress-list cloud-list-rows">
            {starred.map((l) => (
              <li key={l.id}>
                <a
                  className="study-row progress-row"
                  href={`/?view=lists&list=${l.id}`}
                  onClick={(e) => {
                    if (!plain(e)) return;
                    e.preventDefault();
                    navigate('lists', { list: l.id });
                  }}
                >
                  <span className="cloud-vis" data-public>
                    <Star size={16} aria-hidden="true" />
                  </span>
                  <span className="study-row-main">
                    <strong>{l.title}</strong>
                    <span className="study-row-secondary">
                      {[l.owner ? `@${l.owner}` : t('学习者', 'A learner'), t(`${l.count} 题`, `${l.count} problem${l.count === 1 ? '' : 's'}`)].join(' · ')}
                    </span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cloud-starred-empty">
            {t('在别人的公开题单页点「收藏」，它会出现在这里。', 'Save someone’s public list from its page and it shows up here.')}
          </p>
        )}
      </section>
    </>
  );
}

function ListDetail({
  id,
  boot,
  navigate,
  t,
  english,
}: {
  id: string;
  boot: Boot;
  navigate: Navigate;
  t: T;
  english: boolean;
}) {
  const [list, setList] = useState<Detail | null>(null);
  const [history, setHistory] = useState<Map<string, PracticeHistoryItem>>(new Map());
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ title: string; description: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<Detail>(`oj/lists/${encodeURIComponent(id)}`).then(
      (d) => live && setList(d),
      (e: Error) => live && setError(e.message),
    );
    // Status per problem; the list still shows when history cannot load.
    api<{ items: PracticeHistoryItem[] }>('oj/history').then(
      (h) => live && setHistory(new Map(h.items.map((i) => [i.problemId, i]))),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [id]);
  async function run<R>(task: () => Promise<R>) {
    setBusy(true);
    setError('');
    try {
      return await task();
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  if (!list)
    return error ? (
      <div className="study-state" role="alert">
        <p>{t(error, englishMessage(error))}</p>
        <Button variant="outline" onClick={() => navigate('lists')}>
          {t('回到我的题单', 'Back to my lists')}
        </Button>
      </div>
    ) : (
      <output className="study-state">{t('正在加载…', 'Loading…')}</output>
    );
  const summaries = new Map(boot.problems.map((p) => [p.id, p]));
  const ids = list.items.map((i) => i.problemId);
  const solved = ids.filter((pid) => history.get(pid)?.firstAcAt).length;
  const share = `${typeof location === 'undefined' ? '' : location.origin}/u/lists/${list.id}`;
  const update = (body: Record<string, string>) =>
    run(async () => setList(await api<Detail>(`oj/lists/${list.id}`, body)));
  return (
    <>
      <nav className="cloud-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        <a
          href="/?view=lists"
          onClick={(e) => {
            if (!plain(e)) return;
            e.preventDefault();
            navigate('lists');
          }}
        >
          {t('我的题单', 'My lists')}
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{list.title}</span>
      </nav>
      <header className="cloud-board">
        <p className="route-kicker">
          {list.mine
            ? list.visibility === 'public'
              ? t('公开题单', 'Public list')
              : t('私有题单', 'Private list')
            : list.owner
              ? t(`@${list.owner} 的公开题单`, `Public list by @${list.owner}`)
              : t('公开题单', 'Public list')}
        </p>
        {editing ? (
          <form
            className="cloud-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void update(editing).then(() => setEditing(null));
            }}
          >
            <label>
              {t('名称', 'Name')}
              <input
                value={editing.title}
                maxLength={80}
                required
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label>
              {t('说明', 'Description')}
              <textarea
                value={editing.description}
                maxLength={1000}
                rows={3}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <div className="cloud-edit-actions">
              <button type="submit" disabled={busy || !editing.title.trim()}>
                {t('保存', 'Save')}
              </button>
              <button type="button" className="is-quiet" onClick={() => setEditing(null)}>
                {t('取消', 'Cancel')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1>{list.title}</h1>
            {list.description && <p>{list.description}</p>}
          </>
        )}
        <div className="cloud-meter" role="img" aria-label={t(`已通过 ${solved} / ${ids.length}`, `${solved} of ${ids.length} solved`)}>
          <span aria-hidden="true">
            <b>{solved}</b> / {ids.length}
          </span>
          <span
            className="cloud-bar"
            style={{ '--frac': ids.length ? solved / ids.length : 0 } as React.CSSProperties}
            aria-hidden="true"
          />
          <span aria-hidden="true">{t('已通过', 'solved')}</span>
        </div>
        <div className="cloud-actions">
          {list.mine ? (
            <>
              {!editing && (
                <button
                  type="button"
                  className="is-quiet"
                  onClick={() => setEditing({ title: list.title, description: list.description })}
                >
                  {t('编辑', 'Edit')}
                </button>
              )}
              <button
                type="button"
                className="is-quiet"
                aria-pressed={list.visibility === 'public'}
                disabled={busy}
                onClick={() => void update({ visibility: list.visibility === 'public' ? 'private' : 'public' })}
              >
                {list.visibility === 'public' ? <Globe size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
                {list.visibility === 'public' ? t('公开中 · 设为私有', 'Public · make private') : t('设为公开', 'Make public')}
              </button>
              <button type="button" className="is-quiet is-danger" onClick={() => setConfirm(true)}>
                <Trash2 size={14} aria-hidden="true" />
                {t('删除', 'Delete')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const copy = await api<Detail>(`oj/lists/${list.id}/fork`, {});
                    navigate('lists', { list: copy.id });
                  })
                }
              >
                <GitFork size={14} aria-hidden="true" />
                {t('复制到我的题单', 'Copy to my lists')}
              </button>
              <button
                type="button"
                className="is-quiet"
                aria-pressed={!!list.starred}
                disabled={busy}
                onClick={() =>
                  void run(async () => setList(await api<Detail>(`oj/lists/${list.id}/star`, { on: !list.starred })))
                }
              >
                <Star size={14} aria-hidden="true" fill={list.starred ? 'currentColor' : 'none'} />
                {list.starred ? t('已收藏', 'Saved') : t('收藏', 'Save')}
              </button>
            </>
          )}
          {list.visibility === 'public' && (
            <span className="cloud-counts">
              {t(`${list.stars ?? 0} 收藏 · ${list.forks ?? 0} 复制`, `${list.stars ?? 0} saves · ${list.forks ?? 0} copies`)}
            </span>
          )}
        </div>
        {list.mine && list.visibility === 'public' && (
          <div className="cloud-share">
            <label>
              {t('分享链接', 'Share link')}
              <input readOnly value={share} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(share).then(
                  () => setCopied(true),
                  () => {},
                );
              }}
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? t('已复制', 'Copied') : t('复制', 'Copy')}
            </button>
          </div>
        )}
      </header>
      {error && (
        <p className="cloud-error" role="alert">
          {t(error, englishMessage(error))}
        </p>
      )}
      {ids.length ? (
        <ul className="study-list progress-list">
          {ids.map((pid) => {
            const summary = summaries.get(pid);
            const item = history.get(pid);
            const progress = item?.firstAcAt ? 'solved' : item ? 'attempted' : 'not_started';
            const label = { solved: t('已通过', 'Solved'), attempted: t('未通过', 'Not solved'), not_started: t('未提交', 'Not submitted') }[progress];
            const name = summary ? problemTitle(summary, english ? 'en' : 'zh') : pid;
            return (
              <li key={pid} className="cloud-item">
                <a
                  className="study-row progress-row"
                  href={`/?view=problem&problem=${encodeURIComponent(pid)}`}
                  data-progress={progress}
                  onClick={(e) => {
                    if (!plain(e)) return;
                    e.preventDefault();
                    rememberProblemSequence(ids);
                    navigate('problem', { problem: pid });
                  }}
                >
                  <span className="study-progress" data-progress={progress} title={label}>
                    {progress === 'solved' ? (
                      <Check size={18} aria-hidden="true" />
                    ) : progress === 'attempted' ? (
                      <Circle size={18} aria-hidden="true" />
                    ) : null}
                    <span className="sr-only">{label}</span>
                  </span>
                  <span className="study-row-main">
                    <strong>
                      {pid.startsWith('lc-') && <span className="study-number">{pid.slice(3)}.</span>}{' '}
                      {name}
                    </strong>
                    <span className="study-row-secondary">{pid.startsWith('lc-') ? 'LeetCode' : 'OA'}</span>
                  </span>
                  <span className="study-level" data-level={summary?.difficulty}>
                    {summary ? t(summary.difficulty, LEVELS[summary.difficulty] ?? summary.difficulty) : '—'}
                  </span>
                </a>
                {list.mine && (
                  <button
                    type="button"
                    className="cloud-remove"
                    disabled={busy}
                    aria-label={t(`从题单移除 ${name}`, `Remove ${name} from the list`)}
                    onClick={() =>
                      void run(async () =>
                        setList(await api<Detail>(`oj/lists/${list.id}/items`, { problemId: pid, on: false })),
                      )
                    }
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="study-state progress-empty">
          <p>
            {t(
              '题单还是空的。打开任意题目，在标题旁点「加入题单」。',
              'This list is empty. Open any problem and use "Add to a list" next to its title.',
            )}
          </p>
          <Button variant="outline" onClick={() => navigate('problems')}>
            {t('去题库挑题', 'Browse problems')}
            <ArrowRight size={15} />
          </Button>
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('删除这个题单？', 'Delete this list?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                '题单和里面的题目顺序会被删除，题目本身和你的提交记录不受影响。别人复制的副本也会保留。',
                "The list and its order are removed. The problems and your submissions stay, and copies others made are kept.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('保留', 'Keep it')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(async () => {
                  await api(`oj/lists/${list.id}/delete`, {});
                  navigate('lists');
                })
              }
            >
              {t('删除', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
