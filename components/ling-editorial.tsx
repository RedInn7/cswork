'use client';
import { useState } from 'react';
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
import { StatementMarkdown } from './statement-markdown';
import type { LingEditorial as Editorial } from '@/lib/oj-client';
import type { Language } from '@/lib/problems';
import type { EditorSettings } from '@/lib/editor-settings';
import '@/app/ling-editorial.css';

const LANGS = [
  ['python', 'Python'],
  ['cpp', 'C++'],
] as const;
type EditorialLang = (typeof LANGS)[number][0];

/**
 * The Line 500 editorial tab: approaches from brute force to best, each with its idea,
 * complexity and Python / C++ code, and a diff of that code against the editor's.
 * Locked until the learner has passed the problem, unless they confirm they want it now;
 * the workspace keeps that choice (`unlocked`) so switching tabs doesn't forget it.
 */
export function LingEditorial({
  editorial,
  english,
  unlocked,
  onUnlock,
  code,
  language,
  settings,
}: {
  editorial: Editorial;
  english: boolean;
  unlocked: boolean;
  onUnlock: () => void;
  code: string;
  language: Language;
  settings: EditorSettings;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [lang, setLang] = useState<EditorialLang>(language === 'cpp' ? 'cpp' : 'python');
  const [compare, setCompare] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const langName = LANGS.find(([id]) => id === lang)![1];
  return (
    <section className="cs-ling-editorial" aria-labelledby="ling-editorial-title">
      <div className="cs-ling-editorial-head">
        <h2 id="ling-editorial-title">{t('官方题解', 'Editorial')}</h2>
        {editorial.verified ? (
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
          <button type="button" onClick={() => setConfirm(true)}>
            {t('仍要查看', 'Show anyway')}
          </button>
        </div>
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
                        {t('官方题解', 'Editorial')} · {langName}
                      </span>
                      <span>
                        {t('我的代码', 'My code')} · {language}
                      </span>
                    </div>
                    <div className="cs-history-editor cs-ling-diff">
                      <CodeDiff
                        original={approach[lang]}
                        modified={code}
                        originalLanguage={lang}
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
        </>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
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
