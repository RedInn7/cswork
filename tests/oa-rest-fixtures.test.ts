// REST API problems (lib/http-fixtures.mjs): the offline requests/urlopen stubs (run for real
// when python3 is here), the engine command, the package rules, fixtures that never leave the
// server, and every rest- / REST OA package's reference and incorrect programs.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(join(tmpdir(), 'cswork-rest-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.OJ_ENABLED = 'true';
const { sqlite } = await import('../db/sqlite');
const { ojImportSchema } = await import('../lib/oj-types');
const { HTTP_FIXTURE_BOOTSTRAP, HTTP_FIXTURES_FILE } = await import('../lib/http-fixtures.mjs');
const { run } = await import('../lib/server/oj-engine');
const { cleanOaStatement } = await import('../lib/oa-verified-statement');
const { saveProblemDraft, publishProblemDraft, listPublishedProblems, getPublishedProblem, loadJudgeSnapshot } = await import(
  '../lib/server/oj-problems'
);
const { handleOj } = await import('../lib/server/oj-api');

const packages = JSON.parse(readFileSync('content/rest-api/packages.json', 'utf8')) as OjProblemPackage[];
const programs = JSON.parse(readFileSync('content/rest-api/programs.json', 'utf8')) as Record<
  string,
  { reference: string; mutants: { name: string; code: string }[] }
>;
const OA_REST = ['oa-oracle-6', 'oa-palantir-2', 'oa-rippling-3'];
const python = spawnSync('python3', ['--version']).status === 0;
const teacher: Person = { id: 'rest-teacher', name: 'Teacher', email: 'teacher@rest.test', role: 'teacher', verified: true };
const student: Person = { id: 'rest-student', name: 'Student', email: 'student@rest.test', role: 'student', verified: true };

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

/** A program's stdout under the judge's bootstrap, beside the given fixtures, as the sandbox runs it. */
function stubbed(program: string, fixtures: unknown, input = '') {
  const box = mkdtempSync(join(tmpdir(), 'cswork-rest-box-'));
  try {
    writeFileSync(join(box, 'main.py'), program);
    writeFileSync(join(box, HTTP_FIXTURES_FILE), JSON.stringify(fixtures));
    const done = spawnSync('python3', ['-I', '-c', HTTP_FIXTURE_BOOTSTRAP, 'main.py'], { cwd: box, input, encoding: 'utf8', timeout: 30_000 });
    return { code: done.status, stdout: done.stdout, stderr: done.stderr };
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
}

void test('the stubs ignore the host and the order of parameters, in requests and urlopen alike', { skip: !python && 'python3 missing' }, () => {
  const fixtures = { 'GET /api/items?name=Puerto+Rico&page=2': { data: ['hit'] }, 'GET /api/items': { data: ['root'] } };
  const program = [
    'import json, requests, urllib.request',
    "print(requests.get('https://a.test/api/items', params={'page': 2, 'name': 'Puerto Rico'}).json()['data'][0])",
    "print(requests.get('http://b.test/api/items?page=2&name=Puerto%20Rico').json()['data'][0])",
    "print(requests.get('https://c.test/api/items?page=2', params={'name': 'Puerto Rico'}).json()['data'][0])",
    "with requests.Session() as s: print(s.get('https://a.test/api/items', params=[('name', 'Puerto Rico'), ('page', '2')]).json()['data'][0])",
    "print(json.load(urllib.request.urlopen('https://d.test/api/items?name=Puerto+Rico&page=2'))['data'][0])",
    "print(json.load(urllib.request.urlopen(urllib.request.Request('https://d.test/api/items')))['data'][0])",
    "print(requests.get('https://a.test/api/items', params={'skip': None}).status_code)",
    '',
  ].join('\n');
  const out = stubbed(program, fixtures);
  assert.equal(out.code, 0, out.stderr);
  assert.deepEqual(out.stdout.split('\n'), ['hit', 'hit', 'hit', 'hit', 'hit', 'root', '200', '']);
});

void test('a request outside the fixtures is a 404 with a JSON body; urlopen raises HTTPError', { skip: !python && 'python3 missing' }, () => {
  const program = [
    'import requests, urllib.error, urllib.request',
    "r = requests.get('https://a.test/api/missing', params={'id': 7})",
    "print(r.status_code, r.ok, r.json()['error'], r.json()['request'])",
    'try:',
    '    r.raise_for_status()',
    'except requests.exceptions.HTTPError as e:',
    "    print('raised', e.response.status_code, isinstance(e, requests.RequestException))",
    'try:',
    "    urllib.request.urlopen('https://a.test/api/missing')",
    'except urllib.error.HTTPError as e:',
    "    print('urlopen', e.code)",
    '',
  ].join('\n');
  const out = stubbed(program, { 'GET /api/other': {} });
  assert.equal(out.code, 0, out.stderr);
  assert.deepEqual(out.stdout.split('\n'), ['404 False Not Found GET /api/missing?id=7', 'raised 404 True', 'urlopen 404', '']);
});

void test('real network calls are refused inside the bootstrap', { skip: !python && 'python3 missing' }, () => {
  const program = [
    'import socket',
    'for attempt in (lambda: socket.create_connection(("127.0.0.1", 9)), lambda: socket.socket().connect(("127.0.0.1", 9)),',
    '                lambda: socket.getaddrinfo("example.com", 80)):',
    '    try:',
    '        attempt()',
    "        print('connected')",
    '    except OSError as e:',
    "        print('refused', e.errno)",
    'import sys',
    'print(sys.argv)',
    '',
  ].join('\n');
  const out = stubbed(program, {});
  assert.equal(out.code, 0, out.stderr);
  assert.deepEqual(out.stdout.split('\n'), ['refused 101', 'refused 101', 'refused 101', "['main.py']", '']);
});

void test('the engine runs Python through the bootstrap only when the problem has fixtures', async () => {
  const realFetch = globalThis.fetch;
  const sent: { args: string[]; copyIn: Record<string, { content?: string }> }[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string).cmd[0]);
    return Response.json([{ status: 'Accepted', exitStatus: 0, files: { stdout: '', stderr: '' } }]);
  }) as typeof fetch;
  try {
    const spec = { ...packages[0].problem };
    const program = { language: 'python' as const, source: 'print(1)', cache: {} };
    await run(program, '', spec, AbortSignal.timeout(5000));
    const { httpFixtures: _gone, ...plain } = spec;
    await run(program, '', plain, AbortSignal.timeout(5000));
    await run({ language: 'cpp', source: '', cache: { main: 'f1' } }, '', spec, AbortSignal.timeout(5000));
    assert.deepEqual(sent[0].args, ['/usr/bin/python3', '-I', '-c', HTTP_FIXTURE_BOOTSTRAP, 'main.py']);
    assert.deepEqual(JSON.parse(sent[0].copyIn[HTTP_FIXTURES_FILE].content!), spec.httpFixtures);
    assert.equal(sent[0].copyIn['main.py'].content, 'print(1)');
    assert.deepEqual(sent[1].args, ['/usr/bin/python3', '-I', 'main.py']);
    assert.equal(HTTP_FIXTURES_FILE in sent[1].copyIn, false);
    assert.deepEqual(sent[2].args, ['main']);
    assert.equal(HTTP_FIXTURES_FILE in sent[2].copyIn, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

void test('fixtures need a rest- or oa- id, Python only, GET keys and at most 512 KB; rest- needs them', () => {
  const base = packages[0];
  const variant = (problem: object) => ojImportSchema.safeParse({ ...base, problem: { ...base.problem, ...problem } }).success;
  assert.equal(variant({}), true);
  assert.equal(variant({ id: 'oa-acme-1', courseId: 'gomall' }), true);
  assert.equal(variant({ languages: ['python', 'cpp'] }), false);
  assert.equal(variant({ id: 'lc-1' }), false);
  assert.equal(variant({ httpFixtures: { 'POST /api/x': {} } }), false);
  assert.equal(variant({ httpFixtures: { 'GET api/x': {} } }), false);
  assert.equal(variant({ httpFixtures: { 'GET /api/x y': {} } }), false);
  assert.equal(variant({ httpFixtures: {} }), false);
  assert.equal(variant({ httpFixtures: { 'GET /api/big': 'x'.repeat(512 * 1024) } }), false);
  assert.equal(variant({ httpFixtures: undefined }), false);
  assert.equal(variant({ courseId: 'private-course' }), false);
  for (const pkg of packages) {
    const { problem } = ojImportSchema.parse(pkg);
    assert.match(problem.id, /^rest-\d{2}$/);
    assert.deepEqual(problem.languages, ['python']);
    assert.ok(problem.translations?.en?.description.includes('https://data.cswork.test/api/'), problem.id);
    assert.ok(pkg.cases.filter((c) => !c.hidden).length === 3 && pkg.cases.filter((c) => c.hidden).length >= 20, problem.id);
  }
  for (const id of OA_REST) {
    const pkg = ojImportSchema.parse(JSON.parse(readFileSync(`content/oa-judge/packages/${id}.json`, 'utf8')));
    assert.deepEqual(pkg.problem.languages, ['python']);
    assert.ok(Object.keys(pkg.problem.httpFixtures ?? {}).length > 0, id);
  }
});

void test('published fixtures stay out of the catalogue, the statement and OA display copy; the judge snapshot keeps them', async () => {
  for (const pkg of packages) {
    const draft = await saveProblemDraft(teacher, pkg, null);
    await publishProblemDraft(teacher, pkg.problem.id, draft.draft!.revision);
  }
  const secret = Object.keys(packages[0].problem.httpFixtures!)[0].slice(4);
  const listed = (await listPublishedProblems(null)).filter((p) => p.id.startsWith('rest-'));
  assert.equal(listed.length, packages.length);
  assert.ok(listed.every((p) => p.freeJudge && !('httpFixtures' in p)));
  assert.equal(JSON.stringify(listed).includes(secret), false);
  const problem = await getPublishedProblem(student, 'rest-01');
  assert.equal('httpFixtures' in problem, false);
  const response = await handleOj(new Request('https://cswork.test/api/oj/problems/rest-01'), student, ['problems', 'rest-01']);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.equal(body.includes('httpFixtures') || body.includes(secret), false);
  const snapshot = await loadJudgeSnapshot(problem.versionId);
  assert.deepEqual(snapshot.spec.httpFixtures, packages[0].problem.httpFixtures);
  // OA packages: the display copy drops them too.
  const oa = JSON.parse(readFileSync('content/oa-judge/packages/oa-oracle-6.json', 'utf8')).problem;
  assert.equal('httpFixtures' in cleanOaStatement(oa), false);
  assert.ok(cleanOaStatement(oa).description.includes('/api/inventory'));
});

void test('every reference passes its cases through the stubs; every incorrect program exits normally and fails one', { skip: !python && 'python3 missing' }, () => {
  const sets = [
    ...packages.map((pkg) => ({ pkg, ...programs[pkg.problem.id] })),
    ...OA_REST.map((id) => ({
      pkg: JSON.parse(readFileSync(`content/oa-judge/packages/${id}.json`, 'utf8')) as OjProblemPackage,
      reference: readFileSync(`content/oa-judge/references/${id}.py`, 'utf8'),
      mutants: JSON.parse(readFileSync(`content/oa-judge/mutants/${id}.json`, 'utf8')) as { name: string; code: string }[],
    })),
  ];
  const same = (actual: string, expected: string, checker: string) =>
    checker === 'exact' ? actual === expected : actual.split(/\s+/).join(' ').trim() === expected.split(/\s+/).join(' ').trim();
  for (const { pkg, reference, mutants } of sets) {
    const { id, checker, httpFixtures } = pkg.problem;
    assert.ok(reference && mutants.length >= 2, id);
    for (const c of pkg.cases) {
      const out = stubbed(reference, httpFixtures, c.input);
      assert.equal(out.code, 0, `${id} ${c.name}: ${out.stderr}`);
      assert.ok(same(out.stdout, c.expectedOutput, checker), `${id} ${c.name}: ${out.stdout} != ${c.expectedOutput}`);
    }
    for (const mutant of mutants) {
      const caught = pkg.cases.some((c) => {
        const out = stubbed(mutant.code, httpFixtures, c.input);
        assert.equal(out.code, 0, `${id} ${mutant.name} must exit normally: ${out.stderr}`);
        return !same(out.stdout, c.expectedOutput, checker);
      });
      assert.ok(caught, `${id}: ${mutant.name} survives`);
    }
  }
});
