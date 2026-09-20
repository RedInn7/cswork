import assert from 'node:assert/strict';
import test from 'node:test';
import { ipv4Cidr } from '../lib/oa-cidr-checker.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

const SPACE = 2 ** 32;
const ip = (n: number) =>
  [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join('.');
// Independent trie traversal, not the checker's greedy aligned-size search.
function cover(start: number, end: number): string[] {
  const blocks: string[] = [];
  function visit(low: number, size: number, prefix: number) {
    if (low >= end || low + size <= start) return;
    if (low >= start && low + size <= end) {
      blocks.push(`${ip(low)}/${prefix}`);
      return;
    }
    visit(low, size / 2, prefix + 1);
    visit(low + size / 2, size / 2, prefix + 1);
  }
  visit(0, SPACE, 0);
  return blocks;
}
const encode = (blocks: string[]) => `${blocks.length}\n${blocks.join('\n')}\n`;

test('exhaustive small ranges agree with optimal dynamic programming', () => {
  for (let start = 0; start < 64; start++) {
    for (let end = start + 1; end <= 64; end++) {
      const dp = new Array(end + 1).fill(Infinity);
      dp[end] = 0;
      for (let p = end - 1; p >= start; p--) {
        for (let size = 1; p + size <= end; size *= 2) {
          if (p % size === 0) dp[p] = Math.min(dp[p], 1 + dp[p + size]);
        }
      }
      const blocks = cover(start, end);
      assert.equal(blocks.length, dp[start]);
      assert(
        ipv4Cidr(
          encode([...blocks].reverse()),
          encode(blocks),
          `${ip(start)}\n${end - start}\n`,
        ),
      );
    }
  }
});

test('full IPv4 range, high bit, endpoints, random trie partitions and shared checkers', () => {
  let seed = 191909;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const ranges = [
    [0, SPACE],
    [SPACE - 1, SPACE],
    [1, SPACE - 1],
    [2 ** 31 - 1, 2 ** 31 + 1],
    [0, 1],
    [2 ** 31, SPACE],
  ];
  for (let i = 0; i < 1000; i++) {
    const a = random(),
      b = random();
    ranges.push([Math.min(a, b), Math.max(a, b) + 1]);
  }
  for (const [start, end] of ranges) {
    const blocks = cover(start, end);
    const expected = encode(blocks),
      actual = encode([...blocks].reverse());
    const input = `${ip(start)}\n${end - start}\n`;
    assert(ipv4Cidr(actual, expected, input));
    assert(matchesOaOutput(actual, expected, 'oa-ipv4-cidr', input));
    assert(matchesOutput(actual, expected, 'oa-ipv4-cidr', input));
    const incorrect = encode([...blocks.slice(1), blocks[0], blocks[0]]);
    assert.equal(ipv4Cidr(incorrect, expected, input), false);
    assert.equal(ipv4Cidr(actual, incorrect, input), false);
  }
});

test('rejects malformed, misaligned, nonminimal and non-covering answers', () => {
  const input = '0.0.0.0\n4\n',
    good = '1\n0.0.0.0/30\n';
  for (const bad of [
    '2 0.0.0.0/31 0.0.0.2/31',
    '1 0.0.0.1/30',
    '1 0.0.0.0/29',
    '1 0.0.0.0/31',
    '0',
    '01 0.0.0.0/30',
    '1 00.0.0.0/30',
    '1 0.0.0.0/030',
    '1 0.0.0.0/+30',
    '1 0.0.0.0/33',
    '1 0.0.0.0/-1',
    '1 0.0.0.0/30.0',
    '1 0.0.0.0/3e1',
    '1 256.0.0.0/30',
    '1 0.0.0/30',
    '1 0.0.0.0/30 extra',
    '1\u00a00.0.0.0/30',
    '1 0.0.0.0/30\0',
    ' '.repeat(4097),
  ]) {
    assert.equal(ipv4Cidr(bad, good, input), false, bad);
    assert.equal(ipv4Cidr(good, bad, input), false, bad);
  }
  const pairs = '2 0.0.0.1/32 0.0.0.2/32';
  assert.equal(ipv4Cidr('2 0.0.0.1/32 0.0.0.1/32', pairs, '0.0.0.1 2'), false);
  for (const invalid of [
    '0.0.0.0 0',
    '0.0.0.0 -1',
    '0.0.0.0 1e1',
    '0.0.0.0 4294967297',
    '255.255.255.255 2',
    '0.0.0.0 01',
    '00.0.0.0 4',
    '0.0.0.0 4 extra',
    ' '.repeat(129),
  ])
    assert.equal(ipv4Cidr(good, good, invalid), false, invalid);
});
