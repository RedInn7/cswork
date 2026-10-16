// /judge-environment: live versions from the worker's heartbeat (else the image's), the commands
// the engine really runs, and a comparison table, in both languages.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { register, createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const mocks = {
  'next/headers': `export const cookies = async () => ({ get: () => (globalThis.__locale ? { value: globalThis.__locale } : undefined) });`,
  'next/link': `import React from ${JSON.stringify(react)};export default function Link({ href, prefetch, children, ...rest }) { return React.createElement('a', { href, ...rest }, children); }`,
  'next/navigation': `export const usePathname = () => '/'; export const useSearchParams = () => new URLSearchParams();`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){if(mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const dir = mkdtempSync(join(tmpdir(), 'cswork-judge-env-'));
process.env.DATABASE_PATH = join(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite.ts');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { default: JudgeEnvironmentPage } = await import('../app/judge-environment/page.tsx');
const { javaCommand } = await import('../lib/server/leetcode-mode.ts');
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const render = async (locale) => {
  globalThis.__locale = locale;
  return new JSDOM(renderToStaticMarkup(await JudgeEnvironmentPage())).window.document;
};

test('versions come from the heartbeat, else the image; commands match the engine; both languages', async () => {
  sqlite()
    .prepare("INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,1,?)")
    .run(Date.now(), JSON.stringify({ languageVersions: { cpp: 'g++ (Debian 14.2.0-19) 14.2.0' } }));
  for (const locale of ['zh', 'en']) {
    const doc = await render(locale);
    assert.equal(doc.querySelectorAll('h1').length, 1);
    const rows = [...doc.querySelectorAll('table')[0].querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    assert.equal(rows.length, 4);
    assert.match(rows[0], /g\+\+ \(Debian 14\.2\.0-19\) 14\.2\.0.*g\+\+ -std=c\+\+20 -O2/);
    assert.match(rows[1], /OpenJDK 21/, 'no live Java version: the image baseline');
    // The JVM flags are javaCommand's, after -Xmx.
    assert.ok(rows[1].includes(javaCommand(262144).slice(2).join(' ')), rows[1]);
    // Every comparison row has a cell per platform.
    const compared = [...doc.querySelectorAll('table')[1].querySelectorAll('tr')];
    assert.ok(compared.every((tr) => tr.children.length === 5));
    assert.ok(doc.querySelector('a[href="/acm-io"]'));
    const text = doc.body.textContent;
    assert.equal(/[一-鿿]/.test(text), locale === 'zh', locale);
    assert.match(text, locale === 'zh' ? /没有 sortedcontainers/ : /not sortedcontainers/);
  }
});
