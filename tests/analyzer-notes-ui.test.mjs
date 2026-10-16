import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const bfs = ['def bfs(root):', '    queue = [root]', '    while queue:', '        node = queue.pop(0)'].join('\n');

test('notes under Accepted: nothing for clean code, levels, lines and topic links otherwise', async () => {
  const { AnalyzerNotes } = await import('../components/analyzer-notes.tsx');
  const { followUpRule } = await import('../lib/code-analyzer.ts');
  const html = (props) => renderToStaticMarkup(createElement(AnalyzerNotes, props));
  assert.equal(html({ code: 'print(1)', language: 'python', english: false }), '');
  assert.equal(html({ code: 'SELECT 1', language: 'sql', english: false }), '');

  const zh = html({ code: bfs, language: 'python', english: false });
  assert.match(zh, /写法提示/);
  assert.match(zh, /data-severity="actionable"/);
  assert.match(zh, /建议/);
  assert.match(zh, /第 4 行/);
  assert.match(zh, /href="\/topics\/binary-tree"/);
  const en = html({ code: bfs, language: 'python', english: true });
  assert.match(en, /Code notes/);
  assert.match(en, /Line 4/);
  assert.match(en, /collections\.deque/);

  // Follow-up met: shown even when no note fires; never when the code breaks the rule.
  const rule = followUpRule('lc-215', 'python');
  const heap = 'import heapq\nh = []\nfor x in nums:\n    heapq.heappush(h, x)';
  assert.match(html({ code: heap, language: 'python', followUp: rule, english: false }), /通过（满足追问：不排序/);
  assert.match(html({ code: heap, language: 'python', followUp: rule, english: true }), /follow-up met: No sorting/);
  assert.equal(html({ code: 'return sorted(nums)[-k]', language: 'python', followUp: rule, english: false }), '');
});

test('follow-up switch and the message that holds a submission back', async () => {
  const { FollowUpToggle, followUpBlocked } = await import('../components/analyzer-notes.tsx');
  const { followUpRule } = await import('../lib/code-analyzer.ts');
  const rule = followUpRule('lc-238', 'java');
  const off = renderToStaticMarkup(createElement(FollowUpToggle, { rule, on: false, onChange() {}, english: false }));
  assert.match(off, /aria-pressed="false"/);
  assert.match(off, /aria-label="追问模式：不用除法。开启后，提交前会先检查代码"/);
  assert.match(off, />追问</);
  assert.match(renderToStaticMarkup(createElement(FollowUpToggle, { rule, on: true, onChange() {}, english: true })), /aria-pressed="true"[^>]*>.*Follow-up/);

  const code = 'int[] productExceptSelf(int[] nums) {\n    int all = 1;\n    return new int[] { all / nums[0] };\n}';
  assert.equal(followUpBlocked(code, 'java', rule, false), '追问模式：第 3 行用了 /（本题追问要求：不用除法）。改写后再提交，或关掉追问模式按普通方式提交。');
  assert.match(followUpBlocked(code, 'java', rule, true), /^Follow-up mode: line 3 uses \/ \(No division\)/);
  assert.equal(followUpBlocked('int x = 1; // a / b', 'java', rule, false), '');
});

test('the workspace checks before submitting, only in LeetCode mode and outside a mock or contest', () => {
  const source = readFileSync(new URL('../components/problem-workspace.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("const followUp = !examMode && codingMode === 'leetcode' ? followUpRule(problem.id, language) : undefined;"));
  assert.ok(source.includes("const blocked = mode === 'judge' && followUpOn && followUp ? followUpBlocked(code, language, followUp, uiEnglish) : '';"));
  // The check runs before anything is sent, and the request body is unchanged.
  assert.ok(source.indexOf('if (blocked) {') < source.indexOf('const payload = {'));
  assert.equal(/followUp:\s*\w/.test(source.slice(source.indexOf('const payload = {'), source.indexOf('const fingerprint'))), false);
  assert.match(source, /\{ai && <AiComplexity tutor=\{ai\.tutor\} context=\{ai\.context\} \/>\}\s*\{notes\}/);
});
