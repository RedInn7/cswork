/**
 * The AI-assisted coding round (/ai-assisted): small multi-file Python projects in
 * content/ai-coding/<slug>/ that run their unittest suites on the judge (mode 'project').
 * Plain data, shared by the pages, the API and the judge worker.
 */
export const AI_TASK_SLUGS = [
  'inventory-oversell',
  'rate-limit-burst',
  'log-rollup-speed',
  'legacy-pricing',
  'signup-validator-refactor',
  'log-parser-refactor',
  'stock-report-refactor',
] as const;
export type AiTaskSlug = (typeof AI_TASK_SLUGS)[number];
/**
 * Take-home assignments (/take-home): the same layout with "track": "take-home" in meta.json, judged
 * the same way but without the AI pair. Not in AI_TASK_SLUGS, which /ai-assisted lists and maps.
 */
export const TAKE_HOME_SLUGS = ['url-shortener', 'billing-reconcile'] as const;
export type AiTaskTrack = 'ai-assisted' | 'take-home';
/** A run's files: at most this many, this many bytes in all (a separate limit from MAX_CODE_BYTES). */
export const PROJECT_MAX_FILES = 30;
export const PROJECT_MAX_BYTES = 262_144;
/** Learner-editable paths: Python modules under src/ and tests/, nothing else. */
export const PROJECT_PATH = /^(?:src|tests)\/[A-Za-z_][A-Za-z0-9_]{0,59}\.py$/;
/** Runs of one learner per hour, across tasks. */
export const PROJECT_RUNS_PER_HOUR = 30;
/** The problem_id a task's runs carry; no oj_problems row has it. */
export const projectProblemId = (slug: string) => `ai-${slug}`;

/**
 * CodeSignal ICA-style practice (/oa/ica): one Python project in four gated levels, content/ica/<slug>/,
 * judged like an AI-assisted run. A level unlocks once the one before it has an accepted run.
 */
export const ICA_TASK_SLUGS = ['bank-ledger', 'kv-ttl-backup', 'file-store'] as const;
export const ICA_LEVELS = 4;
/** An ICA level's runs; the judge runs the hidden tests of levels 1..level (lib/server/ai-tasks.ts). */
export const icaProblemId = (slug: string, level: number) => `ai-ica-${slug}-l${level}`;
export function parseIcaProblemId(id: string) {
  const match = /^ai-ica-([a-z0-9-]+)-l([1-9])$/.exec(id);
  return match ? { slug: match[1], level: Number(match[2]) } : null;
}

export type ProjectFailure = { name: string; message: string };
/**
 * A finished run as its learner sees it: the public suite's failures by name, the hidden
 * suite as counts only (null when it never reported), and what the code printed.
 */
export type ProjectReport = {
  visible: { passed: number; total: number; failures: ProjectFailure[] } | null;
  hidden: { passed: number; total: number } | null;
  output: string;
};

/**
 * The round review (POST oj/ai/round-review, lib/server/round-review.ts): how the AI pair was used
 * ('pair'), or a take-home's code quality ('quality'), each criterion scored 1–4, labels [zh, en].
 */
export type ReviewMode = 'pair' | 'quality';
export const REVIEW_CRITERIA: Record<ReviewMode, [key: string, zh: string, en: string][]> = {
  pair: [
    ['decomposition', '拆解任务', 'Breaking the task down'],
    ['prompting', '提示具体程度', 'Specific prompts'],
    ['verification', '核验 AI 输出', 'Checking AI output'],
    ['testing', '测试意识', 'Testing'],
    ['explanation', '讲清最终代码', 'Explaining the final code'],
  ],
  quality: [
    ['structure', '代码结构', 'Structure'],
    ['tests', '测试', 'Tests'],
    ['errors', '错误处理', 'Error handling'],
    ['readme', '设计说明', 'Design note'],
  ],
};
export type RoundReview = { scores: { key: string; score: number; why: string }[]; suggestions: string[]; summary: string };
/** The conversation a pair review reads: at most this many turns and characters in all. */
export const REVIEW_TURNS = 40;
export const REVIEW_TALK_CHARS = 24_000;
/** A take-home's design note, sent with its quality review. */
export const REVIEW_NOTES_CHARS = 4000;
/** The newest turns within REVIEW_TURNS and REVIEW_TALK_CHARS, starting with a question. */
export function reviewTurns<T extends { role: string; text: string }>(turns: T[]) {
  const kept: T[] = [];
  let chars = 0;
  for (const turn of [...turns].reverse()) {
    if (kept.length >= REVIEW_TURNS || chars + turn.text.length > REVIEW_TALK_CHARS) break;
    kept.unshift(turn);
    chars += turn.text.length;
  }
  while (kept[0]?.role === 'assistant') kept.shift();
  return kept;
}

/**
 * What a report in the content library has to say for the "companies that mention it"
 * list (lib/server/ai-rounds.ts): English phrases for the full-text index, Chinese ones
 * matched in titles and summaries (the index does not segment Chinese).
 */
export const AI_ROUND_PHRASES = ['"ai assisted"', '"ai enabled"', '"ai assisted coding"', 'copilot', '"cursor ide"', '"ai tools allowed"', '"allowed to use ai"'];
export const AI_ROUND_PHRASES_ZH = ['AI 辅助', 'AI辅助', '可以用 AI', '可以用AI', '允许使用 AI', '允许使用AI', 'AI 编程轮'];
