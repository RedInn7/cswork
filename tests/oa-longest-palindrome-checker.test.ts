import assert from 'node:assert/strict';
import test from 'node:test';
import { longestPalindrome } from '../lib/oa-longest-palindrome-checker.mjs';
import { OA_SEMANTIC_IDS } from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
import { ojImportSchema } from '../lib/oj-types';

function check(
  actual: string,
  expected: string,
  input: string,
  valid: boolean,
) {
  assert.equal(longestPalindrome(actual, expected, input), valid);
  assert.equal(
    matchesOutput(actual, expected, 'oa-longest-palindrome', input),
    valid,
  );
  assert.equal(
    matchesOaOutput(actual, expected, 'oa-longest-palindrome', input),
    valid,
  );
}

test('Cisco29 accepts every longest tie and ignores untrusted expected lengths', () => {
  check('bab\n', 'aba\n', 'babad\n', true);
  check('aba\r\n', 'bab\n', 'babad\r\n', true);
  check(' \taba\n', 'garbage', 'babad', true);
  check('bb', '', 'cbbd', true);
  check('a', 'a', 'babad', false);
  check('bab', 'a'.repeat(1000), 'babad', true);
  check('aaa', 'aaa', 'babad', false); // right length/palindrome, not a substring
  check('bad', 'bad', 'babad', false); // substring/right length, not palindrome
  check('A', 'a', 'a', false);
  check('0A0', 'A', 'x0A0z', true);
  check('a', 'A', 'Aa', true); // single character is valid; not Cisco21's None
  check('A', 'a', 'Aa', true);
});

test('Cisco29 rejects malformed/bounded input and multi-token/non-ASCII output', () => {
  for (const input of [
    '',
    '\n',
    ' a',
    'a ',
    'a\nb',
    'a\n\n',
    'a\r',
    'a\r\n\r\n',
    'é',
    'Ａ',
    '\0a',
    'a'.repeat(1001),
  ])
    check('a', 'a', input, false);
  for (const actual of [
    '',
    ' ',
    'bab aba',
    'bab\naba',
    '"bab"',
    'báb',
    'bab\u00a0',
    'bab\0',
    'x'.repeat(4097),
  ])
    check(actual, 'bab', 'babad\n', false);
});

test('Cisco29 complete 1000-character boundary and no hidden tie-break', () => {
  const uniform = 'a'.repeat(1000);
  check(uniform, 'a', uniform + '\r\n', true);
  check(uniform.slice(1), uniform.slice(1), uniform, false);
  const alternating = 'aB'.repeat(500);
  check(alternating.slice(0, 999), 'bad', alternating, true);
  check(alternating.slice(1), 'bad', alternating, true);
  check(alternating, alternating, alternating, false);
});

test('Cisco29 independent exhaustive substring oracle on 1092 small strings', () => {
  const alphabet = 'aA0';
  let count = 0;
  for (let length = 1; length <= 6; length++) {
    for (let value = 0; value < 3 ** length; value++) {
      let state = value,
        s = '';
      for (let i = 0; i < length; i++) {
        s += alphabet[state % 3];
        state = Math.floor(state / 3);
      }
      const palindromes = new Set<string>();
      for (let l = 0; l < length; l++)
        for (let r = l + 1; r <= length; r++) {
          const part = s.slice(l, r);
          if (part === [...part].reverse().join('')) palindromes.add(part);
        }
      const best = Math.max(...[...palindromes].map((p) => p.length));
      for (const candidate of palindromes)
        assert.equal(
          longestPalindrome(candidate, candidate, s),
          candidate.length === best,
          JSON.stringify({ s, candidate }),
        );
      count++;
    }
  }
  assert.equal(count, 1092);
});

test('Cisco29 checker schema binding is exclusive to oa-cisco-29', () => {
  assert.equal(OA_SEMANTIC_IDS['oa-longest-palindrome'], 'oa-cisco-29');
  const payload = {
    schemaVersion: 1,
    problem: {
      id: 'oa-cisco-29',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Longest palindrome',
      difficulty: '中等',
      tags: ['OA', 'Cisco'],
      description: 'Find any longest palindromic substring.',
      input: 'One ASCII alphanumeric line.',
      output: 'One longest palindromic substring.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 65536,
      outputLimit: 64,
      checker: 'oa-longest-palindrome',
      languages: ['python'],
    },
    cases: [
      {
        name: 'public',
        input: 'babad\n',
        expectedOutput: 'bab\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: 'cbbd\n',
        expectedOutput: 'bb\n',
        hidden: true,
        weight: 1,
      },
    ],
  };
  assert.equal(ojImportSchema.safeParse(payload).success, true);
  payload.problem.id = 'oa-cisco-21';
  assert.equal(ojImportSchema.safeParse(payload).success, false);
  payload.problem.id = 'unrelated';
  assert.equal(ojImportSchema.safeParse(payload).success, false);
});
