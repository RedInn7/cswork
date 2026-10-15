import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { AI_ROUND_PHRASES, AI_ROUND_PHRASES_ZH, PROJECT_MAX_BYTES, PROJECT_PATH, projectProblemId } from '@/lib/ai-coding';
import type { Person } from './auth';
import { aiEnabled, REPLY_CHARS, runAi, SYSTEM, textReply } from './ai-tutor';
import { aiTask } from './ai-tasks';
import { library } from './content-library';
import { runningContestProblems } from './contests';
import { hiddenCompanies } from './env';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';
import { projectReport, projectTooLarge } from './oj-submissions';
import { publicLibraryPath } from './public-library';

/**
 * The AI-assisted round (/ai-assisted): which companies' interview reports mention AI tools
 * in a round, and the AI pair beside the project workspace (POST oj/ai/pair, kind 'pair' of
 * the AI tutor's quota on its own site budget). Projects and their runs: lib/server/ai-tasks.ts,
 * createProjectRun in lib/server/oj-submissions.ts.
 */
export type RoundCompany = { slug: string; name: string; reports: number; links: { title: string; path: string }[] };
const DAY = 86_400_000;
// ponytail: one scan of the experiences every 10 minutes per process; a stored tag if it grows slow.
let mentions: { at: number; hidden: string; value: RoundCompany[] } | null = null;
/**
 * Companies with at least one listed, public experience that mentions an AI-assisted round
 * (lib/ai-coding.ts phrases), by how many, with up to three links each. Hidden companies and
 * reports without a company are left out; no company is listed without a matching report.
 */
export function aiRoundCompanies(now = Date.now(), hidden: ReadonlySet<string> = hiddenCompanies()): RoundCompany[] {
  const key = [...hidden].sort().join(',');
  if (mentions && mentions.hidden === key && now - mentions.at < DAY / 144) return mentions.value;
  const db = library();
  const like = `LIKE ? ESCAPE '\\'`;
  const zh = AI_ROUND_PHRASES_ZH.map((phrase) => `%${phrase.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const rows = (db
    ?.prepare(
      `SELECT company_slug AS slug,company_name AS name,slug AS item,title FROM items
       WHERE type='experience' AND listed=1 AND partial=0 AND dup_of IS NULL AND COALESCE(company_slug,'')<>''
         ${hidden.size ? `AND LOWER(company_slug) NOT IN (${[...hidden].map(() => '?').join(',')})` : ''}
         AND (rowid IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)
           ${zh.map(() => `OR title ${like} OR summary ${like}`).join(' ')})
       ORDER BY published_at DESC, rowid DESC`,
    )
    .all(...hidden, AI_ROUND_PHRASES.join(' OR '), ...zh.flatMap((p) => [p, p])) ?? []) as {
    slug: string;
    name: string | null;
    item: string;
    title: string;
  }[];
  const companies = new Map<string, RoundCompany>();
  for (const row of rows) {
    const company = companies.get(row.slug) ?? { slug: row.slug, name: row.name || row.slug, reports: 0, links: [] };
    company.reports++;
    if (company.links.length < 3) company.links.push({ title: row.title, path: publicLibraryPath('experience', row.item) });
    companies.set(row.slug, company);
  }
  const value = [...companies.values()].sort((a, b) => b.reports - a.reports || a.name.localeCompare(b.name));
  mentions = { at: now, hidden: key, value };
  return value;
}

// Characters of task, files, last run and conversation sent per call: a call stays about the
// size of the interviewer's (HISTORY_CHARS), however large the project is.
export const PAIR_CONTEXT_CHARS = 24_000;
const README_CHARS = 3000;
const RUN_CHARS = 2500;
const HISTORY_CHARS = 6000;
const QUESTION_CHARS = 1000;
const turn = z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(REPLY_CHARS.pair + 200) }).strict();
const input = z
  .object({
    task: z.string().regex(/^[a-z0-9-]{1,60}$/),
    files: z.record(z.string().regex(PROJECT_PATH), z.string()),
    // The file open in the editor: it goes first.
    active: z.string().max(80).optional(),
    question: z.string().max(QUESTION_CHARS),
    history: z.array(turn).max(12).default([]),
    locale: z.enum(['zh', 'en']).default('en'),
  })
  .strict();
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n…(truncated)` : text);

/** The learner's latest finished run of this task as its result panel shows it: hidden tests as counts only. */
function lastRun(userId: string, slug: string) {
  const row = sqlite()
    .prepare(
      `SELECT s.status,r.stdout,r.stderr FROM submissions s JOIN oj_results r ON r.submission_id=s.id AND r.ordinal=0
       WHERE s.user_id=? AND s.problem_id=? AND s.mode='project' ORDER BY s.created_at DESC,s.rowid DESC LIMIT 1`,
    )
    .get(userId, projectProblemId(slug)) as { status: string; stdout: string | null; stderr: string | null } | undefined;
  const report = projectReport(row);
  if (!row || !report) return 'No test run yet.';
  const lines = [`Status: ${row.status}.`];
  if (report.visible) {
    lines.push(`Public tests: ${report.visible.passed}/${report.visible.total} passed.`);
    for (const failure of report.visible.failures) lines.push(`FAILED ${failure.name}\n${failure.message}`);
  } else lines.push('The public tests did not finish.');
  if (report.hidden) lines.push(`Hidden tests: ${report.hidden.passed}/${report.hidden.total} passed (their contents are not available).`);
  if (report.output.trim()) lines.push(`Program output:\n${report.output}`);
  return clip(lines.join('\n'), RUN_CHARS);
}

/**
 * The prompt's data: the README, the last run, then files (the open one first, then src/, then
 * tests/) while they fit PAIR_CONTEXT_CHARS with the conversation; the rest are named only.
 */
export function pairContext(
  readme: string,
  run: string,
  files: Record<string, string>,
  active: string | undefined,
  budget: number,
) {
  const order = Object.keys(files).sort(
    (a, b) => Number(b === active) - Number(a === active) || Number(a.startsWith('tests/')) - Number(b.startsWith('tests/')) || (a < b ? -1 : 1),
  );
  const blocks = [`<task>\n${clip(readme, README_CHARS)}\n</task>`, `<last_test_run>\n${run}\n</last_test_run>`];
  // Every name is reserved up front, so the files left out are named within the budget too.
  let left = budget - blocks.join('\n').length - `\n<files_not_shown>${order.join(', ')}</files_not_shown>`.length;
  const omitted: string[] = [];
  for (const path of order) {
    const head = `<file path="${path}">\n`,
      tail = '\n</file>';
    const room = left - head.length - tail.length;
    const text =
      files[path].length <= room
        ? files[path]
        : // The open file is sent cut short rather than left out.
          path === active && room > 1000
          ? clip(files[path], room - 20)
          : null;
    if (text === null) {
      omitted.push(path);
      continue;
    }
    const block = head + text + tail;
    blocks.push(block);
    left -= block.length + 1;
  }
  if (omitted.length) blocks.push(`<files_not_shown>${omitted.join(', ')}</files_not_shown>`);
  return blocks.join('\n');
}

/** POST oj/ai/pair: one reply of the AI pair about the learner's current files. */
export async function handleAiPair(request: Request, p: Person) {
  if (!aiEnabled() || request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'ai-tutor', 6);
  const data = input.parse(await readJson(request, PROJECT_MAX_BYTES * 2 + 100_000));
  // A run's limits: the list of files not shown stays short.
  if (projectTooLarge(data.files)) throw new HttpError(413, '项目最多 30 个文件，合计 256 KiB');
  // A code-writing assistant must not be a way around a running contest's closed tutor.
  if (runningContestProblems(p.id).size) throw new HttpError(403, '比赛进行中，AI 结对暂停，赛后开放');
  const task = aiTask(data.task);
  if (!task) throw new HttpError(404, '练习任务不存在');
  const question = data.question.trim();
  if (!question) throw new HttpError(400, '请先输入问题');
  // The newest turns within HISTORY_CHARS, oldest first, starting with a question.
  const history: typeof data.history = [];
  for (const t of [...data.history].reverse()) {
    if (history.reduce((n, h) => n + h.text.length, t.text.length) > HISTORY_CHARS) break;
    history.unshift(t);
  }
  while (history[0]?.role === 'assistant') history.shift();
  const used = history.reduce((n, h) => n + h.text.length, 0);
  const context = pairContext(
    task.readme[data.locale],
    lastRun(p.id, task.slug),
    data.files,
    data.active,
    PAIR_CONTEXT_CHARS - used,
  );
  const language = data.locale === 'en' ? 'English' : 'Simplified Chinese';
  const turns = [...history, { role: 'user' as const, text: question }];
  const messages = turns.map((t, i) => ({
    role: t.role,
    content: i ? t.text : `${context}\n\nReply in ${language} throughout. The learner asks:\n${t.text}`,
  }));
  return json(await runAi(request, p, 'pair', messages, SYSTEM.pair, textReply('pair')));
}
