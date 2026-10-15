'use client';
import { useEffect, useRef, useState } from 'react';
import { FilePlus2, LoaderCircle, Play, RotateCcw, Send, X } from 'lucide-react';
import { CodeEditor } from '@/components/editor';
import { StatementMarkdown } from '@/components/statement-markdown';
import { Button } from '@/components/ui/button';
import { PROJECT_MAX_BYTES, PROJECT_MAX_FILES, PROJECT_PATH, type ProjectReport } from '@/lib/ai-coding';
import { defaultEditorSettings } from '@/lib/editor-settings';
import { useLocale, useT } from '@/lib/i18n';
import { activeStatuses, cancelOJ, ojRequest, verdict, type OJSubmission } from '@/lib/oj-client';
import { currentTheme } from '@/lib/theme-script';

export type Run = OJSubmission & { project?: ProjectReport | null };
type Turn = { role: 'user' | 'assistant'; text: string };
/** This browser's copy of the project: every file, the open tabs and the one in the editor. */
type Saved = { files: Record<string, string>; open: string[]; active: string };
const storageKey = (task: string) => `cswork:ai-round:${task}:v1`;
const bytes = (files: Record<string, string>) =>
  Object.values(files).reduce((n, text) => n + new TextEncoder().encode(text).byteLength, 0);
const firstFile = (files: Record<string, string>) =>
  Object.keys(files).find((path) => path.startsWith('src/') && !path.endsWith('__init__.py')) ?? Object.keys(files)[0];

function readSaved(task: string, starter: Record<string, string>): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(task)) || 'null') as Partial<Saved> | null;
    const files = value?.files;
    if (value && files && typeof files === 'object' && Object.entries(files).every(([p, t]) => PROJECT_PATH.test(p) && typeof t === 'string')) {
      // Starting files come back if a stored copy lacks one.
      const merged = { ...starter, ...files };
      const open = (Array.isArray(value.open) ? value.open : []).filter((p): p is string => typeof p === 'string' && p in merged);
      const active = typeof value.active === 'string' && value.active in merged ? value.active : firstFile(merged);
      return { files: merged, open: open.includes(active) ? open : [...open, active], active };
    }
  } catch {
    /* Blocked or unreadable storage: start fresh. */
  }
  const active = firstFile(starter);
  return { files: starter, open: [active], active };
}

/**
 * The AI-assisted round's workspace (/ai-assisted/<task>): a file tree, one Monaco model per
 * open file, the public and hidden test results of the last run (POST oj/ai-assisted/run,
 * watched like a playground run) and the AI pair (POST oj/ai/pair), which works without it too.
 */
export function ProjectWorkspace({
  task,
  level,
  files: starter,
  hiddenTotal,
  signedIn,
  verified,
  ai,
  aiLimit,
  pair = true,
  onFinished,
}: {
  task: string;
  /** ICA sets (/oa/ica): the level a run judges, with task "ica:<slug>". */
  level?: number;
  files: Record<string, string>;
  hiddenTotal: number;
  signedIn: boolean;
  verified: boolean;
  ai: boolean;
  aiLimit: number;
  /** False hides the AI pair: an ICA round allows no AI. */
  pair?: boolean;
  onFinished?: (run: Run) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [newPath, setNewPath] = useState('tests/test_more.py');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [pairError, setPairError] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const loaded = useRef('');

  useEffect(() => {
    // A new task hydrates from browser storage after SSR. New starting files for the same task (an ICA
    // level opening) join the live copy instead, so edits the debounced save has not written survive.
    const same = loaded.current === task;
    loaded.current = task;
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
    setSaved((value) => (value && same ? { ...value, files: { ...starter, ...value.files } } : readSaved(task, starter)));
  }, [task, starter]);
  useEffect(() => () => request.current?.abort(), [task]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey(task), JSON.stringify(saved));
      } catch {
        /* This visit still works. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [task, saved]);

  if (!saved)
    return (
      <output className="ai-round-loading">
        <LoaderCircle size={16} className="cs-spin" /> {t('正在打开项目…', 'Opening the project…')}
      </output>
    );
  const { files, open, active } = saved;
  const paths = Object.keys(files).sort();
  const size = bytes(files);
  const tooBig = size > PROJECT_MAX_BYTES || paths.length > PROJECT_MAX_FILES;
  const busy = running || (!!run && activeStatuses.has(run.status));
  const select = (path: string) =>
    setSaved((value) => value && { ...value, active: path, open: value.open.includes(path) ? value.open : [...value.open, path] });
  const close = (path: string) =>
    setSaved((value) => {
      if (!value || value.open.length < 2) return value;
      const rest = value.open.filter((p) => p !== path);
      return { ...value, open: rest, active: value.active === path ? rest[rest.length - 1] : value.active };
    });
  const edit = (text: string) =>
    setSaved((value) => value && { ...value, files: { ...value.files, [value.active]: text } });
  const pathError = !PROJECT_PATH.test(newPath)
    ? t('文件名需形如 src/name.py 或 tests/test_name.py', 'Use a name like src/name.py or tests/test_name.py')
    : newPath in files
      ? t('已有同名文件', 'That file already exists')
      : '';
  function add(event: { preventDefault(): void }) {
    event.preventDefault();
    if (pathError || paths.length >= PROJECT_MAX_FILES) return;
    setSaved((value) => value && { files: { ...value.files, [newPath]: '' }, open: [...value.open, newPath], active: newPath });
  }
  /** Only files the learner added can go; the starting ones may be emptied but stay. */
  const remove = (path: string) =>
    setSaved((value) => {
      if (!value || path in starter) return value;
      const next = { ...value.files };
      delete next[path];
      const rest = value.open.filter((p) => p !== path);
      const active = value.active === path ? (rest[0] ?? firstFile(next)) : value.active;
      return { files: next, open: rest.includes(active) ? rest : [...rest, active], active };
    });
  const reset = () => {
    if (confirm(t('用初始代码替换全部文件？你的改动会丢失。', 'Replace every file with the starting code? Your changes will be lost.')))
      setSaved({ files: starter, open: [firstFile(starter)], active: firstFile(starter) });
  };

  async function start() {
    if (!signedIn || !verified || busy || tooBig) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setRunning(true);
    setError('');
    setRun(null);
    try {
      let current = await ojRequest<Run>('ai-assisted/run', { task, level, files, idempotencyKey: crypto.randomUUID() }, controller.signal);
      setRun(current);
      while (activeStatuses.has(current.status)) {
        current = await ojRequest<Run>(
          `submissions/${encodeURIComponent(current.id)}?${new URLSearchParams({ wait: '1', after: current.watchToken ?? '' })}`,
          undefined,
          controller.signal,
        );
        setRun(current);
      }
      onFinished?.(current);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (request.current === controller) setRunning(false);
    }
  }
  async function cancel() {
    if (!run) return;
    setCancelling(true);
    try {
      setRun(await cancelOJ(run.id, request.current, new AbortController().signal));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelling(false);
    }
  }
  async function ask(event: { preventDefault(): void }) {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;
    setAsking(true);
    setPairError('');
    try {
      const reply = await ojRequest<{ text: string; remaining: number; bonus?: number }>('ai/pair', {
        task,
        files,
        active,
        question: text,
        history: turns.slice(-8),
        locale,
      });
      setTurns((value) => [...value, { role: 'user', text }, { role: 'assistant', text: reply.text }]);
      setQuestion('');
      setLeft(reply.remaining + (reply.bonus ?? 0));
    } catch (e) {
      setPairError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  }

  const report = run?.project;
  const label: [string, string] =
    run?.status === 'accepted'
      ? ['全部测试通过', 'All tests pass']
      : run?.status === 'wrong_answer'
        ? ['有测试未通过', 'Some tests fail']
        : run
          ? verdict(run.status)
          : ['', ''];
  return (
    <section className="ai-round-bench" aria-label={t('项目工作区', 'Project workspace')}>
      <nav className="ai-round-tree" aria-label={t('项目文件', 'Project files')}>
        {['src', 'tests'].map((folder) => (
          <div key={folder}>
            <p>{folder}/</p>
            <ul>
              {paths
                .filter((path) => path.startsWith(`${folder}/`))
                .map((path) => (
                  <li key={path}>
                    <button type="button" aria-current={path === active ? 'true' : undefined} onClick={() => select(path)}>
                      {path.slice(folder.length + 1)}
                    </button>
                    {!(path in starter) && (
                      <button
                        type="button"
                        className="ai-round-icon"
                        aria-label={t(`删除 ${path}`, `Delete ${path}`)}
                        title={t('删除文件', 'Delete file')}
                        onClick={() => remove(path)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <form className="ai-round-new" onSubmit={add}>
          <label htmlFor="ai-round-new-file">{t('新建文件', 'New file')}</label>
          <div>
            <input
              id="ai-round-new-file"
              value={newPath}
              spellCheck={false}
              aria-invalid={!!pathError}
              aria-describedby={pathError ? 'ai-round-new-error' : undefined}
              onChange={(event) => setNewPath(event.target.value.trim())}
            />
            <button
              type="submit"
              className="ai-round-icon"
              aria-label={t('添加文件', 'Add file')}
              disabled={!!pathError || paths.length >= PROJECT_MAX_FILES}
            >
              <FilePlus2 size={15} />
            </button>
          </div>
          {pathError && newPath && (
            <small id="ai-round-new-error">{pathError}</small>
          )}
        </form>
        <button type="button" className="ai-round-reset" onClick={reset}>
          <RotateCcw size={13} /> {t('恢复初始代码', 'Reset to starting code')}
        </button>
      </nav>

      <div className="ai-round-editor">
        <fieldset className="ai-round-tabs" aria-label={t('已打开的文件', 'Open files')}>
          {open.map((path) => (
            <span key={path} className="ai-round-tab" data-active={path === active || undefined}>
              <button type="button" aria-pressed={path === active} onClick={() => select(path)}>
                {path}
              </button>
              {open.length > 1 && (
                <button type="button" className="ai-round-icon" aria-label={t(`关闭 ${path}`, `Close ${path}`)} onClick={() => close(path)}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </fieldset>
        <div className="ai-round-code">
          <CodeEditor
            value={files[active] ?? ''}
            language="python"
            onChange={edit}
            onRun={() => void start()}
            path={`cswork://ai-assisted/${task}/${active}`}
            // Client-only (after the project loads), so the site theme is known here.
            settings={{ ...defaultEditorSettings, theme: currentTheme() }}
          />
        </div>
        <div className="ai-round-actions">
          <small className={tooBig ? 'ai-round-error' : undefined}>
            {paths.length}/{PROJECT_MAX_FILES} {t('个文件', 'files')} · {(size / 1024).toFixed(1)} / {PROJECT_MAX_BYTES / 1024} KB
          </small>
          {signedIn ? (
            <Button size="sm" disabled={!verified || busy || tooBig} onClick={start} title="Ctrl / ⌘ + Enter">
              {busy ? <LoaderCircle size={14} className="cs-spin" /> : <Play size={14} />}
              {t('运行测试', 'Run tests')}
            </Button>
          ) : (
            // oxlint-disable-next-line next/no-html-link-for-pages -- the SPA's account view, as on /playground.
            <a className="ai-round-signin" href="/?view=account">
              {t('登录后运行', 'Sign in to run')}
            </a>
          )}
        </div>
      </div>

      <div className="ai-round-side">
        <section className="ai-round-results" aria-labelledby="ai-round-results-title">
          <h2 id="ai-round-results-title">{t('测试结果', 'Test results')}</h2>
          {run ? (
            <>
              <output className="ai-round-status" data-status={run.status}>
                {t(...label)}
                {activeStatuses.has(run.status) && (
                  <button type="button" onClick={cancel} disabled={cancelling}>
                    {t('取消', 'Cancel')}
                  </button>
                )}
              </output>
              {report && (
                <>
                  <dl className="ai-round-counts">
                    <div>
                      <dt>{t('公开测试', 'Public tests')}</dt>
                      <dd>{report.visible ? `${report.visible.passed} / ${report.visible.total}` : t('未完成', 'Did not finish')}</dd>
                    </div>
                    <div>
                      <dt>{t('隐藏测试', 'Hidden tests')}</dt>
                      <dd>{report.hidden ? `${report.hidden.passed} / ${report.hidden.total}` : `? / ${hiddenTotal}`}</dd>
                    </div>
                  </dl>
                  {!!report.visible?.failures.length && (
                    <ul className="ai-round-failures" aria-label={t('未通过的公开测试', 'Failing public tests')}>
                      {report.visible.failures.map((failure) => (
                        <li key={failure.name}>
                          <details>
                            <summary>{failure.name}</summary>
                            <pre>{failure.message}</pre>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                  {report.output.trim() && (
                    <details className="ai-round-output">
                      <summary>{t('程序输出（公开测试）', 'Program output (public tests)')}</summary>
                      <pre>{report.output}</pre>
                    </details>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="ai-round-hint">
              {signedIn
                ? verified
                  ? t(
                      `运行后显示公开测试的失败详情；隐藏测试共 ${hiddenTotal} 个，只显示通过数量。`,
                      `A run shows the public tests' failures; the ${hiddenTotal} hidden tests show only how many pass.`,
                    )
                  : t('请先验证邮箱，再运行代码。', 'Verify your email before running code.')
                : t('代码保存在这个浏览器；登录后就能运行测试。', 'Your code stays in this browser; sign in to run the tests.')}
            </p>
          )}
          {error && (
            <p className="ai-round-error" role="alert">
              {error}
            </p>
          )}
        </section>

        {pair && (
          <section className="ai-round-pair" aria-labelledby="ai-round-pair-title">
            <h2 id="ai-round-pair-title">{t('AI 结对', 'AI pair')}</h2>
            {!ai ? (
              <p className="ai-round-hint">
                {t(
                  '本站暂未开放 AI 结对。这一轮不靠 AI 也能完成：读代码、写测试、跑测试，和面试里 AI 不给力时一样。',
                  "The AI pair isn't available on this site right now. The project works without it: read the code, write tests and run them, as you would when the AI lets you down in an interview.",
                )}
              </p>
            ) : !signedIn ? (
              <p className="ai-round-hint">{t('登录后可以和 AI 结对。', 'Sign in to pair with the AI.')}</p>
            ) : (
              <>
                <p className="ai-round-hint">
                  {t(
                    `它能读到 README、你当前的文件（打开的优先）和上次运行的公开结果，可以写代码，但跑不了测试。每天 ${aiLimit} 次${left === null ? '' : `，今天还剩 ${left} 次`}。`,
                    `It reads the README, your current files (the open one first) and the last run's public results. It may write code but cannot run tests. ${aiLimit} a day${left === null ? '' : `, ${left} left today`}.`,
                  )}
                </p>
                {turns.length > 0 && (
                  <ol className="ai-round-turns">
                    {turns.map((turn, index) => (
                      <li key={index} data-role={turn.role}>
                        {turn.role === 'user' ? (
                          <p>{turn.text}</p>
                        ) : (
                          <StatementMarkdown body={turn.text} className="cs-statement-markdown ai-round-reply" plain />
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                <form className="ai-round-ask" onSubmit={ask}>
                  <label htmlFor="ai-round-question" className="sr-only">
                    {t('问 AI 结对', 'Ask the AI pair')}
                  </label>
                  <textarea
                    id="ai-round-question"
                    value={question}
                    maxLength={1000}
                    placeholder={t('例如：test_reserve 为什么失败？', 'For example: why does test_reserve fail?')}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void ask(event);
                    }}
                  />
                  <Button type="submit" size="sm" disabled={asking || !question.trim()}>
                    {asking ? <LoaderCircle size={14} className="cs-spin" /> : <Send size={14} />}
                    {t('发送', 'Send')}
                  </Button>
                </form>
                <output className="sr-only">{asking ? t('AI 正在回复', 'The AI is replying') : ''}</output>
                {pairError && (
                  <p className="ai-round-error" role="alert">
                    {pairError}
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
