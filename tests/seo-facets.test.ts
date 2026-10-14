import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const dir = mkdtempSync(join(tmpdir(), 'seo-facets-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
delete process.env.HIDDEN_COMPANIES;
const { facetIndex, facetPage, facetPaths, facetSlug, parseFacet, companyFacets, MIN_ITEMS, INDEX_ITEMS } = await import(
  '../lib/server/seo-facets'
);
const { itemListJsonLd, facetPageTitle } = await import('../lib/seo');
after(() => rmSync(dir, { recursive: true, force: true }));

const db = new Database(':memory:');
db.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  company_slug TEXT, company_name TEXT, role TEXT, category TEXT, difficulty TEXT, round TEXT,
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL DEFAULT 'Body')`);
let n = 0;
const add = (type: string, company: string | null, o: Record<string, unknown> = {}) => {
  const id = `${type}-${++n}`;
  db.prepare(
    `INSERT INTO items(id,type,slug,title,company_slug,company_name,role,category,published_at,updated_at,partial,listed,dup_of)
     VALUES(@id,@type,@id,@title,@company,@name,@role,@category,@at,@updated,@partial,@listed,@dup)`,
  ).run({
    id, type, title: `Item ${n}`, company, name: company && company[0].toUpperCase() + company.slice(1), role: null, category: null,
    at: `2026-09-${String((n % 28) + 1).padStart(2, '0')}`, updated: null, partial: 0, listed: 1, dup: null, ...o,
  });
};
const SWE = 'Software Engineer';
for (let i = 0; i < 4; i++) add('experience', 'acme', { role: SWE });
for (let i = 0; i < 3; i++) add('interview_question', 'acme', { role: SWE, category: 'Coding & Algorithms' });
add('coding_question', 'acme', { role: 'Data Scientist', updated: '2026-10-12T08:00:00Z' });
add('experience', 'acme', { role: 'Data Scientist' });
for (let i = 0; i < 5; i++) add('experience', 'beta', { role: SWE });
// Another spelling of the same role.
add('experience', 'beta', { role: 'software engineer ' });
// Rows no page may count.
add('experience', 'acme', { role: SWE, partial: 1 });
add('experience', 'acme', { role: SWE, listed: 0 });
add('coding_question', 'acme', { role: SWE, dup: '{"kind":"library"}' });
add('guide', 'acme', { role: SWE });
for (let i = 0; i < 6; i++) add('experience', 'google', { role: SWE });
const hidden = new Set(['google']);

void test('slugs and facet segments', () => {
  assert.equal(facetSlug('Data Manipulation (SQL/Python)'), 'data-manipulation-sql-python');
  assert.equal(facetSlug('Coding & Algorithms'), 'coding-algorithms');
  assert.deepEqual(parseFacet('role-software-engineer'), { kind: 'role', slug: 'software-engineer' });
  assert.deepEqual(parseFacet('cat-coding-algorithms'), { kind: 'cat', slug: 'coding-algorithms' });
  for (const bad of ['software-engineer', 'role-', 'role-Software', 'role--x', 'team-x']) assert.equal(parseFacet(bad), null);
  assert.equal(MIN_ITEMS < INDEX_ITEMS, true);
});

void test('counts: public rows only, spellings merged, hidden companies left out everywhere', () => {
  const index = facetIndex(db, hidden);
  const swe = index.roles.get('software-engineer')!;
  assert.deepEqual([swe.n, swe.experiences, swe.questions, swe.value], [13, 10, 3, SWE]);
  assert.deepEqual(swe.values, [SWE, 'software engineer']);
  assert.equal(index.company.has('google'), false);
  assert.equal(index.company.get('acme')!.role.get('software-engineer')!.n, 7);
  assert.equal(index.cats.get('coding-algorithms')!.n, 3);
  assert.equal(index.company.get('acme')!.role.get('data-scientist')!.updatedAt, '2026-10-12T08:00:00Z');
  // Without the takedown Google counts again.
  assert.equal(facetIndex(db, new Set()).roles.get('software-engineer')!.n, 19);
});

void test('pages: thresholds, noindex below the index bar, items and related links', () => {
  const role = facetPage(db, 'role', 'software-engineer', undefined, hidden)!;
  assert.equal(role.noindex, false);
  assert.equal(role.experiences.length, 10);
  assert.equal(role.questions.length, 3);
  assert.equal(role.questions[0].company, 'Acme', 'a role page names each question’s company');
  assert.equal([...role.experiences, ...role.questions].every((i) => !['guide'].includes(i.type)), true);
  assert.deepEqual(
    role.related.map((r) => [r.path, r.n]),
    [['/company/acme/role-software-engineer', 7], ['/company/beta/role-software-engineer', 6]],
  );
  const cat = facetPage(db, 'cat', 'coding-algorithms', undefined, hidden)!;
  assert.equal(cat.noindex, true, '3–5 items: a page, not indexed');
  assert.equal(facetPage(db, 'role', 'data-scientist', 'acme', hidden), null, 'two items: no page');
  assert.equal(facetPage(db, 'role', 'nope', undefined, hidden), null);
  assert.equal(facetPage(db, 'role', 'software-engineer', 'google', hidden), null, 'hidden company');
  assert.equal(facetPage(db, 'role', 'software-engineer', 'nope', hidden), null, 'no company page');
  assert.equal(facetPage(null, 'role', 'software-engineer'), null);
  const acme = facetPage(db, 'role', 'software-engineer', 'acme', hidden)!;
  assert.equal(acme.company!.slug, 'acme');
  assert.equal(acme.experiences.length + acme.questions.length, 7);
  assert.deepEqual(acme.related.map((r) => r.path), ['/company/acme/cat-coding-algorithms']);
});

void test('sitemap and company links: indexable pages only, with lastmod', () => {
  const paths = facetPaths(db, hidden).map((e) => e.path);
  assert.deepEqual(paths.sort(), ['/company/acme/role-software-engineer', '/company/beta/role-software-engineer', '/roles/software-engineer']);
  assert.equal(facetPaths(db, hidden).every((e) => !!e.updatedAt), true);
  assert.deepEqual(companyFacets(db, 'acme', hidden).map((f) => [f.kind, f.name, f.n]), [['role', SWE, 7]]);
  assert.deepEqual(companyFacets(db, 'google', hidden), []);
});

void test('titles and the ItemList', () => {
  assert.equal(facetPageTitle('en', 'role', SWE, 'Acme'), 'Acme Software Engineer Interview Questions & Experiences | CSWork');
  assert.equal(facetPageTitle('zh', 'cat', '编程与算法'), '编程与算法 面试题 | CSWork');
  const list = JSON.parse(itemListJsonLd('X', [{ name: 'A </script>', path: '/library/experience/a' }]));
  assert.equal(list['@type'], 'ItemList');
  assert.equal(list.itemListElement[0].url, 'https://cswork.org/library/experience/a');
  assert.equal(itemListJsonLd('X', [{ name: '</script>', path: '/' }]).includes('</script>'), false);
});
