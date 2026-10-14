/**
 * STAR story bank: competencies, the story stored as a user note (target `story:<id>`, JSON body),
 * matching stories to a behavioral question, and the Markdown export. Pure, so the story bank
 * view, the question pages and the mock interview share it.
 */
import { PRINCIPLES, leadershipPrinciples, type Text } from './mock-interview';

export type Competency = { id: string; name: Text; lp?: boolean };
/** Amazon's Leadership Principles; ids are the names lib/mock-interview.ts finds in a question. */
const LP_ZH: Record<string, string> = {
  'Customer Obsession': '顾客至上',
  Ownership: '主人翁精神',
  'Invent and Simplify': '创新简化',
  'Are Right, A Lot': '决策正确',
  'Learn and Be Curious': '好奇求知',
  'Hire and Develop the Best': '选贤育能',
  'Insist on the Highest Standards': '最高标准',
  'Think Big': '远见卓识',
  'Bias for Action': '崇尚行动',
  Frugality: '勤俭节约',
  'Earn Trust': '赢得信任',
  'Dive Deep': '刨根问底',
  'Disagree and Commit': '敢于谏言，服从大局',
  'Deliver Results': '达成业绩',
  "Earth's Best Employer": '最佳雇主',
  'Broad Responsibility': '广泛的责任',
};
/** Themes most behavioral questions at any company come back to, with the words that ask for them. */
const GENERIC: [id: string, name: Text, pattern: RegExp][] = [
  ['conflict', ['冲突与分歧', 'Conflict'], /conflict|disagree|difficult (co-?worker|colleague|teammate|person|stakeholder|manager)|push(ed)? back/i],
  ['failure', ['失败与犯错', 'Failure'], /\bfail|mistake|went wrong|setback|regret/i],
  ['leadership', ['领导力', 'Leadership'], /\blead(ership|ing)?\b|\bled\b|mentor/i],
  ['ambiguity', ['模糊与不确定', 'Ambiguity'], /ambigu|unclear|uncertain|incomplete information/i],
  ['impact', ['影响与成果', 'Impact'], /impact|proud|biggest (achievement|accomplishment)|accomplish/i],
  ['teamwork', ['团队协作', 'Teamwork'], /team ?work|collaborat|cross[- ]functional/i],
  ['communication', ['沟通表达', 'Communication'], /communicat|non-technical|explain(ed)? .* to/i],
  ['influence', ['影响他人', 'Influence'], /influenc|persuad|convinc|without authority/i],
  ['prioritization', ['优先级取舍', 'Prioritization'], /prioriti|competing|trade-?off/i],
  ['pressure', ['压力与截止日期', 'Deadlines & pressure'], /deadline|tight (timeline|schedule)|under pressure/i],
  ['feedback', ['接受反馈', 'Feedback'], /feedback|critici/i],
  ['growth', ['学习成长', 'Learning & growth'], /learn(ed)? (something|a new|quickly)|new (skill|technology)|comfort zone/i],
];
export const COMPETENCIES: Competency[] = [
  ...GENERIC.map(([id, name]) => ({ id, name })),
  ...PRINCIPLES.map(([id]) => ({ id, name: [LP_ZH[id] ?? id, id] as Text, lp: true })),
];
const known = new Set(COMPETENCIES.map((c) => c.id));

/** What a behavioral question asks about: the Leadership Principles it names, then the generic themes. */
export const competenciesFor = (text: string) => [
  ...leadershipPrinciples(text),
  ...GENERIC.filter(([, , pattern]) => pattern.test(text)).map(([id]) => id),
];

/** A question a story is the planned answer to: `key` is `<type>/<slug>` in the content library. */
export type StoryQuestion = { key: string; title: string; company?: string | null };
export type Story = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  competencies: string[];
  questions: StoryQuestion[];
  updatedAt: number | null;
};
export const STAR = ['situation', 'task', 'action', 'result'] as const;
export const STAR_NAMES: Record<(typeof STAR)[number], Text> = {
  situation: ['情境 Situation', 'Situation'],
  task: ['任务 Task', 'Task'],
  action: ['行动 Action', 'Action'],
  result: ['结果 Result', 'Result'],
};
export const storyTarget = (id: string) => `story:${id}`;
export const newStoryId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const blankStory = (): Story => ({
  id: newStoryId(),
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  competencies: [],
  questions: [],
  updatedAt: null,
});

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** A stored note back into a story; null for anything that isn't one (the body is the learner's to break). */
export function parseStory(target: string, body: string, updatedAt: number | null = null): Story | null {
  if (!target.startsWith('story:')) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  return {
    id: target.slice('story:'.length),
    title: str(data.title),
    situation: str(data.situation),
    task: str(data.task),
    action: str(data.action),
    result: str(data.result),
    competencies: Array.isArray(data.competencies) ? data.competencies.filter((c): c is string => typeof c === 'string' && known.has(c)) : [],
    questions: questions.flatMap((q) =>
      q && typeof q.key === 'string' && typeof q.title === 'string'
        ? [{ key: q.key, title: q.title, company: typeof q.company === 'string' ? q.company : null }]
        : [],
    ),
    updatedAt,
  };
}
export const storyBody = ({ id: _id, updatedAt: _at, ...story }: Story) => JSON.stringify(story);

/** Words as people count them: Latin words, and each Chinese character (Intl.Segmenter splits CJK into words). */
export const wordCount = (text: string) =>
  [...new Intl.Segmenter('en', { granularity: 'word' }).segment(text)].filter((s) => s.isWordLike).length;
/** Spoken at about 140 words a minute. */
export const speakingSeconds = (words: number) => Math.round((words / 140) * 60);

/**
 * Stories best suited to a question first: by competencies shared with it, then the story already
 * planned for it, then the most recently edited. `matches` is the shared competencies.
 */
export function rankStories(stories: readonly Story[], wanted: readonly string[], key?: string) {
  return stories
    .map((story) => ({ story, matches: story.competencies.filter((c) => wanted.includes(c)) }))
    .sort(
      (a, b) =>
        b.matches.length - a.matches.length ||
        Number(b.story.questions.some((q) => q.key === key)) - Number(a.story.questions.some((q) => q.key === key)) ||
        (b.story.updatedAt ?? 0) - (a.story.updatedAt ?? 0),
    );
}

/** Plans `story` as the answer to `question`: added to it, taken off every other story. Returns the stories that changed. */
export function assignStory(stories: readonly Story[], storyId: string | null, question: StoryQuestion) {
  const changed: Story[] = [];
  for (const story of stories) {
    const has = story.questions.some((q) => q.key === question.key);
    if (story.id === storyId && !has) changed.push({ ...story, questions: [...story.questions, question] });
    else if (story.id !== storyId && has) changed.push({ ...story, questions: story.questions.filter((q) => q.key !== question.key) });
  }
  return changed;
}

/**
 * The editor's story with its question links as stored now: links made elsewhere since `base` (a question
 * page picking it) are kept, and the ones unlinked in the editor dropped. `stored` null: not saved yet.
 */
export function keepLinks(edited: Story, base: Story, stored: Story | null): Story {
  if (!stored) return edited;
  const unlinked = new Set(base.questions.map((q) => q.key).filter((key) => !edited.questions.some((q) => q.key === key)));
  return { ...edited, questions: stored.questions.filter((q) => !unlinked.has(q.key)) };
}

export const competencyName = (id: string, english: boolean) => {
  const c = COMPETENCIES.find((x) => x.id === id);
  return c ? c.name[english ? 1 : 0] : id;
};

/** The whole bank as one Markdown document, to print or paste into notes before an interview. */
export function storiesMarkdown(stories: readonly Story[], english: boolean) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const parts = [`# ${t('我的 STAR 故事', 'My STAR stories')}`];
  for (const s of stories) {
    parts.push(`## ${s.title.trim() || t('未命名故事', 'Untitled story')}`);
    if (s.competencies.length)
      parts.push(`**${t('能力项', 'Competencies')}:** ${s.competencies.map((c) => competencyName(c, english)).join(', ')}`);
    if (s.questions.length)
      parts.push(
        `**${t('用来回答', 'Answers')}:**\n` +
          s.questions.map((q) => `- ${q.title}${q.company ? ` (${q.company})` : ''}`).join('\n'),
      );
    for (const field of STAR) {
      const text = s[field].trim();
      if (text) parts.push(`### ${STAR_NAMES[field][english ? 1 : 0]}\n\n${text}`);
    }
  }
  return parts.join('\n\n') + '\n';
}
