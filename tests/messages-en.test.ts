import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
import { englishMessage } from '../lib/messages-en';

const root = fileURLToPath(new URL('..', import.meta.url));
const CJK = /[㐀-鿿]/;
// Seeded course content, and OTP mails (lib/server/mail.ts carries its own English).
const NOT_MESSAGES = new Set(['lib/server/seed.ts', 'lib/server/seed-interview.ts', 'lib/server/mail.ts']);
// LeetCode's own verdict text, matched in its API responses and never shown.
const MATCHED = new Set(['通过']);

/** Every Chinese string literal in the server code; `${…}` becomes 1, SQL gives its quoted values. */
function serverMessages() {
  const found = new Set<string>();
  for (const dir of ['lib/server', 'app/api']) {
    for (const file of readdirSync(join(root, dir), { recursive: true }) as string[]) {
      if (!file.endsWith('.ts') || NOT_MESSAGES.has(`${dir}/${file}`)) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(join(root, dir, file), 'utf8'),
        ts.ScriptTarget.Latest,
      );
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
          const text = ts.isTemplateExpression(node)
            ? node.getText(source).slice(1, -1).replace(/\$\{[^}]*\}/g, '1')
            : node.text;
          // Stored messages inside SQL: message='…', COALESCE(name,'…').
          const parts = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/.test(text)
            ? [...text.matchAll(/'([^']*)'/g)].map((m) => m[1])
            : [text];
          for (const part of parts) if (CJK.test(part) && !MATCHED.has(part)) found.add(part);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return found;
}

test('exact messages translate', () => {
  assert.equal(englishMessage('请先登录'), 'Please sign in first');
  assert.equal(englishMessage('课程不存在'), 'Course not found');
  assert.equal(englishMessage('此题未开放该语言'), "This language isn't available for this problem");
  assert.equal(
    englishMessage('判题未能完成，请重试；本次不计入错题'),
    "Judging couldn't be completed. Please try again; this attempt won't count as a mistake",
  );
  assert.equal(englishMessage('已取消运行'), 'Run cancelled');
  assert.equal(englishMessage('昵称需为 1–80 个字符'), 'Display name must be 1–80 characters');
  assert.equal(englishMessage('智能补全已就绪'), 'Code completion ready');
});

test('pattern messages keep their variable parts', () => {
  assert.equal(englishMessage('题目文件最多 8 MiB'), 'The problem file can be at most 8 MiB');
  assert.equal(englishMessage('题目文件最多 1.5 MiB'), 'The problem file can be at most 1.5 MiB');
  assert.equal(englishMessage('课程更新：第 3 章 Redis'), 'Course update: 第 3 章 Redis');
  assert.equal(englishMessage('服务暂时不可用（502）'), 'Service temporarily unavailable (502)');
});

test('unknown text is returned unchanged', () => {
  for (const text of ['这是一条没有翻译的消息', 'Already English', '', 'constructor', '请先登录 '])
    assert.equal(englishMessage(text), text);
});

test('every server message has English', () => {
  const messages = serverMessages();
  assert.ok(messages.size > 150, `scan found only ${messages.size} messages`);
  const missing = [...messages].filter((m) => CJK.test(englishMessage(m)));
  assert.deepEqual(missing, [], 'add these to lib/messages-en.ts (content-only files go in NOT_MESSAGES)');
});
