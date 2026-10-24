// Resume projects (content/projects -> lib/content/resume-projects.json): the manifest matches the
// folders, every project is complete in both languages, acceptance scripts import only the standard
// library and download as text/x-python, and the repo-link note takes known https hosts only.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { ROLE_KEYS } from '../lib/content/role-paths';
import { parseProjectNote, PROJECT_LEVELS, REPO_LINK } from '../lib/resume-projects';
import type { Person } from '../lib/server/auth';
import { buildManifest, MANIFEST_FILE } from '../scripts/projects/build.mjs';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-projects-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { resumeProjects, resumeProject, projectPaths } = await import('../lib/server/resume-projects');
const { GET } = await import('../app/projects/[slug]/accept/route');

const me: Person = { id: 'projects-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

test('the manifest is the build of content/projects, without the references', () => {
  assert.equal(readFileSync(MANIFEST_FILE, 'utf8'), buildManifest(), 'run node scripts/projects/build.mjs');
  const folders = readdirSync('content/projects').sort();
  assert.deepEqual(resumeProjects.map((p) => p.slug).sort(), folders);
  assert.equal(folders.length, 10);
  for (const slug of folders) assert.ok(existsSync(`content/projects/${slug}/reference`), `${slug} has a reference`);
  const text = readFileSync(MANIFEST_FILE, 'utf8');
  assert.ok(!text.includes('Reference ') && !text.includes('reference/'), 'reference code stays out of the manifest');
  assert.ok(!resumeProject('url-shortener'), 'the take-home already covers a URL shortener');
});

test('every project is complete in both languages', () => {
  const order = resumeProjects.map((p) => PROJECT_LEVELS.indexOf(p.level));
  assert.deepEqual(order, [...order].sort(), 'grouped by level');
  for (const p of resumeProjects) {
    assert.ok(p.roles.every((r) => (ROLE_KEYS as readonly string[]).includes(r)), `${p.slug} roles`);
    // The briefs say the same things: the same sections and table rows in each language.
    const shape = (md: string) => [md.match(/^## /gm)?.length, md.match(/^\|/gm)?.length, md.match(/^```/gm)?.length];
    assert.deepEqual(shape(p.briefZh), shape(p.briefEn), `${p.slug} briefs differ in shape`);
    assert.match(p.briefZh, /## 加分项/);
    assert.match(p.briefEn, /## Extras/);
    assert.ok(/\p{Script=Han}/u.test(p.titleZh + p.bulletZh) && !/\p{Script=Han}/u.test(p.titleEn + p.bulletEn + p.briefEn), p.slug);
    assert.ok(p.bulletZh.includes('{') && p.bulletEn.includes('{'), `${p.slug} bullet templates have placeholders`);
    for (const item of [...p.milestones, ...p.deepDive]) assert.ok(!/\p{Script=Han}/u.test(item.en) && /\p{Script=Han}/u.test(item.zh));
  }
});

test('acceptance scripts use only the Python standard library', () => {
  const run = spawnSync('python3', ['-c', 'import sys, json; print(json.dumps(sorted(sys.stdlib_module_names)))'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const stdlib = new Set(JSON.parse(run.stdout) as string[]);
  for (const p of resumeProjects) {
    const modules = [...p.accept.matchAll(/^(?:import ([\w.]+)|from ([\w.]+) import)/gm)].map((m) => (m[1] ?? m[2]).split('.')[0]);
    assert.ok(modules.length > 3, p.slug);
    assert.deepEqual(modules.filter((m) => !stdlib.has(m)), [], `${p.slug} imports outside the standard library`);
    assert.match(p.accept, /sys\.exit\(1 if failed else 0\)/, `${p.slug} exits non-zero on failure`);
  }
});

test('GET /projects/<slug>/accept is 404 while resume projects are taken down', async () => {
  const response = await GET(new Request('https://cswork.test/projects/kv-wal/accept'), { params: Promise.resolve({ slug: 'kv-wal' }) });
  assert.equal(response.status, 404);
  const missing = await GET(new Request('https://cswork.test/projects/nope/accept'), { params: Promise.resolve({ slug: 'nope' }) });
  assert.equal(missing.status, 404);
  assert.deepEqual(projectPaths().slice(0, 2), [{ path: '/projects' }, { path: `/projects/${resumeProjects[0].slug}` }]);
});

test('repo links: https on GitHub, GitLab or Codeberg only', () => {
  for (const ok of ['https://github.com/ada/rate-limiter', 'https://gitlab.com/group/sub/kv_store/', 'https://codeberg.org/me/mini.redis'])
    assert.ok(REPO_LINK.test(ok), ok);
  for (const bad of ['http://github.com/a/b', 'https://github.com/ada', 'https://github.com.evil.test/a/b', 'https://evil.test/github.com/a',
    'javascript:alert(1)', 'https://github.com/a/b?x=1', 'https://user@github.com/a/b', 'https://github.com/a/b#readme'])
    assert.ok(!REPO_LINK.test(bad), bad);
  assert.equal(parseProjectNote('{"repo":"https://github.com/a/b"}'), 'https://github.com/a/b');
  assert.equal(parseProjectNote('{"repo":"https://github.com/a/b","x":1}'), null);
  assert.equal(parseProjectNote('https://github.com/a/b'), null);
  assert.equal(parseProjectNote(''), null);
});

test('the notes API keeps a project note to a valid repo link, private to its owner', async () => {
  const put = (body: string, p: Person | null = me) => {
    const url = new URL('https://cswork.test/api/oj/notes?target=project:kv-wal');
    return handleOj(new Request(url, { method: 'PUT', body: JSON.stringify({ body }), headers: { 'Content-Type': 'application/json' } }), p, ['notes']).then(
      (r) => r.status,
      (e: { status?: number }) => e.status ?? 400,
    );
  };
  assert.equal(await put(JSON.stringify({ repo: 'https://evil.test/a/b' })), 400);
  assert.equal(await put('just text'), 400);
  assert.equal(await put(JSON.stringify({ repo: 'https://github.com/ada/kv' })), 200);
  assert.equal(await put(JSON.stringify({ repo: 'https://github.com/ada/kv' }), null), 401);
  const get = (p: Person) =>
    handleOj(new Request('https://cswork.test/api/oj/notes?target=project:kv-wal'), p, ['notes']).then((r) => r.json() as Promise<{ body: string }>);
  assert.equal(parseProjectNote((await get(me)).body), 'https://github.com/ada/kv');
  assert.equal((await get({ ...me, id: 'someone-else' })).body, '');
  assert.equal(await put(''), 200, 'an empty body removes the link');
  assert.equal((await get(me)).body, '');
});

test('start and done are marks on content:project/<slug>', async () => {
  const mark = (mark: string, on: boolean) =>
    handleOj(
      new Request('https://cswork.test/api/oj/marks', { method: 'POST', body: JSON.stringify({ target: 'content:project/kv-wal', mark, on }), headers: { 'Content-Type': 'application/json' } }),
      me,
      ['marks'],
    ).then((r) => r.status);
  assert.equal(await mark('doing', true), 200);
  assert.equal(await mark('done', true), 200);
  const items = (await (await handleOj(new Request('https://cswork.test/api/oj/marks?target=content:project/kv-wal'), me, ['marks'])).json()) as {
    items: { mark: string }[];
  };
  assert.deepEqual(items.items.map((i) => i.mark).sort(), ['doing', 'done']);
});
