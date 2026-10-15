import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AI_TASK_SLUGS } from '@/lib/ai-coding';

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
        hiddenTotal: Object.values(hidden).reduce((n, text) => n + (text.match(/^[ \t]+def test/gm)?.length ?? 0), 0),
      },
    ];
  });
  // An empty list is not cached, so a missing folder in development shows up once it exists.
  if (tasks.length) cache = tasks;
  return tasks;
}

export const aiTask = (slug: string) => aiTasks().find((task) => task.slug === slug);
