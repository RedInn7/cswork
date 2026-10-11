import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { englishMessage } from '../lib/messages-en';

const root = fileURLToPath(new URL('..', import.meta.url));
const CJK = /[㐀-鿿]/;
const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
// new HttpError(status, <message>): the message may span lines and use ?: between literals.
const HTTP_ERROR =
  /new HttpError\(\s*\d+\s*,((?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|[^'"`()])*)\)/g;
// Judge/auth/route messages: `message: '…'`, SQL `message='…'`, `{ error: '…' }`.
const FIELD = /\b(?:message|error)\s*[:=]\s*('(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

/** Every Chinese HttpError / message / error literal in the server code; `${…}` becomes 1. */
function serverMessages() {
  const found = new Set<string>();
  for (const dir of ['lib/server', 'app/api']) {
    for (const file of readdirSync(join(root, dir), { recursive: true }) as string[]) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(join(root, dir, file), 'utf8');
      const calls = [...source.matchAll(HTTP_ERROR)];
      assert.equal(
        calls.length,
        source.split('new HttpError(').length - 1,
        `${dir}/${file}: an HttpError message this scan cannot read`,
      );
      const texts = [...calls, ...source.matchAll(FIELD)].map((m) => m[1]);
      for (const text of texts)
        for (const [quoted] of text.matchAll(STRING)) {
          const message = quoted.slice(1, -1).replace(/\$\{[^}]*\}/g, '1');
          if (CJK.test(message)) found.add(message);
        }
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
  assert.deepEqual(missing, [], 'add these to lib/messages-en.ts');
});
