/**
 * Skill certification exams (/certify): a timed set the server draws and scores. Pure and shared
 * by the API (lib/server/skill-tests.ts) and the page (components/skill-test.tsx). In the
 * workspace a running exam is a mock OA session (lib/mock-oa.ts) carrying `cert`.
 */
import { questionFraction, type QuestionResult, type Slot } from './mock-oa';

export type SkillTestId = 'problem-solving-basic' | 'problem-solving-intermediate' | 'sql' | 'python';
export type SkillTest = {
  id: SkillTestId;
  zh: string;
  en: string;
  /** What is drawn, shown with the rules. */
  poolZh: string;
  poolEn: string;
  minutes: number;
  /** One question per slot, in this order. */
  slots: readonly Slot[];
  /** Only submissions in this language count; null for any. */
  language: 'python' | null;
  /** Line 500 problems with a contest rating in [min, max); none for the SQL track. */
  band?: readonly [number, number];
};

export const SKILL_TESTS: readonly SkillTest[] = [
  {
    id: 'problem-solving-basic',
    zh: '算法基础认证',
    en: 'Problem Solving (Basic)',
    poolZh: 'Line 500 题单中周赛难度分低于 1600 的题',
    poolEn: 'Line 500 problems rated below 1600 in LeetCode contests',
    minutes: 60,
    slots: ['easy', 'medium'],
    language: null,
    band: [0, 1600],
  },
  {
    id: 'problem-solving-intermediate',
    zh: '算法进阶认证',
    en: 'Problem Solving (Intermediate)',
    poolZh: 'Line 500 题单中周赛难度分 1600–2000 的题',
    poolEn: 'Line 500 problems rated 1600–2000 in LeetCode contests',
    minutes: 75,
    slots: ['medium', 'medium'],
    language: null,
    band: [1600, 2000],
  },
  {
    id: 'sql',
    zh: 'SQL 认证',
    en: 'SQL',
    poolZh: 'SQL 专项练习中的题',
    poolEn: 'Problems from the SQL track',
    minutes: 45,
    slots: ['easy', 'medium', 'medium'],
    language: null,
  },
  {
    id: 'python',
    zh: 'Python 认证',
    en: 'Python',
    poolZh: 'Line 500 题单中周赛难度分低于 1600 的题，只认 Python 提交',
    poolEn: 'Line 500 problems rated below 1600; only Python submissions count',
    minutes: 45,
    slots: ['easy', 'medium'],
    language: 'python',
    band: [0, 1600],
  },
];
export const skillTest = (id: string | undefined) => SKILL_TESTS.find((t) => t.id === id);

/** The same test once per this many days, counted from the last start. */
export const SKILL_COOLDOWN_DAYS = 7;
/** Passing: at least this share overall, and at least PASS_EACH on every question. */
export const PASS_TOTAL = 0.7;
export const PASS_EACH = 0.4;

/** Each question 0–100 by passed tests (AC is 100), summed; passed by the two thresholds above. */
export function skillScore(results: readonly (QuestionResult | null)[]) {
  const per = results.map((r) => Math.floor(questionFraction(r) * 100));
  const score = per.reduce((a, b) => a + b, 0),
    max = per.length * 100;
  const passed = max > 0 && score >= PASS_TOTAL * max && per.every((p) => p >= PASS_EACH * 100);
  return { per, score, max, passed };
}
