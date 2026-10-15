'use client';
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, GitCompare, Lock } from 'lucide-react';
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
import { CodeDiff } from './editor';
import { SolutionPosts } from './solution-posts';
import { StatementMarkdown } from './statement-markdown';
import { ojRequest, type LingEditorial as Editorial } from '@/lib/oj-client';
import { englishMessage } from '@/lib/messages-en';
import { languages, type Language } from '@/lib/problems';
import type { EditorSettings } from '@/lib/editor-settings';
import '@/app/ling-editorial.css';

const LANGS = [
  ['python', 'Python'],
  ['cpp', 'C++'],
  ['java', 'Java'],
  ['go', 'Go'],
] as const;
type EditorialLang = (typeof LANGS)[number][0];
const editorialLang = (language: Language): EditorialLang | null =>
  LANGS.find(([id]) => id === language)?.[0] ?? null;
const langName = (lang: EditorialLang) => LANGS.find(([id]) => id === lang)![1];

/**
 * The Line 500 editorial tab: approaches from brute force to best, each with its idea,
 * complexity and Python / C++ / Java / Go code, and a diff against the editor's code
 * in the editor's own language (the shown language when the editorial has none in it).
 * Locked until the learner has passed the problem, unless they confirm they want it now;
 * the workspace keeps that choice (`unlocked`) so switching tabs doesn't forget it. The editorial
 * is fetched only once unlocked; the server refuses it during the learner's running contest.
 * `discussion`: below it, the problem's community solutions (the same posts as the Solutions
 * tab, so the contest gate holds), folded until asked for.
 */
export function LingEditorial({
  problemId,
  verified,
  english,
  unlocked,
  onUnlock,
  code,
  language,
  settings,
  discussion = false,
}: {
  problemId: string;
  verified: boolean;
  english: boolean;
  unlocked: boolean;
  onUnlock: () => void;
  code: string;
  language: Language;
  settings: EditorSettings;
  discussion?: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [lang, setLang] = useState<EditorialLang>(editorialLang(language) ?? 'python');
  // Like for like: my Java code diffs against the Java editorial, whichever tab is shown.
  const diffLang = editorialLang(language) ?? lang;
  const [compare, setCompare] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  // The confirm unmounts the locked panel and its button, so focus lands on the heading instead.
  const confirmed = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [discussing, setDiscussing] = useState(false);
  useEffect(() => {
    if (!unlocked || editorial) return;
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
  }, [unlocked, editorial, problemId, attempt]);
  return (
    <section className="cs-ling-editorial" aria-labelledby="ling-editorial-title">
      <div className="cs-ling-editorial-head">
        <h2 id="ling-editorial-title" ref={heading} tabIndex={-1}>{t('官方题解', 'Editorial')}</h2>
        {verified ? (
          <span className="cs-ling-verified">
            <BadgeCheck size={14} aria-hidden="true" />
            {t('代码已通过本题全部测试', 'Code passes every test of this problem')}
          </span>
        ) : (
          <span className="cs-ling-unverified">
            {t('代码尚未经判题机验证', 'Code not yet checked by the judge')}
          </span>
        )}
      </div>
      {!unlocked ? (
        <div className="cs-route-hint-locked">
          <Lock size={14} aria-hidden="true" />
          <p>
            {t(
              '通过本题后自动解锁。先自己做出来，面试时才记得住。',
              'Unlocks once you pass this problem. The approach you find yourself is the one you remember in an interview.',
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              confirmed.current = false;
              setConfirm(true);
            }}
          >
            {t('仍要查看', 'Show anyway')}
          </button>
        </div>
      ) : error ? (
        <div role="alert">
          {english ? englishMessage(error) : error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            {t('重试', 'Retry')}
          </button>
        </div>
      ) : !editorial ? (
        <p role="status">{t('正在加载题解…', 'Loading the editorial…')}</p>
      ) : (
        <>
          <fieldset className="cs-ling-langs">
            <legend className="sr-only">{t('代码语言', 'Code language')}</legend>
            {LANGS.map(([id, name]) => (
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
                        original={approach[diffLang]}
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
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent finalFocus={() => (confirmed.current && heading.current) || true}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('现在查看官方题解？', 'Show the editorial now?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                '你还没有通过这道题。题解会直接给出完整解法和代码。',
                "You haven't passed this problem yet. The editorial gives away complete solutions and code.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('再想想', 'Keep trying')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmed.current = true;
                setConfirm(false);
                onUnlock();
              }}
            >
              {t('查看题解', 'Show editorial')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
