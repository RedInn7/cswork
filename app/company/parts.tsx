import { RESULTS, ROUND_LABELS, type ExperienceFacts } from '@/lib/experience';

/** Shared by the company page and its role and category pages (facet-view.tsx). */
export const QUESTION_LEVELS: Record<string, [string, string]> = {
  easy: ['简单', 'Easy'],
  medium: ['中等', 'Medium'],
  hard: ['困难', 'Hard'],
};

/** Outcome, rounds and interview month of an experience; nothing when the report has none. */
export function Facts({ item, zh }: { item: Partial<ExperienceFacts>; zh: boolean }) {
  const result = item.result && Object.hasOwn(RESULTS, item.result) ? RESULTS[item.result] : null;
  const rounds = (item.rounds ?? []).map((r) =>
    Object.hasOwn(ROUND_LABELS, r) ? ROUND_LABELS[r][zh ? 0 : 1] : r,
  );
  if (!result && !rounds.length && !item.interviewDate) return null;
  return (
    <p className="company-hub-facts">
      {result && (
        <span className="oa-public-chip" data-result={result.tone}>
          {zh ? result.zh : result.en}
        </span>
      )}
      {!!rounds.length && (
        <span>
          <span aria-hidden="true">{rounds.join(' → ')}</span>
          <span className="sr-only">{zh ? `轮次：${rounds.join('、')}` : `Rounds: ${rounds.join(', ')}`}</span>
        </span>
      )}
      {item.interviewDate && (
        <span>{zh ? `面试于 ${item.interviewDate.slice(0, 7)}` : `Interviewed ${item.interviewDate.slice(0, 7)}`}</span>
      )}
    </p>
  );
}
