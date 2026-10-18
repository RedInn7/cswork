// The LinkedIn profile check (lib/linkedin-check.ts): an empty profile is flagged on all six parts,
// a complete one scores 100, only a random URL tail costs 6, skills are compared against the
// resume's terms, and without a resume nothing is compared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankLinkedIn, checkLinkedIn, linkedInFrom, normalizeLinkedIn, type LinkedIn } from '../lib/linkedin-check';

const RESUME = `Ada Lovelace
EXPERIENCE
Acme | Software Engineer Intern
- Built a Go service on PostgreSQL that cut p99 latency 40%
SKILLS
Languages: Go, Python`;
const full = (): LinkedIn => ({
  headline: 'Software Engineer Intern · Go · Python · PostgreSQL',
  about:
    'I build backend services in Go and Python. Last summer at Acme I moved search onto a PostgreSQL-backed Go service and cut p99 latency by 40%. Before that I wrote a distributed key-value store for a systems course that handled 20k writes per second. I am looking for 2026 new grad backend and infrastructure roles in Seattle or remote.',
  experience: 'Acme · Software Engineer Intern\nCut p99 latency 40% with a Go service\n\nUW CSE · Teaching Assistant\nRan weekly sections for 30 students',
  skills: 'Go, Python, PostgreSQL, Docker, Kubernetes, Redis',
  url: 'https://www.linkedin.com/in/ada-lovelace/',
  openToWork: 'recruiters',
});

test('an empty profile is flagged on all six parts and loses everything but the skills comparison', () => {
  const { score, issues, compared } = checkLinkedIn(blankLinkedIn(), null);
  assert.deepEqual([...new Set(issues.map((i) => i.where))].sort(), ['about', 'experience', 'headline', 'openToWork', 'skills', 'url']);
  assert.equal(compared, 0);
  // 20 + 15 + 25 + 8 (skills under 5) + 10 + 5 (Open to Work not chosen).
  assert.equal(score, 100 - 83);
  assert.equal(issues[0].where, 'experience');
  for (const i of issues) assert.ok(i.zh && i.en && i.rule === i.where);
});

test('a complete profile scores 100, with and without the resume', () => {
  assert.deepEqual(checkLinkedIn(full(), RESUME), { score: 100, issues: [], compared: 3 });
  assert.deepEqual(checkLinkedIn(full(), null), { score: 100, issues: [], compared: 0 });
  assert.deepEqual(checkLinkedIn(full(), '   '), { score: 100, issues: [], compared: 0 });
});

test('the URL: a random tail costs 6, a readable slug with digits nothing, anything else 10', () => {
  const at = (url: string) => checkLinkedIn({ ...full(), url }, null).issues.filter((i) => i.where === 'url').map((i) => i.impact);
  assert.deepEqual(at('linkedin.com/in/ada-lovelace-4b2a1c39'), [6]);
  assert.deepEqual(at('https://www.linkedin.com/in/ada-lovelace-123456789/'), [6]);
  assert.deepEqual(at('linkedin.com/in/ada2026'), []);
  assert.deepEqual(at('linkedin.com/in/ada-lovelace-cs'), []);
  assert.deepEqual(at('linkedin.com/in/ada-decade'), [], 'hex letters without a digit are a word');
  assert.deepEqual(at('https://www.linkedin.com/company/acme'), [10]);
  assert.deepEqual(at('github.com/ada'), [10]);
  assert.deepEqual(at(''), [10]);
});

test('skills: Go on the resume but not in skills or headline is named; under 5 skills costs 8', () => {
  const p = { ...full(), headline: 'Software Engineer Intern · Python', skills: 'Python, PostgreSQL, Docker, Kubernetes, Redis' };
  const result = checkLinkedIn(p, RESUME);
  assert.equal(result.compared, 3);
  const skills = result.issues.filter((i) => i.where === 'skills');
  assert.equal(skills.length, 1);
  assert.match(skills[0].en, /not in your LinkedIn skills or headline: Go\.$/);
  assert.equal(skills[0].impact, 4);
  assert.equal(result.score, 96);
  // In the headline counts too.
  assert.equal(checkLinkedIn({ ...p, headline: 'Software Engineer Intern · Go' }, RESUME).score, 100);
  const few = checkLinkedIn({ ...full(), skills: 'Go\nPython\nPostgreSQL' }, null).issues;
  assert.deepEqual(few.map((i) => [i.where, i.impact]), [['skills', 8]]);
});

test('headline, about, experience and Open to Work rules', () => {
  const issues = (p: Partial<LinkedIn>) => checkLinkedIn({ ...full(), ...p }, null).issues.map((i) => [i.where, i.impact]);
  assert.deepEqual(issues({ headline: 'Student at UW · Python' }), [['headline', 10]]);
  assert.deepEqual(issues({ headline: 'Software Engineer Intern at Acme' }), [['headline', 6]]);
  assert.deepEqual(issues({ headline: `Software Engineer · Python ${'x'.repeat(220)}` }), [['headline', 4]]);
  assert.deepEqual(issues({ headline: '后端开发实习 · Go' }), []);
  assert.deepEqual(issues({ about: 'Backend engineer working in Go.' }), [['about', 6]]);
  assert.deepEqual(issues({ about: `Hi! ${full().about}` }), [['about', 4]]);
  assert.deepEqual(issues({ about: `${'I like building things that people use every single day '.repeat(6)}.` }), [
    ['about', 4],
    ['about', 2],
  ]);
  assert.deepEqual(issues({ experience: 'Acme\nCut latency 40%\n\nUW\nRan sections\n\nCafe\nMade coffee' }).map(([w, n]) => [w, Math.round(Number(n) * 100) / 100]), [
    ['experience', 8.33],
    ['experience', 8.33],
  ]);
  assert.deepEqual(issues({ openToWork: 'off' }), [['openToWork', 10]]);
  assert.deepEqual(issues({ openToWork: 'public' }), []);
});

test('stored profiles are cleaned and the resume links prefill the URL', () => {
  assert.deepEqual(normalizeLinkedIn({ headline: 'x'.repeat(500), openToWork: 'everyone', extra: 1 }), { ...blankLinkedIn(), headline: 'x'.repeat(400) });
  assert.deepEqual(normalizeLinkedIn('junk'), blankLinkedIn());
  assert.equal(linkedInFrom('github.com/ada, https://www.linkedin.com/in/ada-lovelace, ada.dev'), 'https://www.linkedin.com/in/ada-lovelace');
  assert.equal(linkedInFrom('github.com/ada'), '');
});
