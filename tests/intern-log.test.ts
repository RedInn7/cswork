// The internship log (lib/intern-log.ts): week arithmetic, lenient parsing of the brag: notes, XYZ
// bullets, self-review drafts, writing bullets into the resume, and the team-matching matrix; plus
// the guide's internship checklist (lib/content/career-checklists.ts) it reads.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAREER_CHECKLISTS } from '../lib/content/career-checklists';
import { blankResume, MAX } from '../lib/resume-shape';
import {
  appendBullets,
  bragBody,
  isDay,
  mondayOf,
  parseBrag,
  parseMeta,
  rankingText,
  rankTeams,
  readTeamMatch,
  resolveWeek,
  selfReview,
  TEAM_FACTORS,
  TEAM_QUESTIONS,
  weekLabel,
  weekMonday,
  weekNo,
  winLines,
  xyzBullet,
  type BragWeek,
  type InternMeta,
} from '../lib/intern-log';

const meta: InternMeta = { company: 'Acme', role: 'SWE Intern', start: '2026-06-03', weeks: 12 };
const brag = (monday: string, part: Partial<BragWeek>): BragWeek => ({ monday, wins: [], feedback: '', learned: '', next: '', ...part });

void test('weeks: a mid-week start belongs to its Monday, and checklist weeks resolve against the length', () => {
  // 2026-06-03 is a Wednesday.
  assert.equal(mondayOf('2026-06-03'), '2026-06-01');
  assert.equal(mondayOf('2026-06-01'), '2026-06-01');
  assert.equal(mondayOf('2026-06-07'), '2026-06-01');
  assert.equal(mondayOf('2026-01-01'), '2025-12-29');
  assert.equal(weekNo(meta.start, '2026-06-01'), 1);
  assert.equal(weekNo(meta.start, '2026-06-08'), 2);
  assert.equal(weekNo(meta.start, '2026-05-31'), 0);
  assert.equal(weekNo(meta.start, '2026-11-02'), 23);
  assert.equal(weekMonday(meta.start, 1), '2026-06-01');
  assert.equal(weekMonday(meta.start, 12), '2026-08-17');
  assert.equal(resolveWeek('mid', 10), 5);
  assert.equal(resolveWeek('mid', 12), 6);
  assert.equal(resolveWeek('mid', 9), 5);
  assert.equal(resolveWeek(-2, 12), 11);
  assert.equal(resolveWeek(-1, 10), 10);
  assert.equal(resolveWeek(0, 12), 0);
  assert.equal(resolveWeek(3, 12), 3);
  assert.deepEqual([0, 2, 'mid', -1, -3].map((w) => weekLabel(w as number | 'mid', false)), ['Before day one', 'Week 2', 'Midpoint', 'Final week', 'Third-to-last week']);
  assert.deepEqual([0, 2, 'mid', -1, -3].map((w) => weekLabel(w as number | 'mid', true)), ['入职前', '第 2 周', '中期', '最后一周', '倒数第 3 周']);
  for (const day of ['2026-02-30', '2026-13-01', '2026-6-1', 'x', '']) assert.equal(isDay(day), false, day);
  assert.equal(isDay('2028-02-29'), true);
});

void test('parsing: broken notes are null, the rest is trimmed to its caps', () => {
  for (const body of ['', '{', 'null', '[]', '"x"', '42']) assert.equal(parseBrag(body), null, body);
  const long = 'x'.repeat(400);
  const parsed = parseBrag(
    JSON.stringify({ wins: [null, 'w', { x: long, y: 5, z: 'z' }, { x: ' ', y: '', z: '' }, ...Array(10).fill({ x: 'a' })], feedback: long.repeat(3), learned: 7, extra: true }),
  )!;
  assert.equal(parsed.wins.length, 8);
  assert.deepEqual(parsed.wins[0], { x: 'x'.repeat(300), y: '', z: 'z', project: '' });
  assert.equal(parsed.feedback.length, 1000);
  assert.equal(parsed.learned, '');
  assert.ok(!('extra' in parsed));
  assert.equal(bragBody({ wins: [{ x: ' ', y: '', z: '', project: 'p' }], feedback: ' ', learned: '', next: '' }), '');
  assert.deepEqual(JSON.parse(bragBody({ wins: [{ x: 'a', y: '', z: '', project: '' }, { x: '', y: '', z: '', project: '' }], feedback: '', learned: '', next: '' })).wins.length, 1);

  assert.equal(parseMeta('{"start":"2026-02-30"}'), null);
  assert.equal(parseMeta('oops'), null);
  assert.deepEqual(parseMeta(JSON.stringify({ company: 'A'.repeat(200), start: '2026-06-03', weeks: 40 })), { company: 'A'.repeat(100), role: '', start: '2026-06-03', weeks: 16 });
  assert.equal(parseMeta('{"start":"2026-06-03","weeks":3}')!.weeks, 8);
  assert.equal(parseMeta('{"start":"2026-06-03","weeks":"10"}')!.weeks, 12);
});

void test('XYZ bullets: one "by", trailing stops dropped, and a nudge for a missing number', () => {
  assert.deepEqual(xyzBullet({ x: 'Cut search latency', y: 'from 800 ms to 300 ms.', z: 'caching hot queries', project: '' }), {
    line: 'Cut search latency from 800 ms to 300 ms, by caching hot queries.',
    addNumber: false,
  });
  assert.equal(xyzBullet({ x: 'Shipped the export page', y: '', z: 'By pairing with design.', project: '' }).line, 'Shipped the export page, by pairing with design.');
  assert.equal(xyzBullet({ x: 'Shipped the export page', y: 'used by every team', z: '', project: '' }).addNumber, true);
  assert.equal(xyzBullet({ x: 'Wrote the runbook', y: '', z: '', project: '' }).line, 'Wrote the runbook.');
  assert.equal(xyzBullet({ x: '把接口延迟', y: '降低 60%', z: '缓存热点查询。', project: '' }).line, '把接口延迟，降低 60%，通过缓存热点查询。');
  assert.equal(xyzBullet({ x: '上线导出功能', y: '', z: '通过和设计结对', project: '' }).line, '上线导出功能，通过和设计结对。');
});

void test('self-review: the midpoint reads the first half only, measured results first and grouped by project', () => {
  const weeks = [
    brag('2026-06-01', { wins: [{ x: 'Set up CI', y: '', z: '', project: 'Infra' }], feedback: 'Ask earlier.\nWrite more tests.', next: 'n1' }),
    brag('2026-06-08', { wins: [{ x: 'Built search', y: 'serving 2k users', z: 'a trie', project: 'Search' }], learned: 'Tries', next: 'n2' }),
    brag('2026-06-15', { wins: [{ x: 'Cut build time', y: 'by 40%', z: 'caching', project: 'Infra' }], next: 'n3' }),
    // Week 7 of 12: past the midpoint.
    brag('2026-07-13', { wins: [{ x: 'Late win', y: '3x', z: '', project: 'Search' }], feedback: 'late', next: 'n7' }),
    // A log kept from last year's internship: outside this one's weeks.
    brag('2025-07-14', { wins: [{ x: 'Old internship', y: '1', z: '', project: '' }], feedback: 'old', next: 'old' }),
  ];
  const mid = selfReview(meta, weeks, 'mid', false);
  assert.ok(mid.startsWith('# Midpoint self-review draft · SWE Intern at Acme\n'));
  assert.ok(mid.includes('Weeks 1–6 of 12.'));
  assert.ok(!mid.includes('Late win') && !mid.includes('late') && !mid.includes('n7'));
  // Search (a measured win in week 2) and Infra's measured win lead; Infra's unmeasured one trails.
  const order = ['### Search', '- Built search serving 2k users, by a trie.', '### Infra', '- Cut build time by 40%, by caching.', '- Set up CI.'].map((s) => mid.indexOf(s));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), String(order));
  assert.ok(mid.includes('- **Week 1**: Ask earlier.\n  Write more tests.'));
  assert.ok(mid.includes('- **Week 2**: Tries'));
  // Next steps: the two latest weeks that wrote one.
  assert.ok(mid.includes('- **Week 2**: n2\n- **Week 3**: n3') && !mid.includes('n1'));
  assert.ok(mid.includes('## Questions for my manager') && !mid.includes('## Return offer'));

  const final = selfReview(meta, weeks, 'final', true);
  assert.ok(final.startsWith('# 期末自评草稿 · SWE Intern，Acme\n'));
  assert.ok(final.includes('Late win') && final.includes('- **第 7 周**：n7') && final.includes('## 转正意向'));
  assert.ok(!mid.includes('Old internship') && !final.includes('Old internship') && !final.includes('old'));

  const empty = selfReview({ ...meta, role: '', company: '' }, [], 'mid', false);
  assert.ok(empty.startsWith('# Midpoint self-review draft\n'));
  assert.equal(empty.match(/\(nothing logged yet\)/g)?.length, 4);
  // A single unnamed project needs no subheading.
  assert.ok(!selfReview(meta, [brag('2026-06-08', { wins: [{ x: 'Solo', y: '', z: '', project: '' }] })], 'mid', false).includes('###'));
  assert.deepEqual(winLines(meta, weeks), ['Built search serving 2k users, by a trie.', 'Cut build time by 40%, by caching.', 'Late win 3x.', 'Set up CI.']);
});

void test('resume bullets: duplicates skipped, the 3000-character cap honoured, a new entry made from the internship', () => {
  const resume = blankResume();
  const made = appendBullets(resume, 'new', ['One.', 'Two.', 'One.', ' '], meta);
  // The builder's single blank entry is replaced, not pushed down.
  assert.equal(made.resume.experience.length, 1);
  assert.deepEqual(made.resume.experience[0], { title: 'Acme', subtitle: 'SWE Intern', dates: 'Jun 2026 – Aug 2026', bullets: 'One.\nTwo.' });
  assert.deepEqual(made.added, ['One.', 'Two.']);
  const again = appendBullets(made.resume, 0, ['Two.', 'Three.'], meta);
  assert.equal(again.resume.experience[0].bullets, 'One.\nTwo.\nThree.');
  assert.deepEqual(again.added, ['Three.']);
  // Bullets with marks count as the same line.
  const marked = { ...resume, experience: [{ title: 'Old', subtitle: '', dates: '', bullets: '- One.\n' }] };
  assert.deepEqual(appendBullets(marked, 0, ['One.', 'Two.'], meta).resume.experience[0].bullets, '- One.\nTwo.');
  assert.equal(appendBullets(marked, 'new', ['X.'], meta).resume.experience.length, 2);
  assert.equal(appendBullets(marked, 'new', ['X.'], meta).resume.experience[1].title, 'Old');

  const full = { ...resume, experience: [{ title: 'Old', subtitle: '', dates: '', bullets: 'x'.repeat(MAX.bullets - 10) }] };
  const capped = appendBullets(full, 0, ['short', 'this one is far too long'], meta);
  assert.deepEqual(capped.added, ['short']);
  assert.deepEqual(capped.dropped, ['this one is far too long']);
  assert.ok(capped.resume.experience[0].bullets.length <= MAX.bullets);
  const twenty = { ...resume, experience: Array.from({ length: 20 }, () => ({ title: 'T', subtitle: '', dates: '', bullets: '' })) };
  assert.deepEqual(appendBullets(twenty, 'new', ['a'], meta), { resume: twenty, added: [], dropped: ['a'] });
  assert.deepEqual(appendBullets(resume, 5, ['a'], meta).dropped, ['a']);
  // Start late in the year: the end month rolls into the next.
  assert.equal(appendBullets(resume, 'new', ['a'], { ...meta, start: '2026-11-02', weeks: 10 }).resume.experience[0].dates, 'Nov 2026 – Jan 2027');
});

void test('team matching: default factors, scores dropped with their team, ranked by weighted mean', () => {
  const blank = readTeamMatch(null);
  assert.deepEqual(blank.factors.map((f) => f.id), TEAM_FACTORS.map(([id]) => id));
  assert.deepEqual(blank.teams, []);
  assert.equal(TEAM_QUESTIONS.length, 12);
  assert.equal(new Set(TEAM_QUESTIONS.map(([id]) => id)).size, 12);

  const m = readTeamMatch({
    factors: [
      { id: 'work', name: '', weight: 5 },
      { id: 'pace', name: 'Sleep', weight: 1 },
    ],
    scores: { a: { work: 2, pace: 5 }, b: { work: 4, pace: 1 }, gone: { work: 5 }, c: { work: 9 } },
    teams: [
      { id: 'a', name: 'Payments', manager: 'Lee', callAt: '2026-04-02T10:30', asked: ['mentor', 'nope', 'mentor'], notes: 'n'.repeat(2000) },
      { id: 'b', name: '', manager: '', callAt: 'soon', asked: 'x' },
      { id: 'c', name: 'Unscored' },
      { id: 'a', name: 'dupe' },
      { id: '../bad', name: 'bad' },
      null,
    ],
  });
  assert.deepEqual(m.factors.map((f) => [f.id, f.weight]), [['work', 5], ['pace', 1]]);
  assert.deepEqual(m.teams.map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(m.teams[0].asked, ['mentor']);
  assert.equal(m.teams[0].notes.length, 1500);
  assert.equal(m.teams[1].callAt, '');
  assert.deepEqual(Object.keys(m.scores).sort(), ['a', 'b']);
  // b: (5·4 + 1·1) / 6 = 3.5; a: (5·2 + 1·5) / 6 = 2.5; c unscored last.
  assert.deepEqual(rankTeams(m).map((r) => [r.team.id, r.score]), [['b', 3.5], ['a', 2.5], ['c', null]]);
  assert.equal(rankingText(m, false), '1. Team 2: 3.50\n2. Payments (Lee): 2.50\n3. Unscored: not scored');
  assert.equal(rankingText(m, true).split('\n')[0], '1. 第 2 组: 3.50');
  // Removing a team on the page and reading it back drops its scores.
  const gone = readTeamMatch({ ...m, teams: m.teams.filter((t) => t.id !== 'b') });
  assert.deepEqual(Object.keys(gone.scores), ['a']);
  // An emptied factor list stays empty rather than coming back as the defaults.
  assert.deepEqual(readTeamMatch({ factors: [] }).factors, []);
  assert.equal(readTeamMatch({ teams: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}` })) }).teams.length, 8);
});

void test('the internship checklist: every item placed in a week, every phase covered', () => {
  const items = CAREER_CHECKLISTS.internship;
  assert.ok(items.length >= 12 && items.length <= 15);
  assert.ok(items.every((i) => i.week === 'mid' || (Number.isInteger(i.week) && Math.abs(i.week as number) <= 4)));
  // Every phase of a 12-week internship gets something to do.
  const weeks = new Set(items.map((i) => resolveWeek(i.week!, 12)));
  for (const w of [0, 1, 2, 6, 10, 11, 12]) assert.ok(weeks.has(w), String(w));
  assert.ok(items.some((i) => i.href === '/career/intern'));
});
