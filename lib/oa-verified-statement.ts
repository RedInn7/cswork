// Packages keep provenance/forensics notes (checksums bind them); readers never see them.
// ponytail: clause-level regex tuned on the 2026-10 OA corpus (zh packages + en translations);
// notes worded differently stay visible. Upgrade path: drop them from the source text itself.
const sourced =
  /https?:\/\/(?:www\.)?(?:oamaster\.com|fastprep\.io|1point3acres\.com|leetcode\.com)\/|fingerprint|指纹/i;
const meta = new RegExp(
  [
    // Forensics about where the text came from (FastPrep, OCR, MDX, pinned snapshots).
    String.raw`oamaster|fastprep|ocr(?![a-z])|\bmdx\b|(?:fixed|pinned|original|upstream|oamaster|truncated|same) snapshot|snapshot (?:content|fingerprint)|transcription|cross-checked|curated page|curation error|upstream (?:solutions?|code|snapshot|example|text|function)`,
    // Who compiled the statement and what it does not claim. Plain "original problem" can carry a rule, so it is not matched.
    String.raw`(?:written|compiled|prepared|wrapped)(?: \w+)? by (?:this site|cswork)|(?:this site|cswork) independently|not (?:claimed|presented)\b|not treated as (?:part of )?(?:the )?(?:original|source)|not treated as a task rule|do(?:es)? not (?:imply|mean|pose|represent|claim)|not (?:the )?(?:source's )?original|original source (?:did|does|has|gives) (?:not|no)|review (?:notes|record)|company source|source repository`,
    String.raw`not given by the source|missing from the sources?|where the source lacks|missing (?:source |original )?(?:numeric )?(?:bounds|ranges|constraints)|typos in the source|source typos|corrections to (?:the )?examples|example corrections|judging conventions?|supplements added by this site|marked as this site's additions?|source's ranges are missing|statement for the original source|(?:original (?:statement|problem|text)|source(?: problem)?) (?:gives|gave|published|has|provides) no (?:\S+ ){0,2}?(?:bounds?|constraints?|ranges?|examples?|limits?|sizes?|scale)\b|additions? by this site|this site's additions|\b(?:ranges?|bounds?|limits?|constraints?|domain|character set|format|protocol|examples?|I/O)\b[^;:.]{0,60}?\b(?:is|are|were|was) (?:\w+ )?added by (?:this site|cswork)|supplemented by this site are defined`,
    // Sample notes that only point at the editorial or restate "follow the rules".
    String.raw`see the (?:accompanying |companion )?(?:notes|editorial|solution)\b|^\s*(?:process (?:the input )?according to the (?:problem |definite )?rules(?: above| in the statement)?|the example inputs and outputs follow the rules above directly|the output is the result computed according to the problem rules)[;.\s]*$`,
    String.raw`快照|整理页|审阅记录|交叉核对|交叉确认|上游(?:题解|代码|快照|样例|文字|函数题)|冒充|冒称|伪称|不声称|不宣称|不代表(?:原|上游|OAMaster)|不表示原题|不视为原始|原题(?:未|没有)(?:列出|给出?|公布|提供)|原始题面(?:没有|未)(?:公布|给|提供)|不是来源|不是原题额外|原题(?:平台|另有|提供)|不执行(?:上游|来源)`,
    String.raw`来源(?:原|笔误|缺失|未给|未提供|仓库|范围缺失)|源题未给|源未给出|原始(?:来源|题源)|题源未|题源与|题目来源与|原题来源与|公司来源|缺失原界|样例纠错|笔误恢复`,
    // "Added by this site" alone may introduce a real rule ("非负成本为本站补充"), so only ranges/formats/examples count.
    String.raw`由\s*(?:本站|CSWork)[^，。；]{0,10}?(?:编写|整理|定义|包装)|(?:本站|CSWork)\s*独立(?:编写|整理)|为本站(?:包装|整理)|(?:范围|上界|上限|下界|界|限制|约束|字符集|格式|协议|I/O|输入输出|样例|例)均?(?:由|为|是)本站(?:明确)?补充|标(?:为|明为|注为|记为)本站|属于本站(?:补充|整理|评测约定)|本站评测约定|站内判题约定|见(?:配套|候选)?(?:讲义|题解)`,
    String.raw`^\s*(?:请?(?:按|依照)(?:题目|题面|以上|上述)?(?:确定)?规则(?:处理|计算)(?:输入)?|样例输入输出直接遵循上述规则|输出按题目规则计算的结果)[；;。\s]*$`,
  ].join('|'),
  'i',
);
// ponytail: a clause carrying a bound, number, code or "specifies that" is never dropped, even if it
// names the source. Problem numbers ("Rubrik #22") are not rules.
const rule = (part: string) =>
  /[0-9≤≥<>=`]|specifies that|明确为/.test(part.replace(/#\d+/g, ''));
const drop = (part: string) => meta.test(part) && !rule(part);
function keep(clause: string): string {
  if (sourced.test(clause)) return '';
  // A leading attribution ("第三例为本站补充：…", "来源未给数值界，本站…") goes; what it introduces stays.
  const lead = clause.match(/^[^，：:]*[，：:]/)?.[0];
  const rest = lead ? clause.slice(lead.length) : '';
  if (
    lead &&
    drop(lead) &&
    (/[：:例]/.test(lead) || rule(rest) || /^本[站题]/.test(rest))
  )
    return keep(rest);
  return drop(clause) ? '' : clause;
}

const depth = (t: string, open = /[(（]/g, close = /[)）]/g) =>
  (t.match(open) || []).length - (t.match(close) || []).length;

function cleanText(text: string, clean = keep) {
  let fenced = false;
  let changed = false;
  const lines = text.split('\n').flatMap((line) => {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    if (fenced || !line.trim()) return [line];
    // A list/quote marker belongs to the line, not to its first clause.
    const mark = line.match(/^\s*(?:[-*+>]|\d+\.)\s+/)?.[0] ?? '';
    // [^] rather than ".": \r, U+2028 and U+2029 must not split or lose text.
    const kept = (
      line
        .slice(mark.length)
        .match(/[^]*?(?:[。！？]+|[.!?]+(?=\s|$)|$)\s*/g) || []
    )
      .map((sentence) => {
        const parts = sentence.split(/(?<=[；;])/).map(clean);
        const left = parts.join('');
        if (left === sentence) return sentence;
        let body = left.trim().replace(/[；;，：:。！？.!?]+$/, '');
        if (!body) return '';
        // A clause dropped from inside "(…; …)" or "“…；…”" must not take the closer with it.
        if (depth(body, /“/g, /”/g) > depth(sentence, /“/g, /”/g)) body += '”';
        if (depth(body) > depth(sentence))
          body += /（[^（）]*$/.test(body) ? '）' : ')';
        // "…; the rest" keeps reading as a sentence once its first clause is gone. Text after a
        // dropped "…OCR:" lead may be a literal ("bird=4", "aaaa") and keeps its case.
        const head =
          !parts[0].trim() && /^[A-Z]/.test(sentence)
            ? body[0].toUpperCase()
            : body[0];
        return head + body.slice(1) + sentence.match(/[。！？.!?]*\s*$/)![0];
      })
      .join('');
    if (mark + kept === line) return [line];
    changed = true;
    return kept.trim() ? [mark + kept.trimEnd()] : [];
  });
  // Untouched text stays byte-for-byte (markdown line breaks, spacing).
  return changed
    ? lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : text;
}

/** Display copy of an OA statement: provenance gone, and no explanation that repeats a hint. */
export function cleanOaStatement<
  T extends {
    description: string;
    input: string;
    output: string;
    explanation: string;
    hints?: string[];
  },
>(spec: T): T {
  const explanation = cleanText(spec.explanation);
  const hints = spec.hints?.map((hint) => cleanText(hint)).filter(Boolean);
  const display = {
    ...spec,
    description: cleanText(spec.description),
    input: cleanText(spec.input),
    output: cleanText(spec.output),
    // A sample note equal to a hint would reveal the hint before it is opened.
    explanation: hints?.some((h) => h.trim() === explanation.trim())
      ? ''
      : explanation,
    ...(hints && { hints }),
  };
  // REST API fixtures answer hidden cases' requests: judge-only, never display copy.
  Reflect.deleteProperty(display, 'httpFixtures');
  return display;
}

/** Editorials keep their forensics prose; only source links and fingerprints are hidden. */
export const cleanOaEditorial = (text: string) =>
  cleanText(text, (clause) =>
    /https?:\/\/|fingerprint|指纹/i.test(clause) ? '' : clause,
  );

/** Only public fields from the exact published judge version belong in the OA reader. */
export function formatOaVerifiedStatement(
  raw: {
    description: string;
    input: string;
    output: string;
    explanation: string;
    hints?: string[];
  },
  samples: { input: string; expectedOutput: string }[],
) {
  return oaStatementMarkdown(cleanOaStatement(raw), samples);
}

/**
 * Prose language of a catalog statement, for `lang`. Code is ignored; a Han character
 * counts as a word, and Chinese prose keeps English identifiers (~30% Han in the catalog).
 */
export function oaStatementLang(text: string) {
  const prose = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, ' ');
  const han = prose.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const words = prose.match(/[A-Za-z]+/g)?.length ?? 0;
  return han > 0.3 * (han + words) ? 'zh-CN' : 'en';
}

const headings = {
  zh: ['输入格式', '输出格式', '样例', '输入：', '输出：', '样例说明'],
  en: ['Input', 'Output', 'Example', 'Input:', 'Output:', 'Example notes'],
};
/** One Markdown document for an already-cleaned statement and its public samples. */
export function oaStatementMarkdown(
  spec: { description: string; input: string; output: string; explanation: string },
  samples: { input: string; expectedOutput: string }[],
  locale: 'zh' | 'en' = 'zh',
) {
  const [input, output, example, sampleIn, sampleOut, notes] = headings[locale];
  const code = (value: string) => {
    const length = Math.max(
      3,
      ...[...value.matchAll(/`+/g)].map((m) => m[0].length + 1),
    );
    const fence = '`'.repeat(length);
    return `${fence}text\n${value.replace(/\n$/, '')}\n${fence}`;
  };
  return [
    spec.description,
    `## ${input}\n\n` + spec.input,
    `## ${output}\n\n` + spec.output,
    ...samples.map(
      (sample, index) =>
        `## ${example} ${index + 1}\n\n${sampleIn}\n\n${code(sample.input)}\n\n${sampleOut}\n\n${code(sample.expectedOutput)}`,
    ),
    ...(spec.explanation ? [`## ${notes}\n\n` + spec.explanation] : []),
  ].join('\n\n');
}
