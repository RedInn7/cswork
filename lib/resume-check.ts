import type { Resume } from '@/components/resume-builder';

/**
 * The resume builder's rule check (components/resume-builder.tsx): no AI, it runs in the browser
 * on the resume as typed. Each rule has a weight out of 100; a rule over bullets takes its weight
 * off in shares (one failing bullet of eight costs an eighth), so the score is 100 less every
 * issue's `impact`, and the issues come back largest impact first. `where` names the field to fix:
 * 'name', 'email', 'links', 'skills', a section ('education', 'experience') or '<section>.<i>.<field>'.
 */
export type ResumeIssue = { where: string; rule: string; zh: string; en: string; impact: number };

const WEIGHT = {
  education: 8,
  skills: 8,
  work: 10,
  name: 4,
  email: 4,
  links: 4,
  dates: 4,
  verb: 14,
  metric: 16,
  length: 8,
  pronoun: 4,
  vague: 8,
  repeat: 4,
  tense: 4,
};
const BULLET_RULES = ['verb', 'metric', 'length', 'pronoun', 'vague', 'repeat', 'tense'] as const;

// Strong opening verbs, base forms. Past tense is regular unless PAST says otherwise.
const VERBS = `accelerate achieve adapt add analyze architect assemble audit author automate balance benchmark boost
build cache calibrate champion clarify coach code collaborate compile compose compute conceive configure consolidate
construct containerize contribute convert coordinate create curate cut debug decrease define delegate deliver deploy
design detect develop devise diagnose digitize direct discover document double drive eliminate enable engineer enhance
establish evaluate expand expedite experiment extend extract fix forecast formalize generate grow guide halve
harden identify implement improve increase initiate innovate inspect install instrument integrate introduce invent
investigate launch lead leverage lower maintain manage map maximize measure mentor merge migrate minimize model
modernize monitor negotiate normalize optimize orchestrate organize overhaul own parallelize partner patch pilot pioneer plan
port predict prepare present prioritize produce profile program prototype provision publish rebuild recruit redesign
reduce refactor release remove render replace report research resolve restructure revamp review rewrite run save scale
schedule secure shorten ship simplify slash solve spearhead speed standardize streamline strengthen supervise teach
test train transform translate triage troubleshoot tune unify upgrade validate visualize win write`.split(/\s+/);
const PAST: Record<string, string> = {
  build: 'built',
  cut: 'cut',
  debug: 'debugged',
  drive: 'drove',
  grow: 'grew',
  lead: 'led',
  map: 'mapped',
  model: 'modeled',
  plan: 'planned',
  program: 'programmed',
  rebuild: 'rebuilt',
  rewrite: 'rewrote',
  run: 'ran',
  ship: 'shipped',
  speed: 'sped',
  teach: 'taught',
  win: 'won',
  write: 'wrote',
};
const past = (v: string) => PAST[v] ?? (v.endsWith('e') ? `${v}d` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ied` : `${v}ed`);
const third = (v: string) => (/(s|x|z|ch|sh)$/.test(v) ? `${v}es` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : `${v}s`);
/** Every form of every verb → its base form and whether that form is the past tense. */
const FORMS = new Map<string, { base: string; past: boolean }>();
// British spellings too: optimise, analyse.
for (const v of [...VERBS, ...VERBS.filter((w) => w.endsWith('ize')).map((w) => `${w.slice(0, -3)}ise`), 'analyse']) {
  FORMS.set(v, { base: v, past: past(v) === v });
  FORMS.set(third(v), { base: v, past: false });
  FORMS.set(past(v), { base: v, past: true });
}
FORMS.set('modelled', { base: 'model', past: true });
FORMS.set('speeded', { base: 'speed', past: true });

const VAGUE = /\b(responsible for|helped (with|to)?|worked on|various)\b|各种/i;
// "I/O" is not a pronoun, and "US" is a country.
const PRONOUN = /\b(I(?!\/O)|[Mm]y|[Mm]e|[Ww]e|[Oo]ur|[Uu]s)\b|我/;
const METRIC =
  /\d|[%×百千万亿倍半]|\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|dozens?|hundreds?|thousands?|millions?|billions?|doubled?|tripled?|halved?|half)\b/i;
const ONGOING = /present|current|now|ongoing|today|至今|现在|今/i;
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|spring|summer|fall|autumn|winter';
const CN_WEAK = /^(负责|参与|协助)/;

const bulletsOf = (value: string) =>
  value
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*·▪]\s*/, '').trim())
    .filter(Boolean);
const filled = (item: Resume['experience'][number]) => !!(item.title.trim() || item.subtitle.trim() || item.dates.trim() || item.bullets.trim());
/** Mostly Chinese: CJK characters are at least a third of the non-space ones. */
const isChinese = (s: string) => (s.match(/[㐀-鿿]/g)?.length ?? 0) * 3 >= s.replace(/\s/g, '').length;
const snip = (s: string) => (s.length > 32 ? `${s.slice(0, 32)}…` : s);
/** The opening word, "co-"/"re-" dropped, as a verb form; null when it is not one of VERBS. */
function opening(bullet: string) {
  const word = /^[A-Za-z]+(?:-[A-Za-z]+)*/.exec(bullet)?.[0].toLowerCase().replace(/^(co|re)-/, '');
  return word ? (FORMS.get(word) ?? null) : null;
}
/** A date's format family: month names, 2024.01, 2024/01, 2024-01, 01/2024, 2024年1月 or a bare year. */
function family(part: string) {
  if (new RegExp(`\\b(${MONTHS})[a-z]*\\.?\\s*\\d{4}`, 'i').test(part)) return 'month';
  if (/\d{4}\s*年/.test(part)) return 'cjk';
  if (/\d{4}\.\d{1,2}(?!\d)/.test(part)) return 'dot';
  if (/\d{4}\/\d{1,2}(?!\d)/.test(part)) return 'slash';
  if (/\d{4}-\d{1,2}(?!\d)/.test(part)) return 'dash';
  if (/\b\d{1,2}\/\d{4}/.test(part)) return 'month-first';
  if (/\d{4}/.test(part)) return 'year';
  return null;
}

export function checkResume(r: Resume): { score: number; issues: ResumeIssue[] } {
  const issues: ResumeIssue[] = [];
  const add = (where: string, rule: string, impact: number, zh: string, en: string) => issues.push({ where, rule, zh, en, impact });

  if (!r.name.trim()) add('name', 'contact', WEIGHT.name, '没有填写姓名。', 'Add your name.');
  if (!r.email.trim()) add('email', 'contact', WEIGHT.email, '没有填写邮箱，招聘方联系不到你。', 'Add an email address so recruiters can reach you.');
  const links = r.links.split(/[\s,，;|]+/).filter((l) => /\w\.\w/.test(l) && !/linkedin\.com/i.test(l));
  if (!links.length)
    add('links', 'links', WEIGHT.links, '链接里没有 GitHub 或个人网站：放一个能看到你代码或作品的地址。', 'No GitHub or personal site in your links: add one where your code or work can be seen.');
  if (!r.education.some(filled)) add('education', 'sections', WEIGHT.education, '缺少教育经历（Education）。', 'Add your education.');
  if (!r.skills.trim()) add('skills', 'sections', WEIGHT.skills, '缺少技能（Skills）一节。', 'Add a Skills section.');
  const work = (['experience', 'projects'] as const).flatMap((key) =>
    r[key].map((item, index) => ({ key, index, item })).filter(({ item }) => filled(item)),
  );
  // Without experience or projects there are no bullets either: their rules are lost too.
  const bulletWeight = BULLET_RULES.reduce((n, rule) => n + WEIGHT[rule], 0);
  if (!work.length) add('experience', 'sections', WEIGHT.work + bulletWeight, '至少写一段工作经历或项目。', 'Add at least one experience or project.');

  // Dates: one format across the resume; the first entry off the most common one is flagged.
  const dated = (['education', 'experience', 'projects'] as const).flatMap((key) =>
    r[key].flatMap((item, index) => {
      const families = item.dates.split(/\s*(?:–|—|~|～|\bto\b|至|\s-\s)\s*|(?<=\d)-(?=\d{4})/).map(family).filter((f) => f !== null);
      return families.length ? [{ where: `${key}.${index}.dates`, families, dates: item.dates.trim() }] : [];
    }),
  );
  const counts = new Map<string, number>();
  for (const d of dated) for (const f of d.families) counts.set(f, (counts.get(f) ?? 0) + 1);
  if (counts.size > 1) {
    const common = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const off = dated.find((d) => d.families.some((f) => f !== common))!;
    add(off.where, 'dates', WEIGHT.dates, `日期格式不统一：「${off.dates}」和其他经历写法不同。`, `Dates are not in one format: “${off.dates}” differs from the rest.`);
  }

  // Bullets of experience and projects (education bullets are GPA and coursework: no verbs to check).
  const all = work.flatMap(({ key, index, item }) =>
    bulletsOf(item.bullets).map((text) => ({ text, where: `${key}.${index}.bullets`, ended: !!item.dates.trim() && !ONGOING.test(item.dates) })),
  );
  if (work.length && !all.length) {
    const first = work[0];
    add(`${first.key}.${first.index}.bullets`, 'bullets', bulletWeight, '经历下面还没有要点：每段写 2–4 条做了什么、怎么做、结果如何。', 'Your entries have no bullets yet: write 2–4 per entry on what you did, how, and the result.');
  }
  for (const { key, index, item } of work)
    if (all.length && !bulletsOf(item.bullets).length)
      add(`${key}.${index}.bullets`, 'bullets', 2, `「${snip(item.title.trim() || item.subtitle.trim())}」下面还没有要点。`, `“${snip(item.title.trim() || item.subtitle.trim())}” has no bullets yet.`);
  const share = (rule: (typeof BULLET_RULES)[number], n: number) => WEIGHT[rule] / n;
  for (const b of all) {
    const zh = isChinese(b.text);
    const s = snip(b.text);
    const verb = zh ? null : opening(b.text);
    if (zh ? CN_WEAK.test(b.text) : !verb)
      add(b.where, 'verb', share('verb', all.length), `「${s}」开头不是有力的动词：用做了什么的动词开头（例如 设计、实现、优化 / Built、Cut）。`, `“${s}” does not open with a strong verb: start with what you did (Built, Cut, Led).`);
    if (!METRIC.test(b.text))
      add(b.where, 'metric', share('metric', all.length), `「${s}」没有数字：补上规模、提升幅度或用户数。`, `“${s}” has no number: add the scale, the gain or the users.`);
    const [min, max] = zh ? [12, 90] : [40, 200];
    if (b.text.length < min || b.text.length > max)
      add(
        b.where,
        'length',
        share('length', all.length),
        b.text.length < min ? `「${s}」太短，说清楚怎么做和结果。` : `「${s}」太长，压到一两行。`,
        b.text.length < min ? `“${s}” is too short: say how and with what result.` : `“${s}” is too long: cut it to one or two lines.`,
      );
    if (PRONOUN.test(b.text))
      add(b.where, 'pronoun', share('pronoun', all.length), `「${s}」用了第一人称：简历要点省掉“我”。`, `“${s}” uses a first-person pronoun: resume bullets leave out I, my and we.`);
    if (VAGUE.test(b.text))
      add(b.where, 'vague', share('vague', all.length), `「${s}」用了空泛的说法：写具体做了什么。`, `“${s}” is vague (responsible for, worked on, various): say what you actually did.`);
  }
  // Repeated opening verbs, once per entry.
  const withBullets = work.filter(({ item }) => bulletsOf(item.bullets).length);
  for (const { key, index, item } of withBullets) {
    const bases = bulletsOf(item.bullets).map((t) => opening(t)?.base).filter(Boolean);
    const repeated = bases.find((v, i) => bases.indexOf(v) !== i);
    if (repeated)
      add(`${key}.${index}.bullets`, 'repeat', share('repeat', withBullets.length), `「${snip(item.title.trim())}」里有多条要点都以 ${repeated} 开头：换不同的动词。`, `Several bullets under “${snip(item.title.trim())}” open with “${repeated}”: vary the verbs.`);
  }
  // Finished entries: past tense, judged by the verb list (Led, Built and Ran are past too).
  const ended = all.filter((b) => b.ended && !isChinese(b.text));
  for (const b of ended) {
    const verb = opening(b.text);
    if (verb && !verb.past)
      add(b.where, 'tense', share('tense', ended.length), `「${snip(b.text)}」所在的经历已经结束，动词用过去时（${past(verb.base)}）。`, `“${snip(b.text)}” is from a finished role: use the past tense (${past(verb.base)}).`);
  }

  issues.sort((a, b) => b.impact - a.impact);
  const lost = issues.reduce((n, i) => n + i.impact, 0);
  return { score: Math.max(0, Math.round(100 - lost)), issues };
}
