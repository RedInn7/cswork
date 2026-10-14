import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
  classicList,
  classicListAppHref,
  classicLists,
  leetcodeUrl,
  levelOf,
  problemAppHref,
  problemTitle,
} from '../lib/classic-lists';
import { curatedByNumber, curatedEntries } from '../lib/ling-curated';
import { SITEMAP_STATIC_ENTRIES, sitemapLibraryRange } from '../lib/seo';

const dir = mkdtempSync(resolve(tmpdir(), 'classic-lists-test-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { listLibrary, listClassicLibrary, listStudyLibrary } = await import(
  '../lib/server/study-library'
);
const { practiceRoundState } = await import('../lib/server/practice-rounds');

// One Line 500 problem judgeable here, one in the bank but not judgeable, one judgeable
// off the line, and one number the bank does not have at all.
const onLine = curatedEntries[0].number;
const unready = curatedEntries[1].number;
const offLine = 999998;
const missing = 999997;
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  const insert = db.prepare(`INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,imported_at)
    VALUES(?,?,?,?,?,?,'[]','{}','source',1,1,1)`);
  insert.run(`lc-${onLine}`, onLine, 'on-line', '线上题', 'On the line', '简单');
  insert.run(`lc-${unready}`, unready, 'not-ready', '未就绪', 'Not ready', 'Medium');
  insert.run(`lc-${offLine}`, offLine, 'off-line', '', 'Off the line', 'hard');
  for (const number of [onLine, offLine]) {
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`,
    ).run(`lc-${number}`, `v-${number}`);
    db.prepare(
      `INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,'{}','hash','teacher',1)`,
    ).run(`v-${number}`, `lc-${number}`);
    db.prepare(
      `UPDATE study_library SET judge_problem_id=id,verified_hash=content_hash || ':' || ? WHERE number=?`,
    ).run(`v-${number}`, number);
  }
  // Bank rows that are not judgeable keep a judge id but no verified hash.
  db.prepare('UPDATE study_library SET judge_problem_id=id WHERE number=?').run(unready);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const list = {
  slug: 'fixture',
  nameZh: '测试题单',
  nameEn: 'Fixture list',
  source: 'https://example.com/list',
  groups: [
    { nameZh: '甲', nameEn: 'A', numbers: [missing, onLine] },
    { nameZh: '乙', nameEn: 'B', numbers: [unready, offLine, onLine] },
  ],
};

void test('the data file holds the four mapped lists as numbers and groups only', () => {
  assert.deepEqual(
    classicLists.map((l) => l.slug).sort(),
    ['blind-75', 'grind-75', 'leetcode-hot-100', 'top-interview-150'],
  );
  for (const l of classicLists) {
    assert.deepEqual(Object.keys(l).sort(), ['groups', 'nameEn', 'nameZh', 'slug', 'source']);
    assert.ok(l.nameZh && l.nameEn, l.slug);
    assert.equal(new URL(l.source).protocol, 'https:', l.slug);
    assert.ok(l.groups.length > 0, l.slug);
    const numbers = l.groups.flatMap((g) => g.numbers);
    assert.ok(numbers.every((n) => Number.isInteger(n) && n > 0), l.slug);
    assert.equal(new Set(numbers).size, numbers.length, `${l.slug} repeats a number`);
    for (const g of l.groups) assert.ok(g.nameZh && g.nameEn && g.numbers.length, l.slug);
  }
  assert.equal(classicList('blind-75')?.nameEn, 'Blind 75');
  assert.equal(classicList('ling-selected-500'), undefined);
  assert.equal(classicList(null), undefined);
});

void test('groups keep their order; problems not judgeable here are external and out of progress', () => {
  const view = listClassicLibrary(list, 'alice');
  assert.deepEqual(
    view.groups.map((g) => [g.nameEn, g.items.map((i) => i.number)]),
    [
      ['A', [missing, onLine]],
      ['B', [unready, offLine, onLine]],
    ],
  );
  const [a, b] = view.groups;
  assert.deepEqual(
    [...a.items, ...b.items].map((i) => [i.number, i.external, i.judgeProblemId]),
    [
      [missing, true, null],
      [onLine, false, `lc-${onLine}`],
      [unready, true, null],
      [offLine, false, `lc-${offLine}`],
      [onLine, false, `lc-${onLine}`],
    ],
  );
  assert.deepEqual([a.total, a.ready, b.total, b.ready], [2, 1, 3, 2]);
  // A number listed twice counts once; external problems are not part of the total to solve.
  assert.deepEqual(
    [view.collection.total, view.collection.ready, view.collection.solved],
    [4, 2, 0],
  );
  assert.deepEqual(view.sequence, [`lc-${onLine}`, `lc-${offLine}`]);
  assert.equal(view.nextProblemId, `lc-${onLine}`);
  // Line 500 problems show their stop, judgeable or not; others have none.
  const stop = curatedByNumber.get(onLine)!;
  assert.equal(a.items[1].stop?.slug, stop.sectionSlug);
  assert.equal(a.items[1].stop?.code, '01');
  assert.ok(a.items[1].stop?.nameZh && a.items[1].stop?.nameEn);
  assert.equal(b.items[0].stop?.slug, curatedByNumber.get(unready)!.sectionSlug);
  assert.equal(b.items[1].stop, null);
  assert.equal(a.items[0].stop, null);
  // Missing numbers still list, with an empty title the pages fill in.
  assert.equal(problemTitle(a.items[0], true), `LeetCode ${missing}`);
  assert.equal(problemTitle(b.items[1], false), 'Off the line');
});

void test('progress counts accepted judge submissions on judgeable problems only', () => {
  const submit = sqlite().prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,practice_round_id) VALUES(?,?,?,'python','',?,1,1,1,'judge',?)`,
  );
  const round = practiceRoundState('bob').activeRoundId;
  submit.run('s1', 'bob', `lc-${onLine}`, 'accepted', round);
  submit.run('s2', 'bob', `lc-${offLine}`, 'wrong_answer', round);
  const view = listClassicLibrary(list, 'bob');
  assert.equal(view.collection.solved, 1);
  assert.deepEqual(
    view.groups.map((g) => g.solved),
    [1, 1],
  );
  const offRow = view.groups[1].items[1];
  assert.equal(offRow.progressStatus, 'attempted');
  assert.equal(view.nextProblemId, `lc-${offLine}`);
  // Another user and guests see none of it.
  assert.equal(listClassicLibrary(list, 'carol').collection.solved, 0);
  assert.equal(listClassicLibrary(list).collection.solved, 0);
});

void test('the list API serves classic slugs and still rejects unknown collections', () => {
  const view = listLibrary(new URLSearchParams('collection=blind-75'));
  assert.ok('groups' in view);
  assert.equal(view.collection.id, 'blind-75');
  assert.deepEqual(
    view.groups.map((g) => g.items.map((i) => i.number)),
    classicList('blind-75')!.groups.map((g) => g.numbers),
  );
  assert.ok('items' in listLibrary(new URLSearchParams('collection=ling-selected-500')));
  assert.throws(() => listLibrary(new URLSearchParams('collection=unknown')));
  // The Line 500 endpoint itself does not take classic slugs.
  assert.throws(() => listStudyLibrary(new URLSearchParams('collection=blind-75')));
});

void test('public page helpers: LeetCode links by locale, app links, levels and sitemap entries', () => {
  assert.equal(leetcodeUrl(1, 'two-sum', false), 'https://leetcode.cn/problems/two-sum/');
  assert.equal(leetcodeUrl(1, 'two-sum', true), 'https://leetcode.com/problems/two-sum/');
  // No known slug (or an unsafe one): search by number.
  assert.equal(leetcodeUrl(42, '', true), 'https://leetcode.com/problemset/?search=42');
  assert.equal(leetcodeUrl(42, '../x', false), 'https://leetcode.cn/problemset/?search=42');
  assert.equal(classicListAppHref('blind-75'), '/?view=problems&library=blind-75');
  assert.equal(problemAppHref('lc-1'), '/?view=problem&problem=lc-1');
  assert.deepEqual(levelOf('中等'), ['medium', '中等', 'Medium']);
  assert.equal(levelOf('EASY')?.[0], 'easy');
  assert.equal(levelOf(''), undefined);
  const paths = SITEMAP_STATIC_ENTRIES.map((e) => e.path);
  assert.ok(paths.includes('/lists'));
  for (const l of classicLists) assert.ok(paths.includes(`/lists/${l.slug}`), l.slug);
  assert.equal(new Set(paths).size, paths.length);
  // The library starts right after every static entry on page 1.
  assert.equal(sitemapLibraryRange(2).offset + SITEMAP_STATIC_ENTRIES.length, 45_000);
});
