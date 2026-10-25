import courseFile from '@/lib/content/beginner-courses.json';
import coreSkills from '@/lib/content/core-skills.json';
import mcqBank from '@/lib/content/oa-mcq.json';
import mlCoding from '@/lib/content/ml-coding.json';
import projectFile from '@/lib/content/resume-projects.json';
import {
  ROLE_KEYS,
  ROLES,
  stepTitle,
  stopsName,
  type ResolvedStep,
  type RoleKey,
  type RoleStep,
  type StepKind,
} from '@/lib/content/role-paths';
import sqlTrack from '@/lib/content/sql-track.json';
import { PLAN_TOPICS_PARAM } from '@/lib/jd-skills';
import { curatedEntries } from '@/lib/ling-curated';
import { ROUTE_SLUGS, STOP_NAMES, stopHref } from '@/lib/route-stops';
import { MINUTES, minutesFor } from '@/lib/study-plan';
import { learnKey, learnPath } from './beginner-courses';
import { sdParts, sdPath, totalMinutes } from './system-design-course';

const problemKeys = (ids: string[]) => ids.map((id) => `problem:${id}`);
/** Minutes per multiple-choice question. */
export const MCQ_MINUTES = 1.5;
const STAGE_MINUTES = { 基础: MINUTES.easy, 核心: MINUTES.medium, 进阶: MINUTES.hard };
const coreDifficulty = new Map(coreSkills.problems.map((p) => [p.id, p.difficulty]));
/** An SQL track group, or one of its pandas-only groups (pd-1xx ids, which the pd- mapping keeps). */
const sqlGroup = (key: string) => [...sqlTrack.groups, ...sqlTrack.pandasGroups].find((group) => group.key === key);

/** One step with its title, link and keys; throws on a ref that does not exist (tests/role-paths.test.ts). */
export function resolveStep(step: RoleStep, zh: boolean): ResolvedStep {
  const pick = (cn: string, en: string) => (zh ? cn : en);
  const title = (name: string) => stepTitle(step.kind, name, zh);
  const missing = () => new Error(`role path: no ${step.kind} "${step.ref}"`);
  switch (step.kind) {
    case 'line-stops': {
      const slugs = step.ref.split(',');
      if (!slugs.every((slug) => Object.hasOwn(STOP_NAMES, slug))) throw missing();
      const entries = curatedEntries.filter((e) => slugs.includes(e.sectionSlug));
      const ids = entries.map((e) => `lc-${e.number}`);
      return {
        ...step,
        minutes: entries.reduce((n, e) => n + STAGE_MINUTES[e.stage], 0),
        // One stop (a learner's route) goes by its name.
        title: title(slugs.length > 1 ? stopsName(slugs.length, ids.length, zh) : STOP_NAMES[slugs[0]][zh ? 0 : 1]),
        href: stopHref(slugs[0])!,
        keys: problemKeys(ids),
        stops: slugs.map((slug) => ({ slug, name: STOP_NAMES[slug][zh ? 0 : 1], href: stopHref(slug)! })),
        plan: `/?${new URLSearchParams({ view: 'problems', [PLAN_TOPICS_PARAM]: step.ref })}`,
      };
    }
    case 'sd-part': {
      const part = sdParts.find((p) => p.from === step.ref);
      if (!part) throw missing();
      return {
        ...step,
        // The course's part names carry their own "System design:" and "(optional)"; the step has a label and its own Optional tag.
        title: title(pick(part.zh, part.en).replace(/^(系统设计：|System design: )|(（选读）| \(optional\))$/g, '')),
        href: sdPath(part.from),
        keys: part.chapters.map((chapter) => `sd:${chapter.slug}`),
        minutes: totalMinutes(part.chapters, zh),
      };
    }
    case 'sql-track':
    case 'pandas': {
      const group = sqlGroup(step.ref);
      if (!group) throw missing();
      const pandas = step.kind === 'pandas';
      return {
        ...step,
        title: title(pick(group.zh, group.en)),
        // The track's SQL / Pandas switch remembers the language in this browser.
        href: '/?view=problems&library=sql',
        keys: problemKeys(pandas ? group.ids.map((id) => id.replace(/^sql-/, 'pd-')) : group.ids),
        minutes: group.ids.length * MINUTES.medium,
      };
    }
    case 'core-group': {
      const group = coreSkills.groups.find((g) => g.key === step.ref);
      if (!group) throw missing();
      return {
        ...step,
        title: title(pick(group.zh, group.en)),
        href: `/core-skills#core-group-${group.key}`,
        keys: problemKeys(group.ids),
        minutes: group.ids.reduce((n, id) => n + minutesFor(coreDifficulty.get(id)), 0),
      };
    }
    case 'ml-group': {
      const group = mlCoding.groups.find((g) => g.key === step.ref);
      if (!group) throw missing();
      return {
        ...step,
        title: title(pick(group.zh, group.en)),
        // The track's group heading (components/sql-track.tsx ProblemTrack, library "ml").
        href: `/?view=problems&library=ml#ml-group-${group.key}`,
        keys: problemKeys(group.ids),
        minutes: group.ids.length * MINUTES.medium,
      };
    }
    case 'mcq-topic': {
      const ids = mcqBank.questions.filter((q) => q.topic === step.ref).map((q) => `mcq:${q.id}`);
      if (!ids.length) throw missing();
      return { ...step, title: '', href: `/oa/mcq?topic=${step.ref}`, keys: ids, minutes: Math.round(ids.length * MCQ_MINUTES) };
    }
    case 'project': {
      const project = projectFile.projects.find((p) => p.slug === step.ref);
      if (!project) throw missing();
      return {
        ...step,
        title: title(pick(project.titleZh, project.titleEn)),
        href: `/projects/${project.slug}`,
        keys: [`content:project/${project.slug}`],
        minutes: project.hours * 60,
      };
    }
    case 'course': {
      const course = courseFile.courses.find((c) => c.slug === step.ref);
      if (!course) throw missing();
      return {
        ...step,
        title: pick(course.titleZh, course.titleEn),
        href: learnPath(course.slug),
        keys: course.chapters.map((chapter) => `sd:${learnKey(course.slug, chapter.slug)}`),
        minutes: totalMinutes(course.chapters, zh),
      };
    }
  }
}

// Resume projects, beginner courses and the system design course are taken down
// (app/projects, app/learn, app/system-design): their steps leave the paths.
const RETIRED_KINDS = new Set<StepKind>(['project', 'course', 'sd-part']);
export const resolveRolePath = (role: RoleKey, zh: boolean) =>
  ROLES[role].steps.filter((step) => !RETIRED_KINDS.has(step.kind)).map((step) => resolveStep(step, zh));

// The SQL groups with a pandas twin for every problem (content/sql-track/pandas-packages.json; tests/role-paths.test.ts).
const PANDAS_TWINS = ['basics', 'joins', 'grouping', 'subqueries', 'windows', 'strings', 'dates'];
/** Every ref a learner can put on a route, by kind: each Line 500 stop on its own, and every group and part. */
const SINGLE_REFS: Record<StepKind, () => string[]> = {
  'line-stops': () => ROUTE_SLUGS,
  'sd-part': () => sdParts.map((p) => p.from),
  'sql-track': () => sqlTrack.groups.map((g) => g.key),
  pandas: () => [...PANDAS_TWINS, ...sqlTrack.pandasGroups.map((g) => g.key)],
  'core-group': () => coreSkills.groups.map((g) => g.key),
  'ml-group': () => mlCoding.groups.map((g) => g.key),
  'mcq-topic': () => [...new Set(mcqBank.questions.map((q) => q.topic))],
  project: () => projectFile.projects.map((p) => p.slug),
  course: () => courseFile.courses.map((c) => c.slug),
};
/**
 * `kind:ref` -> the resolved step, for learner-made routes (/roadmap?route=): the six roles' steps
 * (their multi-stop Line 500 steps included) and every single ref. Never optional: a route says so itself.
 */
export function routeCatalog(zh: boolean) {
  const catalog: Record<string, ResolvedStep> = {};
  const add = ({ kind, ref }: RoleStep) => (catalog[`${kind}:${ref}`] = resolveStep({ kind, ref }, zh));
  for (const role of ROLE_KEYS) ROLES[role].steps.forEach(add);
  for (const [kind, refs] of Object.entries(SINGLE_REFS)) for (const ref of refs()) add({ kind: kind as StepKind, ref });
  return catalog;
}
