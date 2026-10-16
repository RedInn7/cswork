/**
 * Flake check for the Core Skills concurrency group, run locally or in CI (never by the judge).
 * The drivers shuffle thread start order and pause at random, so one clean build run proves
 * little: here each solution must reproduce solution.py's answers `--runs` times over (cycling
 * through the sample and tests), and each racy.<ext>, the solution with its synchronization
 * taken out, must go wrong at least once in as many runs, or the driver is too weak to catch
 * the race it is there for.
 *
 *   node --import tsx scripts/core-skills/stress.ts [--runs 50] [slug ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile, CONTENT_DIR, EXT, exec, LANGUAGES, PROBLEMS } from './build';

const args = process.argv.slice(2);
const at = args.indexOf('--runs');
const runs = at < 0 ? 50 : Number(args.splice(at, 2)[1]);
const slugs = args.length ? args : PROBLEMS.filter((p) => p.group === 'concurrency').map((p) => p.slug);
const problems: string[] = [];
for (const slug of slugs) {
  const dir = join(CONTENT_DIR, slug);
  const { samples, tests } = JSON.parse(exec('python3', ['-I', 'gen.py'], dir).stdout) as {
    samples: string[];
    tests: string[];
  };
  const inputs = [...samples, ...tests];
  const reference = compile('python', readFileSync(join(dir, 'solution.py'), 'utf8'));
  const expected = inputs.map((input) => reference.run(input).stdout);
  reference.close();
  for (const language of LANGUAGES)
    for (const kind of ['solution', 'racy'] as const) {
      const program = compile(language, readFileSync(join(dir, `${kind}.${EXT[language]}`), 'utf8'));
      let wrong = 0;
      let ms = 0;
      try {
        if (!program.built.ok) throw new Error(`${slug} ${kind}.${EXT[language]} does not compile\n${program.built.stderr}`);
        // A deadlocked racy run times out and counts as caught.
        for (let k = 0; k < runs && !(kind === 'racy' && wrong); k++) {
          const result = program.run(inputs[k % inputs.length], 10_000);
          if (result.stdout !== expected[k % inputs.length]) wrong++;
          ms = Math.max(ms, result.ms);
        }
      } finally {
        program.close();
      }
      const line = `${slug} ${kind}.${EXT[language]}: ${wrong} wrong, slowest ${ms}ms`;
      console.log(line);
      if (kind === 'solution' ? wrong : !wrong) problems.push(line);
    }
}
if (problems.length) {
  console.error(`flaky solutions or racy variants that got through:\n${problems.join('\n')}`);
  process.exit(1);
}
