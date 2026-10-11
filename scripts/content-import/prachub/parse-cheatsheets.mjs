// PracHub interview-prep cheatsheets -> parsed/cheatsheets.jsonl (authorized import, editorial sheets only).
// The sheet is the RSC `initialData` prop: content_md (Markdown with [[QCARD:<slug>]] placeholders for its
// question_cards), target_company/target_role and is_editorial. Sheets that are not editorial are users'
// personal prep plans (self-ratings, timeline, …) and are skipped; a title is emitted once. Nested sections
// with lock flags (round -> category -> concept) are walked too: locked ones are dropped and set
// partial=true. Pages that don't match fail loudly with a payload outline instead of emitting junk.
//   /opt/homebrew/bin/node scripts/content-import/prachub/parse-cheatsheets.mjs [--self-test]
import assert from 'node:assert/strict';
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

const tally = { personal: 0, personalSentences: 0, brokenLinks: 0 };

// [[QCARD:<slug>]] -> a list item linking the question at its old-site path (the builder links the ones
// we publish and keeps the text of the rest), with company and difficulty. `*` bullets keep the cards
// out of a neighbouring `-` list.
function card(cards, slug) {
  const c = cards?.[slug];
  if (!c) return ''; // ponytail: every placeholder has its card today
  const about = [
    c.company,
    c.difficulty?.replace(/^./, (ch) => ch.toUpperCase()),
  ].filter(Boolean);
  const title = (c.title || slug).replace(/[[\]\\$]/g, '\\$&');
  return `* [${title}](/${c.has_coding_schema ? 'coding' : 'interview'}-questions/${slug})${about.length ? ` — ${about.join(' · ')}` : ''}`;
}

// Sentences built from the plan owner's profile ("you self-rated it 1/5", "You explicitly selected …").
const PERSONAL =
  /\byou (?:self-rated|rated|selected|flagged|marked|picked|called out)\b|\byou explicitly (?:said|noted|selected|picked|flagged|called)\b|\bself-rat(?:ed|ing)\b|\b[1-5]\/5\b|\byour (?:selected|platform activity|self-ratings?|ratings?|timeline)\b|\bsolved-question\b|\buntil (?:your )?interview\b|_Focus area_/i;
// remark-math pairs "$1 fee … is $-0.6$" from the first "$", so a "$" opening an amount of money is
// escaped. ponytail: amount + word/closing punctuation heuristic; "$0.75 ± $0.30" would still pair.
const CURRENCY =
  /(?<![\\$])\$(?=\d[\d,]*(?:\.\d+)?(?:\s?(?:[kKmMbB]n?|million|billion))?(?:\s+[A-Za-z]{2,}|[”"’',)\]–]|\.(?:\s|$)|\s*$))/gm;

/** content_md -> our Markdown: question cards, profile sentences dropped, broken links ("[Book](citation)")
 *  as text, TeX fit for remark-math. `inline code` is left alone (the sheets have no fences). */
function tidy(md, cards) {
  return md
    .replace(
      /^([ \t]*(?:[-*+>][ \t]+|\d+[.)][ \t]+)*)(.+)$/gm,
      (line, lead, text) => {
        const kept = text.replace(/(?:[^.!?]|[.!?](?=\S))+[.!?]*\s*/g, (s) =>
          PERSONAL.test(s) ? (tally.personalSentences++, '') : s,
        );
        return kept === text ? line : kept.trim() ? lead + kept.trimEnd() : '';
      },
    )
    .replace(
      /\[\[QCARD:([^\]]+)\]\](\n\s*(?=\[\[QCARD:))?/g,
      (_, slug, next) => card(cards, slug) + (next ? '\n' : ''),
    )
    .replace(
      /(`[^`\n]*`)|(?<!!)\[([^\]\n]*)\]\((?!<?(?:https?:\/\/|\/|#|mailto:))([^()\n]*)\)/g,
      (all, code, text, to) => {
        if (code) return all;
        tally.brokenLinks++;
        const note = to.replace(/`/g, '').trim(); // "`Wiley, 2015`" is worth keeping
        return /^(?:[\w ]*citation)?$/i.test(note) ? text : `${text} (${note})`;
      },
    )
    .split(/(`[^`\n]*`)/)
    .map((part, i) =>
      // KaTeX has no \* (a Markdown escape remark-math keeps): "m^\*" -> "m^*".
      i % 2 ? part : part.replace(CURRENCY, '\\$').replace(/\^\\\*/g, '^*'),
    )
    .join('');
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
  // A user's own plan (their ratings, timeline, …), not the site's guide.
  if (sheet.is_editorial !== true) {
    tally.personal++;
    return 'personal';
  }
  const sections = kidsOf(sheet);
  const hidden = { count: 0 };
  const parts = sections.length
    ? sections.map((s) => render(s, 2, hidden))
    : [scrub(markdownOf(sheet))];
  const body = tidy(
    parts.filter(Boolean).join('\n\n'),
    sheet.question_cards,
  );
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
    company: companyOf(
      sheet.target_company ?? sheet.company ?? sheet.company_name,
    ),
    role: str(sheet.target_role ?? sheet.position ?? sheet.role),
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
      // TeX ($…$, $$…$$) the old site rendered with KaTeX; CSWORK loads remark-math for these.
      math:
        /(?<!\\)\$[^$\n]*(?<!\\)\$/.test(body.replace(/`[^`\n]*`/g, '')) ||
        undefined,
    },
    sourceUrl: sourceUrl(TYPE, slug),
    partial:
      hidden.count > 0 ||
      /Premium section/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '')),
  };
}

function selfTest() {
  const cards = {
    a: {
      title: 'Two [Sum]',
      company: 'Meta',
      difficulty: 'easy',
      has_coding_schema: true,
    },
    b: { title: 'Design X', difficulty: 'hard' },
  };
  assert.equal(
    tidy(
      [
        '**Practice questions**',
        '',
        '[[QCARD:a]]',
        '',
        '[[QCARD:b]]',
        '',
        '- Focus here: you self-rated it 1/5. Keep this.',
        'A $1 fee is $-0.6$ and `$5 fee` stays; $m^\\*$.',
        '- [Book](citation), [Other](`Wiley, 2015`), [Ok](/concepts/x), `a[i](j)`',
      ].join('\n'),
      cards,
    ),
    [
      '**Practice questions**',
      '',
      '* [Two \\[Sum\\]](/coding-questions/a) — Meta · Easy',
      '* [Design X](/interview-questions/b) — Hard',
      '',
      '- Keep this.',
      'A \\$1 fee is $-0.6$ and `$5 fee` stays; $m^*$.',
      '- Book, Other (Wiley, 2015), [Ok](/concepts/x), `a[i](j)`',
    ].join('\n'),
  );
  console.log('self-test ok');
}

if (isMain(import.meta.url)) {
  if (process.argv[2] === '--self-test') selfTest();
  else {
    const { items, stats } = run('cheatsheets', TYPE, parseCheatsheet);
    // One sheet per title: the most complete (longest body).
    const best = new Map();
    for (const it of items)
      if (!(best.get(it.title)?.body.length >= it.body.length))
        best.set(it.title, it);
    const kept = [...best.values()];
    stats.duplicate += items.length - kept.length;
    stats.emitted = kept.length;
    stats.partial = kept.filter((it) => it.partial).length;
    stats.personal = tally.personal; // run() has no counter of its own for it
    save('cheatsheets', { items: kept, stats });
    console.log(
      `[cheatsheets] dropped ${tally.personalSentences} profile sentences, ${tally.brokenLinks} broken links`,
    );
  }
}
