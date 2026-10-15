// REST API problems (lib/http-fixtures.mjs): the offline requests/urlopen stubs (run for real
// when python3 is here), the engine command, the package rules, fixtures that never leave the
// server (sample runs get the visible cases' only), the /oa/ica link that waits for publication,
// and every rest- / REST OA package's reference and incorrect programs.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

// /oa/ica renders here: its stylesheets load as nothing, next/headers and next/link are stubbed (English).
const react = JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('react')).href);
register(
  `data:text/javascript,${encodeURIComponent(`const mocks={
  'next/headers':'export const cookies=async()=>({get:()=>undefined});export const headers=async()=>new Headers();',
  'next/link':'import {createElement} from ${react.replaceAll("'", "\\'")};export default function Link({href,prefetch,...rest}){return createElement("a",{href,...rest});}'};
export async function resolve(s,c,n){if(mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);
const dir = mkdtempSync(join(tmpdir(), 'cswork-rest-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.OJ_ENABLED = 'true';
const { sqlite } = await import('../db/sqlite');
const { ojImportSchema } = await import('../lib/oj-types');
const { HTTP_FIXTURE_BOOTSTRAP, HTTP_FIXTURES_FILE } = await import('../lib/http-fixtures.mjs');
const { run, runSpec } = await import('../lib/server/oj-engine');
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
const oaPackage = (id: string) => JSON.parse(readFileSync(`content/oa-judge/packages/${id}.json`, 'utf8')) as OjProblemPackage;
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

/** The /oa/ica page's links to the REST API track. */
async function icaRestLinks() {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: IcaIndex } = await import('../app/oa/ica/page');
  return [...renderToStaticMarkup(await IcaIndex()).matchAll(/href="([^"]*problem=rest-[^"]*)"/g)].map((m) => m[1]);
}

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

void test('sample and custom-input runs get only the visible cases\' fixtures; judge and drill runs get them all', async () => {
  const realFetch = globalThis.fetch;
  let sent: Record<string, { content?: string }> = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(init.body as string).cmd[0].copyIn;
    return Response.json([{ status: 'Accepted', exitStatus: 0, files: { stdout: '', stderr: '' } }]);
  }) as typeof fetch;
  const sandboxKeys = async (spec: OjProblemPackage['problem']) => {
    await run({ language: 'python', source: 'print(1)', cache: {} }, '', spec, AbortSignal.timeout(5000));
    return Object.keys(JSON.parse(sent[HTTP_FIXTURES_FILE].content!) as object).sort();
  };
  try {
    let hiddenOnly = 0;
    for (const { problem } of [...packages, ...OA_REST.map(oaPackage)]) {
      const all = Object.keys(problem.httpFixtures!).sort();
      const visible = new Set(problem.visibleFixtureKeys);
      const sample = await sandboxKeys(runSpec(problem, false));
      assert.deepEqual(sample, [...visible].sort(), problem.id);
      assert.ok(sample.every((key) => visible.has(key)), `${problem.id}: a hidden-only fixture reached a sample run`);
      hiddenOnly += all.length - sample.length;
      assert.deepEqual(await sandboxKeys(runSpec(problem, true)), all, problem.id);
    }
    assert.ok(hiddenOnly > 0);
    // rest-01's samples ask for paid / refunded / cancelled orders; shipped and pending are hidden cases' only.
    const rest01 = runSpec(packages.find((p) => p.problem.id === 'rest-01')!.problem, false);
    assert.ok(Object.keys(rest01.httpFixtures!).some((key) => key.includes('status=paid')));
    assert.equal(Object.keys(rest01.httpFixtures!).some((key) => /status=(shipped|pending)/.test(key)), false);
    // OA packages keyed by input: a sample run never sees a hidden case's barcode.
    const oracle = oaPackage('oa-oracle-6');
    const sampleKeys = new Set(Object.keys(runSpec(oracle.problem, false).httpFixtures!));
    for (const c of oracle.cases) {
      const key = `GET /api/inventory?barcode=${c.input.trim()}`;
      assert.ok(key in oracle.problem.httpFixtures!, c.name);
      assert.equal(sampleKeys.has(key), !c.hidden, c.name);
    }
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
  assert.equal(variant({ visibleFixtureKeys: undefined }), false);
  assert.equal(variant({ visibleFixtureKeys: ['GET /api/not-a-fixture'] }), false);
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

void test('/oa/ica links to the REST API track only once rest-01 is published', async () => {
  assert.deepEqual(await icaRestLinks(), []);
});

void test('published fixtures stay out of the catalogue, the statement and OA display copy; the judge snapshot keeps them', async () => {
  for (const pkg of packages) {
    const draft = await saveProblemDraft(teacher, pkg, null);
    await publishProblemDraft(teacher, pkg.problem.id, draft.draft!.revision);
  }
  const secret = Object.keys(packages[0].problem.httpFixtures!)[0].slice(4);
  const listed = (await listPublishedProblems(null)).filter((p) => p.id.startsWith('rest-'));
  assert.equal(listed.length, packages.length);
  // Only the flag that hides the in-browser debugger, which has no stubs, reaches readers.
  assert.ok(listed.every((p) => p.freeJudge && p.httpApi === true && !('httpFixtures' in p)));
  assert.equal(JSON.stringify(listed).includes(secret), false);
  const problem = await getPublishedProblem(student, 'rest-01');
  assert.equal('httpFixtures' in problem, false);
  assert.equal(problem.httpApi, true);
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
  assert.deepEqual(await icaRestLinks(), ['/?view=problem&amp;problem=rest-01']);
});

void test('every reference passes its cases through the stubs; every incorrect program exits normally and fails one', { skip: !python && 'python3 missing' }, () => {
  const sets = [
    ...packages.map((pkg) => ({ pkg, ...programs[pkg.problem.id] })),
    ...OA_REST.map((id) => ({
      pkg: oaPackage(id),
      reference: readFileSync(`content/oa-judge/references/${id}.py`, 'utf8'),
      mutants: JSON.parse(readFileSync(`content/oa-judge/mutants/${id}.json`, 'utf8')) as { name: string; code: string }[],
    })),
  ];
  const same = (actual: string, expected: string, checker: string) =>
    checker === 'exact' ? actual === expected : actual.split(/\s+/).join(' ').trim() === expected.split(/\s+/).join(' ').trim();
  for (const { pkg, reference, mutants } of sets) {
    const { id, checker, httpFixtures } = pkg.problem;
    // Visible cases run with what a sample run gets, so a sample run answers them as the judge does.
    const sample = runSpec(pkg.problem, false).httpFixtures;
    const fixtures = (c: { hidden: boolean }) => (c.hidden ? httpFixtures : sample);
    assert.ok(reference && mutants.length >= 2, id);
    for (const c of pkg.cases) {
      const out = stubbed(reference, fixtures(c), c.input);
      assert.equal(out.code, 0, `${id} ${c.name}: ${out.stderr}`);
      assert.ok(same(out.stdout, c.expectedOutput, checker), `${id} ${c.name}: ${out.stdout} != ${c.expectedOutput}`);
    }
    for (const mutant of mutants) {
      const caught = pkg.cases.some((c) => {
        const out = stubbed(mutant.code, fixtures(c), c.input);
        assert.equal(out.code, 0, `${id} ${mutant.name} must exit normally: ${out.stderr}`);
        return !same(out.stdout, c.expectedOutput, checker);
      });
      assert.ok(caught, `${id}: ${mutant.name} survives`);
    }
  }
});
