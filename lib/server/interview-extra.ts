import bank from '@/lib/content/interview-extra-questions.json';
import type { KindId, Text } from '@/lib/mock-interview';
import type { PoolRow } from './mock-interview';
import { sdChapter } from './system-design-course';

/*
 * The AI interviewer's project, API and frontend questions (lib/content/interview-extra-questions.json).
 * The project deep dive is one fixed prompt over the candidate's own resume; an API question is the
 * case of an API design course chapter, which is its reference answer; the frontend ones carry their
 * own. Only the question leaves the server (lib/server/mock-interview.ts); lib/server/ai-interviewer.ts
 * reads the rest.
 */
type Extra = {
  id: string;
  kind: 'project' | 'api' | 'frontend';
  /** One of KINDS[kind].categories: the frontend round draws a fundamentals and a component question. */
  category: string;
  title: Text;
  question: Text;
  hints: string;
  followUps: string;
  rubric: string;
  solution: string;
  /** An API question's course chapter: its reference answer. */
  chapter?: string;
};
// Via unknown: the JSON infers string[] where Extra has [zh, en] pairs and literal kinds.
const EXTRAS = (bank as unknown as { questions: Extra[] }).questions;

/** An extra question by id, with its interviewer-only parts; null for any other id. */
export function extraQuestion(id: string) {
  const q = EXTRAS.find((x) => x.id === id);
  if (!q) return null;
  return {
    id: q.id,
    kind: q.kind as KindId,
    category: q.category,
    title: q.title[1],
    titleZh: q.title[0],
    question: q.question[1],
    questionZh: q.question[0],
    hints: q.hints,
    followUps: q.followUps,
    rubric: q.rubric,
    // Diagrams repeat the prose; dropped as for an LLD chapter so the deep dives fit the cap.
    solution: q.chapter ? (sdChapter(q.chapter)?.bodyEn ?? '').replace(/^```mermaid\n[\s\S]*?^```\n?/gm, '') : q.solution,
  };
}

/** A kind's extra questions as pool rows; none for the library's own kinds. */
export const extraPool = (kind: KindId): PoolRow[] =>
  EXTRAS.filter((x) => x.kind === kind).map((x) => ({
    id: x.id, type: 'extra', slug: x.id, title: x.title[1], company: null, companyName: null, role: null,
    category: x.category, round: null, difficulty: null, listed: false, problem: null,
  }));
