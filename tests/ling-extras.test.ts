import assert from 'node:assert/strict';
import { test } from 'node:test';
import edgeFile from '../lib/content/ling-edges.json';
import followUpFile from '../lib/content/ling-followups.json';
import { curatedByNumber } from '../lib/ling-curated';
import type { LingEdge, LingFollowUps } from '../lib/oj-client';
import { lingEditorial } from '../lib/server/ling-editorials';
import { leetcodeConstraints, leetcodeContract, leetcodeParams } from '../lib/server/leetcode-mode';
import { checkConstraints, checkField, splitFields } from '../lib/testcase-fields';

// Running the inputs is scripts/line500-extras/verify.ts (the toolchains job); this checks the shape.
const edges = edgeFile as Record<string, { edges: LingEdge[] }>;
const followUps = followUpFile as Record<string, LingFollowUps>;
const HAN = /[一-鿿]/;
const judged = (id: string) => curatedByNumber.has(Number(/^lc-(\d+)$/.exec(id)?.[1])) && !!leetcodeContract(id);
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() !== '' && value.length <= max;

void test('edge cases: Line 500 problems, 1-6 distinct bilingual inputs, each valid and inside the bounds', () => {
  const bad: string[] = [];
  for (const [id, entry] of Object.entries(edges)) {
    assert.deepEqual(Object.keys(entry), ['edges'], id);
    const params = leetcodeParams(id);
    if (!judged(id) || !params || !lingEditorial(id)?.verified) {
      bad.push(`${id}: not a judged Line 500 problem with parameters and a verified editorial`);
      continue;
    }
    if (entry.edges.length < 1 || entry.edges.length > 6) bad.push(`${id}: ${entry.edges.length} edge cases`);
    if (new Set(entry.edges.map((edge) => edge.input)).size !== entry.edges.length) bad.push(`${id}: repeated input`);
    const bounds = leetcodeConstraints(id);
    entry.edges.forEach((edge, i) => {
      const at = `${id}[${i}]`;
      assert.deepEqual(Object.keys(edge).sort(), ['en', 'input', 'zh'], at);
      if (!text(edge.zh, 40) || !HAN.test(edge.zh)) bad.push(`${at}.zh`);
      if (!text(edge.en, 60) || HAN.test(edge.en)) bad.push(`${at}.en`);
      const fields = splitFields(edge.input, params.length);
      if (!fields || edge.input.endsWith('\n')) return bad.push(`${at}: needs ${params.length} lines`);
      params.forEach((p, k) => {
        if (!checkField(fields[k], p.type).ok) bad.push(`${at}: ${p.name} is not a ${p.type}`);
      });
      const broken = bounds && checkConstraints(fields, params, bounds).find(Boolean);
      if (broken) bad.push(`${at}: ${broken[1]}`);
    });
  }
  assert.deepEqual(bad, []);
});

void test('follow-ups: 2-3 bilingual questions and a takeaway; a linked problem is another judged Line 500 problem', () => {
  const bad: string[] = [];
  for (const [id, entry] of Object.entries(followUps)) {
    if (!judged(id)) bad.push(`${id}: not a Line 500 problem`);
    assert.deepEqual(Object.keys(entry).sort(), ['followUps', 'takeawayEn', 'takeawayZh'], id);
    if (!text(entry.takeawayZh, 160) || !HAN.test(entry.takeawayZh)) bad.push(`${id}.takeawayZh`);
    if (!text(entry.takeawayEn, 320) || HAN.test(entry.takeawayEn)) bad.push(`${id}.takeawayEn`);
    if (entry.followUps.length < 2 || entry.followUps.length > 3) bad.push(`${id}: ${entry.followUps.length} follow-ups`);
    entry.followUps.forEach((f, i) => {
      const at = `${id}[${i}]`;
      const keys = Object.keys(f).sort();
      assert.deepEqual(keys, ['aEn', 'aZh', 'qEn', 'qZh', ...(f.problem === undefined ? [] : ['problem'])].sort(), at);
      if (!text(f.qZh, 80) || !HAN.test(f.qZh)) bad.push(`${at}.qZh`);
      if (!text(f.qEn, 160) || HAN.test(f.qEn)) bad.push(`${at}.qEn`);
      if (!text(f.aZh, 400) || !HAN.test(f.aZh)) bad.push(`${at}.aZh`);
      if (!text(f.aEn, 800) || HAN.test(f.aEn)) bad.push(`${at}.aEn`);
      if (f.problem !== undefined && (!judged(f.problem) || f.problem === id)) bad.push(`${at}.problem ${f.problem}`);
    });
  }
  assert.deepEqual(bad, []);
});

void test('both files cover the same problems', () => {
  assert.deepEqual(Object.keys(edges).sort(), Object.keys(followUps).sort());
  assert.ok(Object.keys(edges).length >= 39);
});
