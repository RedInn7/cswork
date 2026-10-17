// The builder's rule check (lib/resume-check.ts): each rule flags what it should and nothing it
// should not (irregular past tenses, I/O, Chinese bullets), issues come largest impact first with
// the field to open, and the score is 100 less their impact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkResume } from '../lib/resume-check';
import { blankResume, type Resume } from '../components/resume-builder';

const item = (title: string, dates: string, bullets: string[]) => ({ title, subtitle: 'Software Engineer Intern', dates, bullets: bullets.join('\n') });
const good = (): Resume => ({
  ...blankResume(),
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  links: 'github.com/ada, linkedin.com/in/ada',
  education: [item('University of Washington', 'Sep 2022 – Jun 2026', ['GPA 3.9/4.0'])],
  experience: [
    item('Acme', 'Jun 2025 – Sep 2025', [
      'Built a Redis cache in front of the search API, cutting p99 latency from 420 ms to 180 ms',
      'Led the move of 14 cron jobs onto Kubernetes, removing 3 hours of weekly on-call toil',
      'Wrote 40 integration tests for the I/O layer that caught 6 regressions before release',
      'Ran load tests at 2,000 requests per second and fixed two connection-pool leaks',
    ]),
  ],
  // A current project: the present tense is right.
  projects: [item('Tiny Raft', 'Jan 2025 – Present', ['Implement leader election and log replication across 5 nodes in Go'])],
  skills: 'Languages: Python, Go, SQL',
});
const rules = (r: Resume) => checkResume(r).issues.map((i) => `${i.rule}@${i.where}`);

void test('a clean resume scores 100: Led, Built, Wrote and Ran are past tense, I/O is no pronoun', () => {
  assert.deepEqual(checkResume(good()), { score: 100, issues: [] });
  // A gerund is no action verb.
  const r = good();
  r.projects[0].bullets = 'Implementing leader election and log replication across 5 nodes in Go';
  assert.deepEqual(rules(r), ['verb@projects.0.bullets']);
  // Founding, ML and research verbs are strong and past too; "Found" is the past of find.
  const s = good();
  s.experience[0].bullets = [
    'Founded a student club with 40 members and ran weekly coding workshops',
    'Fine-tuned Llama 3 on 20k support tickets, raising answer accuracy by 12%',
    'Conducted 40 user interviews to shape the onboarding flow for new users',
    'Proposed a sharded index layout that cut query latency by 30% across shards',
    'Found and fixed 12 race conditions in the job scheduler before the launch',
    'Deployed the API to AWS us-east-1 behind an ALB, cutting p99 latency by 40%',
  ].join('\n');
  s.projects[0].bullets = 'Co-founded a startup that served 2,000 users in its first six months';
  assert.deepEqual(rules(s), []);
});

void test('each rule on one bad bullet: weak verb, no number, short, pronoun, vague, tense, repeats', () => {
  const r = good();
  r.experience[0].bullets += '\nResponsible for various internal tools that I maintained';
  const found = checkResume(r).issues.filter((i) => i.where === 'experience.0.bullets').map((i) => i.rule);
  assert.deepEqual(new Set(found), new Set(['verb', 'metric', 'pronoun', 'vague']));
  // Present tense in a finished role, and the same verb twice in one entry.
  r.experience[0].bullets = [
    'Build a Redis cache in front of the search API, cutting p99 latency from 420 ms to 180 ms',
    'Built 40 integration tests for the I/O layer that caught 6 regressions before release',
  ].join('\n');
  assert.deepEqual(rules(r).sort(), ['repeat@experience.0.bullets', 'tense@experience.0.bullets']);
  assert.match(checkResume(r).issues.find((i) => i.rule === 'tense')!.en, /\(built\)/);
  // An ongoing role keeps the present tense; the base form of "Lead" wants "led".
  r.experience[0].dates = 'Jun 2025 – Present';
  assert.deepEqual(rules(r), ['repeat@experience.0.bullets']);
  r.experience[0].dates = 'Jun 2025 – Sep 2025';
  r.experience[0].bullets = 'Lead the move of 14 cron jobs onto Kubernetes, removing 3 hours of weekly toil';
  assert.match(checkResume(r).issues[0].zh, /过去时（led）/);
  // Too long, and too short.
  r.experience[0].bullets = `Built ${'a very long bullet '.repeat(12)} with 3 numbers`;
  assert.deepEqual(rules(r), ['length@experience.0.bullets']);
  r.experience[0].bullets = 'Built 3 APIs';
  assert.deepEqual(rules(r), ['length@experience.0.bullets']);
  // Digits inside tool names are no numbers; a p99 is.
  r.experience[0].bullets = 'Built a REST API on EC2 with OAuth2 login and S3 uploads for the team portal';
  assert.deepEqual(rules(r), ['metric@experience.0.bullets']);
  r.experience[0].bullets = 'Built a REST API on EC2 with OAuth2 login and S3 uploads, tracking p99 latency';
  assert.deepEqual(rules(r), []);
});

void test('Chinese bullets: their own length range, 负责/参与 flagged, no tense check', () => {
  const r = good();
  r.experience[0].bullets = ['使用 Go 重写特征拼接模块，P99 延迟从 80ms 降到 35ms，节省 120 台机器', '负责推荐服务的接口开发，日均调用 3000 万次'].join('\n');
  assert.deepEqual(rules(r), ['verb@experience.0.bullets']);
  r.experience[0].bullets = '参与开发';
  assert.deepEqual(new Set(rules(r)), new Set(['verb@experience.0.bullets', 'metric@experience.0.bullets', 'length@experience.0.bullets']));
  r.experience[0].bullets = '我们用 Go 重写特征拼接模块，延迟降低了一半，节省了大量机器成本';
  assert.deepEqual(rules(r), ['pronoun@experience.0.bullets']);
});

void test('structure: sections, contact, links and date formats point at their fields', () => {
  const r = good();
  r.links = 'linkedin.com/in/ada';
  r.projects[0].dates = '2025.01 - 至今';
  assert.deepEqual(rules(r), ['links@links', 'dates@projects.0.dates']);
  const empty = checkResume(blankResume());
  assert.deepEqual(empty.issues.map((i) => `${i.rule}@${i.where}`), [
    'sections@experience',
    'sections@education',
    'sections@skills',
    'contact@name',
    'contact@email',
    'links@links',
  ]);
  assert.equal(empty.score, 4);
  // Entries without a single bullet: one issue costs every bullet rule.
  const bare = good();
  bare.experience[0].bullets = '';
  bare.projects[0].bullets = '';
  const { score, issues } = checkResume(bare);
  assert.deepEqual([issues[0].rule, issues[0].where, score], ['bullets', 'experience.0.bullets', 42]);
});

void test('impact orders the issues and adds up to the score', () => {
  const r = good();
  r.email = '';
  r.experience[0].bullets += '\nWorked on stuff';
  const { score, issues } = checkResume(r);
  for (let i = 1; i < issues.length; i++) assert.ok(issues[i - 1].impact >= issues[i].impact);
  assert.equal(score, Math.round(100 - issues.reduce((n, i) => n + i.impact, 0)));
  assert.equal(issues[0].where, 'email');
  for (const issue of issues) assert.ok(issue.zh && issue.en);
});
