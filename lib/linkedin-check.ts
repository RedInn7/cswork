import { extractTerms, JD_TERMS, mentions } from './jd-keywords';
import { METRIC, type ResumeIssue } from './resume-check';

/**
 * A LinkedIn profile checked by rules, no AI (components/resume-extend.tsx): the learner pastes the
 * sections in; nothing is fetched from LinkedIn and nothing leaves the browser (LINKEDIN_KEY in
 * localStorage). Weights add up to 100 (headline 20, about 15, experience 25, skills 20, URL 10,
 * Open to Work 10) and the score is 100 less every issue's impact, like lib/resume-check.ts. With
 * the resume's text, skills are compared against the table terms it mentions (`compared` of them).
 */
export type OpenToWork = '' | 'off' | 'recruiters' | 'public';
export type LinkedIn = { headline: string; about: string; experience: string; skills: string; url: string; openToWork: OpenToWork };
export const LINKEDIN_KEY = 'cswork:linkedin:v1';
/** Input caps: LinkedIn's own (headline 220, about 2,600) with room for the over-length rule to fire. */
export const LINKEDIN_MAX = { headline: 400, about: 3000, experience: 8000, skills: 2000, url: 200 };
export const blankLinkedIn = (): LinkedIn => ({ headline: '', about: '', experience: '', skills: '', url: '', openToWork: '' });

/** A stored profile, cleaned: unknown fields dropped, strings capped. */
export function normalizeLinkedIn(raw: unknown): LinkedIn {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const text = (key: keyof typeof LINKEDIN_MAX) => (typeof r[key] === 'string' ? (r[key] as string).slice(0, LINKEDIN_MAX[key]) : '');
  const open = ['off', 'recruiters', 'public'].includes(r.openToWork as string) ? (r.openToWork as OpenToWork) : '';
  return { headline: text('headline'), about: text('about'), experience: text('experience'), skills: text('skills'), url: text('url'), openToWork: open };
}

/** The first linkedin.com/in/ address in a resume's links line, '' when there is none. */
export const linkedInFrom = (links: string) => /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s,，;|]+/i.exec(links)?.[0] ?? '';

const ROLE = /\b(?:engineer\w*|swe|sde|developer|intern\w*|scientist|analyst)\b|工程师|实习|开发/i;
const GREETING = /^(?:hi\b|hello\b|hey\b|i am an?\b|i'm an?\b|大家好|你好|我是一名)/i;
const PROFILE_URL = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})\/?(?:[?#]\S*)?$/i;
// LinkedIn's default URL ends in a random tail: hex with a digit in it, or a long run of digits.
const RANDOM_TAIL = /-(?=[0-9a-f]*\d)[0-9a-f]{6,}$|\d{5,}$/i;
const TECH = JD_TERMS.filter((t) => t.skill !== 'behavioral' && t.skill !== 'oa');
const techIn = (text: string) => TECH.some((t) => mentions(t.term, text));
const snip = (s: string) => (s.length > 32 ? `${s.slice(0, 32)}…` : s);

export function checkLinkedIn(p: LinkedIn, resumeText: string | null): { score: number; issues: ResumeIssue[]; compared: number } {
  const issues: ResumeIssue[] = [];
  const add = (where: keyof LinkedIn, impact: number, zh: string, en: string) => issues.push({ where, rule: where, zh, en, impact });

  const headline = p.headline.trim();
  if (!headline) add('headline', 20, '标题（Headline）是空的：招聘方搜人时先看到的就是它。', 'Your headline is empty: it is the first thing a recruiter sees in search.');
  else {
    if (!ROLE.test(headline))
      add('headline', 10, '标题里没有岗位词：写上 Software Engineer、SWE Intern 这类招聘方会搜的词。', 'The headline names no role: put in what recruiters search for, like Software Engineer or SWE Intern.');
    if (!techIn(headline)) add('headline', 6, '标题里没有技术词：加上两三个主力技术（例如 Python · AWS · React）。', 'The headline has no technology: add two or three you work in (e.g. Python · AWS · React).');
    if (headline.length > 220) add('headline', 4, `标题有 ${headline.length} 字，超过 LinkedIn 的 220 字上限。`, `The headline is ${headline.length} characters, past LinkedIn’s 220 limit.`);
  }

  const about = p.about.trim();
  if (!about) add('about', 15, '简介（About）是空的：用几句话写你做什么、擅长什么、在找什么。', 'Your About section is empty: say in a few lines what you build, what you are good at and what you are looking for.');
  else {
    if (about.length < 300) add('about', 6, `简介只有 ${about.length} 字：写到 300 字以上，放进项目、技术和数字。`, `About is only ${about.length} characters: write 300 or more, with projects, technologies and numbers.`);
    const first = about.split(/(?<=[.!?。！？])\s*|\n/)[0];
    if (first.length > 200 || GREETING.test(about))
      add('about', 4, '简介第一句太长或是客套话：第一句直接写你是做什么的（只有前两三行会默认展开）。', 'The first sentence is long or a greeting: open with what you do (only the first lines show before “see more”).');
    if (!techIn(about)) add('about', 2, '简介里没有技术词：写上你常用的语言和框架，方便被搜到。', 'About names no technology: mention your main languages and frameworks so searches find you.');
  }

  const roles = p.experience.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (!roles.length) add('experience', 25, '经历（Experience）是空的：把简历上的经历搬过来，每段写一两条带数字的成果。', 'Experience is empty: bring over your resume entries, each with a result or two that has a number.');
  for (const role of roles)
    if (!METRIC.test(role))
      add('experience', 25 / roles.length, `经历「${snip(role.split('\n')[0])}」没有数字：补上规模、提升幅度或用户数。`, `The role “${snip(role.split('\n')[0])}” has no number: add the scale, the gain or the users.`);

  const skills = p.skills.split(/[\n,，;；·|•]+/).map((s) => s.trim()).filter(Boolean);
  if (skills.length < 5) add('skills', 8, `技能只列了 ${skills.length} 项：至少写 5 项，LinkedIn 按技能匹配职位。`, `Only ${skills.length} ${skills.length === 1 ? 'skill' : 'skills'} listed: add at least 5; LinkedIn matches jobs on skills.`);
  const terms = resumeText?.trim() ? extractTerms(resumeText).map((h) => h.term) : [];
  const missing = terms.filter((term) => !mentions(term, `${p.skills}\n${p.headline}`));
  if (missing.length) {
    const list = missing.slice(0, 5).join(', ');
    add('skills', (12 * missing.length) / terms.length, `简历里写了、LinkedIn 技能和标题里没有：${missing.slice(0, 5).join('、')}${missing.length > 5 ? ` 等 ${missing.length} 项` : ''}。`, `On your resume but not in your LinkedIn skills or headline: ${list}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}.`);
  }

  const url = p.url.trim();
  const slug = PROFILE_URL.exec(url)?.[1];
  if (!slug) add('url', 10, '没有填 LinkedIn 主页地址（linkedin.com/in/你的名字）：放到简历上，招聘方一点就到。', 'No profile URL (linkedin.com/in/your-name): put it on your resume so recruiters get there in one click.');
  else if (RANDOM_TAIL.test(slug))
    add('url', 6, `主页地址「${slug}」带着随机尾巴：在 LinkedIn 的“编辑公开主页和网址”里改成自定义地址。`, `The URL “${slug}” ends in a random tail: set a custom one under “Edit public profile & URL”.`);

  if (p.openToWork === '') add('openToWork', 5, '还没选 Open to Work：找实习或工作时打开，可以只对招聘方可见。', 'Open to Work is not set: while job hunting turn it on, visible to recruiters only if you like.');
  if (p.openToWork === 'off') add('openToWork', 10, 'Open to Work 关着：打开它并设为“仅招聘方可见”，不会在头像上加绿框。', 'Open to Work is off: turn it on as “Recruiters only”, which adds no green frame to your photo.');

  issues.sort((a, b) => b.impact - a.impact);
  const lost = issues.reduce((n, i) => n + i.impact, 0);
  return { score: Math.max(0, Math.round(100 - lost)), issues, compared: terms.length };
}
