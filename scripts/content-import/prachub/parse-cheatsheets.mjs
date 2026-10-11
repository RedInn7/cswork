// PracHub interview-prep cheatsheets -> parsed/cheatsheets.jsonl (authorized import, public sections only).
// No interview-prep page existed when this was written, so the payload shape is inferred from the other
// PracHub pages: an RSC `initial*` prop holds the sheet, sections nest (round -> category -> concept) and
// carry markdown + lock flags. Locked sections are dropped and set partial=true; pages that don't match
// fail loudly with a payload outline instead of emitting junk.
//   /opt/homebrew/bin/node scripts/content-import/prachub/parse-cheatsheets.mjs
import { meta, sourceUrl } from './common.mjs';
import {
  rscProps,
  isLocked,
  markdownOf,
  scrub,
  shape,
  run,
  save,
  isMain,
  companyOf,
  linksIn,
  iso,
} from './parse-experiences.mjs';

const TYPE = 'interview-prep';
const KIDS =
  /^(?:sections|subsections|children|items|topics|concepts|parts|categories|rounds)$/;
const titleOf = (o) => o.title ?? o.name ?? o.heading ?? null;
const kidsOf = (o) =>
  Object.entries(o).find(
    ([k, v]) =>
      KIDS.test(k) &&
      Array.isArray(v) &&
      v.some((x) => x && typeof x === 'object'),
  )?.[1] ?? [];
const str = (v) => (typeof v === 'string' ? v : (v?.name ?? null));

// The sheet: the largest object-valued `initial*` client prop (any client prop when none is named initial*).
function findSheet(props) {
  const all = props
    .flatMap((p) => Object.entries(p))
    .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
  const named = all.filter(([k]) => k.startsWith('initial'));
  return (
    (named.length ? named : all)
      .map(([, v]) => [JSON.stringify(v).length, v])
      .sort((a, b) => b[0] - a[0])[0]?.[1] ?? null
  );
}

// Markdown for a section and its sub-sections. Locked sections, and titled ones without public text
// (lock placeholders), are left out and counted in `hidden`.
function render(node, depth, hidden) {
  const open = !isLocked(node);
  const text = open ? scrub(markdownOf(node)) : '';
  const kids = open
    ? kidsOf(node)
        .map((k) => render(k, depth + 1, hidden))
        .filter(Boolean)
    : [];
  if (!text && !kids.length) {
    hidden.count++;
    return '';
  }
  const title = titleOf(node);
  return [title && `${'#'.repeat(Math.min(depth, 6))} ${title}`, text, ...kids]
    .filter(Boolean)
    .join('\n\n');
}

const emitted = new Set();

function parseCheatsheet(raw, html) {
  // Aliases (/interview-prep/<seo-slug> with a canonical /interview-prep/<id>) are emitted once.
  const slug =
    /<link rel="canonical" href="https:\/\/prachub\.com\/interview-prep\/([^"/?#]+)"/.exec(
      html,
    )?.[1] ?? raw;
  if (emitted.has(slug)) return 'duplicate';
  const props = rscProps(html);
  const sheet = findSheet(props);
  if (!sheet)
    throw Object.assign(new Error('no cheatsheet object in RSC payload'), {
      detail: shape(props),
    });
  // Sheet-level is_free=false may only mean "not all free": the sections decide, unless it is locked outright.
  if (sheet.locked === true || sheet.is_locked === true) return 'locked';
  const sections = kidsOf(sheet);
  const hidden = { count: 0 };
  const parts = sections.length
    ? sections.map((s) => render(s, 2, hidden))
    : [scrub(markdownOf(sheet))];
  const body = parts.filter(Boolean).join('\n\n');
  if (!body) {
    if (sections.length) return 'locked'; // every section is premium
    throw Object.assign(
      new Error('cheatsheet object has no sections or markdown'),
      { detail: shape(sheet) },
    );
  }
  emitted.add(slug);
  return {
    id: `cs-${slug}`,
    type: 'cheatsheet',
    slug,
    title:
      sheet.title ??
      meta(html, 'og:title')?.replace(/\s*\|\s*PracHub.*$/i, '') ??
      null,
    summary:
      scrub(sheet.description ?? sheet.summary ?? meta(html, 'description')) ||
      null,
    body,
    company: companyOf(sheet.company ?? sheet.company_name),
    role: str(sheet.position ?? sheet.role),
    category: null,
    round: null,
    seniority: str(sheet.seniority),
    difficulty: null,
    tags: [sheet.tags].flat().filter((t) => typeof t === 'string'),
    publishedAt: iso(sheet.published_at ?? sheet.created_at),
    updatedAt: iso(sheet.updated_at),
    relations: linksIn(body),
    extra: {
      sections: sections.map((s, i) => ({
        title: titleOf(s),
        locked: !parts[i],
      })),
    },
    sourceUrl: sourceUrl(TYPE, slug),
    partial:
      hidden.count > 0 ||
      /Premium section/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '')),
  };
}

if (isMain(import.meta.url))
  save('cheatsheets', run('cheatsheets', TYPE, parseCheatsheet));
