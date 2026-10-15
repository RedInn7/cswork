import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
  bookProblemUrl,
  classicList,
  classicListAppHref,
  classicLists,
  groupEntries,
  leetcodeUrl,
  levelOf,
  problemAppHref,
  problemTitle,
  refLabel,
  sourceUrl,
} from '../lib/classic-lists';
import { readLcSite, saveLcSite } from '../lib/lc-site';
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
  // A twinless book problem published as its own bk- problem (content/book-problems).
  db.prepare(
    `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES('bk-five','gomall','00-overview','v-five',1,1,1)`,
  ).run();
  db.prepare(
    `INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES('v-five','bk-five',1,?,'hash','teacher',1)`,
  ).run(JSON.stringify({ title: '五', difficulty: '中等', translations: { en: { title: 'Five' } } }));
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

void test('the data file holds the mapped lists as numbers and groups only', () => {
  assert.deepEqual(
    classicLists.map((l) => l.slug).sort(),
    [
      'blind-75',
      'cracking-the-coding-interview',
      'grind-75',
      'leetcode-75',
      'leetcode-hot-100',
      'sword-offer',
      'top-interview-150',
    ],
  );
  for (const l of classicLists.filter((list) => !list.refLabel)) {
    assert.deepEqual(Object.keys(l).sort(), ['groups', 'nameEn', 'nameZh', 'slug', 'source']);
    assert.ok(l.nameZh && l.nameEn, l.slug);
    assert.equal(new URL(sourceUrl(l)).protocol, 'https:', l.slug);
    assert.ok(l.groups.length > 0, l.slug);
    const numbers = l.groups.flatMap((g) => g.numbers!);
    assert.ok(numbers.every((n) => Number.isInteger(n) && n > 0), l.slug);
    // A list may file one problem under two groups (Blind 75 has 23 in Linked List and Heap).
    for (const g of l.groups) assert.equal(new Set(g.numbers).size, g.numbers!.length, `${l.slug} repeats a number in a group`);
    assert.ok(new Set(numbers).size >= numbers.length - 2, `${l.slug} repeats too many numbers`);
    for (const g of l.groups) assert.ok(g.nameZh && g.nameEn && g.numbers!.length, l.slug);
  }
  // LeetCode 75: 75 numbers in 22 groups, the same on leetcode.com and leetcode.cn.
  const l75 = classicList('leetcode-75')!;
  assert.equal(l75.groups.length, 22);
  assert.equal(new Set(l75.groups.flatMap((g) => g.numbers)).size, 75);
  assert.deepEqual(l75.groups[0].numbers, [1768, 1071, 1431, 605, 345, 151, 238, 334, 443]);
  // The source link is the URL alone, not the note on how the list was read.
  for (const l of classicLists) {
    assert.doesNotMatch(sourceUrl(l), /\s/, l.slug);
    assert.equal(new URL(sourceUrl(l)).href, sourceUrl(l), l.slug);
  }
  assert.equal(classicList('blind-75')?.nameEn, 'Blind 75');
  assert.equal(classicList('ling-selected-500'), undefined);
  assert.equal(classicList(null), undefined);
});

void test('book lists hold every book problem, in book order, with its LeetCode twin when there is one', () => {
  const offer = classicList('sword-offer')!;
  const cci = classicList('cracking-the-coding-interview')!;
  for (const [list, count, chapters, suffix] of [
    [offer, 75, 6, /-lcof$/],
    [cci, 109, 9, /-lcci$/],
  ] as const) {
    assert.deepEqual(Object.keys(list).sort(), ['groups', 'nameEn', 'nameZh', 'refLabel', 'slug', 'source']);
    assert.equal(list.groups.length, chapters);
    const refs = list.groups.flatMap((g) => g.refs!);
    assert.equal(refs.length, count);
    assert.equal(new Set(refs.map((r) => r.ref)).size, count, `${list.slug} repeats a book number`);
    assert.equal(new Set(refs.map((r) => r.slug)).size, count, `${list.slug} repeats a slug`);
    for (const r of refs) {
      assert.match(r.slug, suffix);
      assert.ok(r.lc === null || (Number.isInteger(r.lc) && r.lc > 0), r.ref);
    }
    for (const g of list.groups) assert.ok(g.nameZh && g.nameEn && g.refs!.length && !g.numbers, list.slug);
  }
  // Book order and chapters: 剑指 Offer 03 opens chapter 2, 68-II closes chapter 7.
  const offerRefs = offer.groups.flatMap((g) => g.refs!);
  assert.equal(offerRefs[0].ref, '03');
  assert.equal(offerRefs.at(-1)!.ref, '68-II');
  assert.deepEqual(offer.groups.map((g) => g.refs!.length), [14, 10, 14, 14, 20, 3]);
  // Twins come from leetcode.cn's own notes (07 is main-site 105) or a side-by-side reading;
  // 03 (any duplicate in 0..n-1) has none and stays a leetcode.cn link.
  const offerRef = (ref: string) => offerRefs.find((r) => r.ref === ref)!;
  assert.equal(offerRef('07').lc, 105);
  assert.equal(offerRef('07').slug, 'zhong-jian-er-cha-shu-lcof');
  assert.equal(offerRef('03').lc, null);
  assert.equal(offerRef('68-II').lc, 236);
  // 53-I matches 34 "except for the return value": not the same problem.
  assert.equal(offerRef('53-I').lc, null);
  const cciRef = (ref: string) => cci.groups.flatMap((g) => g.refs!).find((r) => r.ref === ref)!;
  assert.equal(cciRef('16.25').lc, 146);
  assert.equal(cciRef('01.01').lc, null);
  assert.deepEqual(
    cci.groups.map((g) => g.nameEn.split(' · ')[0]),
    ['01', '02', '03', '04', '05', '08', '10', '16', '17'].map((c) => `Chapter ${Number(c)}`),
  );
  // Labels and links.
  assert.equal(refLabel(offer, '07', false), '剑指 Offer 07');
  assert.equal(refLabel(cci, '01.02', true), 'CtCI 01.02');
  assert.equal(refLabel(classicList('blind-75')!, '07', true), '');
  assert.equal(bookProblemUrl('zhong-jian-er-cha-shu-lcof'), 'https://leetcode.cn/problems/zhong-jian-er-cha-shu-lcof/');
  assert.equal(bookProblemUrl('../x'), 'https://leetcode.cn/problemset/');
  assert.deepEqual(groupEntries({ nameZh: '', nameEn: '', numbers: [1] }), [{ number: 1, ref: null, refSlug: null, judge: null }]);
  assert.equal(problemTitle({ number: null, titleZh: '', titleEn: '' }, false), '力扣中国站原题');
});

void test('a book list counts each book problem; problems sharing one twin share its judge and progress; rewrites judge as their own', () => {
  const book = {
    slug: 'book',
    nameZh: '书',
    nameEn: 'Book',
    source: 'https://example.com/book',
    refLabel: { zh: '书', en: 'Book' },
    groups: [
      {
        nameZh: '一',
        nameEn: 'One',
        refs: [
          { ref: '1', lc: onLine, slug: 'one-lcof' },
          { ref: '2', lc: null, slug: 'two-lcof', judge: 'bk-unpublished' },
          { ref: '3', lc: missing, slug: 'three-lcof' },
          { ref: '5', lc: null, slug: 'five-lcof', judge: 'bk-five' },
        ],
      },
      { nameZh: '二', nameEn: 'Two', refs: [{ ref: '4', lc: onLine, slug: 'four-lcof' }] },
    ],
  };
  const view = listClassicLibrary(book, 'dave');
  const items = view.groups.flatMap((g) => g.items);
  assert.deepEqual(
    items.map((i) => [i.ref, i.number, i.external, i.judgeProblemId, i.refSlug]),
    [
      ['1', onLine, false, `lc-${onLine}`, 'one-lcof'],
      // Its rewrite is not published yet: still the leetcode.cn page.
      ['2', null, true, null, 'two-lcof'],
      ['3', missing, true, null, 'three-lcof'],
      ['5', null, false, 'bk-five', 'five-lcof'],
      ['4', onLine, false, `lc-${onLine}`, 'four-lcof'],
    ],
  );
  assert.deepEqual([items[3].titleZh, items[3].titleEn, items[3].difficulty], ['五', 'Five', '中等']);
  assert.equal(items[1].stop, null);
  assert.ok(items[0].stop);
  assert.deepEqual(
    [view.collection.total, view.collection.mapped, view.collection.ready, view.collection.solved],
    [5, 3, 3, 0],
  );
  assert.deepEqual(view.sequence, [`lc-${onLine}`, 'bk-five']);
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,practice_round_id) VALUES('d1','dave',?,'python','','accepted',1,1,1,'judge',?)`,
    )
    .run(`lc-${onLine}`, practiceRoundState('dave').activeRoundId);
  const solved = listClassicLibrary(book, 'dave');
  assert.deepEqual([solved.collection.solved, solved.groups[0].solved, solved.groups[1].solved], [2, 1, 1]);
  assert.equal(solved.nextProblemId, 'bk-five');
  // A rewrite counts by its own id, in any practice round.
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES('d2','dave','bk-five','python','','wrong_answer',1,1,1,'judge')`,
    )
    .run();
  assert.equal(listClassicLibrary(book, 'dave').groups[0].items[3].progressStatus, 'attempted');
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES('d3','dave','bk-five','python','','accepted',1,2,2,'judge')`,
    )
    .run();
  const all = listClassicLibrary(book, 'dave');
  assert.deepEqual([all.collection.solved, all.groups[0].solved, all.nextProblemId], [3, 2, null]);
  // LeetCode lists keep counting numbers: every number has a twin, itself.
  const plain = listClassicLibrary(list);
  assert.equal(plain.collection.mapped, plain.collection.total);
});

void test('groups keep their order; problems not judgeable here are external and out of progress', async () => {
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
  // Stage and rating let a short study plan keep foundation, then easier problems.
  const { lcRatingOf } = await import('../lib/server/lc-ratings');
  assert.equal(a.items[1].stage, ['基础', '核心', '进阶'].indexOf(stop.stage));
  const rating = lcRatingOf(onLine)?.rating;
  assert.equal(a.items[1].rating, rating == null ? null : Math.round(rating));
  assert.deepEqual([b.items[1].stage, a.items[0].rating], [null, null]);
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
  // The site the reader chose (lib/lc-site.ts) wins over the language.
  assert.equal(leetcodeUrl(1, 'two-sum', 'cn'), 'https://leetcode.cn/problems/two-sum/');
  assert.equal(leetcodeUrl(1, 'two-sum', 'com'), 'https://leetcode.com/problems/two-sum/');
  // Without storage (or blocked) the language decides; a saved choice wins; junk is ignored.
  assert.equal(readLcSite(true), 'com');
  assert.equal(readLcSite(false), 'cn');
  const saved: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => saved[k] ?? null, setItem: (k: string, v: string) => (saved[k] = v) },
  });
  try {
    saveLcSite('cn');
    assert.equal(saved['cswork:lc-site'], 'cn');
    assert.equal(readLcSite(true), 'cn');
    saved['cswork:lc-site'] = 'jp';
    assert.equal(readLcSite(true), 'com');
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
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
