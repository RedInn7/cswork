/**
 * Builds lib/content/resume-projects.json from content/projects/<slug>/: brief.{zh,en}.md (their
 * first `# ` line is the title), meta.json and accept_test.py. reference/ stays out: it only
 * proves the acceptance script passes (scripts/projects/verify.mjs). Order: level, then hours.
 *
 *   node scripts/projects/build.mjs          # write the manifest
 *   node scripts/projects/build.mjs --check  # fail on drift
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONTENT_DIR = 'content/projects';
export const MANIFEST_FILE = 'lib/content/resume-projects.json';
export const LEVELS = ['beginner', 'intermediate', 'advanced'];
/** How the acceptance script reaches the project: BASE_URL http(s)://, BASE_URL tcp://, or CMD. */
export const RUNS = ['http', 'tcp', 'cmd'];
const META_KEYS = ['slug', 'summaryZh', 'summaryEn', 'level', 'roles', 'hours', 'run', 'milestones', 'bulletZh', 'bulletEn', 'deepDive'];

const fail = (slug, message) => {
  throw new Error(`content/projects/${slug}: ${message}`);
};
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const pairs = (list) => Array.isArray(list) && list.every((item) => item && text(item.zh) && text(item.en) && Object.keys(item).length === 2);

/** One project's manifest entry; throws on anything the pages could not show. */
function project(slug) {
  const dir = join(CONTENT_DIR, slug);
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const keys = Object.keys(meta);
  if (keys.length !== META_KEYS.length || META_KEYS.some((key) => !keys.includes(key)))
    fail(slug, `meta.json needs exactly ${META_KEYS.join(', ')}`);
  if (meta.slug !== slug) fail(slug, 'meta slug differs from its folder');
  if (!LEVELS.includes(meta.level)) fail(slug, `level is one of ${LEVELS.join(', ')}`);
  if (!RUNS.includes(meta.run)) fail(slug, `run is one of ${RUNS.join(', ')}`);
  if (!Array.isArray(meta.roles) || !meta.roles.length || !meta.roles.every(text)) fail(slug, 'roles is a non-empty list');
  if (!Number.isInteger(meta.hours) || meta.hours < 1 || meta.hours > 80) fail(slug, 'hours is an integer from 1 to 80');
  if (!pairs(meta.milestones) || meta.milestones.length < 2) fail(slug, 'milestones: at least 2 {zh, en}');
  if (!pairs(meta.deepDive) || meta.deepDive.length < 5 || meta.deepDive.length > 8) fail(slug, 'deepDive: 5 to 8 {zh, en}');
  for (const key of ['summaryZh', 'summaryEn', 'bulletZh', 'bulletEn']) if (!text(meta[key])) fail(slug, `${key} is empty`);
  const brief = {};
  for (const lang of ['zh', 'en']) {
    const body = readFileSync(join(dir, `brief.${lang}.md`), 'utf8');
    const title = /^# (.+)\n+/.exec(body);
    if (!title) fail(slug, `brief.${lang}.md starts with a "# title" line`);
    brief[lang] = { title: title[1].trim(), body: body.slice(title[0].length).trimEnd() + '\n' };
  }
  const accept = readFileSync(join(dir, 'accept_test.py'), 'utf8');
  if (!accept.includes(`https://cswork.org/projects/${slug}`)) fail(slug, 'accept_test.py names its project page');
  const env = meta.run === 'cmd' ? 'CMD' : 'BASE_URL';
  if (!accept.includes(`os.environ.get('${env}'`)) fail(slug, `accept_test.py reads ${env}`);
  return {
    slug,
    titleZh: brief.zh.title,
    titleEn: brief.en.title,
    ...Object.fromEntries(META_KEYS.slice(1).map((key) => [key, meta[key]])),
    briefZh: brief.zh.body,
    briefEn: brief.en.body,
    accept,
  };
}

export function buildManifest() {
  const projects = readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => project(entry.name))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.hours - b.hours || a.slug.localeCompare(b.slug));
  return `${JSON.stringify({ projects }, null, 1)}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const manifest = buildManifest();
  if (process.argv.includes('--check')) {
    if (readFileSync(MANIFEST_FILE, 'utf8') !== manifest) {
      console.error(`out of date: ${MANIFEST_FILE}; run node scripts/projects/build.mjs`);
      process.exit(1);
    }
  } else writeFileSync(MANIFEST_FILE, manifest);
}
