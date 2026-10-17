/**
 * Checks Line 500's edge cases (lib/content/ling-edges.json) and interview follow-ups
 * (lib/content/ling-followups.json), and every custom case lib/clarify.ts builds, locally or in CI.
 * An edge case must have one field per parameter, each decoding as its type and inside the
 * statement's bounds, and the verified editorial's best Python approach must run it without an
 * error. Earlier approaches run it too: an answer that differs is printed for a human to judge
 * (the input may break the statement's guarantees, or the problem may accept several answers).
 * A follow-up's `problem` must be a judged Line 500 problem other than its own.
 *
 *   node --import tsx scripts/line500-extras/verify.ts [--prune] [--show] [lc-1 ...]
 *
 * --show prints what the best approach answers on each edge case, for reviewing the descriptions.
 * --prune deletes failing edge cases from the file instead of failing: never edit one until it
 * "looks right".
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import safe from '../../lib/content/stress-safe.json';
import { clarifyItems } from '../../lib/clarify';
import { curatedByNumber } from '../../lib/ling-curated';
import type { LingEdge, LingFollowUps } from '../../lib/oj-client';
import { lingEditorial } from '../../lib/server/ling-editorials';
import { leetcodeConstraints, leetcodeContract, leetcodeParams, leetcodeSource } from '../../lib/server/leetcode-mode';
import type { StressRule } from '../../lib/stress-gen';
import { checkConstraints, checkField, splitFields } from '../../lib/testcase-fields';

const EDGES = new URL('../../lib/content/ling-edges.json', import.meta.url);
const FOLLOW_UPS = new URL('../../lib/content/ling-followups.json', import.meta.url);
const args = process.argv.slice(2);
const prune = args.includes('--prune');
const show = args.includes('--show');
const only = new Set(args.filter((arg) => !arg.startsWith('--')));
const picked = (id: string) => !only.size || only.has(id);
const python = process.env.PYTHON || (spawnSync('python3.13', ['-V']).status === 0 ? 'python3.13' : 'python3');
const rules = safe as Record<string, Record<string, StressRule>>;
const edges = JSON.parse(readFileSync(EDGES, 'utf8')) as Record<string, { edges: LingEdge[] }>;
const followUps = JSON.parse(readFileSync(FOLLOW_UPS, 'utf8')) as Record<string, LingFollowUps>;
const curated = (id: string) => curatedByNumber.has(Number(/^lc-(\d+)$/.exec(id)?.[1])) && !!leetcodeContract(id);
const failures: string[] = [];
const warnings: string[] = [];
const dir = mkdtempSync(join(tmpdir(), 'line500-extras-'));

/** Each approach's Python on one LeetCode-mode stdin: its stdout, or the error it raised. */
function runAll(id: string, input: string) {
  return lingEditorial(id)!.approaches.map((approach, i) => {
    const file = join(dir, `${id}-${i}.py`);
    writeFileSync(file, leetcodeSource(id, 'python', approach.python, 262144).source);
    const run = spawnSync(python, ['-I', file, '--leetcode-input'], { input, encoding: 'utf8', timeout: 10_000 });
    return run.status === 0 ? { out: run.stdout } : { error: (run.stderr || run.error?.message || 'timed out').trim().split('\n').at(-1) };
  });
}

/** Why an input fails, or '' when the best approach runs it (differences only warn). */
function check(id: string, input: string, label: string) {
  const params = leetcodeParams(id)!;
  const fields = splitFields(input, params.length);
  if (!fields) return `${params.length} fields expected`;
  for (const [i, p] of params.entries()) {
    const typed = checkField(fields[i], p.type);
    if (!typed.ok) return `${p.name}: ${typed.message[1]}`;
  }
  const bounds = leetcodeConstraints(id);
  const broken = bounds && checkConstraints(fields, params, bounds).find(Boolean);
  if (broken) return broken[1];
  const runs = runAll(id, input);
  const best = runs.at(-1)!;
  if ('error' in best) return `best approach: ${best.error}`;
  if (show) console.log(`${id} ${label}: ${input.replace(/\n/g, ' | ')}  =>  ${best.out.trim().replace(/\n/g, ' | ')}`);
  // Unordered answers print in any order: compare their tokens as a multiset.
  const bag = (out: string) => out.split(/[\s,[\]]+/).filter(Boolean).sort().join(' ');
  runs.slice(0, -1).forEach((run, i) => {
    if ('error' in run || bag(run.out) !== bag(best.out))
      warnings.push(`${id} ${label}: approach ${i + 1} ${'error' in run ? `fails (${run.error})` : `prints ${run.out.trim()}`}, best prints ${best.out.trim()}`);
  });
  return '';
}

let ran = 0;
for (const [id, entry] of Object.entries(edges)) {
  if (!picked(id)) continue;
  if (!curated(id) || !leetcodeParams(id) || !lingEditorial(id)?.verified) {
    failures.push(`${id}: not a Line 500 problem with parameters and a verified editorial`);
    continue;
  }
  entry.edges = entry.edges.filter((edge, i) => {
    const why = !edge.zh?.trim() || !edge.en?.trim() ? 'needs zh and en' : check(id, edge.input, `edge ${i + 1}`);
    ran++;
    if (why) (prune ? warnings : failures).push(`${id} edge ${i + 1} (${edge.en}): ${why}${prune ? ' (pruned)' : ''}`);
    return !why;
  });
  if (!entry.edges.length) delete edges[id];
}
if (prune) writeFileSync(EDGES, JSON.stringify(edges, null, 2) + '\n');

// The checklist's own cases: a broken one is a lib/clarify.ts bug, never pruned.
for (const { number } of curatedByNumber.values()) {
  const id = `lc-${number}`;
  const params = leetcodeParams(id);
  if (!picked(id) || !params || !lingEditorial(id)?.verified) continue;
  for (const item of clarifyItems(params, leetcodeConstraints(id), rules[id]))
    for (const input of item.cases) {
      ran++;
      const why = check(id, input, `clarify ${item.key}`);
      if (why) failures.push(`${id} clarify ${item.key} ${JSON.stringify(input)}: ${why}`);
    }
}

for (const [id, entry] of Object.entries(followUps)) {
  if (!picked(id)) continue;
  if (!curated(id)) failures.push(`${id}: not a Line 500 problem`);
  if (!entry.takeawayZh?.trim() || !entry.takeawayEn?.trim()) failures.push(`${id}: needs a takeaway in both languages`);
  if (!Array.isArray(entry.followUps) || entry.followUps.length < 1 || entry.followUps.length > 4)
    failures.push(`${id}: needs 1-4 follow-ups`);
  for (const [i, f] of (entry.followUps ?? []).entries()) {
    if (![f.qZh, f.qEn, f.aZh, f.aEn].every((text) => typeof text === 'string' && text.trim()))
      failures.push(`${id} follow-up ${i + 1}: needs a question and an answer in both languages`);
    if (f.problem !== undefined && (!curated(f.problem) || f.problem === id))
      failures.push(`${id} follow-up ${i + 1}: ${f.problem} is not another judged Line 500 problem`);
  }
}

rmSync(dir, { recursive: true, force: true });
for (const line of warnings) console.warn(`warn: ${line}`);
for (const line of failures) console.error(`FAIL: ${line}`);
console.log(`${ran} inputs run with ${python}; ${failures.length} failures, ${warnings.length} warnings`);
if (failures.length) process.exit(1);
