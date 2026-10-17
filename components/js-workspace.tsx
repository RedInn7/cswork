'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, CircleCheck, LoaderCircle, Play, RotateCcw, Send, X } from 'lucide-react';
import { Button } from './ui/button';
import { JsEditor } from './js-editor';
import { StatementMarkdown } from './statement-markdown';
import { useT } from '@/lib/i18n';
import { api } from '@/lib/types';
import { draftKey, markTarget, readDone, RUN_TIMEOUT_MS, runJs, saveDone, type RunResult, type RunScope } from '@/lib/js-runner';

export type JsProblemView = {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  statement: string;
  editorial: string;
  starter: string;
  solution: string;
  tests: string;
  cases: { name: string; public: boolean }[];
};

/**
 * One frontend JS problem (/frontend/js/<slug>): statement, editor, Run (public cases) and
 * Submit (every case) in the browser sandbox (lib/js-runner.ts), results and console. The draft
 * stays in this browser; passing every case marks the problem done (content:fe-js/<slug> for
 * members). The editorial opens after a full pass, or on request with a confirmation.
 */
export function JsWorkspace({
  problem,
  harness,
  signedIn,
  next,
}: {
  problem: JsProblemView;
  harness: string;
  signedIn: boolean;
  next?: { href: string; title: string };
}) {
  const t = useT();
  const { slug, starter } = problem;
  const [code, setCode] = useState(starter);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState<RunScope | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [scope, setScope] = useState<RunScope>('public');
  const [solved, setSolved] = useState(false);
  const [justPassed, setJustPassed] = useState(false);
  const [reveal, setReveal] = useState<'hidden' | 'confirm' | 'open'>('hidden');
  const [markError, setMarkError] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const busy = useRef(false);

  // This browser's draft and done flag, then the account's mark.
  useEffect(() => {
    let draft: string | null = null;
    try {
      draft = localStorage.getItem(draftKey(slug));
    } catch {}
    // oxlint-disable-next-line react/react-compiler -- The draft lives only in this browser.
    if (draft !== null) setCode(draft);
    setSolved(readDone().includes(slug));
    setLoaded(true);
    let live = true;
    if (signedIn)
      api<{ items: unknown[] }>(`oj/marks?${new URLSearchParams({ target: markTarget(slug), mark: 'done' })}`).then(
        ({ items }) => live && items.length > 0 && setSolved(true),
        () => {},
      );
    return () => {
      live = false;
      stop.current?.();
    };
  }, [slug, signedIn]);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try {
        if (code === starter) localStorage.removeItem(draftKey(slug));
        else localStorage.setItem(draftKey(slug), code);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [code, loaded, slug, starter]);

  async function markSolved() {
    setSolved(true);
    setJustPassed(true);
    setReveal('open');
    saveDone(slug);
    if (!signedIn) return;
    try {
      await api('oj/marks', { target: markTarget(slug), mark: 'done', on: true });
    } catch (error) {
      setMarkError((error as Error).message);
    }
  }
  function start(which: RunScope) {
    if (busy.current) return;
    busy.current = true;
    setRunning(which);
    setScope(which);
    setResult(null);
    setJustPassed(false);
    setMarkError('');
    const run = runJs({ harness, code, tests: problem.tests, scope: which, onUpdate: setResult });
    stop.current = run.stop;
    void run.done.then((final) => {
      busy.current = false;
      if (final.status === 'stopped') return;
      setResult(final);
      setRunning(null);
      const passed = final.status === 'done' && final.total > 0 && final.cases.length === final.total && final.cases.every((c) => c.pass);
      if (which === 'all' && passed) void markSolved();
    });
  }
  function reset() {
    if (window.confirm(t('恢复起始代码？当前草稿会被覆盖。', 'Restore the starter code? Your draft will be replaced.'))) setCode(starter);
  }

  const publicCases = problem.cases.filter((c) => c.public);
  const passed = result?.cases.filter((c) => c.pass).length ?? 0;
  const level = { easy: t('简单', 'Easy'), medium: t('中等', 'Medium'), hard: t('困难', 'Hard') }[problem.difficulty];
  return (
    <div className="fejs">
      <section className="fejs-statement" aria-labelledby="fejs-title">
        <div className="fejs-meta">
          <span className={`fejs-level fejs-level-${problem.difficulty}`}>{level}</span>
          {solved && (
            <span className="fejs-solved">
              <CircleCheck size={14} aria-hidden="true" /> {t('已完成', 'Solved')}
            </span>
          )}
        </div>
        <h1 id="fejs-title">{problem.title}</h1>
        <div className="public-library-prose fejs-prose">
          <StatementMarkdown body={problem.statement} className="fejs-markdown" />
        </div>
        <h2 className="fejs-h2">{t('公开用例', 'Public tests')}</h2>
        <p className="fejs-note">
          {t(
            `「运行」只跑这 ${publicCases.length} 个；「提交」跑全部 ${problem.cases.length} 个。`,
            `Run checks these ${publicCases.length}; Submit runs all ${problem.cases.length}.`,
          )}
        </p>
        <ul className="fejs-public-cases">
          {publicCases.map((c) => (
            <li key={c.name}>{c.name}</li>
          ))}
        </ul>
        <section className="fejs-editorial" aria-labelledby="fejs-editorial-title">
          <h2 id="fejs-editorial-title" className="fejs-h2">
            {t('题解', 'Editorial')}
          </h2>
          {reveal === 'open' ? (
            <div className="public-library-prose fejs-prose">
              <StatementMarkdown body={problem.editorial} className="fejs-markdown" />
              <h3>{t('参考实现', 'Reference solution')}</h3>
              <StatementMarkdown body={'```js\n' + problem.solution.trimEnd() + '\n```'} className="fejs-markdown" />
            </div>
          ) : reveal === 'confirm' ? (
            <div className="fejs-confirm" role="group" aria-label={t('确认查看题解', 'Confirm opening the editorial')}>
              <p>{t('先自己写一版再看，收获会大得多。确定现在就看吗？', 'You learn far more by writing your own version first. Open it anyway?')}</p>
              <Button size="sm" variant="outline" onClick={() => setReveal('open')}>
                {t('确定查看', 'Open the editorial')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReveal('hidden')}>
                {t('再想想', 'Not yet')}
              </Button>
            </div>
          ) : (
            <p className="fejs-note">
              {t('全部用例通过后自动展开。', 'Opens by itself once every test passes.')}{' '}
              <button type="button" className="fejs-link" onClick={() => setReveal('confirm')}>
                {t('现在查看', 'Open it now')}
              </button>
            </p>
          )}
        </section>
        {next && (
          <p className="fejs-next">
            <a href={next.href}>
              {t('下一题', 'Next')}: {next.title} →
            </a>
          </p>
        )}
      </section>

      <section className="fejs-bench" aria-label={t('代码与结果', 'Code and results')}>
        <div className="fejs-toolbar">
          <span className="fejs-keys">
            {t('Ctrl/⌘+Enter 运行 · +Shift 提交', 'Ctrl/⌘+Enter runs · +Shift submits')}
          </span>
          <div className="fejs-actions">
            <Button variant="ghost" size="sm" onClick={reset} disabled={!!running}>
              <RotateCcw size={14} aria-hidden="true" /> {t('重置', 'Reset')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => start('public')} disabled={!!running}>
              {running === 'public' ? <LoaderCircle size={14} className="cs-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {t('运行', 'Run')}
            </Button>
            <Button size="sm" onClick={() => start('all')} disabled={!!running}>
              {running === 'all' ? <LoaderCircle size={14} className="cs-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              {t('提交', 'Submit')}
            </Button>
          </div>
        </div>
        <div className="fejs-editor">
          <JsEditor value={code} onChange={setCode} onRun={() => start('public')} onSubmit={() => start('all')} />
        </div>
        <div className="fejs-results" aria-live="polite">
          {running ? (
            <p className="fejs-summary" role="status">
              <LoaderCircle size={14} className="cs-spin" aria-hidden="true" />{' '}
              {result?.total
                ? t(`运行中… ${result.cases.length} / ${result.total}`, `Running… ${result.cases.length} / ${result.total}`)
                : t('运行中…', 'Running…')}
            </p>
          ) : !result ? (
            <p className="fejs-empty">
              {t(
                '代码在这个浏览器的沙箱里运行，不上传、不计分：只算练习。',
                'Your code runs in a sandbox in this browser. Nothing is uploaded or scored: practice only.',
              )}
            </p>
          ) : result.status === 'error' ? (
            <p className="fejs-summary fejs-bad" role="alert">
              {result.error === 'noworker'
                ? t('这个浏览器不支持 Web Worker，无法在这里运行代码。', "This browser doesn't support Web Workers, so the code can't run here.")
                : `${t('代码没能运行', "The code didn't run")}: ${result.error}${result.line ? t(`（第 ${result.line} 行）`, ` (line ${result.line})`) : ''}`}
            </p>
          ) : (
            <>
              <p className={`fejs-summary ${passed === result.total && result.status === 'done' ? 'fejs-good' : 'fejs-bad'}`}>
                {scope === 'all' ? t('提交', 'Submit') : t('运行', 'Run')}: {t(`通过 ${passed} / ${result.total}`, `${passed} / ${result.total} passed`)}
                {justPassed && <strong> · {t('全部通过，已标记完成', 'All passed: marked as solved')}</strong>}
              </p>
              {result.status === 'timeout' && (
                <p className="fejs-bad" role="alert">
                  {t(
                    `运行超过 ${RUN_TIMEOUT_MS / 1000} 秒被终止：可能有死循环，或者有 Promise 一直没有结束。${result.total - result.cases.length} 个用例没有跑完。`,
                    `Stopped after ${RUN_TIMEOUT_MS / 1000} s: maybe an endless loop, or a promise that never settles. ${result.total - result.cases.length} tests didn't finish.`,
                  )}
                </p>
              )}
              {markError && <p className="fejs-bad">{markError}</p>}
              <ol className="fejs-cases">
                {result.cases.map((c, i) => (
                  <li key={`${i}:${c.name}`} className={c.pass ? 'is-pass' : 'is-fail'}>
                    <span className="fejs-case-head">
                      {c.pass ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                      <span className="sr-only">{c.pass ? t('通过：', 'Passed: ') : t('未通过：', 'Failed: ')}</span>
                      <span>{c.name}</span>
                      {!c.public && <small>{t('隐藏', 'hidden')}</small>}
                    </span>
                    {c.error && <pre>{c.error}</pre>}
                  </li>
                ))}
              </ol>
            </>
          )}
          {result && result.logs.length > 0 && (
            <details className="fejs-console" open>
              <summary>{t(`控制台输出（${result.logs.length}）`, `Console (${result.logs.length})`)}</summary>
              <pre>
                {result.logs.map((line, i) => (
                  <span key={i} className={`fejs-log-${line.level === 'error' || line.level === 'warn' ? line.level : 'log'}`}>
                    {line.text}
                    {'\n'}
                  </span>
                ))}
              </pre>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
