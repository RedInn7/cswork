/** Exercise rendered production HTML, not just metadata helper return values. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(join(tmpdir(), 'cswork-seo-http-'));
const entry = resolve('dist/standalone/server.js');
const contentPath = join(dir, 'content.sqlite');
const db = new Database(contentPath);
db.exec(`CREATE TABLE items (
  type TEXT, slug TEXT, title TEXT, summary TEXT, company_slug TEXT, company_name TEXT,
  role TEXT, category TEXT, round TEXT, difficulty TEXT, updated_at TEXT, published_at TEXT, body TEXT, extra TEXT DEFAULT '{}',
  listed INTEGER DEFAULT 1, partial INTEGER DEFAULT 0, dup_of TEXT
);`);
const insert = db.prepare(
  'INSERT INTO items(type,slug,title,summary,body,listed,partial,dup_of) VALUES(?,?,?,?,?,?,?,?)',
);
for (let i = 0; i < 26; i++) {
  insert.run(
    'algorithm',
    `algorithm-${String(i).padStart(2, '0')}`,
    `Algorithm ${i}`,
    'Practice algorithms with worked examples.',
    '## A worked example\n\nUse a hash map to find the answer.\n\nMapping: [q1,q2](A1,A2)->R\n\n```js\nconst seen = new Map();\n```',
    1,
    0,
    null,
  );
}
insert.run(
  'article',
  'unlisted',
  'Unlisted sentinel',
  null,
  'Must not be published.',
  0,
  0,
  null,
);
insert.run(
  'article',
  'partial',
  'Partial sentinel',
  null,
  'Must not be published.',
  1,
  1,
  null,
);
insert.run(
  'article',
  'duplicate',
  'Duplicate sentinel',
  null,
  'Must not be published.',
  1,
  0,
  '{"id":"original"}',
);
insert.run(
  'guide',
  'template-guide',
  'Template company guide',
  'An overview.',
  'A readable guide.',
  1,
  0,
  null,
);
db.close();
// The OA sitemap shard reads published judge versions from the app database.
const appDb = new Database(join(dir, 'app.sqlite'));
migrate(drizzle(appDb), { migrationsFolder: resolve('drizzle') });
appDb.close();
const base = 'http://127.0.0.1:4328';
const server = spawn(process.execPath, [entry], {
  cwd: dirname(entry),
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    NODE_OPTIONS: '--max-old-space-size=1024',
    HOST: '127.0.0.1',
    PORT: '4328',
    APP_URL: base,
    DATABASE_PATH: join(dir, 'app.sqlite'),
    CONTENT_DATABASE_PATH: contentPath,
    BETTER_AUTH_SECRET: 'local-seo-test-only-secret-at-least-32-characters',
    OJ_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
for (const stream of [server.stdout, server.stderr])
  stream.on('data', (chunk) => {
    logs = (logs + chunk).slice(-10000);
  });
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    assert.equal(server.exitCode, null, logs);
    try {
      if ((await fetch(base + '/robots.txt')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  assert(ready, 'Preview did not start: ' + logs);
  async function html(path, expected = 200, headers = {}) {
    const response = await fetch(base + path, { headers });
    assert.equal(response.status, expected, `${path}: ${logs}`);
    return response.text();
  }
  const home = await html('/');
  const visibleHome = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  assert.match(
    visibleHome,
    /<h1[^>]*>Coding practice and software engineering interview prep<\/h1>/,
  );
  assert.match(visibleHome, /href="\/library"/);
  assert.match(home, /name="description"[^>]*content="[^"]*online assessments/);
  assert.match(home, /rel="canonical"[^>]*href="https:\/\/cswork.org\/?"/);
  assert.match(home, /property="og:title"/);
  assert.match(home, /name="twitter:card"/);
  assert.match(home, /application\/ld\+json/);
  const workspace = await html('/?view=account');
  assert.match(workspace, /name="robots"[^>]*content="[^"]*noindex/);
  const catalog = await html('/library');
  assert.match(catalog, /href="\/library\/algorithm\/algorithm-00"/);
  assert.match(catalog, /href="\/library\?page=2"/);
  assert.doesNotMatch(catalog, /(?:Unlisted|Partial|Duplicate) sentinel/);
  const page2 = await html('/library?page=2');
  assert.match(
    page2,
    /rel="canonical"[^>]*href="https:\/\/cswork.org\/library\?page=2"/,
  );
  const article = await html('/library/algorithm/algorithm-00');
  assert.match(article, /<h1[^>]*>Algorithm 0<\/h1>/);
  assert.match(
    article.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
    /Use a hash map to find the answer/,
  );
  assert.match(
    article,
    /rel="canonical"[^>]*href="https:\/\/cswork.org\/library\/algorithm\/algorithm-00"/,
  );
  assert.match(
    article.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
    /\[q1,q2\]\(A1,A2\)/,
  );
  assert.doesNotMatch(article, /href="A1,A2"/);
  for (const path of ['/library/guide/template-guide', '/library?type=guide']) {
    assert.match(await html(path), /name="robots"[^>]*content="[^"]*noindex/);
  }
  for (const path of [
    '/library/article/unlisted',
    '/library/article/partial',
    '/library/article/duplicate',
    '/library/article/missing',
    '/library?type=private',
    '/library?page=99999',
  ])
    await html(path, 404);
  const robots = await html('/robots.txt');
  assert.match(robots, /Sitemap: https:\/\/cswork.org\/sitemap.xml/);
  assert.match(robots, /Disallow: \/api\//);
  const sitemap = await html('/sitemap.xml');
  let allMaps = sitemap;
  for (const [, url] of sitemap.matchAll(
    /<loc>(https:\/\/cswork.org\/sitemap\/[^<]+)<\/loc>/g,
  )) {
    allMaps += await html(new URL(url).pathname);
  }
  assert.match(
    allMaps,
    /https:\/\/cswork.org\/library\/algorithm\/algorithm-00/,
  );
  assert.match(allMaps, /https:\/\/cswork.org\/oa\/[a-z0-9-]+\/oa-[a-z0-9-]+</);
  assert.doesNotMatch(
    allMaps,
    /article\/(?:unlisted|partial|duplicate)|guide\/template-guide|view=|localhost/,
  );
  // Static pages are listed before the library in the first shard.
  assert.match(allMaps, /<loc>https:\/\/cswork.org\/acm-io<\/loc>/);
  const acmIo = await html('/acm-io');
  assert.match(
    acmIo,
    /rel="canonical"[^>]*href="https:\/\/cswork.org\/acm-io"/,
  );
  assert.match(acmIo, /ACM 模式输入输出模板/);
  assert.match(acmIo, /while \(cin &gt;&gt; a &gt;&gt; b\)/);
  assert.match(acmIo, /"@type":"BreadcrumbList"/);
  const privacy = await html('/privacy');
  assert.match(
    privacy,
    /rel="canonical"[^>]*href="https:\/\/cswork.org\/privacy"/,
  );
  console.log(
    'SEO HTTP checks passed: server-rendered content, metadata, pagination, exclusions, real 404s and sitemaps.',
  );
} finally {
  server.kill('SIGTERM');
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) return resolveExit();
    server.once('exit', resolveExit);
    setTimeout(() => {
      server.kill('SIGKILL');
      resolveExit();
    }, 5000).unref();
  });
  rmSync(dir, { recursive: true, force: true });
}
