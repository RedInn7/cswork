import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frontMatter,
  noteGist,
  portfolioFiles,
  progressCsv,
  progressRows,
  safePath,
  vaultFiles,
  vaultMarkdown,
  type ExportItem,
  type SolutionItem,
} from '../lib/notes-export';
import type { PracticeHistoryItem } from '../lib/practice-review';
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

void test('portfolio: a folder per accepted problem, an index by stop in route order, OA and notes only when asked', async () => {
  const at = Date.UTC(2026, 9, 2, 12);
  const items: SolutionItem[] = [
    {
      problemId: 'lc-15',
      firstAc: at,
      solutions: [
        { language: 'python', code: 'print(15)\n', at: at + 86400000, runtime: 0.012 },
        { language: 'cpp', code: 'int main(){}\n', at, runtime: null },
      ],
      note: 'sort, then two pointers',
      meta: { title: '三数之和', titleEn: '3Sum', difficulty: '中等', topics: ['two-pointers-windows'], stop: 'two-pointers-windows', order: 30 },
    },
    {
      problemId: 'lc-1',
      firstAc: at,
      solutions: [{ language: 'go', code: 'package main\n', at, runtime: 0.001 }],
      meta: { title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', stop: 'hash-counting', order: 5 },
    },
    { problemId: 'sql-7', firstAc: at, solutions: [{ language: 'sql', code: 'SELECT 1;', at, runtime: 0.2 }], meta: { title: 'A | B [x]', topics: ['sql'] } },
    { problemId: 'c-9', firstAc: at, solutions: [{ language: 'pandas', code: 'df', at, runtime: null }] },
    { problemId: '../x:y', firstAc: at, solutions: [{ language: 'java', code: 'class A {}', at, runtime: null }], meta: { titleEn: 'Bad/../Name?' } },
    { problemId: 'oa-acme-1', firstAc: at, solutions: [{ language: 'python', code: 'secret', at, runtime: null }], meta: { title: 'Acme OA' } },
  ];
  const files = portfolioFiles(items, { english: true, origin: 'https://cswork.test' });
  assert.deepEqual(
    files.map((f) => f.name),
    [
      'README.md',
      'problems/lc-15-3sum/README.md',
      'problems/lc-15-3sum/solution.cpp',
      'problems/lc-15-3sum/solution.py',
      'problems/lc-1-two-sum/README.md',
      'problems/lc-1-two-sum/solution.go',
      'problems/sql-7/README.md',
      'problems/sql-7/solution.sql',
      'problems/c-9/README.md',
      'problems/c-9/solution.py',
      'problems/x-y-bad-name/README.md',
      'problems/x-y-bad-name/solution.java',
    ],
    'no OA by default; .. and reserved characters cleaned',
  );
  const byName = new Map(files.map((f) => [f.name, f.data]));
  const lc15 = byName.get('problems/lc-15-3sum/README.md')!;
  assert.match(lc15, /^# 3Sum\n\n- Problem: \[lc-15\]\(https:\/\/cswork\.test\/\?view=problem&problem=lc-15\)\n- Difficulty: Medium\n- Topics: Two Pointers\n/);
  assert.match(lc15, /- Line 500 stop: \[Two Pointers\]\(https:\/\/cswork\.test\/topics\/two-pointers-windows\)\n- First accepted: 2026-10-02\n/);
  assert.match(lc15, /\| cpp \| \[solution\.cpp\]\(solution\.cpp\) \| 2026-10-02 \| – \|\n\| python \| \[solution\.py\]\(solution\.py\) \| 2026-10-03 \| 12 ms \|\n$/);
  assert.ok(!lc15.includes('two pointers') && !lc15.includes('## Notes'), 'notes only when asked');
  assert.equal(byName.get('problems/lc-15-3sum/solution.py'), 'print(15)\n');
  const index = files[0].data;
  assert.ok(!index.includes('NDA') && !index.includes('Acme'));
  assert.match(index, /^# My CSWork solutions\n\n5 accepted problems/);
  const headings = [...index.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, ['Hashing', 'Two Pointers', 'SQL', 'Other'], 'stops in route order, then topics, then Other');
  assert.match(index, /\| \[Two Sum\]\(problems\/lc-1-two-sum\/\) \| Easy \| go \| 2026-10-02 \|/);
  assert.match(index, /\| \[3Sum\]\(problems\/lc-15-3sum\/\) \| Medium \| cpp, python \| 2026-10-02 \|/);
  assert.match(index, /\| \[A \\\| B \\\[x\\\]\]\(problems\/sql-7\/\) \| {2}\| sql \|/, 'pipes and brackets escaped');

  const zh = portfolioFiles(items, { english: false, origin: 'https://cswork.test', oa: true, notes: true });
  assert.ok(zh.some((f) => f.name === 'problems/oa-acme-1/solution.py'));
  assert.match(zh[0].data, /^# 我的 CSWork 题解\n\n> OA 多有保密条款：这个仓库仅供私用，请勿公开。\n\n共 6 道通过的题/);
  assert.match(zh.find((f) => f.name === 'problems/lc-15-3sum/README.md')!.data, /^# 三数之和\n[\s\S]*- 难度: 中等\n[\s\S]*\n## 笔记\n\nsort, then two pointers\n$/);

  const back = await unzip(await zip(files, true), () => true, 1 << 20);
  assert.deepEqual(
    [...back!].map(([name, data]) => [name, new TextDecoder().decode(data)]),
    files.map((f) => [f.name, f.data]),
    'the deflated zip unpacks to the same files',
  );
});

void test('progress CSV: BOM, CRLF, formulas defused, lists, marks and no due day once mastered', () => {
  const day = 86400000;
  const t0 = new Date(2026, 9, 1, 10).getTime();
  const item = (id: string, over: Partial<PracticeHistoryItem>): PracticeHistoryItem => ({
    problemId: id,
    attempts: 1,
    firstAt: t0,
    lastAt: t0,
    firstAcAt: null,
    failuresBeforeAc: 0,
    lastStatus: 'wrong_answer',
    languages: ['python'],
    acAt: [],
    stop: null,
    help: 'none',
    solveSeconds: null,
    whiteboard: null,
    brute: false,
    ...over,
  });
  const history = [
    item('lc-1', { attempts: 3, failuresBeforeAc: 1, lastStatus: 'accepted', firstAcAt: t0, acAt: [t0], stop: 'hash-counting', help: 'hint', solveSeconds: 750, languages: ['python', 'cpp'] }),
    // Good, Good, Hard, Easy after the first AC: level 5, past the four-step ladder.
    item('lc-2', { lastStatus: 'accepted', firstAcAt: t0, acAt: [0, 3, 10, 31, 91].map((d) => t0 + d * day), grades: [[t0 + 91 * day, 4], [t0 + 31 * day, 2]] }),
    item('oa-acme-1', {}),
  ];
  const rows = progressRows(history, {
    marks: [
      { target: 'problem:lc-1', mark: 'star' },
      { target: 'problem:oa-acme-1', mark: 'redo' },
      { target: 'content:x', mark: 'star' },
    ],
    titleOf: (id) => ({ 'lc-1': 'Two Sum', 'oa-acme-1': '=HYPERLINK("x")' })[id],
    difficultyOf: (id) => (id === 'lc-1' ? '简单' : undefined),
  });
  const [lc1, lc2, oa] = rows;
  assert.equal(lc1.difficulty, 'Easy');
  assert.equal(lc1.first_ac, '2026-10-01');
  assert.equal(lc1.next_review, '2026-10-02', 'a solve with a hint comes back the next day');
  assert.ok(String(lc1.lists).split(' | ').includes('leetcode-hot-100'));
  assert.deepEqual([lc1.help, lc1.solve_minutes, lc1.languages, lc1.starred, lc1.redo], ['hint', 12.5, 'python | cpp', true, false]);
  assert.deepEqual([lc2.mastered, lc2.next_review, lc2.last_grade], [true, null, 'Easy']);
  assert.deepEqual([oa.review_level, oa.mastered, oa.next_review, oa.first_ac, oa.redo, oa.lists], [null, false, null, null, true, null]);
  const csv = progressCsv(rows);
  assert.ok(csv.startsWith('\uFEFF"problem_id","title","difficulty","line500_stop","lists","first_attempt","first_ac"'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 5, 'header, three rows and the final CRLF');
  assert.equal(lines[0].split(',').length, 21);
  assert.ok(lines[3].includes(`"'=HYPERLINK(""x"")"`), 'a formula is defused and quotes doubled');
  assert.ok(lines[2].includes('"true","false","","Easy"'), 'mastered: next_review empty');
});
