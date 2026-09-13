import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import test from 'node:test';

test('authoring normalizers decode split UTF-8 characters without replacement', async () => {
  const expected = '边界与组合 中文 café 😀';
  const stream = Readable.from(
    [...Buffer.from(expected)].map((value) => Buffer.from([value])),
  );
  stream.setEncoding('utf8');
  let actual = '';
  for await (const chunk of stream) actual += chunk;
  assert.equal(actual, expected);
  const files = [
    'scripts/oa-judge/google_batch.py',
    ...readdirSync('scripts/oa-judge/batches')
      .filter((name) => name.endsWith('.py'))
      .map((name) => 'scripts/oa-judge/batches/' + name),
  ];
  for (const file of files)
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.includes("process.stdin.on('data'"))
        assert(line.includes("process.stdin.setEncoding('utf8')"), file);
    }
});

test('published OA metadata has no accidental replacement characters', () => {
  for (const file of readdirSync('content/oa-judge/packages').filter((name) =>
    name.endsWith('.json'),
  )) {
    const pkg = JSON.parse(
      readFileSync('content/oa-judge/packages/' + file, 'utf8'),
    );
    assert(
      !JSON.stringify({
        problem: pkg.problem,
        caseNames: pkg.cases.map((item) => item.name),
      }).includes('\uFFFD'),
      file,
    );
  }
});
