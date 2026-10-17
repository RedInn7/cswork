import test from 'node:test';
import assert from 'node:assert/strict';
import { frontMatter, noteGist, safePath, vaultFiles, vaultMarkdown, type ExportItem } from '../lib/notes-export';
import { crc32, unzip, zip } from '../lib/zip';
import { PROBLEM_TEMPLATE } from '../lib/note-meta';

void test('front matter strings are JSON strings, so YAML reads them back as typed', () => {
  const tricky = ['say "hi"', 'key: value', 'two\nlines', '# not a comment', 'back\\slash'];
  const yaml = frontMatter({ title: tricky[0], a: tricky[1], b: tricky[2], c: tricky[3], d: tricky[4], tags: ['x', 'y'], n: 3, gone: null, none: [] });
  const lines = yaml.split('\n');
  assert.deepEqual([lines[0], lines.at(-3)], ['---', '---']);
  const fields = Object.fromEntries(lines.slice(1, -3).map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)]));
  assert.deepEqual(Object.keys(fields), ['title', 'a', 'b', 'c', 'd', 'tags', 'n'], 'empty fields are left out');
  assert.deepEqual([fields.title, fields.a, fields.b, fields.c, fields.d].map((v) => JSON.parse(v)), tricky);
  assert.ok([fields.title, fields.a, fields.b, fields.c].every((v) => v.startsWith('"')), 'double-quoted scalars');
  assert.equal(fields.b.includes('\n'), false, 'a newline is escaped, never a line break');
  assert.deepEqual(JSON.parse(fields.tags), ['x', 'y']);
  assert.equal(fields.n, '3');
});

void test('noteGist takes the key observation and complexity sections, skips code, else the first line', () => {
  const filled = PROBLEM_TEMPLATE.zh
    .replace('## 关键观察\n', '## 关键观察\n有序数组，两端指针往中间收。\n```py\n# not this\nl, r = 0, n - 1\n```\n')
    .replace('## 复杂度\n', '## 复杂度\nO(n) 时间，O(1) 空间\n')
    .replace('## 暴力解\n', '## 暴力解\n两层循环\n')
    .replace('把握度:\n#', '把握度: 2\n#双指针');
  assert.equal(noteGist(filled), '有序数组，两端指针往中间收。 · O(n) 时间，O(1) 空间');
  assert.equal(noteGist('## Key observation\nmonotonic stack\n\n## Complexity\n`O(n)`'), 'monotonic stack · `O(n)`');
  assert.equal(noteGist('# Title\n\n```\ncode first\n```\n#tag #other\nConfidence: 3\nreal first line\nsecond'), 'real first line');
  assert.equal(noteGist(PROBLEM_TEMPLATE.en), '', 'an empty template has nothing to say');
  const long = noteGist(`## 关键观察\n${'很长'.repeat(200)}`);
  assert.equal(long.length, 240);
  assert.ok(long.endsWith('…'));
});

void test('vault paths drop .. and reserved characters; files land in their folders with an index', () => {
  assert.equal(safePath('clips/../../etc/passwd'), 'clips/etc/passwd');
  assert.equal(safePath('library/./a:b/..'), 'library/a-b');
  const items: ExportItem[] = [
    {
      target: 'problem:lc-15',
      body: '#双指针\n把握度: 4\n见 [[lc-1]]',
      updatedAt: Date.UTC(2026, 9, 1),
      lastAc: Date.UTC(2026, 9, 2),
      code: { language: 'python', code: 'print("```")\n' },
      meta: { title: '三数之和', titleEn: '3Sum', difficulty: '中等', topics: ['数组'], stop: 'two-pointers-windows', order: 30 },
    },
    { target: 'problem:oa-acme-1', body: 'oa note', updatedAt: 1 },
    { target: 'clip:../../evil', body: '> quote', updatedAt: 1 },
    { target: 'sub:s9', body: 'off by one', updatedAt: 1, problemId: 'lc-15' },
    { target: 'card:abcdefabcdef', body: JSON.stringify({ v: 1, front: 'Why sort?', back: 'To use two pointers', tags: ['Google'] }), updatedAt: 1 },
    { target: 'story:1', body: JSON.stringify({ title: 'Outage', situation: 'S', task: 'T', action: 'A', result: 'R' }), updatedAt: 1 },
    { target: 'sd:url-shortener/draft', body: 'draft', updatedAt: 1 },
  ];
  const files = vaultFiles(items, { english: true, origin: 'https://cswork.test' });
  assert.deepEqual(
    files.map((f) => f.name),
    [
      'index.md',
      'problems/two-pointers-windows/lc-15.md',
      'problems/oa/oa-acme-1.md',
      'clips/evil.md',
      'submissions/s9.md',
      'cards/abcdefabcdef.md',
      'system-design/url-shortener.md',
      'stories/star-stories.md',
    ],
  );
  const lc = files[1].data;
  assert.match(lc, /^---\ntitle: "3Sum"\naliases: \["3Sum"\]\nurl: "https:\/\/cswork\.test\/\?view=problem&problem=lc-15"\ndifficulty: "Medium"\n/);
  assert.match(lc, /\ntags: \["双指针"\]\nconfidence: 4\nstop: "two-pointers-windows"\nlast_ac: "2026-10-02"\n/);
  assert.match(lc, /\n# 3Sum\n\n#双指针/);
  assert.match(lc, /\n````python\nprint\("```"\)\n````\n$/, 'a fence longer than the code’s backticks');
  assert.match(files[4].data, /\n\[\[lc-15\]\]\n\noff by one\n$/);
  assert.match(files[5].data, /tags: \["google"\][\s\S]*## Front\n\nWhy sort\?\n\n## Back\n\nTo use two pointers/);
  assert.match(files[7].data, /## Outage/);
  assert.match(files[0].data, /- \[\[problems\/two-pointers-windows\/lc-15\|3Sum\]\]/);
  const md = vaultMarkdown(files);
  assert.ok(!md.includes('\ntitle: '), 'one Markdown file, no front matter');
  assert.ok(md.startsWith('# 3Sum\n'));
});

void test('zip writes stored entries with CRC-32, UTF-8 names and an end record unzip reads back', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [
    { name: 'index.md', data: '# notes\n' },
    { name: 'problems/双指针/lc-15.md', data: '把握度: 4\n' },
  ];
  const bytes = await zip(files);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2, 'entry count');
  const directory = view.getUint32(end + 16, true);
  assert.equal(directory + view.getUint32(end + 12, true), end, 'the directory ends where the end record starts');
  assert.equal(view.getUint32(directory, true), 0x02014b50);
  assert.equal(view.getUint16(directory + 8, true) & 0x800, 0x800, 'UTF-8 names');
  const back = await unzip(bytes, () => true, 1 << 20);
  assert.deepEqual(
    [...back!].map(([name, data]) => [name, new TextDecoder().decode(data)]),
    files.map((f) => [f.name, f.data]),
  );
});
