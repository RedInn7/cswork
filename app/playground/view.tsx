'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link2, LoaderCircle, Play, RotateCcw } from 'lucide-react';
import { CodeEditor } from '@/components/editor';
import { DebugButton } from '@/components/python-debugger-button';
import { SubmissionResult } from '@/components/oj-results';
import { Button } from '@/components/ui/button';
import { defaultEditorSettings, languageFiles } from '@/lib/editor-settings';
import { useLocale, useT } from '@/lib/i18n';
import { activeStatuses, cancelOJ, ojRequest, type OJSubmission } from '@/lib/oj-client';
import {
  decodeShare,
  encodeShare,
  PLAYGROUND_LANGUAGES,
  SHARE_MAX_CHARS,
  type PlaygroundState,
} from '@/lib/playground-share';
import { languages, starterTemplates, type CodeLanguage } from '@/lib/problems';
import { currentTheme } from '@/lib/theme-script';

/**
 * This browser's scratchpad: the language, stdin and one program per language, plus what a
 * share link last replaced (kept until the learner restores or dismisses it).
 */
const STORAGE_KEY = 'cswork:playground:v1';
type Replaced = { language: CodeLanguage; code?: string; stdin: string };
type Saved = {
  language: CodeLanguage;
  stdin: string;
  code: Partial<Record<CodeLanguage, string>>;
  replaced?: Replaced;
};
function readSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<Saved> | null;
    if (value && PLAYGROUND_LANGUAGES.includes(value.language as CodeLanguage)) {
      const replaced = value.replaced;
      return {
        language: value.language as CodeLanguage,
        stdin: typeof value.stdin === 'string' ? value.stdin : '',
        code: value.code && typeof value.code === 'object' ? value.code : {},
        ...(replaced &&
        PLAYGROUND_LANGUAGES.includes(replaced.language) &&
        typeof replaced.stdin === 'string' &&
        (replaced.code === undefined || typeof replaced.code === 'string')
          ? { replaced }
          : {}),
      };
    }
  } catch {
    /* Blocked or unreadable storage: start fresh. */
  }
  return { language: 'python', stdin: '', code: {} };
}
const nameOf = (id: CodeLanguage) => languages.find((item) => item.id === id)?.name;
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const MAX_BYTES = 65536;

export function PlaygroundView({ signedIn, verified }: { signedIn: boolean; verified: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [submission, setSubmission] = useState<OJSubmission | null>(null);
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<[string, string] | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const run = useRef<AbortController | null>(null);

  // Saved scratchpad first; a #c= share link on top of it (also when pasted into this tab).
  // The fragment is dropped once read, so a reload keeps later edits instead of the snapshot.
  useEffect(() => {
    let active = true;
    const load = () =>
      void decodeShare(location.hash).then((shared: PlaygroundState | null) => {
        if (!active) return;
        if (location.hash.includes('c='))
          history.replaceState(history.state, '', location.pathname + location.search);
        const base = readSaved();
        if (shared) {
          const mine = base.code[shared.language];
          const ownCode =
            mine !== undefined &&
            mine !== shared.code &&
            !Object.values(starterTemplates).some((starters) => starters[shared.language] === mine);
          const ownStdin = base.stdin.trim() !== '' && base.stdin !== shared.stdin;
          // ponytail: one backup; a second link before restore/dismiss keeps the first (the learner's own) code.
          if ((ownCode || ownStdin) && !base.replaced)
            base.replaced = { language: shared.language, code: mine, stdin: base.stdin };
          base.language = shared.language;
          base.code = { ...base.code, [shared.language]: shared.code };
          base.stdin = shared.stdin;
          setNotice(['已载入链接里的代码', 'Loaded the code from the link']);
        } else if (location.hash.includes('c='))
          setNotice(['链接已损坏，打开的是你上次的代码', "The link is broken; this is your last code"]);
        setSaved(base);
      });
    load();
    window.addEventListener('hashchange', load);
    return () => {
      active = false;
      window.removeEventListener('hashchange', load);
      run.current?.abort();
    };
  }, []);
  // A copied link is of the code as it was: stale after the next edit.
  useEffect(() => setShareUrl(''), [saved]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch {
        /* This visit still works. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!saved)
    return (
      <Shell>
        <output className="playground-loading">
          <LoaderCircle size={16} className="cs-spin" /> {t('正在打开沙盒…', 'Opening the playground…')}
        </output>
      </Shell>
    );
  const language = saved.language;
  const starter = starterTemplates[locale][language];
  const code = saved.code[language] ?? starter;
  const tooBig = bytes(code) > MAX_BYTES || bytes(saved.stdin) > MAX_BYTES;
  const busy = running || (!!submission && activeStatuses.has(submission.status));
  const update = (patch: Partial<Saved>) => setSaved((value) => value && { ...value, ...patch });
  const setCode = (next: string) =>
    setSaved((value) => value && { ...value, code: { ...value.code, [value.language]: next } });
  /** Puts back the code and stdin a share link replaced; the link's version goes. */
  const restore = () =>
    setSaved((value) => {
      if (!value?.replaced) return value;
      const { language: lang, code: previous, stdin } = value.replaced;
      const next = { ...value.code };
      if (previous === undefined) delete next[lang];
      else next[lang] = previous;
      return { language: lang, stdin, code: next };
    });

  async function start() {
    if (!signedIn || !verified || busy || tooBig || !code.trim()) return;
    const controller = new AbortController();
    run.current?.abort();
    run.current = controller;
    setRunning(true);
    setError('');
    setNotice(null);
    setSubmission(null);
    try {
      let current = await ojRequest<OJSubmission>(
        'playground/run',
        { language, code, stdin: saved!.stdin, idempotencyKey: crypto.randomUUID() },
        controller.signal,
      );
      setSubmission(current);
      // The custom-input watch protocol: each answer comes back on a change or after ~3 s.
      while (activeStatuses.has(current.status)) {
        current = await ojRequest<OJSubmission>(
          `submissions/${encodeURIComponent(current.id)}?${new URLSearchParams({ wait: '1', after: current.watchToken ?? '' })}`,
          undefined,
          controller.signal,
        );
        setSubmission(current);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (run.current === controller) setRunning(false);
    }
  }
  async function cancel() {
    if (!submission) return;
    setCancelling(true);
    try {
      setSubmission(await cancelOJ(submission.id, run.current, new AbortController().signal));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelling(false);
    }
  }
  async function share() {
    const value = await encodeShare({ language, code, stdin: saved!.stdin });
    if (!value) {
      setNotice([
        `代码和输入压缩后超过 ${SHARE_MAX_CHARS / 1024} KB，放不进链接`,
        `Compressed, the code and input exceed ${SHARE_MAX_CHARS / 1024} KB: too long for a link`,
      ]);
      return;
    }
    // Not put in the address bar: a reload there would bring this snapshot back over later edits.
    const url = `${location.origin}${location.pathname}#c=${value}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(['链接已复制，打开即是这份代码和输入', 'Link copied: it opens this code and input']);
    } catch {
      setShareUrl(url);
      setNotice(['复制下面的链接即可分享', 'Copy the link below to share it']);
    }
  }

  return (
    <Shell>
      <section className="playground-bench" aria-label={t('代码沙盒', 'Code playground')}>
        <div className="playground-toolbar">
          <fieldset className="playground-languages" aria-label={t('编程语言', 'Programming language')}>
            {PLAYGROUND_LANGUAGES.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === language}
                onClick={() => update({ language: id })}
              >
                {nameOf(id)}
              </button>
            ))}
          </fieldset>
          <div className="playground-actions">
            <button
              type="button"
              className="playground-icon"
              aria-label={t('恢复语言模板', 'Reset to the template')}
              title={t('恢复语言模板', 'Reset to the template')}
              disabled={code === starter}
              onClick={() => {
                if (confirm(t('用模板替换当前代码？', 'Replace your code with the template?'))) setCode(starter);
              }}
            >
              <RotateCcw size={15} />
            </button>
            <DebugButton language={language} code={code} stdin={saved.stdin} mode="acm" />
            <Button variant="outline" size="sm" onClick={share}>
              <Link2 size={14} /> {t('分享链接', 'Share link')}
            </Button>
            {signedIn ? (
              <Button
                size="sm"
                disabled={!verified || busy || tooBig || !code.trim()}
                onClick={start}
                title="Ctrl / ⌘ + Enter"
              >
                {busy ? <LoaderCircle size={14} className="cs-spin" /> : <Play size={14} />}
                {t('运行', 'Run')}
              </Button>
            ) : (
              <a className="playground-signin" href="/?view=account">
                {t('登录后运行', 'Sign in to run')}
              </a>
            )}
          </div>
        </div>
        <div className="playground-grid">
          <div className="playground-editor">
            <CodeEditor
              key={language}
              value={code}
              language={language}
              onChange={setCode}
              onRun={() => void start()}
              path={`cswork://playground/${languageFiles[language]}`}
              // Client-only (after the scratchpad loads), so the site theme is known here.
              settings={{ ...defaultEditorSettings, theme: currentTheme() }}
            />
          </div>
          <div className="playground-side">
            <label className="playground-stdin">
              <span>
                {t('标准输入', 'Stdin')}
                <small>{(bytes(saved.stdin) / 1024).toFixed(1)} / 64 KB</small>
              </span>
              <textarea
                value={saved.stdin}
                spellCheck={false}
                placeholder={t('程序从标准输入读到的内容', 'What the program reads from stdin')}
                onChange={(event) => update({ stdin: event.target.value })}
              />
            </label>
            <div className="playground-output" aria-live="polite">
              {submission ? (
                // Shown as a custom-input run: the same cases, output and timing.
                <SubmissionResult
                  submission={{ ...submission, mode: 'run' }}
                  cancel={cancel}
                  cancelling={cancelling}
                />
              ) : (
                <p className="playground-empty">
                  {signedIn
                    ? verified
                      ? t('Ctrl / ⌘ + Enter 运行，输出、耗时和内存显示在这里。', 'Ctrl / ⌘ + Enter runs it; output, time and memory show here.')
                      : t('请先验证邮箱，再运行代码。', 'Verify your email before running code.')
                    : t('代码会保存在这个浏览器；登录后就能运行。', 'Your code stays in this browser; sign in to run it.')}
                </p>
              )}
              {error && <p className="playground-error" role="alert">{error}</p>}
            </div>
          </div>
        </div>
        <div className="playground-footer">
          <span>
            {t(
              '单次运行限 3 秒 CPU、256 MB 内存；每小时 30 次。运行会留存在你的运行记录里，但不出现在提交列表和统计中。',
              'Each run gets 3 s of CPU and 256 MB; 30 runs an hour. Runs are kept in your run records but never appear in your submissions or statistics.',
            )}
          </span>
          {tooBig && (
            <span className="playground-error">
              {t('代码或输入超过 64 KB', 'The code or input is over 64 KB')}
            </span>
          )}
          {notice && <output>{t(...notice)}</output>}
          {shareUrl && (
            <input
              className="playground-share-url"
              readOnly
              value={shareUrl}
              aria-label={t('分享链接', 'Share link')}
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
          {saved.replaced && (
            <div className="playground-replaced" role="status">
              <span>
                {t(
                  `链接替换了你原来的 ${nameOf(saved.replaced.language)} 代码和输入`,
                  `The link replaced your own ${nameOf(saved.replaced.language)} code and input`,
                )}
              </span>
              <button type="button" onClick={restore}>
                {t('恢复我的代码', 'Restore my code')}
              </button>
              <button type="button" onClick={() => update({ replaced: undefined })}>
                {t('保留链接的代码', "Keep the link's code")}
              </button>
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="public-library playground">
      <header className="public-library-header">
        <a className="public-library-brand" href="/">
          cswork<span> / Playground</span>
        </a>
        <a href="/?view=problems">
          {t('去题库练习', 'Open the problems')} <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main className="playground-main" id="main-content">
        <div className="public-library-intro playground-intro">
          <p className="public-library-eyebrow">SANDBOX · STDIN → STDOUT</p>
          <h1>{t('代码沙盒', 'Code playground')}</h1>
          <p>
            {t(
              '不挑题目，直接写一段程序、给它输入、看它输出。和题库用同一套编译器与运行环境；分享链接把代码装在网址里，服务器不保存。',
              'No problem attached: write a program, give it input, read its output. Same compilers and runtime as the judge; a share link carries the code in the URL itself, nothing is stored.',
            )}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
