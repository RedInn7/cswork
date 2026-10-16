'use client';

import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { analyze, banned, type FollowUpRule } from '@/lib/code-analyzer';
import '@/app/analyzer-notes.css';

const LEVEL = {
  essential: ['需要修正', 'Fix'],
  actionable: ['建议', 'Suggestion'],
  informative: ['提示', 'Note'],
} as const;

/**
 * Under "Accepted": rule-based notes on the code (lib/code-analyzer.ts, no AI quota)
 * and, in follow-up mode, that the follow-up was met. Renders nothing when neither applies.
 */
export function AnalyzerNotes({
  code,
  language,
  followUp,
  english,
}: {
  code: string;
  language: string;
  /** Set only when the submission was made in follow-up mode. */
  followUp?: FollowUpRule;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const notes = useMemo(() => analyze(code, language), [code, language]);
  const kept = useMemo(() => !!followUp && !banned(code, language, followUp), [code, language, followUp]);
  if (!notes.length && !kept) return null;
  return (
    <div className="cs-analyzer-notes">
      {kept && followUp && (
        <p className="cs-follow-up-kept">
          {t(`通过（满足追问：${followUp.zh}）`, `Accepted, follow-up met: ${followUp.en}`)}
        </p>
      )}
      {notes.length > 0 && (
        <section aria-label={t('写法提示', 'Code notes')}>
          <h3>{t('写法提示', 'Code notes')}</h3>
          <ul>
            {notes.map((note) => (
              <li key={note.id} data-severity={note.severity}>
                <span className="cs-analyzer-level">{t(...LEVEL[note.severity])}</span>
                <span className="cs-analyzer-line">{t(`第 ${note.line} 行`, `Line ${note.line}`)}</span>
                <p>
                  {t(note.zh, note.en)}
                  {note.topic && (
                    <>
                      {' '}
                      <a href={`/topics/${note.topic}`}>{t('看专题', 'See the topic')}</a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The editor toolbar's follow-up switch, shown only on problems with a follow-up rule. */
export function FollowUpToggle({
  rule,
  on,
  onChange,
  english,
}: {
  rule: FollowUpRule;
  on: boolean;
  onChange: (on: boolean) => void;
  english: boolean;
}) {
  const label = english
    ? `Follow-up mode: ${rule.en}. When on, your code is checked before it is submitted`
    : `追问模式：${rule.zh}。开启后，提交前会先检查代码`;
  return (
    <button className="cs-follow-up-toggle" aria-pressed={on} aria-label={label} title={label} onClick={() => onChange(!on)}>
      <ListChecks size={14} />
      {english ? 'Follow-up' : '追问'}
    </button>
  );
}

/** Why a follow-up-mode submission is held back, or '' when the code keeps to the rule. */
export function followUpBlocked(code: string, language: string, rule: FollowUpRule, english: boolean) {
  const hit = banned(code, language, rule);
  if (!hit) return '';
  return english
    ? `Follow-up mode: line ${hit.line} uses ${hit.token} (${rule.en}). Rewrite it, or turn follow-up mode off to submit as usual.`
    : `追问模式：第 ${hit.line} 行用了 ${hit.token}（本题追问要求：${rule.zh}）。改写后再提交，或关掉追问模式按普通方式提交。`;
}
