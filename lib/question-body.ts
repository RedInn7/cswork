/**
 * A question's Markdown split into what the candidate sees and the reference parts (hints,
 * follow-ups, rubric, solution): the content library's try-first reveal and the AI answer grader
 * read the same split. Pure (no I/O).
 */
export type BodyParts = {
  /** What the candidate sees. */
  question: string;
  hints: string;
  followUps: string;
  /** What a strong answer covers, clarifying questions to expect. */
  rubric: string;
  /** Approach notes and the worked solution. */
  solution: string;
};
const SECTIONS: [keyof BodyParts, RegExp][] = [
  ['hints', /^hints?\b/i],
  ['followUps', /^(follow[- ]?ups?|extensions?)\b/i],
  ['solution', /^(suggested |reference )?approach\b/i],
  [
    'rubric',
    /^(what a strong answer covers|what (this|each) part should cover|clarifying questions|what (the )?interviewers? (are |is )?(look(ing)? for|want|evaluat)|evaluation (focus|emphasis|criteria)|what good looks like|expectations\b|grading\b)/i,
  ],
];
/** An inline hint the body quotes in the question: `> **Hint: …**` and the quote lines after it. */
const QUOTED_HINT = /^\s*>\s*\*\*hints?\b/i,
  QUOTE = /^\s*>\s?/;
/**
 * Splits a question's Markdown at its `## Solution` heading and moves the interviewer-only
 * sections above it (hints, follow-ups, rubric, approach) out of the candidate's part. A moved
 * section runs to the next heading of its level or higher; one inside a part keeps the part's name.
 * A quoted `> **Hint…**` block in the question moves to the hints too.
 */
export function splitBody(body: string): BodyParts {
  const parts: Record<keyof BodyParts, string[]> = { question: [], hints: [], followUps: [], rubric: [], solution: [] };
  let into: keyof BodyParts = 'question',
    depth = 0,
    fence = false,
    quote = false,
    quotePart: string | undefined;
  // The candidate's headings by level, to name the part a moved section came from.
  const heads: string[] = [];
  // A section ends without its trailing blank lines and the rule that closed it.
  const close = () => {
    const lines = parts[into];
    while (lines.length && /^\s*(?:-{3,}|\*{3,})?\s*$/.test(lines[lines.length - 1])) lines.pop();
  };
  for (const line of body.split('\n')) {
    if (quote && QUOTE.test(line)) {
      parts.hints.push(line.replace(QUOTE, ''));
      continue;
    }
    quote = false;
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && into === 'question' && QUOTED_HINT.test(line)) {
      quote = true;
      if (parts.hints.length) parts.hints.push('');
      // Named by the heading it sat under, once for a run of hints there.
      const part = heads.slice(2).findLast(Boolean);
      if (part && part !== quotePart) parts.hints.push(`**${part}**`, '');
      quotePart = part;
      parts.hints.push(line.replace(QUOTE, ''));
      continue;
    }
    const heading = fence ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length,
        title = heading[2];
      if (level === 2 && /^solution\b/i.test(title)) {
        close();
        into = 'solution';
        depth = 2;
        continue;
      } else if (into === 'question' || level <= depth) {
        // A document titled "# Follow-up email…" is still a question.
        const section = (level > 1 || heads.length > 0) && SECTIONS.find(([, pattern]) => pattern.test(title));
        if (section) {
          close();
          into = section[0];
          depth = level;
          if (parts[into].length) parts[into].push('');
          const part = heads.slice(2, level).findLast(Boolean);
          if (part) parts[into].push(`**${part}**`, '');
          if (into === 'solution' || into === 'rubric') parts[into].push(`#### ${title}`);
          continue;
        }
        if (into !== 'question') close();
        into = 'question';
        heads.length = level;
        heads[level] = title;
      }
    }
    parts[into].push(line);
  }
  close();
  const text = (key: keyof BodyParts) =>
    parts[key]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .replace(/\n\s*(?:-{3,}|\*{3,})$/, '');
  return { question: text('question'), hints: text('hints'), followUps: text('followUps'), rubric: text('rubric'), solution: text('solution') };
}
