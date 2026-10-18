// Role paths on /roadmap (lib/content/role-paths.ts): every ref points at content that exists,
// each step resolves to a link and to the items that count it done, and AI-only mocks read as
// unavailable while AI is off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mcqBank from '../lib/content/oa-mcq.json';
import projectFile from '../lib/content/resume-projects.json';
import { ROLE_KEYS, ROLES, ROUTE_MAX_STEPS, isRole, parseRoute, routeFits } from '../lib/content/role-paths';
import { PLAN_TOPICS_PARAM } from '../lib/jd-skills';
import { AI_TEMPLATES } from '../lib/mock-interview';
import { ROUTE_SLUGS } from '../lib/route-stops';
import { MCQ_MINUTES, resolveRolePath, resolveStep, routeCatalog } from '../lib/server/role-paths';
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

test('every ref exists: stops, SD parts, SQL/pandas groups, core and ML groups, MCQ topics, projects, courses, mocks', () => {
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
    }
  // Pandas-only groups (pd-1xx) resolve like the twins; index design is an optional backend step.
  const reshape = resolveStep({ kind: 'pandas', ref: 'reshape' }, false, true);
  assert.equal(reshape.title, 'Pandas: Reshaping & pivots');
  assert.deepEqual(reshape.keys, ['problem:pd-101', 'problem:pd-102', 'problem:pd-103', 'problem:pd-104']);
  assert.ok(ROLES.backend.steps.some((s) => s.kind === 'sql-track' && s.ref === 'indexing' && s.optional));
  assert.throws(() => resolveStep({ kind: 'line-stops', ref: 'array-foundations,nope' }, true, true), /no line-stops/);
  assert.throws(() => resolveStep({ kind: 'sd-part', ref: 'url-shortener' }, true, true), /no sd-part/, 'a part, not a chapter');
  assert.throws(() => resolveStep({ kind: 'project', ref: 'url-shortener' }, true, true), /no project/);
  assert.throws(() => resolveStep({ kind: 'mcq-topic', ref: 'astrology' }, true, true), /no mcq-topic/);
  assert.throws(() => resolveStep({ kind: 'core-group', ref: 'lld' }, true, true), /no core-group/);
  // The judged OOD problems (Core Skills group `ood`) follow the OOD reading on the generalist and backend paths.
  const ood = resolveStep({ kind: 'core-group', ref: 'ood' }, true, true);
  assert.equal(ood.href, '/core-skills#core-group-ood');
  assert.ok(ood.keys.includes('problem:core-parking-lot') && ood.keys.length >= 8);
  for (const role of ['generalist', 'backend'] as const)
    assert.ok(ROLES[role].steps.some((s) => s.kind === 'core-group' && s.ref === 'ood' && !s.optional), role);
  // ML Coding groups open the bank's ML section at the group; the ML path requires the classic models.
  const models = resolveStep({ kind: 'ml-group', ref: 'models' }, false, true);
  assert.equal(models.title, 'ML Coding: Classic models');
  assert.equal(models.href, '/?view=problems&library=ml#ml-group-models');
  assert.ok(models.keys.includes('problem:ml-kmeans') && models.keys.every((k) => /^problem:ml-[a-z0-9-]+$/.test(k)));
  assert.throws(() => resolveStep({ kind: 'ml-group', ref: 'kmeans' }, true, true), /no ml-group/, 'a group, not a problem');
  assert.ok(ROLES.ml.steps.some((s) => s.kind === 'ml-group' && s.ref === 'models' && !s.optional));
  for (const topic of ['ml', 'stats']) assert.ok(ROLES.ml.steps.some((s) => s.kind === 'mcq-topic' && s.ref === topic), topic);
  assert.ok(ROLES.data.steps.some((s) => s.kind === 'mcq-topic' && s.ref === 'stats'));
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

test('every step has an estimate: problems by difficulty, reading time, MCQs, project hours, mock slots', () => {
  for (const role of ROLE_KEYS)
    for (const zh of [true, false])
      for (const step of resolveRolePath(role, zh, false))
        assert.ok(step.unavailable ? step.minutes === 0 : step.minutes > 0, `${role} ${step.kind} ${step.ref}: ${step.minutes}`);
  // 6 basics at 25 minutes (lib/study-plan.ts MINUTES.medium); 66 complexity questions at 1.5; a 6-hour project.
  assert.equal(resolveStep({ kind: 'sql-track', ref: 'basics' }, true, true).minutes, 150);
  const complexity = resolveStep({ kind: 'mcq-topic', ref: 'complexity' }, true, true);
  assert.equal(complexity.minutes, Math.round(complexity.keys.length * MCQ_MINUTES));
  assert.equal(resolveStep({ kind: 'project', ref: 'lru-ttl-cache' }, true, true).minutes, 360);
  assert.equal(resolveStep({ kind: 'mock-kind', ref: 'phone' }, true, true).minutes, 50);
  assert.equal(resolveStep({ kind: 'mock-kind', ref: 'frontend' }, true, false).minutes, 0, 'unavailable');
  // Line 500 by stage: never below all-easy, never above all-hard.
  const linear = resolveStep(ROLES.backend.steps[0], true, true);
  assert.ok(linear.minutes >= linear.keys.length * 15 && linear.minutes <= linear.keys.length * 40);
});

test('the route catalog holds every built-in step and every single ref, all 35 stops among them', () => {
  const catalog = routeCatalog(false, false);
  for (const role of ROLE_KEYS)
    for (const step of ROLES[role].steps) {
      const entry = catalog[`${step.kind}:${step.ref}`];
      assert.ok(entry, `${role} ${step.kind}:${step.ref}`);
      assert.equal(entry.optional, undefined, 'a route says itself what is optional');
    }
  const stops = Object.keys(catalog).filter((id) => id.startsWith('line-stops:') && !id.includes(','));
  assert.deepEqual(stops.map((id) => id.slice('line-stops:'.length)), ROUTE_SLUGS);
  for (const kind of ['sd-part', 'sql-track', 'pandas', 'core-group', 'ml-group', 'mcq-topic', 'project', 'course', 'mock-kind'])
    assert.ok(Object.keys(catalog).some((id) => id.startsWith(`${kind}:`)), kind);
  assert.equal(Object.keys(catalog).filter((id) => id.startsWith('project:')).length, projectFile.projects.length);
  assert.equal(new Set(Object.keys(catalog).filter((id) => id.startsWith('mcq-topic:'))).size, new Set(mcqBank.questions.map((q) => q.topic)).size);
  // Every pandas entry is made of packaged pandas problems.
  for (const [id, entry] of Object.entries(catalog))
    if (id.startsWith('pandas:'))
      assert.ok(entry.keys.length && entry.keys.every((k) => pandasIds.has(k.slice('problem:'.length))), id);
  assert.equal(catalog['mock-kind:frontend'].unavailable, true, 'AI off');
  assert.equal(catalog['line-stops:binary-search'].title, 'Line 500: Binary Search', 'one stop goes by its name');
});

test('parseRoute keeps a valid route and refuses long titles, too many steps and unreal dates', () => {
  const base = { v: 1, targetDate: '2026-12-01', weeklyHours: 10, state: {}, planned: {} };
  const ext = { kind: 'ext', id: 'ext-a1b2c3', title: 'CS61B lectures 1–12', units: 12, done: 3, unitMinutes: 90 };
  const route = { ...base, name: 'Mine', from: 'backend', steps: [{ kind: 'sql-track', ref: 'joins', optional: true }, ext], state: { 'ext-a1b2c3': 'doing' }, planned: { 'sql-track:joins': '2026-11-02' } };
  assert.deepEqual(parseRoute(JSON.stringify(route)), route);
  assert.deepEqual(parseRoute(base), base);
  // An entry without unitMinutes takes an hour a unit.
  const { kind, id, title, units, done } = ext;
  const bare = { kind, id, title, units, done };
  assert.deepEqual(parseRoute({ ...base, steps: [bare] })?.steps, [{ ...bare, unitMinutes: 60 }]);
  const bad = (doc: object, why: string) => assert.equal(parseRoute(doc), null, why);
  bad({ ...base, steps: [{ ...ext, title: 'x'.repeat(81) }] }, 'an 81-character title');
  assert.ok(parseRoute({ ...base, steps: [{ ...ext, title: 'x'.repeat(80) }] }));
  bad({ ...base, steps: [{ ...ext, title: '   ' }] }, 'a blank title');
  bad({ ...base, steps: [{ ...ext, url: 'javascript:alert(1)' }] }, 'entries carry no link');
  bad({ ...base, steps: [{ ...ext, done: 13 }] }, 'more done than units');
  bad({ ...base, steps: [{ ...ext, units: 501 }] }, 'units');
  bad({ ...base, steps: [{ ...ext, unitMinutes: 4 }] }, 'unit minutes');
  const many = Array.from({ length: ROUTE_MAX_STEPS + 1 }, (_, i) => ({ ...ext, id: `ext-${String(i).padStart(6, '0')}` }));
  bad({ ...base, steps: many }, '81 steps');
  assert.ok(parseRoute({ ...base, steps: many.slice(1) }), '80 steps');
  bad({ ...base, steps: [ext, ext] }, 'a repeated step');
  bad({ ...base, steps: [{ kind: 'sql-track', ref: 'a b' }] }, 'a ref with a space');
  bad({ ...base, steps: [{ kind: 'nope', ref: 'joins' }] }, 'an unknown kind');
  // A step of a removed feature (the frontend JS track) drops out; the rest of the route stays.
  assert.deepEqual(parseRoute({ ...route, steps: [{ kind: 'fe-js', ref: 'promise' }, ...route.steps] }), route);
  bad({ ...base, targetDate: '2026-02-30' }, 'Feb 30');
  bad({ ...base, targetDate: '2026-1-5' }, 'not YYYY-MM-DD');
  bad({ ...base, planned: { a: '2026-13-01' } }, 'a planned month 13');
  bad({ ...base, weeklyHours: 0 }, 'no hours');
  bad({ ...base, weeklyHours: 41 }, 'too many hours');
  bad({ ...base, state: { a: 'done' } }, 'an unknown mark');
  bad({ ...base, from: 'manager' }, 'an unknown role');
  bad({ ...base, extra: 1 }, 'an unknown field');
  assert.equal(parseRoute('{'), null);
  // A built-in role's note holds no steps; a learner's route needs them.
  assert.ok(routeFits('route:role-backend', parseRoute(base)!));
  assert.ok(!routeFits('route:role-manager', parseRoute(base)!));
  assert.ok(!routeFits('route:role-backend', parseRoute(route)!));
  assert.ok(routeFits('route:r-lx2k9a', parseRoute(route)!));
  assert.ok(!routeFits('route:r-lx2k9a', parseRoute(base)!));
  assert.ok(!routeFits('route:r-UP', parseRoute(route)!));
  assert.ok(!routeFits('route:custom/1', parseRoute(route)!));
});
