// Resume follow-up questions by rules (lib/resume-drill.ts): a bullet's number gets "how was it
// measured", a technology gets "why it", a team bullet "your part", a load or database bullet
// "what breaks at 10×"; at most 2 per bullet and 24 in all; ids are stable card ids, cards pass
// parseCard and the friend's sheet carries no name or contact line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drillCard, drillId, drillSheet, MAX_DRILLS, resumeDrills } from '../lib/resume-drill';
import { CARD_ID, parseCard } from '../lib/recall-cards';
import { blankResume, type Resume } from '../lib/resume-shape';

const REDIS = 'Built a Redis cache in front of the search API, cutting p99 latency from 420 ms to 180 ms';
const LED = 'Led a team of 3 to move 14 cron jobs onto Kubernetes';
const resume = (): Resume => ({
  ...blankResume(),
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+1 206 555 0100',
  experience: [{ title: 'Acme', subtitle: 'Software Engineer Intern', dates: 'Summer 2025', bullets: `- ${REDIS}\n- ${LED}` }],
  projects: [{ title: '博客系统', subtitle: 'Go, PostgreSQL', dates: '2024', bullets: '用 Go 实现文章接口，响应时间降低 40%\n独立完成部署脚本' }],
});

test('the Redis bullet asks how its number was measured and why Redis; Led asks for your part', () => {
  const drills = resumeDrills(resume());
  const redis = drills.filter((d) => d.bullet === REDIS);
  assert.deepEqual(redis.map((d) => d.kind), ['measure', 'why']);
  assert.equal(redis[0].q[1], 'How did you measure “p99 latency”? What was the baseline?');
  assert.equal(redis[1].q[1], 'Why Redis? What else did you consider?');
  assert.equal(redis[0].where, 'experience.0.bullets');
  assert.equal(redis[0].entry, 'Acme');
  const led = drills.filter((d) => d.bullet === LED);
  assert.equal(led[0].kind, 'mine');
  // One "your part" per entry.
  assert.equal(drills.filter((d) => d.where === 'experience.0.bullets' && d.kind === 'mine').length, 1);
  for (const d of drills) assert.equal(d.listen.length, 3);
});

test('Chinese bullets get questions too; a solo project has no "your part"', () => {
  const drills = resumeDrills(resume()).filter((d) => d.where === 'projects.0.bullets');
  const first = drills.filter((d) => d.bullet.startsWith('用 Go'));
  assert.deepEqual(first.map((d) => d.kind), ['measure', 'why']);
  assert.equal(first[0].q[0], '「40%」是怎么测出来的？基线是多少？');
  assert.equal(first[1].q[0], '为什么选 Go？当时还考虑过什么？');
  // The second bullet names nothing itself: the subtitle's next technology, Go already asked.
  const second = drills.filter((d) => d.bullet === '独立完成部署脚本');
  assert.deepEqual(second.map((d) => [d.kind, d.q[1]]), [['why', 'Why PostgreSQL? What else did you consider?']]);
  assert.equal(drills.some((d) => d.kind === 'mine'), false);
});

test('a job with no team bullet asks for your part on its first; numbers in words and 倍 count', () => {
  const r = { ...blankResume(), experience: [{ title: '', subtitle: '', dates: '', bullets: 'Doubled throughput of the ingest service\n将接口吞吐提升三倍' }] };
  const drills = resumeDrills(r);
  assert.deepEqual(drills.filter((d) => d.bullet.startsWith('Doubled')).map((d) => d.kind), ['mine', 'measure']);
  assert.equal(drills.find((d) => d.bullet.startsWith('Doubled') && d.kind === 'measure')!.q[1], 'How did you measure “Doubled”? What was the baseline?');
  assert.equal(drills.find((d) => d.bullet.startsWith('将'))!.q[0], '「三倍」是怎么测出来的？基线是多少？');
  // No title: the card names the section and number.
  assert.match(drillCard(drills[0], false).front, /^Experience 1: /);
  assert.match(drillCard(drills[0], true).front, /^工作经历 1：/);
});

test('scale: load words or a database/system design term; a head count is no measurement', () => {
  const r = {
    ...blankResume(),
    projects: [{ title: 'Feed', subtitle: '', dates: '', bullets: 'Moved the feed table to PostgreSQL across 4 nodes\nServed requests for the mobile app\nRewrote slow queries in MySQL, cutting load time 3x' }],
  };
  const drills = resumeDrills(r);
  // The last bullet's scale question is a third one: dropped.
  assert.deepEqual(drills.map((d) => [d.bullet.split(' ')[0], d.kind]), [
    ['Moved', 'why'],
    ['Moved', 'scale'],
    ['Served', 'scale'],
    ['Rewrote', 'measure'],
    ['Rewrote', 'why'],
  ]);
  assert.equal(drills[3].q[1], 'How did you measure “3x”? What was the baseline?');
  // Counts carry no unit: no "how was it measured".
  for (const bullet of ['Led a team of 3 to ship 14 cron jobs', 'Wrote 40 integration tests', '带领 5 人小组完成重构'])
    assert.equal(resumeDrills({ ...blankResume(), projects: [{ title: 'P', subtitle: '', dates: '', bullets: bullet }] }).some((d) => d.kind === 'measure'), false, bullet);
  const figure = (bullet: string) => resumeDrills({ ...blankResume(), projects: [{ title: 'P', subtitle: '', dates: '', bullets: bullet }] }).find((d) => d.kind === 'measure')?.q[1];
  assert.equal(figure('Saved $50,000 a year in compute'), 'How did you measure “$50,000”? What was the baseline?');
  assert.equal(figure('Grew to 10K+ daily users'), 'How did you measure “10K”? What was the baseline?');
  assert.equal(figure('Handled 3,000 QPS at peak'), 'How did you measure “3,000 QPS”? What was the baseline?');
  assert.equal(figure('Cut cold start from 2.5 s to 800ms'), 'How did you measure “2.5 s”? What was the baseline?');
  assert.equal(figure('Ran it on 2 EC2 hosts'), undefined, 'EC2 is no number');
});

test('why asks about a pick (a store, a framework, an architecture), not a topic', () => {
  const why = (bullet: string) => resumeDrills({ ...blankResume(), projects: [{ title: 'P', subtitle: '', dates: '', bullets: bullet }] }).find((d) => d.kind === 'why')?.q[1];
  assert.equal(why('Split the monolith into microservices'), 'Why Microservices? What else did you consider?');
  assert.equal(why('Built a Spring Boot API'), 'Why Spring Boot? What else did you consider?');
  assert.equal(why('Answered questions with RAG over the docs'), 'Why RAG? What else did you consider?');
  for (const bullet of ['Designed a distributed system for logs', 'Added load balancing and debugging tools', 'Fixed concurrency bugs over HTTP', 'Improved communication across teams'])
    assert.equal(why(bullet), undefined, bullet);
});

test('at most 2 per bullet and 24 in all; ids are stable card ids and unique', () => {
  const bullets = Array.from({ length: 20 }, (_, i) => `Led the team that cut Redis p99 latency by ${i + 10}% for 2M users`).join('\n');
  const r = { ...blankResume(), experience: [{ title: 'Big', subtitle: '', dates: '', bullets }] };
  const drills = resumeDrills(r);
  assert.equal(drills.length, MAX_DRILLS);
  const per = new Map<string, number>();
  for (const d of drills) per.set(d.bullet, (per.get(d.bullet) ?? 0) + 1);
  assert.ok([...per.values()].every((n) => n <= 2));
  assert.equal(new Set(drills.map((d) => d.id)).size, drills.length);
  for (const d of drills) assert.match(`card:${d.id}`, CARD_ID);
  assert.deepEqual(resumeDrills(r).map((d) => d.id), drills.map((d) => d.id));
  assert.equal(drillId('measure', REDIS), drillId('measure', REDIS));
  assert.notEqual(drillId('measure', REDIS), drillId('why', REDIS));
  assert.match(`card:${drillId('why', '用 Go 实现文章接口')}`, CARD_ID);
});

test('cards pass parseCard in both languages and link back to the bullets field', () => {
  const long = { ...blankResume(), projects: [{ title: 'X'.repeat(120), subtitle: '', dates: '', bullets: `Cut latency 30% ${'a'.repeat(2900)}` }] };
  for (const d of [...resumeDrills(resume()), ...resumeDrills(long)])
    for (const zh of [true, false]) {
      const card = drillCard(d, zh);
      assert.deepEqual(parseCard(JSON.stringify(card)), card);
      assert.deepEqual(card.tags, ['resume', `resume-${d.kind}`]);
      assert.equal(card.src!.href, `/career/resume/builder#resume-${d.where.replace(/\./g, '-')}`);
      assert.ok(card.back.length < 1000);
    }
  const card = drillCard(resumeDrills(resume())[0], true);
  assert.match(card.front, /^Acme：/);
  assert.match(card.back, /^Built a Redis cache/);
  assert.match(card.back, /要讲到：\n- /);
});

test('the sheet groups by entry with each bullet, question and what to listen for, and no name or contact', () => {
  const drills = resumeDrills(resume());
  for (const zh of [true, false]) {
    const sheet = drillSheet(drills, zh);
    for (const secret of ['Ada', 'Lovelace', 'ada@example.com', '555']) assert.equal(sheet.includes(secret), false);
    assert.ok(sheet.includes(REDIS));
    assert.equal(sheet.split(REDIS).length, 2, 'a bullet is printed once above its questions');
  }
  const en = drillSheet(drills, false);
  assert.match(en, /^Resume follow-ups · \d+ questions/);
  assert.match(en, /\[Acme\]\nBullet: Built a Redis cache.*\n1\. Ask: How did you measure “p99 latency”\? What was the baseline\?\n {3}Listen for:\n {3}- The baseline/);
  assert.match(drillSheet(drills, true), /【博客系统】\n要点：用 Go/);
});
