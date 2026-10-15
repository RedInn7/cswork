/**
 * The AI-assisted coding round (/ai-assisted): small multi-file Python projects in
 * content/ai-coding/<slug>/ that run their unittest suites on the judge (mode 'project').
 * Plain data, shared by the pages, the API and the judge worker.
 */
export const AI_TASK_SLUGS = ['inventory-oversell', 'rate-limit-burst', 'log-rollup-speed', 'legacy-pricing'] as const;
export type AiTaskSlug = (typeof AI_TASK_SLUGS)[number];
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
 * What a report in the content library has to say for the "companies that mention it"
 * list (lib/server/ai-rounds.ts): English phrases for the full-text index, Chinese ones
 * matched in titles and summaries (the index does not segment Chinese).
 */
export const AI_ROUND_PHRASES = ['"ai assisted"', '"ai enabled"', '"ai assisted coding"', 'copilot', '"cursor ide"', '"ai tools allowed"', '"allowed to use ai"'];
export const AI_ROUND_PHRASES_ZH = ['AI 辅助', 'AI辅助', '可以用 AI', '可以用AI', '允许使用 AI', '允许使用AI', 'AI 编程轮'];
