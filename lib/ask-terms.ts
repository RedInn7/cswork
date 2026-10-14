/** Search words for "Ask AI" (lib/server/ai-ask.ts): plain data, outside lib/server so the stop words are not messages. */
const STOP = new Set(
  'the and for how what why does did with this that are can you use used when which from into its not but have has was were will would should could about between difference explain mean means meaning work works there their they them than then also any all some more most such only other want need know like get give tell show make way ways best good one two is it in on of to or an as at be by do if me my no so up us we'.split(
    ' ',
  ),
);
const CJK_STOP = new Set(['什么', '怎么', '如何', '为什', '么是', '一下', '一个', '这个', '那个', '可以', '是不', '不是', '的是']);
const CJK = /[㐀-鿿]+/g;

/**
 * Search terms of a question: Latin words (3+ letters, or a 2-letter acronym like DP or OA; no stop
 * words) and Chinese bigrams. Chinese and Latin touching ("什么是LRU缓存") are split first.
 */
export function askTerms(text: string) {
  const spaced = text.replace(/(?<=[㐀-鿿])(?=[A-Za-z0-9])|(?<=[A-Za-z0-9])(?=[㐀-鿿])/g, ' ');
  const words = [
    ...new Set(
      (spaced.match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter((w) => (w.length >= 3 || /^[A-Z]{2}$/.test(w)) && !/^[㐀-鿿]/.test(w))
        .map((w) => w.toLowerCase())
        .filter((w) => !STOP.has(w)),
    ),
  ].slice(0, 8);
  const grams = new Set<string>();
  for (const run of spaced.match(CJK) ?? [])
    for (let i = 0; i + 2 <= run.length; i++) if (!CJK_STOP.has(run.slice(i, i + 2))) grams.add(run.slice(i, i + 2));
  return { words, grams: [...grams].slice(0, 12) };
}
