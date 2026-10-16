import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import coreSkills from '@/lib/content/core-skills.json';
import {
  JD_CHARS,
  JD_MIN,
  JD_ROUNDS,
  JD_SKILL_INFO,
  JD_SKILLS,
  type JdItem,
  type JdReport,
  type JdSkill,
  type Readiness,
} from '@/lib/jd-skills';
import { curatedByNumber, curatedEntries } from '@/lib/ling-curated';
import { ROUTE_SLUGS } from '@/lib/route-stops';
import type { Person } from './auth';
import { line, untagged } from './ai-resume';
import { aiEnabled, runAi, SYSTEM } from './ai-tutor';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';
import { sdParts } from './system-design-course';

/**
 * The JD readiness checklist on /career/jd (components/jd-readiness.tsx). The learner pastes a
 * job description; the model lists the skills it asks for, only from lib/jd-skills.ts, with a
 * quote and must/nice each, and the interview rounds it implies. The server then measures every
 * skill on the learner's own data (ACs, chapters marked read, certificates, STAR stories).
 * Nothing of the posting or the reply is stored: ai_usage keeps the daily count (kind 'jd').
 */
const TAGS = ['job_description'];
const input = z.object({ job: z.string().max(JD_CHARS * 4) }).strict();

const string = { type: 'string' };
const SCHEMA = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            skill: { type: 'string', enum: [...JD_SKILLS] },
            evidence: string,
            importance: { type: 'string', enum: ['must', 'nice'] },
          },
          required: ['skill', 'evidence', 'importance'],
          additionalProperties: false,
        },
      },
      likelyRounds: { type: 'array', items: { type: 'string', enum: [...JD_ROUNDS] } },
    },
    required: ['skills', 'likelyRounds'],
    additionalProperties: false,
  },
};
const PROMPT = `${SYSTEM.jd}
- "skills": each skill from this list that the job description asks for, at most once, the most important first. Use only these ids:
${JD_SKILLS.map((skill) => `  - ${skill}: ${JD_SKILL_INFO[skill].hint}`).join('\n')}
- Map each requirement to the closest id and leave out requirements no id covers, such as a cloud platform or a framework.
- "evidence": the words of the job description that ask for the skill, quoted exactly, at most 100 characters.
- "importance": "must" when the posting requires it (requirements, minimum or basic qualifications), "nice" when it is preferred, a plus or a bonus.
- "likelyRounds": the interview rounds this role probably has. oa for intern and new-grad roles or when the posting names a coding test; phone-coding and behavioral for any software role; system-design only when it asks for distributed systems or several years of experience; take-home only when the posting mentions one.
- If the text is not a job description, return empty lists.`;

type Asked = Pick<JdItem, 'skill' | 'evidence' | 'importance'>;
const isSkill = (value: unknown): value is JdSkill => (JD_SKILLS as readonly unknown[]).includes(value);
const flat = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The model's JSON as skills and rounds: ids off the lists dropped, each skill once, and a quote
 * the posting `job` does not hold blanked (the page shows it in quotation marks); null when it is not one.
 */
export function parseJd(raw: string, job: string): { skills: Asked[]; likelyRounds: JdReport['likelyRounds'] } | null {
  const posting = flat(job);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const list: unknown[] | null = data && typeof data === 'object' && Array.isArray(data.skills) ? data.skills : null;
  if (!list) return null;
  const seen = new Set<JdSkill>();
  const skills = list.flatMap((item): Asked[] => {
    const { skill, evidence, importance } = (item ?? {}) as Record<string, unknown>;
    if (!isSkill(skill) || seen.has(skill)) return [];
    seen.add(skill);
    const quote = line(evidence, 100);
    return [
      { skill, evidence: quote && posting.includes(flat(quote)) ? quote : '', importance: importance === 'must' ? 'must' : 'nice' },
    ];
  });
  const rounds: unknown[] = Array.isArray(data.likelyRounds) ? data.likelyRounds : [];
  // In the order a process runs, whatever order the model wrote.
  return { skills, likelyRounds: JD_ROUNDS.filter((round) => rounds.includes(round)) };
}

/** What measures the skills: problems solved (id → accepted languages), read marks, certificates, stories. */
export type Learner = { solved: Map<string, Set<string>>; read: Set<string>; certs: Set<string>; stories: number };

export function learnerData(userId: string): Learner {
  const db = sqlite();
  const solved = new Map<string, Set<string>>();
  const ac = db
    .prepare("SELECT DISTINCT problem_id AS id,language FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'")
    .all(userId) as { id: string; language: string }[];
  for (const { id, language } of ac) solved.set(id, (solved.get(id) ?? new Set<string>()).add(language));
  const read = new Set<string>();
  const marks = db
    .prepare("SELECT target,mark FROM user_marks WHERE user_id=? AND mark IN ('read','done')")
    .all(userId) as { target: string; mark: string }[];
  for (const { target, mark } of marks) {
    if (mark === 'read') read.add(target);
    // Ticked as solved elsewhere: counts for its stop or track, in none of the judge's languages.
    else if (target.startsWith('problem:')) {
      const id = target.slice('problem:'.length);
      solved.set(id, solved.get(id) ?? new Set<string>());
    }
  }
  return {
    solved,
    read,
    certs: new Set(db.prepare('SELECT course_id FROM certificates WHERE user_id=?').pluck().all(userId) as string[]),
    stories: db.prepare("SELECT COUNT(*) FROM user_notes WHERE user_id=? AND target LIKE 'story:%'").pluck().get(userId) as number,
  };
}

// A stop is covered at STOP_GOAL solved problems; a skill is ready at READY of its measure.
const STOP_GOAL = 3;
const READY = 0.8;
const STOP_TOTALS = curatedEntries.reduce((m, e) => m.set(e.sectionSlug, (m.get(e.sectionSlug) ?? 0) + 1), new Map<string, number>());
const stopOf = (id: string) => curatedByNumber.get(Number(/^lc-(\d+)$/.exec(id)?.[1]))?.sectionSlug;

/** Line 500 stops, in line order, with fewer than STOP_GOAL problems solved (all of a shorter stop). */
export function weakStops(learner: Learner) {
  const solved = new Map<string, number>();
  for (const id of learner.solved.keys()) {
    const stop = stopOf(id);
    if (stop) solved.set(stop, (solved.get(stop) ?? 0) + 1);
  }
  return ROUTE_SLUGS.filter((slug) => (solved.get(slug) ?? 0) < Math.min(STOP_GOAL, STOP_TOTALS.get(slug) ?? 0));
}

/** A skill's progress on the learner's data (lib/jd-skills.ts says what measures it); total 0: nothing does. */
export function skillProgress(skill: JdSkill, learner: Learner, weak = weakStops(learner)) {
  const m = JD_SKILL_INFO[skill];
  let done = 0;
  let total = 0;
  if (m.line) {
    total = ROUTE_SLUGS.length;
    done = total - weak.length;
  } else if (m.parts || m.core) {
    const chapters = sdParts
      .filter((part) => m.parts?.includes(part.from))
      .flatMap((part) => part.chapters.map((chapter) => `sd:${chapter.slug}`));
    const problems = coreSkills.groups.find((group) => group.key === m.core)?.ids ?? [];
    total = chapters.length + problems.length;
    done = chapters.filter((c) => learner.read.has(c)).length + problems.filter((id) => learner.solved.has(id)).length;
  } else if (m.goal) {
    const n = m.stories
      ? learner.stories
      : [...learner.solved].filter(([id, languages]) => (m.prefix ? id.startsWith(m.prefix) : languages.has(m.language!)))
          .length;
    total = m.goal;
    done = Math.min(n, total);
  }
  const certified = !!m.certs?.some((c) => learner.certs.has(c));
  const status: Readiness =
    certified || (total > 0 && done >= total * READY) ? 'ready' : !total ? 'unmeasured' : done > 0 ? 'partial' : 'gap';
  // The certificate sets the status; done stays the learner's real count.
  return { status, done, total, certified };
}

// Line 500 is the study plan's pool: these skills' gaps become its topics.
const PLANNED = new Set<JdSkill>(['dsa', 'oa']);

/** POST oj/ai/jd: a job description's skills measured on the learner's data; nothing stored. */
export async function handleAiJd(request: Request, p: Person) {
  if (!aiEnabled() || request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'ai-tutor', 6);
  // Room for escaped characters; zod refuses past four postings' worth, untagged then reads JD_CHARS.
  const data = input.parse(await readJson(request, JD_CHARS * 4 * 6));
  const job = untagged(data.job.slice(0, JD_CHARS), TAGS).trim();
  if (job.length < JD_MIN) throw new HttpError(400, '请粘贴完整的职位描述（至少 80 个字符）');
  const user = `<job_description>
${job}
</job_description>
List the skills this job description asks for and the interview rounds it implies.`;
  const reply = await runAi(
    request,
    p,
    'jd',
    user,
    PROMPT,
    (raw) => {
      const asked = parseJd(raw, job);
      // Unparseable or cut off by max_tokens: a failed call, still spent.
      if (!asked) throw new HttpError(503, 'AI 助教暂时不可用，请稍后再试');
      return asked;
    },
    SCHEMA,
  );
  const learner = learnerData(p.id);
  const weak = weakStops(learner);
  const skills: JdItem[] = reply.skills.map((s) => ({ ...s, ...skillProgress(s.skill, learner, weak) }));
  const planStops = skills.some((s) => PLANNED.has(s.skill) && s.status !== 'ready') ? weak : [];
  return json({ ...reply, skills, planStops });
}
