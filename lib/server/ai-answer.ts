import { z } from 'zod';
import { splitBody } from '@/lib/mock-interview';
import { speakingSeconds, STAR, wordCount } from '@/lib/story-bank';
import type { Person } from './auth';
import { line, lines, untagged } from './ai-resume';
import { aiEnabled, runAi, SYSTEM, tidyReply } from './ai-tutor';
import { library } from './content-library';
import { runningContestProblems } from './contests';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';
import { sdCases, sdChapter } from './system-design-course';

/**
 * "AI feedback on my answer" (components/answer-grade.tsx): a written answer to a library question
 * or a system design case, graded against the page's reference notes, or a STAR story from the
 * story bank, optionally with the behavioral question it answers. The reference goes to the model
 * only; the reply is a score, the points covered and missed and a tighter version. Nothing is
 * stored: ai_usage keeps the daily count (kind 'grade') as for the AI tutor, whose plumbing this is.
 */
export const ANSWER_MIN = 80;
export const ANSWER_CHARS = 6000;
const QUESTION_CHARS = 3000;
const REFERENCE_CHARS = 12_000;
const STORY_QUESTION_CHARS = 300;
const TAGS = ['question', 'reference_notes', 'answer', 'story'];
// A library question, or a system design case (the reader's note target, `/draft` and all).
const TARGET = /^(?:content:(?:interview|coding)_question\/.+|sd:[a-z0-9-]{1,80}(?:\/draft)?)$/;
const locale = z.enum(['zh', 'en']).default('en');
// No max: readJson caps the body, and past ANSWER_CHARS is a 413 that names the limit (sized).
const field = z.string();
const input = z.union([
  z.object({ target: z.string().max(400).regex(TARGET), answer: field, locale }).strict(),
  z
    .object({
      story: z
        .object({ title: z.string().max(200).default(''), situation: field, task: field, action: field, result: field })
        .strict(),
      question: z.string().max(STORY_QUESTION_CHARS).default(''),
      locale,
    })
    .strict(),
]);

const string = { type: 'string' };
const list = { type: 'array', items: string };
const schema = (properties: Record<string, object>) => ({
  type: 'json_schema',
  schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
});
// Structured outputs take enum but not minimum/maximum; parseFeedback checks the range again.
const BASE = { score: { type: 'integer', enum: [1, 2, 3, 4] }, covered: list, missing: list, tighter: string };
const ANSWER_SCHEMA = schema(BASE);
const STORY_SCHEMA = schema({ ...BASE, specificity: string, measurableResult: string, iVsWe: string });

export type AnswerFeedback = {
  score: number;
  covered: string[];
  missing: string[];
  tighter: string;
  // A STAR story only.
  specificity?: string;
  measurableResult?: string;
  iVsWe?: string;
  fitsTwoMinutes?: boolean;
};

/** The model's JSON as feedback, every field cleaned and capped; null when it is not one. */
export function parseFeedback(raw: string, star: boolean): AnswerFeedback | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !Number.isInteger(data.score)) return null;
  const score = data.score as number;
  if (score < 1 || score > 4) return null;
  const feedback: AnswerFeedback = {
    score,
    covered: lines(data.covered, 5, 200),
    missing: lines(data.missing, 5, 200),
    // Line breaks kept (a short answer may be a list); links, images and code go (tidyReply).
    tighter: typeof data.tighter === 'string' ? tidyReply(data.tighter, 'grade').trim() : '',
  };
  return star
    ? {
        ...feedback,
        specificity: line(data.specificity, 300),
        measurableResult: line(data.measurableResult, 300),
        iVsWe: line(data.iVsWe, 300),
      }
    : feedback;
}

/** The question and its reference notes for a target, or the HttpError that stops the call. */
export function gradeSource(target: string, zh: boolean) {
  const sd = /^sd:([a-z0-9-]+)(?:\/draft)?$/.exec(target);
  if (sd) {
    const chapter = sdCases.has(sd[1]) ? sdChapter(sd[1]) : undefined;
    if (!chapter) throw new HttpError(404, '内容不存在');
    // "Case 1: URL Shortener" → "URL Shortener"; "Case 4: Design a Chat App" asks to design "a Chat App".
    const title = chapter.titleEn.replace(/^[^:]*:\s*/, '');
    return {
      question: `${title}\n\nDesign ${title.replace(/^Design\s+/i, '')} as in a system design interview: requirements, core entities, the API and the high-level architecture, then the deep dives.`,
      reference: (zh && chapter.bodyZh) || chapter.bodyEn,
    };
  }
  const [, type, slug] = /^content:(\w+)\/(.+)$/.exec(target) ?? [];
  const row = library()?.prepare('SELECT title, body FROM items WHERE type=? AND slug=?').get(type, slug) as
    | { title: string; body: string }
    | undefined;
  if (!row) throw new HttpError(404, '内容不存在');
  // The page's own split (components/content-library.tsx): no rubric and no solution, nothing to grade against.
  const { question, rubric, solution } = splitBody(row.body);
  if (!rubric && !solution) throw new HttpError(400, '这道题没有参考答案，不能 AI 点评');
  return { question: `${row.title}\n\n${question}`, reference: [rubric, solution].filter(Boolean).join('\n\n') };
}

/** Checked before untagged, which then reads at most ANSWER_CHARS. */
function sized(text: string) {
  if (text.length < ANSWER_MIN) throw new HttpError(400, '至少写 80 个字符再请求 AI 点评');
  if (text.length > ANSWER_CHARS) throw new HttpError(413, '内容过长，AI 点评最多读取 6000 个字符');
  return text;
}

/** POST oj/ai/grade: feedback on a written answer or a STAR story, nothing stored. */
export async function handleAiGrade(request: Request, p: Person) {
  if (!aiEnabled() || request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'ai-tutor', 6);
  const data = input.parse(await readJson(request, ANSWER_CHARS * 2 * 4 * 5));
  // "tighter" all but writes the answer, and a coding question maps to a judge problem: none
  // while a contest or exam runs for this learner, as for the AI pair.
  if (runningContestProblems(p.id).size) throw new HttpError(403, '比赛或考试进行中，AI 作答点评暂停，结束后开放');
  const language = data.locale === 'zh' ? 'Simplified Chinese' : 'English';
  let user: string;
  let fitsTwoMinutes: boolean | undefined;
  if ('target' in data) {
    const answer = untagged(sized(data.answer.trim()), TAGS);
    const source = gradeSource(data.target, data.locale === 'zh');
    user = `<question>
${untagged(source.question, TAGS).slice(0, QUESTION_CHARS)}
</question>
<reference_notes>
${untagged(source.reference, TAGS).slice(0, REFERENCE_CHARS)}
</reference_notes>
<answer>
${answer}
</answer>

Grade the answer against the question and the reference notes. Write every field in ${language}; write "tighter" in the answer's own language.`;
  } else {
    const { story } = data;
    const told = untagged(sized(STAR.map((f) => story[f].trim()).join('\n')), TAGS);
    // Counted, not judged by the model: about 140 spoken words a minute (lib/story-bank.ts).
    fitsTwoMinutes = speakingSeconds(wordCount(told)) <= 120;
    const question = untagged(data.question.trim(), TAGS);
    user = `<question>${question || '(not given: judge it as an answer to the behavioral question its title suggests)'}</question>
<story>
Title: ${untagged(story.title.trim(), TAGS)}
${STAR.map((f) => `${f[0].toUpperCase()}${f.slice(1)}: ${untagged(story[f].trim(), TAGS)}`).join('\n')}
</story>

Review this STAR story as the answer to the question. Write every field in ${language}; write "tighter" in the story's own language.`;
  }
  const star = fitsTwoMinutes !== undefined;
  const reply = await runAi(
    request,
    p,
    'grade',
    user,
    SYSTEM.grade,
    (raw) => {
      const feedback = parseFeedback(raw, star);
      // Unparseable or cut off by max_tokens: a failed call, still spent.
      if (!feedback) throw new HttpError(503, 'AI 助教暂时不可用，请稍后再试');
      return { feedback: star ? { ...feedback, fitsTwoMinutes } : feedback };
    },
    star ? STORY_SCHEMA : ANSWER_SCHEMA,
  );
  return json(reply);
}
