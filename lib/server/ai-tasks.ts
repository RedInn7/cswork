import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AI_TASK_SLUGS, ICA_LEVELS, ICA_TASK_SLUGS, parseIcaProblemId } from '@/lib/ai-coding';

/**
 * The AI-assisted round's practice projects (lib/ai-coding.ts), read from content/ai-coding/<slug>/
 * (shipped by scripts/package-oj-worker.mjs): meta.json, README.md / README.zh.md, the learner's
 * starting src/ and tests/, and hidden_tests/, which stays on the server and only the judge reads.
 * solution/ is the reference fix the tests check (tests/ai-assisted.test.ts); it is never read here.
 */
export type AiTask = {
  slug: string;
  title: [string, string];
  summary: [string, string];
  kind: [string, string];
  minutes: number;
  readme: { zh: string; en: string };
  /** The starting files the learner edits: path → content. */
  files: Record<string, string>;
  hidden: Record<string, string>;
  /** Test methods in the hidden suite, so a suite that never loaded still shows its size. */
  hiddenTotal: number;
};
// ponytail: read once per process; a content change ships with a release, which restarts it.
let cache: AiTask[] | null = null;

function folder(dir: string, prefix: string) {
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.py'))
      .sort()
      .map((name) => [`${prefix}/${name}`, readFileSync(join(dir, name), 'utf8')]),
  );
}
const testCount = (files: Record<string, string>) =>
  Object.values(files).reduce((n, text) => n + (text.match(/^[ \t]+def test/gm)?.length ?? 0), 0);

export function aiTasks(): AiTask[] {
  if (cache) return cache;
  const root = resolve('content/ai-coding');
  const tasks = AI_TASK_SLUGS.flatMap((slug) => {
    const dir = join(root, slug);
    if (!existsSync(join(dir, 'meta.json'))) return [];
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Pick<AiTask, 'title' | 'summary' | 'kind' | 'minutes'>;
    const hidden = folder(join(dir, 'hidden_tests'), 'hidden_tests');
    return [
      {
        slug,
        title: meta.title,
        summary: meta.summary,
        kind: meta.kind,
        minutes: meta.minutes,
        readme: {
          en: readFileSync(join(dir, 'README.md'), 'utf8'),
          zh: readFileSync(join(dir, 'README.zh.md'), 'utf8'),
        },
        files: { ...folder(join(dir, 'src'), 'src'), ...folder(join(dir, 'tests'), 'tests') },
        hidden,
        hiddenTotal: testCount(hidden),
      },
    ];
  });
  // An empty list is not cached, so a missing folder in development shows up once it exists.
  if (tasks.length) cache = tasks;
  return tasks;
}

export const aiTask = (slug: string) => aiTasks().find((task) => task.slug === slug);

/**
 * The ICA practice sets (lib/ai-coding.ts), read from content/ica/<slug>/ (shipped like ai-coding):
 * meta.json, levels/<n>.md and <n>.zh.md, the starting src/, tests/test_level<n>.py (public, handed out
 * with their level) and hidden_tests/test_level<n>.py, which only the judge reads. solution/ is for tests.
 */
export type IcaTask = {
  slug: string;
  title: [string, string];
  summary: [string, string];
  minutes: number;
  /** Per level, from level 1. */
  levels: { zh: string; en: string; tests: Record<string, string>; hidden: Record<string, string>; hiddenTotal: number }[];
  /** The starting files: src/ and tests/__init__.py. */
  files: Record<string, string>;
};
let icaCache: IcaTask[] | null = null;

export function icaTasks(): IcaTask[] {
  if (icaCache) return icaCache;
  const root = resolve('content/ica');
  const tasks = ICA_TASK_SLUGS.flatMap((slug) => {
    const dir = join(root, slug);
    if (!existsSync(join(dir, 'meta.json'))) return [];
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Pick<IcaTask, 'title' | 'summary' | 'minutes'>;
    const tests = folder(join(dir, 'tests'), 'tests'),
      hidden = folder(join(dir, 'hidden_tests'), 'hidden_tests');
    const level = (files: Record<string, string>, n: number) =>
      Object.fromEntries(Object.entries(files).filter(([path]) => path.endsWith(`/test_level${n}.py`)));
    return [
      {
        slug,
        title: meta.title,
        summary: meta.summary,
        minutes: meta.minutes,
        levels: Array.from({ length: ICA_LEVELS }, (_, i) => {
          const secret = level(hidden, i + 1);
          return {
            en: readFileSync(join(dir, 'levels', `${i + 1}.md`), 'utf8'),
            zh: readFileSync(join(dir, 'levels', `${i + 1}.zh.md`), 'utf8'),
            tests: level(tests, i + 1),
            hidden: secret,
            hiddenTotal: testCount(secret),
          };
        }),
        files: { ...folder(join(dir, 'src'), 'src'), 'tests/__init__.py': tests['tests/__init__.py'] ?? '' },
      },
    ];
  });
  if (tasks.length) icaCache = tasks;
  return tasks;
}

export const icaTask = (slug: string) => icaTasks().find((task) => task.slug === slug);

/**
 * The hidden suite a project run's problem_id stands for: an AI-assisted task's, or for an ICA
 * level (ai-ica-<slug>-l<n>) the hidden tests of levels 1..n, so a later level cannot break an earlier one.
 */
export function projectSuite(problemId: string) {
  const ica = parseIcaProblemId(problemId);
  if (ica) {
    const levels = icaTask(ica.slug)?.levels.slice(0, ica.level);
    if (!levels || levels.length < ica.level) return undefined;
    return {
      hidden: Object.assign({ 'hidden_tests/__init__.py': '' }, ...levels.map((l) => l.hidden)) as Record<string, string>,
      hiddenTotal: levels.reduce((n, l) => n + l.hiddenTotal, 0),
    };
  }
  const task = aiTask(problemId.replace(/^ai-/, ''));
  return task && { hidden: task.hidden, hiddenTotal: task.hiddenTotal };
}
