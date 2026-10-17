/** Codility-style named groups for a submission judged on every case (submissions.all_cases). */
export type CaseGroup = 'correctness' | 'performance';

/**
 * Splits a version's cases when its hidden inputs include clearly larger ones: at least 6 hidden
 * cases and the largest input at least 8x the median hidden input. Hidden cases within 8x of the
 * largest are performance, at most the largest ceil(30%) of them (ties by ordinal); every other
 * case, samples too, is correctness.
 * Returns each case's group in input order, or null when the version is not split.
 * ponytail: input length is the only signal; a per-case label in the package replaces it if ever needed.
 */
export function caseGroups(
  cases: readonly { ordinal: number; hidden: boolean; size: number }[],
): CaseGroup[] | null {
  const hidden = cases.filter((c) => c.hidden);
  if (hidden.length < 6) return null;
  const sizes = hidden.map((c) => c.size).sort((a, b) => a - b);
  const mid = sizes.length >> 1;
  const median = sizes.length % 2 ? sizes[mid] : (sizes[mid - 1] + sizes[mid]) / 2;
  const max = sizes.at(-1)!;
  if (max === 0 || max < 8 * median) return null;
  const large = new Set(
    hidden
      .filter((c) => c.size * 8 >= max)
      .sort((a, b) => b.size - a.size || a.ordinal - b.ordinal)
      .slice(0, Math.ceil(hidden.length * 0.3))
      .map((c) => c.ordinal),
  );
  return cases.map((c) => (large.has(c.ordinal) ? 'performance' : 'correctness'));
}

/** Each group's weighted pass percentage, floored so 100 means every case in it passed. */
export function groupScores(
  cases: readonly { group: CaseGroup; weight: number; accepted: boolean }[],
): Record<CaseGroup, number> {
  const pct = (group: CaseGroup) => {
    let earned = 0,
      total = 0;
    for (const c of cases)
      if (c.group === group) {
        total += c.weight;
        if (c.accepted) earned += c.weight;
      }
    return total > 0 ? Math.floor((earned * 100) / total) : 100;
  };
  return { correctness: pct('correctness'), performance: pct('performance') };
}
