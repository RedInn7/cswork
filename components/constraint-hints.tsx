'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { budget, budgetMessage, failureChecks, type Bounds } from '@/lib/constraint-hints';
import '@/app/analyzer-notes.css';

/**
 * A statement pill: the complexity the largest input allows, folded so the learner estimates it
 * first. Opened, one line below the pill row. Nothing without bounds (lib/constraint-hints.ts).
 */
export function ComplexityBudget({ bounds, language, english }: { bounds: Bounds | null; language: string; english: boolean }) {
  const [open, setOpen] = useState(false);
  const message = bounds && budgetMessage(bounds, language);
  if (!message) return null;
  return (
    <>
      <button className="cs-statement-pill" aria-expanded={open} aria-controls="complexity-budget" onClick={() => setOpen((o) => !o)}>
        <Calculator size={15} />
        {english ? 'Complexity budget' : '复杂度预算'}
      </button>
      {open && (
        <p className="cs-budget-line" id="complexity-budget">
          {english ? message[1] : message[0]}
          {budget(bounds, language)?.pythonTight && (
            <>
              {' '}
              <a href="/learn/big-o/complexity">{english ? 'Estimating complexity' : '怎么估算复杂度'}</a>
            </>
          )}
        </p>
      )}
    </>
  );
}

const LINK: [string, string, string][] = [
  ['/topics/', '看专题', 'See the topic'],
  ['/judge-environment', '看评测环境', 'Judge environment'],
];

/** Under a failed result: what to check first, from the code, stderr and bounds. Nothing when empty. */
export function FailureChecklist({ english, ...input }: Parameters<typeof failureChecks>[0] & { english: boolean }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const { status, language, codingMode, code, stderr, bounds, params, constraints, statement } = input;
  const checks = useMemo(
    () => failureChecks({ status, language, codingMode, code, stderr, bounds, params, constraints, statement }),
    [status, language, codingMode, code, stderr, bounds, params, constraints, statement],
  );
  if (!checks.length) return null;
  return (
    <div className="cs-analyzer-notes">
      <section aria-label={t('排查清单', 'What to check')}>
        <h3>{t('排查清单：先看这几处', 'What to check first')}</h3>
        <ul>
          {checks.map((check) => {
            const link = check.href && LINK.find(([prefix]) => check.href!.startsWith(prefix));
            return (
              <li key={check.id}>
                {check.line && <span className="cs-analyzer-line">{t(`第 ${check.line} 行`, `Line ${check.line}`)}</span>}
                <p>
                  {t(check.zh, check.en)}
                  {check.href && (
                    <>
                      {' '}
                      <a href={check.href}>{link ? t(link[1], link[2]) : t('看说明', 'Read more')}</a>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
