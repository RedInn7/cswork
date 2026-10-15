/**
 * The AI interviewer mode of a mock interview (`?view=mock-interview&as=ai`): the turn limits,
 * what the interviewer says before the first call, and the end-of-interview report as the
 * feedback the page already renders (lib/mock-interview-feedback.ts). Pure, so the page and
 * the server (lib/server/ai-interviewer.ts) share the limits. Texts are [zh, en].
 */
import type { KindId, Text } from './mock-interview';
import { RUBRIC, VERDICTS, questionTag, type Feedback, type RubricId, type VerdictId } from './mock-interview-feedback';

/** Candidate messages per interview, over all its questions. */
export const AI_TURNS = 40;
/** Characters in one candidate message. */
export const AI_MESSAGE_CHARS = 2000;
/** Step feedback calls per interview (a guided question has five steps). */
export const AI_STEPS = 5;
export type Turn = { role: 'candidate' | 'interviewer'; text: string };
/** The AI's feedback on one guided step: 1–4 on the step's rubric dimensions, one keep and one fix. */
export type StepFeedback = { scores: Partial<Record<RubricId, number | null>>; keep: string; fix: string };

type Opener = 'coding' | 'behavioral' | 'design' | 'lld' | 'other';
const OPENERS: Record<Opener, Text> = {
  coding: [
    '你好，我是今天的面试官。题目在左边，先读一读；输入范围、边界情况有不清楚的都可以先问我。想好思路先讲给我听，再在代码框里写。',
    "Hi, I'll be your interviewer today. The question is on the left; take a moment to read it, and ask me about input sizes or edge cases. Talk me through your approach first, then write it in the code box.",
  ],
  behavioral: [
    '你好，我们来聊这道行为题。先想想要讲哪段经历，然后按情境、任务、你的行动和结果讲给我听。',
    "Hi, let's talk through this behavioral question. Pick the experience you want to use, then walk me through the situation, the task, what you did and the result.",
  ],
  design: [
    '你好，这一轮是系统设计。这里没有白板，请用文字描述：先问清需求和规模，再讲整体架构、数据模型和关键取舍。',
    "Hi, this is the system design round. There's no whiteboard here, so describe your design in text: pin down the requirements and scale first, then the architecture, the data model and the key trade-offs.",
  ],
  lld: [
    '你好，这一轮是面向对象的低层设计。我们一步步来：先问清需求，再讲类、接口，然后在代码框里写核心代码，最后聊扩展。每步讲完点「完成这一步」，我给你这一步的反馈。',
    "Hi, this is a low-level design round. We'll go step by step: clarify the requirements, then the classes and interfaces, then the core code in the code box, then extensions. Finish each step to get my feedback on it.",
  ],
  other: [
    '你好，题目在左边。先说说你的理解和思路，有不清楚的地方随时问我。',
    "Hi, the question is on the left. Start by telling me how you read it and how you'd approach it; ask me anything that's unclear.",
  ],
};
/** Shown before the first message of each question; never sent, so reading costs no turn. */
export const openerFor = (kind: KindId): Text =>
  OPENERS[kind === 'coding' || kind === 'sql' ? 'coding' : kind === 'behavioral' || kind === 'design' || kind === 'lld' ? kind : 'other'];
/** Questions whose code box goes to the interviewer with each message. */
export const writesCode = (kind: KindId) => kind === 'coding' || kind === 'sql' || kind === 'lld';

export const candidateTurns = (chats: readonly (readonly Turn[] | undefined)[]) =>
  chats.reduce((n, chat) => n + (chat?.filter((t) => t.role === 'candidate').length ?? 0), 0);

/** The report the server returns: 1–4 scores, null where the interview showed nothing to score. */
export type AiReport = {
  rubric: Partial<Record<RubricId, number | null>>;
  verdict: VerdictId | null;
  strengths: string;
  improvements: string;
  /** In the set's order. */
  questions: { rating: number | null; note: string }[];
};

/** The report as feedback for this set: rendered by FeedbackCard, saved and shared as a `#fb=` link. */
export function reportFeedback(
  report: AiReport,
  set: { seed: string; rerolls: number[]; itemIds: (string | null)[] },
): Feedback {
  const score = (n: number | null | undefined) => (n && Number.isInteger(n) && n >= 1 && n <= 4 ? n : null);
  const rubric: Feedback['rubric'] = {};
  for (const r of RUBRIC) {
    const n = score(report.rubric[r.id]);
    if (n) rubric[r.id] = n;
  }
  return {
    seed: set.seed,
    rerolls: set.rerolls,
    rubric,
    verdict: VERDICTS.find(([id]) => id === report.verdict)?.[0] ?? null,
    strengths: report.strengths,
    improvements: report.improvements,
    questions: set.itemIds.map((id, i) => ({
      rating: score(report.questions[i]?.rating),
      note: report.questions[i]?.note ?? '',
      tag: id ? questionTag(id) : '',
    })),
    ai: true,
  };
}
