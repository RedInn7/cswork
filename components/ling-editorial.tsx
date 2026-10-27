'use client';
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, GitCompare } from 'lucide-react';
import { CodeDiff } from './editor';
import { EditorialVote } from './editorial-vote';
import { EditorialFollowUps, EditorialSteps } from './ling-editorial-steps';
import { SolutionPosts } from './solution-posts';
import { StatementMarkdown } from './statement-markdown';
import { ojRequest, type LingFollowUps, type TrackEditorial } from '@/lib/oj-client';
import { englishMessage } from '@/lib/messages-en';
import { languages, type Language } from '@/lib/problems';
import type { EditorSettings } from '@/lib/editor-settings';
import '@/app/ling-editorial.css';

const LANGS = [
  ['python', 'Python'],
  ['cpp', 'C++'],
  ['java', 'Java'],
  ['go', 'Go'],
  ['sql', 'SQL'],
  ['pandas', 'Pandas'],
] as const;
type EditorialLang = (typeof LANGS)[number][0];
// A Line 500 editorial has all four languages; a track's only those its reference solution has.
type Editorial = TrackEditorial & Partial<LingFollowUps>;
const editorialLang = (language: Language): EditorialLang | null =>
  LANGS.find(([id]) => id === language)?.[0] ?? null;
const langName = (lang: EditorialLang) => LANGS.find(([id]) => id === lang)![1];
const MODE_KEY = 'cswork:editorial-mode';

/**
 * The Line 500 editorial tab: approaches from brute force to best, each with its idea,
 * complexity and Python / C++ / Java / Go code, and a diff against the editor's code
 * in the editor's own language (the shown language when the editorial has none in it).
 * Like LeetCode, it opens straight away, no lock or confirm; the server refuses it during the
 * learner's running contest. `discussion`: below it, the problem's community solutions (the same
 * posts as the Solutions tab, so the contest gate holds), folded until asked for. With two or more
 * approaches it reads all at once or step by step (components/ling-editorial-steps.tsx; `stop` is
 * the problem's Line 500 stop), remembered in this browser; then the interview follow-ups
 * (`followUpOn` / `onFollowUp`: the workspace's follow-up mode switch).
 */
export function LingEditorial({
  problemId,
  verified,
  english,
  code,
  language,
  settings,
  discussion = false,
  stop,
  followUpOn,
  onFollowUp,
}: {
  problemId: string;
  verified: boolean;
  english: boolean;
  code: string;
  language: Language;
  settings: EditorSettings;
  discussion?: boolean;
  stop?: string | null;
  followUpOn?: boolean;
  onFollowUp?: (on: boolean) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [picked, setLang] = useState<EditorialLang>(editorialLang(language) ?? 'python');
  const [compare, setCompare] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [discussing, setDiscussing] = useState(false);
  // Everything at once by default, like LeetCode; step by step is the learner's own choice.
  const [mode, setMode] = useState<'steps' | 'all'>('all');
  const [stepsDone, setStepsDone] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === 'steps') setMode('steps');
    } catch {
      /* All at once by default. */
    }
  }, []);
  const pickMode = (next: 'steps' | 'all') => {
    setMode(next);
    setStepsDone(false);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* Kept for this visit. */
    }
  };
  const stepped = !!editorial && editorial.approaches.length >= 2;
  const shownLangs = LANGS.filter(([id]) => editorial?.approaches.some((approach) => approach[id]));
  const has = (id: EditorialLang | null) => !!id && shownLangs.some(([shown]) => shown === id);
  const lang = has(picked) ? picked : (shownLangs[0]?.[0] ?? picked);
  // Like for like: my Java code diffs against the Java editorial, whichever tab is shown.
  const diffLang = has(editorialLang(language)) ? editorialLang(language)! : lang;
  const lingProblem = problemId.startsWith('lc-');
  useEffect(() => {
    if (editorial) return;
    const controller = new AbortController();
    setError('');
    ojRequest<Editorial>(`problems/${encodeURIComponent(problemId)}/editorial`, undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setEditorial(value);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [editorial, problemId, attempt]);
  const modeSwitch = () => (
    <fieldset className="cs-ling-langs">
      <legend className="sr-only">{t('题解的看法', 'How to read the editorial')}</legend>
      <button type="button" aria-pressed={mode === 'steps'} onClick={() => pickMode('steps')}>
        {t('分步看', 'Step by step')}
      </button>
      <button type="button" aria-pressed={mode === 'all'} onClick={() => pickMode('all')}>
        {t('全部展开', 'Show all')}
      </button>
    </fieldset>
  );
  return (
    <section className="cs-ling-editorial" aria-labelledby="ling-editorial-title">
      <div className="cs-ling-editorial-head">
        <h2 id="ling-editorial-title" ref={heading} tabIndex={-1}>{t('官方题解', 'Editorial')}</h2>
        {verified ? (
          <span className="cs-ling-verified">
            <BadgeCheck size={14} aria-hidden="true" />
            {lingProblem
              ? t('Python 代码已通过本题全部测试，C++、Java、Go 已通过公开样例', 'Python passes every test; C++, Java and Go pass the public samples')
              : t('题解代码已通过本题全部测试', 'The code passes every test of this problem')}
          </span>
        ) : (
          <span className="cs-ling-unverified">
            {t('代码尚未经判题机验证', 'Code not yet checked by the judge')}
          </span>
        )}
      </div>
      {error ? (
        <div role="alert">
          {english ? englishMessage(error) : error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            {t('重试', 'Retry')}
          </button>
        </div>
      ) : !editorial ? (
        <p role="status">{t('正在加载题解…', 'Loading the editorial…')}</p>
      ) : stepped && mode === 'steps' && !stepsDone ? (
        <>
          {modeSwitch()}
          <EditorialSteps
            approaches={editorial.approaches}
            stop={stop}
            english={english}
            onDone={() => {
              setStepsDone(true);
              heading.current?.focus();
            }}
          />
        </>
      ) : (
        <>
          {stepped && modeSwitch()}
          <fieldset className="cs-ling-langs">
            <legend className="sr-only">{t('代码语言', 'Code language')}</legend>
            {shownLangs.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={lang === id}
                onClick={() => setLang(id)}
              >
                {name}
              </button>
            ))}
          </fieldset>
          <ol className="cs-ling-approaches">
            {editorial.approaches.map((approach, i) => (
              <li key={i} aria-labelledby={`ling-approach-${i}`}>
                <h3 id={`ling-approach-${i}`}>
                  <span className="cs-ling-no" aria-hidden="true">
                    {i + 1}
                  </span>
                  {t(`解法 ${i + 1}：`, `Approach ${i + 1}: `)}
                  {english ? approach.nameEn : approach.nameZh}
                </h3>
                <dl className="cs-ling-cost">
                  <div>
                    <dt>{t('时间', 'Time')}</dt>
                    <dd>{approach.time}</dd>
                  </div>
                  <div>
                    <dt>{t('空间', 'Space')}</dt>
                    <dd>{approach.space}</dd>
                  </div>
                </dl>
                <StatementMarkdown
                  body={english ? approach.ideaEn : approach.ideaZh}
                  className="cs-statement-markdown cs-ling-idea"
                  untrusted
                />
                <pre className="cs-ling-code">
                  <code>{approach[lang]}</code>
                </pre>
                <button
                  type="button"
                  className="cs-ling-compare"
                  aria-expanded={compare === i}
                  onClick={() => setCompare(compare === i ? null : i)}
                >
                  <GitCompare size={14} aria-hidden="true" />
                  {compare === i ? t('收起对比', 'Hide comparison') : t('与我的代码对比', 'Compare with my code')}
                </button>
                {compare === i && (
                  <>
                    <div className="cs-diff-labels">
                      <span>
                        {t('官方题解', 'Editorial')} · {langName(diffLang)}
                      </span>
                      <span>
                        {t('我的代码', 'My code')} ·{' '}
                        {languages.find((item) => item.id === language)?.name ?? language}
                      </span>
                    </div>
                    <div className="cs-history-editor cs-ling-diff">
                      <CodeDiff
                        original={approach[diffLang] ?? approach[lang] ?? ''}
                        modified={code}
                        originalLanguage={diffLang}
                        language={language}
                        settings={settings}
                        ariaLabel={t('官方题解与我的代码的差异', 'Differences between the editorial and my code')}
                      />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
          <EditorialFollowUps problemId={problemId} extras={editorial} language={language} english={english} followUpOn={followUpOn} onFollowUp={onFollowUp} />
          <EditorialVote problemId={problemId} english={english} />
          {discussion && (
            <details className="cs-ling-discussion" onToggle={(e) => setDiscussing(e.currentTarget.open)}>
              <summary>{t('社区题解与讨论', 'Community solutions and discussion')}</summary>
              {discussing && (
                <SolutionPosts problemId={problemId} english={english} code={code} language={language} unlocked />
              )}
            </details>
          )}
        </>
      )}
    </section>
  );
}
