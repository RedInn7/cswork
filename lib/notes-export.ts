// The notes export (GET oj/notes/export, lib/server/note-export.ts) as an Obsidian vault, and the
// note gist of the review sheet. Pure: the server, components/cheatsheet.tsx and /review-sheet share it.
import { levelOf } from './classic-lists';
import { parseNoteMeta } from './note-meta';
import { STOP_NAMES } from './route-stops';
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
