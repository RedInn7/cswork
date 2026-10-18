// The notes export (GET oj/notes/export, lib/server/note-export.ts) as an Obsidian vault, the accepted
// code (GET oj/solutions/export) as a portfolio repository, the progress CSV/JSON and the note gist of
// the review sheet. Pure: the server, components/cheatsheet.tsx and /review-sheet share it.
import { csvCell } from './applications';
import { classicLists, groupEntries, levelOf } from './classic-lists';
import { parseNoteMeta } from './note-meta';
import { reviewState, type PracticeHistoryItem } from './practice-review';
import { ROUTE_SLUGS, STOP_NAMES, topicName } from './route-stops';
import { parseStory, storiesMarkdown, type Story } from './story-bank';

/** What the server knows of a problem: study-library titles for LeetCode, the Line 500 stop and route order. */
export type ProblemMeta = {
  title?: string;
  titleEn?: string | null;
  difficulty?: string;
  topics?: string[];
  stop?: string | null;
  order?: number;
};
/** One exported note (GET oj/notes/export items). */
export type ExportItem = {
  target: string;
  body: string;
  updatedAt: number;
  /** sub: notes, the submission's problem. */
  problemId?: string | null;
  /** problem: notes, the learner's latest judge AC (ms) and, with ?code=1, its code. */
  lastAc?: number | null;
  code?: { language: string; code: string } | null;
  meta?: ProblemMeta;
};
export type ExportPage = { items: ExportItem[]; nextCursor: string | null };
/** One accepted problem (GET oj/solutions/export items): each language's latest AC, runtime in seconds. */
export type SolutionItem = {
  problemId: string;
  firstAc: number;
  solutions: { language: string; code: string; at: number; runtime: number | null }[];
  /** With ?notes=1, the problem note when there is one. */
  note?: string;
  meta?: ProblemMeta;
};
export type SolutionPage = { items: SolutionItem[]; nextCursor: string | null };

// Fenced code blocks (an unclosed fence runs to the end), as lib/note-meta.ts reads them.
const FENCE = /^ {0,3}(`{3,}|~{3,}).*$[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))/gm;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?[ \t#]*$/;
// The problem template's 关键观察 / Key observation and 复杂度 / Complexity sections (lib/note-meta.ts).
const GIST = /^(?:关键观察|key observations?|复杂度|complexity)$/i;
// Lines that say nothing on their own: a confidence line, a line of #tags.
const NOISE = /^(?:[-*>]\s*)?(?:把握度|confidence)\s*[:：]|^(?:#[^\s#]*\s*)+$/i;
const GIST_MAX = 240;

/**
 * A note in one line (GIST_MAX characters at most): its key observation and complexity sections,
 * else the first line of prose that is not a heading. Code blocks never count.
 */
export function noteGist(body: string) {
  const lines = body.replace(FENCE, '').split('\n');
  const parts: string[] = [];
  let inGist = false;
  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) inGist = GIST.test((heading[1] ?? '').trim());
    else if (inGist && line.trim() && !NOISE.test(line.trim())) parts.push(line.trim());
  }
  const first = lines.find((line) => line.trim() && !HEADING.test(line) && !NOISE.test(line.trim()));
  const text = (parts.length ? parts.join(' · ') : (first ?? '')).replace(/\s+/g, ' ').trim();
  return text.length > GIST_MAX ? `${text.slice(0, GIST_MAX - 1)}…` : text;
}

/** A self-made review card (card:<id>, {v,front,back,tags,src}), or null when the body is not one. */
export function readCard(body: string) {
  try {
    const d = JSON.parse(body) as Record<string, unknown>;
    if (!d || typeof d.front !== 'string' || typeof d.back !== 'string') return null;
    const src = d.src as { href?: unknown; title?: unknown } | undefined;
    return {
      front: d.front,
      back: d.back,
      tags: Array.isArray(d.tags) ? d.tags.filter((s): s is string => typeof s === 'string').map((s) => s.toLowerCase()) : [],
      src:
        src && typeof src.href === 'string' && src.href.startsWith('/') && !src.href.startsWith('//')
          ? { href: src.href, title: typeof src.title === 'string' ? src.title : src.href }
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * YAML front matter. Every string goes through JSON.stringify: a JSON string is a valid YAML
 * double-quoted scalar, so quotes, colons, newlines and a leading # stay text. Empty fields are left out.
 */
export function frontMatter(fields: Record<string, string | number | readonly string[] | null | undefined>) {
  const lines = Object.entries(fields).flatMap(([key, value]) =>
    value == null || value === '' || (Array.isArray(value) && !value.length)
      ? []
      : [`${key}: ${typeof value === 'number' ? value : JSON.stringify(value)}`],
  );
  return `---\n${lines.join('\n')}\n---\n\n`;
}

/** A relative path without '..', '.', empty segments or characters Windows refuses in names. */
export function safePath(path: string) {
  return path
    .split('/')
    .map((segment) => segment.replace(/[\\:*?"<>|\p{Cc}]/gu, '-'))
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

/** Code in a fence longer than any backtick run inside it. */
const fenced = (code: string, language: string) => {
  const fence = '`'.repeat(Math.max(3, ...[...code.matchAll(/`+/g)].map((m) => m[0].length + 1)));
  return `${fence}${language}\n${code.replace(/\n$/, '')}\n${fence}`;
};
const day = (at: number | null | undefined) => (at ? new Date(at).toISOString().slice(0, 10) : null);
const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD in this browser's zone, as review due dates are local midnights; the portfolio and progress exports agree. */
const localDay = (at: number | null) => {
  if (!at) return null;
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A problem's title in the reader's language, else its id. */
export const metaTitle = (id: string, meta: ProblemMeta | undefined, english: boolean) =>
  (english ? meta?.titleEn || meta?.title : meta?.title || meta?.titleEn) || id;

export type VaultFile = { name: string; data: string; title: string };

/**
 * The export as an Obsidian vault: problems/<stop or source>/<id>.md (so [[lc-42]] resolves),
 * submissions/, library/, system-design/, topics/, cards/, clips/, the STAR stories in one
 * stories/star-stories.md, and index.md linking everything. LeetCode problems carry their number,
 * title and link only, never the statement.
 */
export function vaultFiles(items: readonly ExportItem[], { english, origin }: { english: boolean; origin: string }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const files: VaultFile[] = [];
  const taken = new Set<string>();
  const add = (path: string, title: string, front: Parameters<typeof frontMatter>[0], body: string) => {
    const base = safePath(path) || 'note';
    let name = `${base}.md`;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}.md`;
    taken.add(name);
    files.push({ name, title, data: `${frontMatter({ title, ...front })}# ${title}\n\n${body.trim()}\n` });
  };
  const problemUrl = (id: string) => `${origin}/?${new URLSearchParams({ view: 'problem', problem: id })}`;
  const stories: Story[] = [];
  for (const item of items) {
    const colon = item.target.indexOf(':');
    const kind = item.target.slice(0, colon);
    const key = item.target.slice(colon + 1);
    const { tags, confidence } = parseNoteMeta(item.body);
    const updated = day(item.updatedAt);
    if (kind === 'story') {
      const story = parseStory(item.target, item.body, item.updatedAt);
      if (story) stories.push(story);
    } else if (kind === 'problem') {
      const m = item.meta;
      const title = metaTitle(key, m, english);
      const level = m?.difficulty ? levelOf(m.difficulty) : undefined;
      const code = item.code
        ? `\n\n## ${t('最近一次 AC 代码', 'Latest accepted code')} (${item.code.language})\n\n${fenced(item.code.code, item.code.language)}`
        : '';
      add(
        `problems/${m?.stop ?? key.split('-')[0]}/${key}`,
        title,
        {
          aliases: title === key ? [] : [title],
          url: problemUrl(key),
          difficulty: level ? level[english ? 2 : 1] : m?.difficulty,
          topics: m?.topics,
          tags,
          confidence,
          stop: m?.stop,
          last_ac: day(item.lastAc),
          updated,
        },
        item.body.trim() + code,
      );
    } else if (kind === 'sub') {
      const problem = item.problemId;
      add(
        `submissions/${key}`,
        `${t('提交笔记', 'Submission note')} ${key}`,
        { problem, url: problem ? problemUrl(problem) : null, tags, updated },
        `${problem ? `[[${problem}]]\n\n` : ''}${item.body}`,
      );
    } else if (kind === 'content') {
      const [type, ...slug] = key.split('/');
      add(
        `library/${key}`,
        slug.join('/') || key,
        { url: `${origin}/?${new URLSearchParams({ view: 'content', type, slug: slug.join('/') })}`, tags, updated },
        item.body,
      );
    } else if (kind === 'sd') {
      const chapter = key.replace(/\/draft$/, '');
      add(`system-design/${chapter}`, chapter, { url: `${origin}/system-design/${chapter}`, tags, updated }, item.body);
    } else if (kind === 'topic') {
      const name = STOP_NAMES[key];
      add(`topics/${key}`, name ? t(...name) : key, { url: `${origin}/topics/${key}`, tags, updated }, item.body);
    } else if (kind === 'card') {
      const card = readCard(item.body);
      const title = card ? card.front.split('\n', 1)[0].slice(0, 80) : key;
      add(
        `cards/${key}`,
        title,
        { tags: card?.tags, source: card?.src ? `${origin}${card.src.href}` : null, updated },
        card
          ? `## ${t('正面', 'Front')}\n\n${card.front}\n\n## ${t('背面', 'Back')}\n\n${card.back}` +
              (card.src ? `\n\n${t('出处', 'Source')}: [${card.src.title}](${origin}${card.src.href})` : '')
          : item.body,
      );
    } else add(`${kind === 'clip' ? 'clips' : kind}/${key}`, key, { tags, updated }, item.body);
  }
  if (stories.length) {
    const title = t('我的 STAR 故事', 'My STAR stories');
    add('stories/star-stories', title, {}, storiesMarkdown(stories, english).replace(/^# .*\n+/, ''));
  }
  const folders = new Map<string, VaultFile[]>();
  for (const file of files) {
    const folder = file.name.split('/', 1)[0];
    folders.set(folder, [...(folders.get(folder) ?? []), file]);
  }
  const index =
    `# ${t('我的 CSWork 笔记', 'My CSWork notes')}\n\n${t(`共 ${files.length} 个文件`, `${files.length} files`)}\n` +
    [...folders]
      .map(
        ([folder, list]) =>
          `\n## ${folder}\n\n` +
          list.map((f) => `- [[${f.name.replace(/\.md$/, '')}|${f.title.replace(/[[\]|\n]/g, ' ')}]]`).join('\n'),
      )
      .join('\n');
  return [{ name: 'index.md', title: 'index', data: index + '\n' }, ...files];
}

/** The vault as one Markdown document: each file from its own # title on, front matter left out. */
export const vaultMarkdown = (files: readonly VaultFile[]) =>
  files
    .slice(1)
    .map((f) => f.data.replace(/^---\n[\s\S]*?\n---\n\n/, ''))
    .join('\n---\n\n');

// ponytail: inline, as lib/editor-settings' extension table would pull the problems into this bundle.
const extension = (language: string) => (language === 'python' || language === 'pandas' ? 'py' : language);
/** Text for a Markdown table cell: one line, with \, |, [ and ] escaped. */
const cell = (text: string) => text.replace(/\s+/g, ' ').replace(/[\\|[\]]/g, '\\$&');

/**
 * Accepted code as a portfolio repository: problems/<id>-<English title slug>/ holds each language's
 * latest AC (solution.<ext>) and a README (title, link, difficulty, topics, Line 500 stop, first AC,
 * each language's AC date and runtime, the note when asked), never the statement. The top README.md
 * indexes them by Line 500 stop, else first topic, else Other, in route order. OA problems, often
 * under NDA, only when asked, and then the README says to keep the repository private.
 */
export function portfolioFiles(
  items: readonly SolutionItem[],
  { english, origin, oa = false, notes = false }: { english: boolean; origin: string; oa?: boolean; notes?: boolean },
) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const files: VaultFile[] = [];
  const taken = new Set<string>();
  const groups = new Map<string, { name: string; rank: number; rows: [SolutionItem, string][] }>();
  for (const item of items) {
    if (!oa && item.problemId.startsWith('oa-')) continue;
    const m = item.meta;
    const title = metaTitle(item.problemId, m, english);
    const slug = (m?.titleEn ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/^-+|-+$/g, '');
    const base = safePath(`problems/${item.problemId}${slug ? `-${slug}` : ''}`);
    let dir = base;
    for (let n = 2; taken.has(dir); n++) dir = `${base}-${n}`;
    taken.add(dir);
    const level = m?.difficulty ? levelOf(m.difficulty) : undefined;
    const difficulty = level ? level[english ? 2 : 1] : (m?.difficulty ?? '');
    const stop = m?.stop && Object.hasOwn(STOP_NAMES, m.stop) ? m.stop : null;
    const solutions = [...item.solutions].sort((a, b) => a.language.localeCompare(b.language));
    const readme = [
      `# ${title}`,
      '',
      `- ${t('题目', 'Problem')}: [${item.problemId}](${origin}/?${new URLSearchParams({ view: 'problem', problem: item.problemId })})`,
      difficulty ? `- ${t('难度', 'Difficulty')}: ${difficulty}` : null,
      m?.topics?.length ? `- ${t('知识点', 'Topics')}: ${m.topics.map((s) => topicName(s, !english)).join(', ')}` : null,
      stop ? `- ${t('Line 500 站', 'Line 500 stop')}: [${t(...STOP_NAMES[stop])}](${origin}/topics/${stop})` : null,
      `- ${t('首次通过', 'First accepted')}: ${localDay(item.firstAc)}`,
      '',
      `| ${t('语言', 'Language')} | ${t('代码', 'Code')} | ${t('最近通过', 'Last accepted')} | ${t('用时', 'Runtime')} |`,
      '| --- | --- | --- | --- |',
      ...solutions.map(
        (s) =>
          `| ${cell(s.language)} | [solution.${extension(s.language)}](solution.${extension(s.language)}) | ${localDay(s.at)} | ${s.runtime == null ? '–' : `${Math.round(s.runtime * 1000)} ms`} |`,
      ),
      notes && item.note?.trim() ? `\n## ${t('笔记', 'Notes')}\n\n${item.note.trim()}` : null,
    ];
    files.push({ name: `${dir}/README.md`, title, data: `${readme.filter((line) => line !== null).join('\n')}\n` });
    for (const s of solutions) files.push({ name: safePath(`${dir}/solution.${extension(s.language)}`), title, data: s.code });
    const topic = m?.topics?.[0];
    const [key, name, rank]: [string, string, number] = stop
      ? [stop, t(...STOP_NAMES[stop]), ROUTE_SLUGS.indexOf(stop)]
      : topic
        ? [`topic:${topic}`, topicName(topic, !english), ROUTE_SLUGS.length]
        : ['', t('其他', 'Other'), ROUTE_SLUGS.length + 1];
    const group = groups.get(key) ?? { name, rank, rows: [] };
    group.rows.push([item, dir]);
    groups.set(key, group);
  }
  const head = `| ${t('题目', 'Problem')} | ${t('难度', 'Difficulty')} | ${t('语言', 'Languages')} | ${t('首次通过', 'First accepted')} |\n| --- | --- | --- | --- |`;
  const index = [
    `# ${t('我的 CSWork 题解', 'My CSWork solutions')}`,
    '',
    ...(oa
      ? [`> ${t('OA 多有保密条款：这个仓库仅供私用，请勿公开。', 'OA problems are often under NDA: keep this repository private and do not publish it.')}`, '']
      : []),
    t(
      `共 ${taken.size} 道通过的题。每题一个目录，放每种语言最近一次通过的代码和 README，不含题面。`,
      `${taken.size} accepted problems, one folder each with every language's latest accepted code and a README; no statements.`,
    ),
    ...[...groups.values()]
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .flatMap((g) => [
        '',
        `## ${g.name}`,
        '',
        head,
        ...g.rows
          .sort(([a], [b]) => (a.meta?.order ?? Infinity) - (b.meta?.order ?? Infinity) || a.problemId.localeCompare(b.problemId, 'en', { numeric: true }))
          .map(([item, dir]) => {
            const level = item.meta?.difficulty ? levelOf(item.meta.difficulty) : undefined;
            const languages = [...new Set(item.solutions.map((s) => s.language))].sort().join(', ');
            return `| [${cell(metaTitle(item.problemId, item.meta, english))}](${encodeURI(`${dir}/`)}) | ${cell(level ? level[english ? 2 : 1] : (item.meta?.difficulty ?? ''))} | ${cell(languages)} | ${localDay(item.firstAc)} |`;
          }),
      ]),
  ];
  return [{ name: 'README.md', title: 'README', data: `${index.join('\n')}\n` }, ...files];
}

/** The progress export's columns: the CSV header and the JSON keys alike. */
export const PROGRESS_COLUMNS = [
  'problem_id', 'title', 'difficulty', 'line500_stop', 'lists', 'first_attempt', 'first_ac', 'attempts',
  'failures_before_ac', 'last_status', 'languages', 'help', 'solve_minutes', 'whiteboard', 'review_level',
  'mastered', 'leech', 'next_review', 'last_grade', 'starred', 'redo',
] as const;
export type ProgressRow = Record<(typeof PROGRESS_COLUMNS)[number], string | number | boolean | null>;
const GRADES = ['Again', 'Hard', 'Good', 'Easy'] as const;

/**
 * One row per problem tried (GET oj/history): attempts, help, solve time, review state, the
 * learner's star and redo marks and the classic lists that hold it (slugs joined by " | ").
 */
export function progressRows(
  history: readonly PracticeHistoryItem[],
  {
    marks,
    titleOf,
    difficultyOf,
  }: {
    marks: readonly { target: string; mark: string }[];
    titleOf: (id: string) => string | null | undefined;
    difficultyOf: (id: string) => string | null | undefined;
  },
): ProgressRow[] {
  const lists = new Map<string, string[]>();
  for (const list of classicLists)
    for (const { number, judge } of list.groups.flatMap(groupEntries)) {
      const id = number ? `lc-${number}` : judge;
      const held = id ? (lists.get(id) ?? []) : [];
      if (id && !held.includes(list.slug)) lists.set(id, [...held, list.slug]);
    }
  const marked = (mark: string) =>
    new Set(marks.flatMap((m) => (m.mark === mark && m.target.startsWith('problem:') ? [m.target.slice(8)] : [])));
  const starred = marked('star');
  const redo = marked('redo');
  return history.map((item) => {
    const state = item.acAt.length ? reviewState(item) : null;
    const difficulty = difficultyOf(item.problemId);
    const grade = [...(item.grades ?? [])].sort((a, b) => a[0] - b[0]).at(-1)?.[1];
    return {
      problem_id: item.problemId,
      title: titleOf(item.problemId) || null,
      difficulty: difficulty ? (levelOf(difficulty)?.[2] ?? difficulty) : null,
      line500_stop: item.stop,
      lists: lists.get(item.problemId)?.join(' | ') ?? null,
      first_attempt: localDay(item.firstAt),
      first_ac: localDay(item.firstAcAt),
      attempts: item.attempts,
      failures_before_ac: item.failuresBeforeAc,
      last_status: item.lastStatus,
      languages: item.languages.join(' | '),
      help: item.help,
      solve_minutes: item.solveSeconds == null ? null : Math.round(item.solveSeconds / 6) / 10,
      whiteboard: item.whiteboard,
      review_level: state?.level ?? null,
      mastered: state?.mastered ?? false,
      leech: state?.leech ?? false,
      // ponytail: the ladder's due day; the daily cap and a break (scheduleReviews) may push it later.
      next_review: state && !state.mastered ? localDay(state.dueAt) : null,
      last_grade: grade ? GRADES[grade - 1] : null,
      starred: starred.has(item.problemId),
      redo: redo.has(item.problemId),
    };
  });
}

/** The rows as CSV: UTF-8 with BOM so spreadsheets read Chinese titles, CRLF lines, formulas defused. */
export function progressCsv(rows: readonly ProgressRow[]) {
  const line = (values: readonly unknown[]) => values.map((value) => csvCell(String(value ?? ''))).join(',');
  return `\uFEFF${[line(PROGRESS_COLUMNS), ...rows.map((row) => line(PROGRESS_COLUMNS.map((key) => row[key])))].join('\r\n')}\r\n`;
}
