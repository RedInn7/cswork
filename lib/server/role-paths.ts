import courseFile from '@/lib/content/beginner-courses.json';
import coreSkills from '@/lib/content/core-skills.json';
import frontendJs from '@/lib/content/frontend-js.json';
import mcqBank from '@/lib/content/oa-mcq.json';
import mlCoding from '@/lib/content/ml-coding.json';
import projectFile from '@/lib/content/resume-projects.json';
import { ROLES, stepTitle, stopsName, type ResolvedStep, type RoleKey, type RoleStep } from '@/lib/content/role-paths';
import sqlTrack from '@/lib/content/sql-track.json';
import { PLAN_TOPICS_PARAM } from '@/lib/jd-skills';
import { curatedEntries } from '@/lib/ling-curated';
import { AI_TEMPLATES, TEMPLATES } from '@/lib/mock-interview';
import { STOP_NAMES, stopHref } from '@/lib/route-stops';
import { learnKey, learnPath } from './beginner-courses';
import { sdParts, sdPath } from './system-design-course';

const problemKeys = (ids: string[]) => ids.map((id) => `problem:${id}`);
/** An SQL track group, or one of its pandas-only groups (pd-1xx ids, which the pd- mapping keeps). */
const sqlGroup = (key: string) => [...sqlTrack.groups, ...sqlTrack.pandasGroups].find((group) => group.key === key);

/** One step with its title, link and keys; throws on a ref that does not exist (tests/role-paths.test.ts). */
export function resolveStep(step: RoleStep, zh: boolean, ai: boolean): ResolvedStep {
  const pick = (cn: string, en: string) => (zh ? cn : en);
  const title = (name: string) => stepTitle(step.kind, name, zh);
  const missing = () => new Error(`role path: no ${step.kind} "${step.ref}"`);
  switch (step.kind) {
    case 'line-stops': {
      const slugs = step.ref.split(',');
      if (!slugs.every((slug) => Object.hasOwn(STOP_NAMES, slug))) throw missing();
      const ids = curatedEntries.filter((e) => slugs.includes(e.sectionSlug)).map((e) => `lc-${e.number}`);
      return {
        ...step,
        title: title(stopsName(slugs.length, ids.length, zh)),
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
      };
    }
    case 'mcq-topic': {
      const ids = mcqBank.questions.filter((q) => q.topic === step.ref).map((q) => `mcq:${q.id}`);
      if (!ids.length) throw missing();
      return { ...step, title: '', href: `/oa/mcq?topic=${step.ref}`, keys: ids };
    }
    case 'project': {
      const project = projectFile.projects.find((p) => p.slug === step.ref);
      if (!project) throw missing();
      return {
        ...step,
        title: title(pick(project.titleZh, project.titleEn)),
        href: `/projects/${project.slug}`,
        keys: [`content:project/${project.slug}`],
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
      };
    }
    case 'fe-js': {
      const group = frontendJs.groups.find((g) => g.key === step.ref);
      if (!group) throw missing();
      return {
        ...step,
        title: title(pick(group.zh, group.en)),
        href: `/frontend#fejs-group-${group.key}`,
        // components/js-workspace.tsx marks a problem done after a full pass (lib/js-runner.ts markTarget).
        keys: frontendJs.problems.filter((p) => p.group === group.key).map((p) => `content:fe-js/${p.slug}`),
      };
    }
    case 'mock-kind': {
      const aiOnly = AI_TEMPLATES.find((t) => t.id === step.ref);
      const template = aiOnly ?? TEMPLATES.find((t) => t.id === step.ref);
      if (!template) throw missing();
      return {
        ...step,
        title: title(template.name[zh ? 0 : 1]),
        href: `/?view=mock-interview&template=${template.id}`,
        keys: [],
        ...(aiOnly && !ai ? { unavailable: true as const } : {}),
      };
    }
  }
}

export const resolveRolePath = (role: RoleKey, zh: boolean, ai: boolean) =>
  ROLES[role].steps.map((step) => resolveStep(step, zh, ai));
