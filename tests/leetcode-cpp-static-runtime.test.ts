import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildLeetCodeCpp,
  getLeetCodeCppJsonRuntime,
  getLeetCodeCppRuntime,
} from '../lib/server/leetcode-cpp';

void test('trusted JSON and identical fallback are emitted before user macros', () => {
  const snippet = 'class Solution { public: int solve(int x) {} };';
  const source =
    '#define SOME_USER_MACRO 1\nclass Solution { public: int solve(int x) { return x; } };';
  const built = buildLeetCodeCpp(1, source, snippet);
  const boundary = built.indexOf('#line 1 "solution.cpp"');
  assert.ok(built.indexOf('// CSWORK_CPP_JSON_RUNTIME_V1') < boundary);
  assert.ok(built.indexOf('struct Json {') < boundary);
  assert.ok(
    built.indexOf('#include "/usr/local/include/cswork/json-v1.hpp"') <
      boundary,
  );
  assert.ok(built.indexOf('struct Graph {') > boundary);
});

void test('fallback embeds the canonical runtime, with no host-file dependency', () => {
  const header = readFileSync('deploy/oj/cpp-json-v1/json-runtime.hpp', 'utf8');
  const cpp = readFileSync('deploy/oj/cpp-json-v1/json-runtime.cpp', 'utf8');
  const output = getLeetCodeCppJsonRuntime();
  assert.ok(output.includes('#if defined(CSWORK_PRECOMPILED_JSON_V1)'));
  assert.ok(output.includes(header));
  assert.ok(output.includes(cpp.replace('#include "json-runtime.hpp"', '')));
  assert.ok(!output.includes('#include "json-runtime.hpp"'));
  assert.ok(output.includes('#define CSWORK_JSON_INLINE inline'));
  assert.ok(output.includes('#undef CSWORK_JSON_INLINE'));
});

void test('standalone generated drivers still receive JSON plus full graph transport', () => {
  const runtime = getLeetCodeCppRuntime();
  assert.ok(runtime.includes('struct Json {'));
  assert.ok(runtime.includes('Nonsequential graph ids'));
  assert.equal((runtime.match(/struct Json \{/g) ?? []).length, 1);
});
