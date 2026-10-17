// Role paths on /roadmap (lib/content/role-paths.ts): every ref points at content that exists,
// each step resolves to a link and to the items that count it done, and AI-only mocks read as
// unavailable while AI is off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mcqBank from '../lib/content/oa-mcq.json';
import projectFile from '../lib/content/resume-projects.json';
import { ROLE_KEYS, ROLES, isRole } from '../lib/content/role-paths';
import { PLAN_TOPICS_PARAM } from '../lib/jd-skills';
import { AI_TEMPLATES } from '../lib/mock-interview';
import { ROUTE_SLUGS } from '../lib/route-stops';
import { resolveRolePath, resolveStep } from '../lib/server/role-paths';
import { sdChapters } from '../lib/server/system-design-course';

const pandasIds = new Set(
  (JSON.parse(readFileSync('content/sql-track/pandas-packages.json', 'utf8')) as { problem: { id: string } }[]).map(
    (p) => p.problem.id,
  ),
);

test('every role resolves in both languages, with AI on and off', () => {
  assert.deepEqual(Object.keys(ROLES), [...ROLE_KEYS]);
  for (const role of ROLE_KEYS)
    for (const zh of [true, false])
      for (const ai of [true, false]) {
        const steps = resolveRolePath(role, zh, ai);
        assert.equal(steps.length, ROLES[role].steps.length);
        for (const step of steps) {
          assert.ok(step.href.startsWith('/'), `${role} ${step.kind} ${step.ref}`);
          assert.equal(step.title === '', step.kind === 'mcq-topic', 'only MCQ topics are named on the client');
        }
      }
  assert.ok(isRole('backend') && !isRole('manager') && !isRole(undefined));
});

test('every ref exists: stops, SD parts, SQL/pandas groups, core groups, MCQ topics, projects, courses, JS groups, mocks', () => {
  const sd = new Set(sdChapters.map((chapter) => chapter.slug));
  const topics = new Set(mcqBank.questions.map((q) => q.topic));
  for (const role of ROLE_KEYS)
    for (const step of ROLES[role].steps) {
      const resolved = resolveStep(step, true, true);
      if (step.kind === 'line-stops') {
        assert.ok(step.ref.split(',').every((slug) => ROUTE_SLUGS.includes(slug)), step.ref);
        assert.ok(resolved.keys.length > 0 && resolved.keys.every((k) => /^problem:lc-\d+$/.test(k)));
        assert.equal(resolved.stops?.length, step.ref.split(',').length);
        assert.equal(new URL(resolved.plan!, 'https://x.test').searchParams.get(PLAN_TOPICS_PARAM), step.ref);
      }
      if (step.kind === 'sd-part') assert.ok(resolved.keys.every((k) => sd.has(k.slice(3))) && resolved.keys.length > 0);
      if (step.kind === 'pandas') assert.ok(resolved.keys.every((k) => pandasIds.has(k.slice('problem:'.length))), step.ref);
      if (step.kind === 'mcq-topic') assert.ok(topics.has(step.ref));
      if (step.kind === 'mock-kind') assert.deepEqual(resolved.keys, []);
      if (step.kind === 'project') assert.deepEqual(resolved.keys, [`content:project/${step.ref}`]);
      if (step.kind === 'fe-js') {
        assert.equal(resolved.href, `/frontend#fejs-group-${step.ref}`);
        assert.ok(resolved.keys.length > 0 && resolved.keys.every((k) => /^content:fe-js\/[a-z-]+$/.test(k)), step.ref);
      }
    }
  assert.throws(() => resolveStep({ kind: 'line-stops', ref: 'array-foundations,nope' }, true, true), /no line-stops/);
  assert.throws(() => resolveStep({ kind: 'sd-part', ref: 'url-shortener' }, true, true), /no sd-part/, 'a part, not a chapter');
  assert.throws(() => resolveStep({ kind: 'project', ref: 'url-shortener' }, true, true), /no project/);
  assert.throws(() => resolveStep({ kind: 'mcq-topic', ref: 'astrology' }, true, true), /no mcq-topic/);
  assert.throws(() => resolveStep({ kind: 'core-group', ref: 'lld' }, true, true), /no core-group/);
  assert.throws(() => resolveStep({ kind: 'fe-js', ref: 'debounce' }, true, true), /no fe-js/, 'a group, not a problem');
  // The frontend path drills the judged JS problems on /frontend; its AI mock reads unavailable in production.
  const promise = resolveStep({ kind: 'fe-js', ref: 'promise' }, true, true);
  assert.equal(promise.title, '前端手写题：Promise 与异步');
  assert.ok(promise.keys.includes('content:fe-js/promise-all'));
  assert.ok(ROLES.frontend.steps.filter((s) => s.kind === 'fe-js' && !s.optional).length >= 2);
  // The judged OOD problems (Core Skills group `ood`) follow the OOD reading on the generalist and backend paths.
  const ood = resolveStep({ kind: 'core-group', ref: 'ood' }, true, true);
  assert.equal(ood.href, '/core-skills#core-group-ood');
  assert.ok(ood.keys.includes('problem:core-parking-lot') && ood.keys.length >= 8);
  for (const role of ['generalist', 'backend'] as const)
    assert.ok(ROLES[role].steps.some((s) => s.kind === 'core-group' && s.ref === 'ood' && !s.optional), role);
});

test('each role is a real path: no repeats, a project, mostly counted steps', () => {
  for (const role of ROLE_KEYS) {
    const steps = ROLES[role].steps;
    const ids = steps.map((s) => `${s.kind}:${s.ref}`);
    assert.equal(new Set(ids).size, ids.length, `${role} repeats a step`);
    assert.ok(steps.some((s) => s.kind === 'project' && !s.optional), `${role} has no required project`);
    const counted = resolveRolePath(role, true, false).filter((s) => !s.optional && s.keys.length && !s.unavailable);
    assert.ok(counted.length >= 6, `${role}: ${counted.length} counted steps`);
  }
  // Every resume project is on some role's path, and its meta roles say where.
  for (const project of projectFile.projects) {
    const on = ROLE_KEYS.filter((role) => ROLES[role].steps.some((s) => s.kind === 'project' && s.ref === project.slug));
    assert.ok(on.length, `${project.slug} is on no path`);
    assert.ok(on.every((role) => project.roles.includes(role)), `${project.slug}: meta roles miss ${on}`);
  }
});

test('AI-only mock interviews read as unavailable while AI is off; the others never count', () => {
  const aiOnly = new Set(AI_TEMPLATES.map((t) => t.id));
  for (const role of ROLE_KEYS)
    for (const ai of [true, false])
      for (const step of resolveRolePath(role, false, ai).filter((s) => s.kind === 'mock-kind'))
        assert.equal(!!step.unavailable, !ai && aiOnly.has(step.ref), `${role} ${step.ref}`);
  const front = resolveRolePath('frontend', true, false).find((s) => s.ref === 'frontend')!;
  assert.equal(front.unavailable, true);
  assert.equal(front.title, '模拟面试：前端面试');
});

test('system design steps carry one label, and "optional" only as the step tag', () => {
  // The course's part names already say "System design:" and "(optional)"; required parts must not read optional.
  for (const role of ROLE_KEYS)
    for (const zh of [true, false])
      for (const step of resolveRolePath(role, zh, true).filter((s) => s.kind === 'sd-part'))
        assert.doesNotMatch(step.title, /系统设计：系统设计|System design: System design|选读|optional/i, `${role} ${step.ref}`);
  assert.equal(resolveStep({ kind: 'sd-part', ref: 'framework' }, false, true).title, 'System design: framework and cases');
  assert.equal(resolveStep({ kind: 'sd-part', ref: 'tech-kafka' }, true, true).title, '系统设计：关键技术');
});
