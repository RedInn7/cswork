/** Search words for "Ask AI" (lib/server/ai-ask.ts): plain data, outside lib/server so the stop words are not messages. */
const STOP = new Set(
  'the and for how what why does did with this that are can you use used when which from into its not but have has was were will would should could about between difference explain mean means meaning work works there their they them than then also any all some more most such only other want need know like get give tell show make way ways best good one two'.split(
    ' ',
  ),
);
const CJK_STOP = new Set(['什么', '怎么', '如何', '为什', '么是', '一下', '一个', '这个', '那个', '可以', '是不', '不是', '的是']);
const CJK = /[\u3400-\u9fff]+/g;

/** Search terms of a question: Latin words (3+ letters, no stop words) and Chinese bigrams. */
export function askTerms(text: string) {
  const words = [
    ...new Set(
      (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
        (w) => w.length >= 3 && !STOP.has(w) && !/^[\u3400-\u9fff]/.test(w),
      ),
    ),
  ].slice(0, 8);
  const grams = new Set<string>();
  for (const run of text.match(CJK) ?? [])
    for (let i = 0; i + 2 <= run.length; i++) if (!CJK_STOP.has(run.slice(i, i + 2))) grams.add(run.slice(i, i + 2));
  return { words, grams: [...grams].slice(0, 12) };
}
