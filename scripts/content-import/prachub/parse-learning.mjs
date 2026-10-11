// PracHub learning -> parsed/courses.jsonl + parsed/lessons.jsonl (authorized import, public pages only).
// Courses: the course page's RSC `initialCourse` (sections = chapters, pages = lessons; section.is_free marks
// the free ones, the rest are "Premium section"). Lessons (raw slug <course>__<lesson>) are emitted only when
// free: locked per course data or per the lesson payload's flags -> counted, never emitted.
// Lesson pages had no sample when this was written: findLesson/quizzesOf/takeawaysOf guess field names.
//   /opt/homebrew/bin/node scripts/content-import/prachub/parse-learning.mjs
import { listRaw, sourceUrl } from './common.mjs';
import {
  rscProps,
  isLocked,
  markdownOf,
  scrub,
  shape,
  run,
  save,
  isMain,
  linksIn,
  uniqRelations,
  iso,
} from './parse-experiences.mjs';

const TYPE = 'learning';
const byOrder = (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0);
const bullets = (xs) => xs.map((x) => `- ${x}`).join('\n');
const lessonsOf = new Map(); // `<course>__<lesson>` -> { slug, title, minutes, free, course, courseTitle, order, chapter }

function parseCourse(slug, html) {
  const props = rscProps(html);
  const c = props.find((p) => p.initialCourse)?.initialCourse;
  if (!c)
    throw Object.assign(new Error('no initialCourse in RSC payload'), {
      detail: shape(props),
    });
  let order = 0;
  const chapters = [...(c.sections ?? [])].sort(byOrder).map((s) => ({
    title: s.title ?? null,
    summary: s.description ?? null,
    free: s.is_free === true,
    lessons: [...(s.pages ?? [])].sort(byOrder).map((p) => {
      const lesson = {
        slug: `${slug}__${p.slug}`,
        title: p.title ?? null,
        minutes: p.duration_minutes ?? null,
        free: (p.is_free ?? s.is_free) === true,
      };
      lessonsOf.set(lesson.slug, {
        ...lesson,
        course: slug,
        courseTitle: c.title ?? null,
        order: ++order,
        chapter: s.title ?? null,
      });
      return lesson;
    }),
  }));
  const lessons = chapters.flatMap((ch) => ch.lessons);
  return {
    id: `co-${slug}`,
    type: 'course',
    slug,
    title: c.title ?? null,
    summary: c.description ?? null,
    // The public course page text, under the page's own headings.
    body: scrub(
      [
        c.description,
        c.learning_outcomes?.length &&
          `## What you will be able to do\n\n${bullets(c.learning_outcomes)}`,
        c.recommended_for &&
          `## Who this course is for\n\n${c.recommended_for}`,
        c.prerequisites?.length &&
          `## Helpful to know first\n\n${bullets(c.prerequisites)}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    ),
    company: null,
    role: null,
    category: c.catalog_group ?? null,
    round: null,
    seniority: null,
    difficulty: null,
    tags: c.focus_areas ?? [],
    publishedAt: iso(c.created_at),
    updatedAt: iso(c.updated_at),
    relations: lessons
      .filter((l) => l.free)
      .map((l) => ({
        kind: 'lesson',
        slug: l.slug,
        title: l.title ?? undefined,
      })),
    extra: {
      level: c.difficulty_level ?? null,
      duration: c.estimated_duration ?? null,
      lessonCount: lessons.length,
      freeLessonCount: lessons.filter((l) => l.free).length,
      chapters,
    },
    sourceUrl: sourceUrl(TYPE, slug),
    partial: chapters.some((ch) => !ch.free),
  };
}

// The lesson record: objects carrying this lesson's slug (the sidebar curriculum repeats it without content)
// plus every non-course `initial*` prop; the one with the longest markdown body wins.
function findLesson(props, lessonSlug) {
  const hits = [];
  const visit = (o) => {
    if (Array.isArray(o)) o.forEach(visit);
    else if (o && typeof o === 'object') {
      if (o.slug === lessonSlug) hits.push(o);
      Object.values(o).forEach(visit);
    }
  };
  visit(props);
  for (const p of props) {
    for (const [k, v] of Object.entries(p))
      if (
        k.startsWith('initial') &&
        k !== 'initialCourse' &&
        v &&
        typeof v === 'object' &&
        !Array.isArray(v)
      )
        hits.push(v);
  }
  return (
    hits.sort((a, b) => markdownOf(b).length - markdownOf(a).length)[0] ?? null
  );
}

// Knowledge-check MCQs: any array of {question|prompt|stem, options|choices}. answer = 0-based option index
// when it can be resolved, else the raw value.
const isQuestion = (q) =>
  !!q &&
  typeof q === 'object' &&
  typeof (q.question ?? q.prompt ?? q.stem) === 'string' &&
  Array.isArray(q.options ?? q.choices);
function quizzesOf(root) {
  const out = [];
  const visit = (o) => {
    if (Array.isArray(o)) {
      if (o.length && o.every(isQuestion)) out.push(...o.map(quiz));
      else o.forEach(visit);
    } else if (o && typeof o === 'object') Object.values(o).forEach(visit);
  };
  visit(root);
  return out;
}
function quiz(q) {
  const raw = q.options ?? q.choices;
  const options = raw.map((x) =>
    typeof x === 'string' ? x : (x?.text ?? x?.label ?? x?.content ?? null),
  );
  let answer =
    q.answer ??
    q.correct_answer ??
    q.correctAnswer ??
    q.correct_index ??
    q.correctIndex ??
    q.correct_option ??
    null;
  const flagged = raw.findIndex(
    (x) =>
      x?.is_correct === true || x?.isCorrect === true || x?.correct === true,
  );
  if (answer == null && flagged >= 0) answer = flagged;
  if (typeof answer === 'string' && options.includes(answer))
    answer = options.indexOf(answer);
  return {
    question: q.question ?? q.prompt ?? q.stem,
    options,
    answer,
    explanation: q.explanation ?? q.rationale ?? null,
  };
}

// "Key takeaways": a dedicated payload field when there is one, else the bullets under that heading in the body.
function takeawaysOf(page, body) {
  const v = Object.entries(page).find(([k]) => /takeaway/i.test(k))?.[1];
  if (Array.isArray(v))
    return v
      .map((x) => (typeof x === 'string' ? x : (x?.text ?? x?.content ?? null)))
      .filter(Boolean);
  const md =
    typeof v === 'string'
      ? v
      : (/^(?:#{1,6}\s*|\*\*)key takeaways?\b.*$([\s\S]*?)(?=^#{1,6}\s|(?![\s\S]))/im.exec(
          body,
        )?.[1] ?? '');
  return [...md.matchAll(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/gm)].map((m) =>
    m[1].trim(),
  );
}

const LOCK_UI = /Premium (?:section|lesson)|Unlock (?:this|the full) lesson/i;

function parseLesson(slug, html) {
  const [course, lessonSlug] = slug.split('__');
  const info = lessonsOf.get(slug);
  if (info && !info.free) return 'locked';
  const props = rscProps(html);
  const page = findLesson(props, lessonSlug);
  if (isLocked(page)) return 'locked';
  const body = scrub(markdownOf(page));
  if (!body) {
    if (LOCK_UI.test(html.replace(/<script[\s\S]*?<\/script>/g, '')))
      return 'locked';
    throw Object.assign(
      new Error(
        page
          ? 'lesson record has no markdown body'
          : 'no lesson record in RSC payload',
      ),
      { detail: shape(props) },
    );
  }
  const objectives = Object.entries(page).find(([k]) =>
    /objective/i.test(k),
  )?.[1];
  const quizzes = quizzesOf(page);
  return {
    id: `ls-${slug}`,
    type: 'lesson',
    slug,
    title: page.title ?? info?.title ?? null,
    summary: scrub(page.summary ?? page.description) || null,
    body,
    company: null,
    role: null,
    category: null,
    round: null,
    seniority: null,
    difficulty: null,
    tags: [],
    publishedAt: iso(page.created_at),
    updatedAt: iso(page.updated_at),
    relations: uniqRelations([
      { kind: 'course', slug: course, title: info?.courseTitle ?? undefined },
      ...linksIn(body),
    ]),
    extra: {
      course,
      order: info?.order ?? null,
      chapter: info?.chapter ?? null,
      minutes: info?.minutes ?? page.duration_minutes ?? null,
      ...(Array.isArray(objectives) && { objectives }),
      quizzes: quizzes.length
        ? quizzes
        : quizzesOf(props.map(({ initialCourse: _course, ...rest }) => rest)),
      takeaways: takeawaysOf(page, body),
    },
    sourceUrl: sourceUrl(TYPE, slug),
    partial: false,
  };
}

if (isMain(import.meta.url)) {
  const slugs = listRaw(TYPE);
  const courses = run(
    'courses',
    TYPE,
    parseCourse,
    slugs.filter((s) => !s.includes('__')),
  );
  const lessons = run(
    'lessons',
    TYPE,
    parseLesson,
    slugs.filter((s) => s.includes('__')),
  );
  // Course -> lesson relations only point at lessons that were actually emitted.
  const emitted = new Set(lessons.items.map((l) => l.slug));
  for (const c of courses.items)
    c.relations = c.relations.filter((r) => emitted.has(r.slug));
  const listed = [...lessonsOf.values()];
  const crawled = new Set(slugs);
  lessons.stats.lockedInCourses = listed.filter((l) => !l.free).length; // premium lessons named in curricula
  lessons.stats.freeNotCrawled = listed.filter(
    (l) => l.free && !crawled.has(l.slug),
  ).length;
  save('courses', courses);
  save('lessons', lessons);
}
