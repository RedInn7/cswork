import { z } from 'zod';
import type { Person } from './auth';
import { aiEnabled, runAi, SYSTEM, tidyReply } from './ai-tutor';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';

/**
 * The AI resume review on /career/resume (components/resume-review.tsx). The learner pastes
 * resume text (no uploads); the server sends it with the target role and job description to
 * the model and returns structured feedback. Nothing of it is stored or logged: ai_usage keeps
 * the daily count (kind 'resume', AI_DAILY_LIMITS.resume a day) and token totals, as for the
 * AI tutor whose quota, site budget and model call this reuses.
 */
export const RESUME_CHARS = 12_000;
export const RESUME_MIN = 80;
const ROLE_CHARS = 120;
export const JOB_CHARS = 4000;
const input = z
  .object({
    resume: z.string().max(RESUME_CHARS * 2),
    role: z.string().max(ROLE_CHARS * 2).default(''),
    job: z.string().max(JOB_CHARS * 2).default(''),
    locale: z.enum(['zh', 'en']).default('en'),
  })
  .strict();

const string = { type: 'string' };
const list = { type: 'array', items: string };
const SCHEMA = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      summary: string,
      impact: list,
      verbs: list,
      keywords: {
        type: 'object',
        properties: { missing: list, present: list },
        required: ['missing', 'present'],
        additionalProperties: false,
      },
      rewrites: {
        type: 'array',
        items: {
          type: 'object',
          properties: { before: string, after: string, why: string },
          required: ['before', 'after', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'impact', 'verbs', 'keywords', 'rewrites'],
    additionalProperties: false,
  },
};
export type ResumeReview = {
  summary: string;
  impact: string[];
  verbs: string[];
  keywords: { missing: string[]; present: string[] };
  rewrites: { before: string; after: string; why: string }[];
};

const RESUME_TAGS = ['resume', 'target_role', 'job_description'];
/**
 * Our prompt's own tags inside pasted text would let it close a block early: `tags` are every
 * tag the caller's prompt wraps pasted text in (code constants, word characters only). Stripped
 * until none is left, so a nested `<</answer>/answer>` cannot rebuild one.
 */
export function untagged(text: string, tags: readonly string[] = RESUME_TAGS) {
  const tag = new RegExp(`<\\/?\\s*(?:${tags.join('|')})\\b[^>]*>`, 'gi');
  // ponytail: a pass per nesting level, quadratic at worst; callers cap pasted text first (24k chars: ~30 ms).
  let last;
  do {
    last = text;
    text = text.replace(tag, '');
  } while (text !== last);
  return text;
}
/** One plain line: no links, images or code (tidyReply), no line breaks, at most `max` characters. */
export const line = (value: unknown, max: number) =>
  typeof value === 'string' ? tidyReply(value, 'resume').replace(/\s+/g, ' ').trim().slice(0, max) : '';
/** Up to `n` non-empty lines (see line) from a JSON array; anything else is none. */
export const lines = (value: unknown, n: number, max: number) =>
  (Array.isArray(value) ? value : []).map((v) => line(v, max)).filter(Boolean).slice(0, n);

/** The model's JSON as a review, every field cleaned and capped; null when it is not one. */
export function parseReview(raw: string): ResumeReview | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const keywords = (data.keywords ?? {}) as Record<string, unknown>;
  const review: ResumeReview = {
    summary: line(data.summary, 500),
    impact: lines(data.impact, 5, 300),
    verbs: lines(data.verbs, 5, 200),
    keywords: {
      missing: [...new Set(lines(keywords.missing, 12, 40))],
      present: [...new Set(lines(keywords.present, 12, 40))],
    },
    rewrites: (Array.isArray(data.rewrites) ? data.rewrites : [])
      .map((r) => {
        const { before, after, why } = (r ?? {}) as Record<string, unknown>;
        return { before: line(before, 400), after: line(after, 400), why: line(why, 240) };
      })
      .filter((r) => r.before && r.after)
      .slice(0, 5),
  };
  return review.summary || review.rewrites.length || review.impact.length ? review : null;
}

/** POST oj/ai/resume: structured feedback on pasted resume text, nothing stored. */
export async function handleAiResume(request: Request, p: Person) {
  if (!aiEnabled() || request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'ai-tutor', 6);
  const data = input.parse(await readJson(request, (RESUME_CHARS + JOB_CHARS + ROLE_CHARS) * 8));
  const resume = untagged(data.resume.trim());
  if (resume.length < RESUME_MIN) throw new HttpError(400, '请粘贴完整的简历文字（至少 80 个字符）');
  if (resume.length > RESUME_CHARS) throw new HttpError(413, '简历过长，最多读取 12000 个字符');
  const role = untagged(data.role.trim()).slice(0, ROLE_CHARS);
  const job = untagged(data.job.trim()).slice(0, JOB_CHARS);
  const language = data.locale === 'zh' ? 'Simplified Chinese' : 'English';
  const user = `<resume>
${resume}
</resume>
<target_role>${role || '(not given: assume an entry-level or intern software engineer role)'}</target_role>
${job ? `<job_description>\n${job}\n</job_description>\n` : ''}
Review this resume for the target role. Write "summary", "impact", "verbs" and "why" in ${language}; quote "before" exactly as the resume has it and write "after" in the resume's own language.`;
  const reply = await runAi(
    request,
    p,
    'resume',
    user,
    SYSTEM.resume,
    (raw) => {
      const review = parseReview(raw);
      // Unparseable or cut off by max_tokens: a failed call, still spent.
      if (!review) throw new HttpError(503, 'AI 助教暂时不可用，请稍后再试');
      return { review };
    },
    SCHEMA,
  );
  return json(reply);
}
