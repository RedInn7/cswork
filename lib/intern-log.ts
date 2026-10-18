// The internship log (/career/intern: components/intern-log.tsx and team-match.tsx). Pure helpers
// over three kinds of the learner's private JSON notes (lib/server/my-practice.ts caps them):
// brag:meta (the internship), brag:<Monday YYYY-MM-DD> (one week's log; absolute dates, so two
// internships never share a key) and brag:teams (team-matching calls). Client- and server-safe.
import { decisionScore, readDecision, type Decision } from './offer-math';
import { ITEMS, lines, MAX, type Resume } from './resume-shape';

export type InternMeta = { company: string; role: string; start: string; weeks: number };
/** One result in XYZ form: accomplished X, as measured by Y, by doing Z. */
export type Win = { x: string; y: string; z: string; project: string };
export type Brag = { wins: Win[]; feedback: string; learned: string; next: string };
export type BragWeek = Brag & { monday: string };

export const META_TARGET = 'brag:meta';
export const TEAMS_TARGET = 'brag:teams';
export const weekTarget = (monday: string) => `brag:${monday}`;
export const WEEKS_MIN = 8;
export const WEEKS_MAX = 16;
export const WINS_MAX = 8;
export const WIN_MAX = 300;
export const FIELD_MAX = 1000;

const DAY_MS = 86400000;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const at = (day: string) => Date.parse(`${day}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** A real calendar day written YYYY-MM-DD. */
export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(at(v)) && iso(at(v)) === v;
/** The Monday of the week holding `day` (calendar dates; no time zone involved). */
export const mondayOf = (day: string) => iso(at(day) - ((new Date(at(day)).getUTCDay() + 6) % 7) * DAY_MS);
/** The internship week `day` falls in: 1 is the week of the start date, 0 or less before it. */
export const weekNo = (start: string, day: string) => Math.round((at(mondayOf(day)) - at(mondayOf(start))) / (7 * DAY_MS)) + 1;
/** The Monday of internship week `n`. */
export const weekMonday = (start: string, n: number) => iso(at(mondayOf(start)) + (n - 1) * 7 * DAY_MS);
/** A checklist week (lib/content/career-checklists.ts) as an internship week: 0 before day one, -n the n-th last, 'mid' the middle. */
export const resolveWeek = (week: number | 'mid', weeks: number) => (week === 'mid' ? Math.ceil(weeks / 2) : week < 0 ? weeks + 1 + week : week);
const FROM_END = ['Final week', 'Second-to-last week', 'Third-to-last week'];
/** A checklist week as the guide shows it, before any internship length is known. */
export function weekLabel(week: number | 'mid', zh: boolean) {
  if (week === 'mid') return zh ? '中期' : 'Midpoint';
  if (week === 0) return zh ? '入职前' : 'Before day one';
  if (week > 0) return zh ? `第 ${week} 周` : `Week ${week}`;
  return zh ? (week === -1 ? '最后一周' : `倒数第 ${-week} 周`) : (FROM_END[-week - 1] ?? `${-week}th-to-last week`);
}

const object = (body: string): Record<string, unknown> | null => {
  try {
    const d: unknown = JSON.parse(body);
    return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
/** brag:meta back into the internship; null without a real start date (or for broken JSON). */
export function parseMeta(body: string): InternMeta | null {
  const d = object(body);
  if (!d || !isDay(d.start)) return null;
  const weeks = Number.isInteger(d.weeks) ? Math.min(WEEKS_MAX, Math.max(WEEKS_MIN, d.weeks as number)) : 12;
  return { company: str(d.company, 100), role: str(d.role, 120), start: d.start, weeks };
}
/** A week's note back into its log, leniently like parseStory: unknown fields dropped, text capped; null for broken JSON. */
export function parseBrag(body: string): Brag | null {
  const d = object(body);
  if (!d) return null;
  const wins = (Array.isArray(d.wins) ? d.wins : [])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
    .map((w) => ({ x: str(w.x, WIN_MAX), y: str(w.y, WIN_MAX), z: str(w.z, WIN_MAX), project: str(w.project, WIN_MAX) }))
    .filter((w) => (w.x + w.y + w.z).trim())
    .slice(0, WINS_MAX);
  return { wins, feedback: str(d.feedback, FIELD_MAX), learned: str(d.learned, FIELD_MAX), next: str(d.next, FIELD_MAX) };
}
/** The note body for a week's log; '' (which deletes the note) when nothing is written. */
export function bragBody(b: Brag) {
  const wins = b.wins.filter((w) => (w.x + w.y + w.z).trim());
  return wins.length || (b.feedback + b.learned + b.next).trim() ? JSON.stringify({ ...b, wins }) : '';
}

const CJK = /[㐀-鿿]/;
const clean = (s: string) => s.trim().replace(/[\s.。,，;；]+$/u, '');
/** A win as one resume line, "X Y, by Z." (Chinese: "X，Y，通过 Z。"); `addNumber` when Y has no figure in it. */
export function xyzBullet(win: Win) {
  const [x, y, z] = [win.x, win.y, win.z].map(clean);
  const head = [x, y].filter(Boolean);
  const line = CJK.test(x + y + z)
    ? `${[...head, z && (/^(通过|借助|靠)/.test(z) ? z : `通过${z}`)].filter(Boolean).join('，')}。`
    : `${head.join(' ')}${z ? `${head.length ? ', ' : ''}${/^by\b/i.test(z) ? z.replace(/^by/i, 'by') : `by ${z}`}` : ''}.`;
  return { line, addNumber: !/\d/.test(y) };
}
/** Every logged win (oldest week first), those with a measure first, stable within each group. */
const ranked = (logged: readonly BragWeek[]) =>
  [...logged]
    .sort((a, b) => a.monday.localeCompare(b.monday))
    .flatMap((w) => w.wins.filter((win) => win.x.trim()))
    .sort((a, b) => +!a.y.trim() - +!b.y.trim());
/** The XYZ lines of every win logged in this internship's weeks, measured ones first, duplicates dropped. */
export const winLines = (meta: InternMeta, logged: readonly BragWeek[]) => {
  const own = logged.filter((w) => weekNo(meta.start, w.monday) >= 1 && weekNo(meta.start, w.monday) <= meta.weeks);
  return [...new Set(ranked(own).map((w) => xyzBullet(w).line))];
};

const item = (text: string) => `- ${text.trim().replace(/\s*\n\s*/g, '\n  ')}`;
/**
 * A self-review draft in Markdown: results (measured first, grouped by project), feedback, what was
 * learned, next steps (the two latest weeks' plans) and questions for the manager. The midpoint
 * draft reads only weeks 1 to ceil(weeks / 2); the final one reads 1 to weeks and adds a
 * return-offer section to fill in.
 */
export function selfReview(meta: InternMeta, logged: readonly BragWeek[], kind: 'mid' | 'final', zh: boolean) {
  const t = (a: string, b: string) => (zh ? a : b);
  const half = Math.ceil(meta.weeks / 2);
  // Weeks of this internship only: a log kept from an earlier one falls outside 1…weeks.
  const rows = [...logged]
    .map((w) => ({ ...w, no: weekNo(meta.start, w.monday) }))
    .filter((w) => w.no >= 1 && w.no <= (kind === 'mid' ? half : meta.weeks))
    .sort((a, b) => a.monday.localeCompare(b.monday));
  const none = t('（还没有记录）', '(nothing logged yet)');
  const where = [meta.role.trim(), meta.company.trim()].filter(Boolean).join(zh ? '，' : ' at ');
  const out = [
    `# ${kind === 'mid' ? t('中期自评草稿', 'Midpoint self-review draft') : t('期末自评草稿', 'Final self-review draft')}${where ? ` · ${where}` : ''}`,
    '',
    t(
      `第 1–${kind === 'mid' ? half : meta.weeks} 周（共 ${meta.weeks} 周）。由每周日志生成，交出去之前请改成自己的话。`,
      `Weeks 1–${kind === 'mid' ? half : meta.weeks} of ${meta.weeks}. Drafted from your weekly log; put it in your own words before you share it.`,
    ),
    '',
    `## ${t('成果', 'Results')}`,
  ];
  const groups = new Map<string, string[]>();
  for (const win of ranked(rows)) {
    const key = win.project.trim();
    groups.set(key, [...(groups.get(key) ?? []), item(xyzBullet(win).line)]);
  }
  if (!groups.size) out.push(none);
  // One project and no others: no subheading needed.
  for (const [project, wins] of groups)
    out.push(...(groups.size > 1 || project ? ['', `### ${project || t('其他', 'Other')}`] : []), ...wins);
  const section = (title: string, field: 'feedback' | 'learned' | 'next', from = rows) => {
    const said = from.filter((w) => w[field].trim()).map((w) => item(`**${t(`第 ${w.no} 周`, `Week ${w.no}`)}**${t('：', ': ')}${w[field]}`));
    out.push('', `## ${title}`, ...(said.length ? said : [none]));
  };
  section(t('收到的反馈', 'Feedback'), 'feedback');
  section(t('学到的', 'What I learned'), 'learned');
  section(t('下一步', 'Next steps'), 'next', rows.filter((w) => w.next.trim()).slice(-2));
  out.push(
    '',
    `## ${t('想问 manager 的问题', 'Questions for my manager')}`,
    ...(kind === 'mid'
      ? [
          t('按现在的表现，我离转正还差什么？', 'Based on how things are going, what stands between me and a return offer?'),
          t('后半程我最该加强哪一点？', 'What should I focus on in the second half?'),
          t('项目范围需要调整吗，期末交付到哪一步算完成？', 'Should we adjust the scope, and what counts as done by the end?'),
        ]
      : [
          t('转正什么时候决定，还需要我提供什么？', 'When will the return-offer decision be made, and do you need anything from me?'),
          t('这段时间我进步最大的地方，以及最该继续改进的地方是什么？', 'Where did I grow most, and what should I keep working on?'),
          t('之后找工作时，可以请你做我的推荐人吗？', 'May I list you as a reference in future applications?'),
        ]
    ).map(item),
  );
  if (kind === 'final')
    out.push(
      '',
      `## ${t('转正意向', 'Return offer')}`,
      t(
        '（写下你是否希望回来，想回这个组还是换组，以及最早什么时候能入职。）',
        '(Say whether you would like to come back, to this team or another, and the earliest date you could start.)',
      ),
    );
  return `${out.join('\n')}\n`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const month = (t: number) => `${MONTHS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCFullYear()}`;
/** The internship's months as the resume builder writes dates ("Jun 2026 – Aug 2026"). */
export const internDates = (meta: InternMeta) => `${month(at(meta.start))} – ${month(at(meta.start) + (meta.weeks * 7 - 1) * DAY_MS)}`;
/**
 * Bullets added to a resume experience (`idx`), or to a new one made from the internship ('new',
 * first in the list, unless the list is the builder's single blank entry). Lines already there are
 * skipped; lines that would push the entry past MAX.bullets come back in `dropped`, as do all of
 * them when the entry is gone or the resume already holds ITEMS experiences.
 */
export function appendBullets(resume: Resume, idx: number | 'new', add: readonly string[], meta: InternMeta) {
  let experience = resume.experience;
  if (idx === 'new') {
    if (experience.length >= ITEMS) return { resume, added: [] as string[], dropped: [...add] };
    const fresh = { title: meta.company.trim(), subtitle: meta.role.trim(), dates: internDates(meta), bullets: '' };
    const blank = experience.length === 1 && !Object.values(experience[0]).some((v) => v.trim());
    experience = blank ? [fresh] : [fresh, ...experience];
  } else if (!experience[idx]) return { resume, added: [] as string[], dropped: [...add] };
  const i = idx === 'new' ? 0 : idx;
  const have = new Set(lines(experience[i].bullets));
  let bullets = experience[i].bullets.trimEnd();
  const added: string[] = [],
    dropped: string[] = [];
  for (const raw of add) {
    const line = raw.trim();
    if (!line || have.has(line)) continue;
    const next = bullets ? `${bullets}\n${line}` : line;
    if (next.length > MAX.bullets) {
      dropped.push(line);
      continue;
    }
    bullets = next;
    have.add(line);
    added.push(line);
  }
  experience = experience.map((x, j) => (j === i ? { ...x, bullets } : x));
  return { resume: { ...resume, experience }, added, dropped };
}

// ---------------------------------------------------------------- team matching

/** What a team is weighed on, [id, zh, en]; the starting factors of brag:teams. */
export const TEAM_FACTORS: [id: string, zh: string, en: string][] = [
  ['work', '做的事', 'The work'],
  ['manager', 'manager', 'The manager'],
  ['growth', '成长', 'Growth'],
  ['stack', '技术栈', 'Tech stack'],
  ['impact', '影响', 'Impact'],
  ['pace', '节奏和 on-call', 'Pace and on-call'],
  ['conversion', '转正可能性', 'Return-offer odds'],
];
/** Questions for any team-matching call, [id, zh, en]; a team's `asked` keeps the ids. */
export const TEAM_QUESTIONS: [id: string, zh: string, en: string][] = [
  ['project', '实习生一般做什么样的项目？能举一个往届的例子吗？', 'What kind of project do interns usually get? Could you give a past example?'],
  ['mentor', '我的 mentor 会是谁，多久见一次？', 'Who would my mentor be, and how often would we meet?'],
  ['stack', '团队用什么技术栈？', 'What is the team’s tech stack?'],
  ['users', '团队做的东西给谁用，怎么衡量做得好不好？', 'Who uses what the team builds, and how is success measured?'],
  ['success', '怎么判断一段实习是否成功？', 'How do you judge whether an internship went well?'],
  ['pace', '团队节奏怎么样，要不要 on-call？', 'What is the team’s pace like, and is there on-call?'],
  ['review', 'code review 和设计评审是怎么做的？', 'How do code reviews and design reviews work on the team?'],
  ['day', '一个普通的工作日是什么样的？', 'What does a typical day look like?'],
  ['size', '团队有多少人，分布在哪些时区？', 'How big is the team, and which time zones is it in?'],
  ['office', '在办公室还是远程，多久去一次办公室？', 'Is the work in the office or remote, and how often are people in?'],
  ['style', '你喜欢怎样和实习生合作？', 'How do you like to work with interns?'],
  ['return', '往届实习生的转正情况大概怎样？', 'Roughly how have past interns fared on return offers?'],
];
export const TEAMS_MAX = 8;
export const TEAM_NOTES_MAX = 1500;
export type Team = { id: string; name: string; manager: string; callAt: string; asked: string[]; notes: string };
/** The decision matrix of /career/offers (scores keyed by team id) plus the call cards. */
export type TeamMatch = Decision & { teams: Team[] };
const QUESTION_IDS = new Set(TEAM_QUESTIONS.map(([id]) => id));

/** brag:teams cleaned up (offer-math's readDecision for the matrix, TEAM_FACTORS when none is saved); a removed team's scores go with it. */
export function readTeamMatch(raw: unknown): TeamMatch {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const teams: Team[] = (Array.isArray(r.teams) ? r.teams : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object' && typeof t.id === 'string' && /^[\w-]{1,40}$/.test(t.id))
    .filter((t, i, all) => all.findIndex((u) => u.id === t.id) === i)
    .slice(0, TEAMS_MAX)
    .map((t) => ({
      id: t.id as string,
      name: str(t.name, 60),
      manager: str(t.manager, 60),
      callAt: typeof t.callAt === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(t.callAt) ? t.callAt : '',
      asked: [...new Set((Array.isArray(t.asked) ? t.asked : []).filter((q): q is string => typeof q === 'string' && QUESTION_IDS.has(q)))],
      notes: str(t.notes, TEAM_NOTES_MAX),
    }));
  const d = readDecision(Array.isArray(r.factors) ? r : { ...r, factors: TEAM_FACTORS.map(([id]) => ({ id, name: '', weight: 3 })) });
  const ids = new Set(teams.map((t) => t.id));
  return { ...d, scores: Object.fromEntries(Object.entries(d.scores).filter(([id]) => ids.has(id))), teams };
}
/** brag:teams as stored (moneyWeight is the offers page's and stays out). */
export const teamMatchBody = ({ factors, scores, teams }: TeamMatch) => JSON.stringify({ factors, scores, teams });
/** Teams by weighted mean score (decisionScore), best first; unscored ones last, in their card order. */
export const rankTeams = (m: TeamMatch) =>
  m.teams
    .map((team, i) => ({ team, no: i + 1, score: decisionScore(m.factors, m.scores[team.id]) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
/** The ranking as plain text to paste anywhere. */
export const rankingText = (m: TeamMatch, zh: boolean) =>
  rankTeams(m)
    .map(({ team, no, score }, i) => {
      const name = team.name.trim() || (zh ? `第 ${no} 组` : `Team ${no}`);
      const manager = team.manager.trim() ? ` (${team.manager.trim()})` : '';
      return `${i + 1}. ${name}${manager}: ${score === null ? (zh ? '未打分' : 'not scored') : score.toFixed(2)}`;
    })
    .join('\n');
