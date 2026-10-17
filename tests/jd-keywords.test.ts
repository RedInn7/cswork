// The JD keyword reading without AI (lib/jd-keywords.ts) and the server half of /career/jd's
// keyword mode: aliases map onto one term on word boundaries (Go but not Go-to-market or "Go
// beyond", C but not Series C or C端, SQL but not NoSQL), sections decide must, nice or nothing
// (About us, Benefits), links are dropped, years count only as experience, rounds come from cues,
// and with AI off POST oj/ai/jd takes only skill ids, measures them on the learner's data and
// never sees the posting.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-jd-keywords-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
delete process.env.ANTHROPIC_API_KEY;
const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { handleOj } = await import('../lib/server/oj-api');
const { fail } = await import('../lib/server/http');
const { JD_TERMS, extractTerms, mentions, readJd } = await import('../lib/jd-keywords');
const { JD_SKILLS } = await import('../lib/jd-skills');
const { ROUTE_SLUGS } = await import('../lib/route-stops');
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const job = `Software Engineer, New Grad 2027
About us
We are an AI-first company with Docker swag.
About the role
You'll build go-to-market tooling and react to customer feedback. Apply at https://jobs.example.com/123.
Minimum qualifications:
- BS in Computer Science; strong data structures and algorithms
- Proficiency in Golang, Python or Java; experience with Postgres and k8s
- Familiarity with JS and React.js
Preferred qualifications
- Experience with distributed systems and Kafka
- Knowledge of C/C++
Benefits
The rest of our perks.`;

void test('the table: about 250 terms, every skill covered, no alias claimed twice', () => {
  assert.ok(JD_TERMS.length >= 240, String(JD_TERMS.length));
  for (const skill of JD_SKILLS) assert.ok(JD_TERMS.some((t) => t.skill === skill), skill);
  const seen = new Map<string, string>();
  for (const t of JD_TERMS)
    for (const form of [t.term, ...t.aliases]) {
      assert.ok(!seen.has(form.toLowerCase()), `${form}: ${seen.get(form.toLowerCase())} and ${t.term}`);
      seen.set(form.toLowerCase(), t.term);
      // Each form finds its own term.
      assert.ok(mentions(t.term, `We use ${form} daily.`), form);
    }
});

void test('aliases and boundaries', () => {
  const yes: [string, string][] = [
    ['Kubernetes', 'deploy on k8s'],
    ['PostgreSQL', 'Postgres 15'],
    ['JavaScript', 'modern JS (ES6+)'],
    ['Go', 'services in Golang'],
    ['Go', 'Go, Rust or C++'],
    ['C', 'C/C++ on Linux'],
    ['C++', 'C/C++ on Linux'],
    ['Distributed systems', 'large distributed computing jobs'],
    ['Node.js', 'Node.js.'],
    ['CI/CD', 'own our CI/CD pipelines'],
    ['React', 'React-based dashboards'],
    ['SQL', 'PL/SQL'],
    ['C', 'proficient in C and assembly'],
    ['C', '熟悉C语言和 Linux'],
    ['C', 'Python, C, or Go'],
    ['Go', 'Go is a plus'],
  ];
  const no: [string, string][] = [
    ['Go', 'our go-to-market team'],
    ['Go', 'Go-to-market'],
    ['Go', 'ready to go'],
    ['React', 'react quickly'],
    ['REST', 'the rest of the team'],
    ['Java', 'JavaScript'],
    ['SQL', 'NoSQL stores'],
    ['C', 'Objective-C'],
    ['C', 'C-level executives'],
    ['C', 'C#'],
    ['Node.js', 'every node of the graph'],
    ['Vue', 'a review'],
    ['Spark', 'spark joy'],
    ['C', 'a fast-growing Series C startup'],
    ['C', 'our series C round'],
    ['C', '负责C端产品的后端开发'],
    ['C', '面向 C 端用户'],
    ['Go', 'Go beyond the ordinary'],
    ['Go', 'a real Go-getter'],
  ];
  for (const [term, text] of yes) assert.ok(mentions(term, text), `${term} in "${text}"`);
  for (const [term, text] of no) assert.ok(!mentions(term, text), `${term} not in "${text}"`);
  // A link in the posting is no HTTP requirement.
  assert.deepEqual(extractTerms('Python. Apply at https://jobs.example.com/123 or www.example.com/jobs').map((h) => h.term), ['Python']);
});

void test('must and nice by heading, by "a plus", and the first must sentence wins', () => {
  const hits = Object.fromEntries(extractTerms(job).map((h) => [h.term, h]));
  assert.deepEqual(hits.Go, { term: 'Go', skill: 'go', sentence: 'Proficiency in Golang, Python or Java;', importance: 'must' });
  assert.equal(hits.Kubernetes.skill, undefined);
  assert.equal(hits.Kafka.importance, 'nice');
  assert.equal(hits['Distributed systems'].importance, 'nice');
  // Not go-to-market, not "react to", not "the rest", not the link; About us and Benefits ask for nothing.
  assert.deepEqual(Object.keys(hits).sort(), [
    'Algorithms', 'C', 'C++', 'Data structures', 'Distributed systems', 'Go', 'Java', 'JavaScript', 'Kafka', 'Kubernetes', 'PostgreSQL', 'Python', 'React',
  ].sort());
  // Before the first heading: the blurb (nice) when there are headings, the posting (must) when there are none.
  assert.deepEqual(extractTerms('We are an AI-first company.\nRequirements\nPython').map((h) => [h.term, h.importance]), [['AI', 'nice'], ['Python', 'must']]);
  assert.deepEqual(extractTerms('We are an AI-first company using Python.').map((h) => [h.term, h.importance]), [['Python', 'must'], ['AI', 'must']]);
  // A nice line that says so inline, and the same term asked for again as a must.
  const inline = extractTerms('Requirements: Python.\nExperience with Rust is a plus.\nNice to have: SQL\nRequirements\nSQL every day');
  assert.deepEqual(inline.map((h) => [h.term, h.importance, h.sentence]), [
    ['Python', 'must', 'Python.'],
    ['Rust', 'nice', 'Experience with Rust is a plus.'],
    ['SQL', 'must', 'SQL every day'],
  ]);
  // Chinese headings and terms.
  const zh = extractTerms('任职要求：\n熟悉数据结构与算法，熟练使用 Go\n加分项：\n有分布式系统经验');
  assert.deepEqual(zh.map((h) => [h.term, h.importance]), [
    ['Data structures', 'must'],
    ['Algorithms', 'must'],
    ['Go', 'must'],
    ['Distributed systems', 'nice'],
  ]);  // A one-line "Location: …" or "Salary: …" field is skipped on its own; the lines after it still count.
  const located = extractTerms('Software Engineer\nLocation: New York, NY\nWe build with Python and SQL.\nExperience with distributed systems.\nGo and Kubernetes.');
  assert.deepEqual(located.map((h) => [h.term, h.importance]).sort(), [
    ['Distributed systems', 'must'], ['Go', 'must'], ['Kubernetes', 'must'], ['Python', 'must'], ['SQL', 'must'],
  ].sort());
  const paid = extractTerms('Requirements:\n- Python\nSalary: $120,000 - $150,000\n- Kubernetes\n- AWS\n- SQL');
  assert.deepEqual(paid.map((h) => [h.term, h.importance]).sort(), [['AWS', 'must'], ['Kubernetes', 'must'], ['Python', 'must'], ['SQL', 'must']].sort());
  // A bare Benefits heading still drops what is under it.
  assert.deepEqual(extractTerms('Requirements\nPython\nBenefits:\nFree SQL lessons').map((h) => h.term), ['Python']);
});

void test('the checklist reading: skills once each, musts first, evidence cut to 120, rounds by cue', () => {
  const read = readJd(job);
  assert.deepEqual(read.skills.map((s) => [s.skill, s.importance]), [
    ['dsa', 'must'],
    ['python', 'must'],
    ['java', 'must'],
    ['go', 'must'],
    ['sql', 'must'],
    ['frontend', 'must'],
    ['system-design', 'nice'],
    ['cpp', 'nice'],
  ]);
  // New grad: an OA; any software skill: phone coding and behavioral; distributed systems: design.
  assert.deepEqual(read.likelyRounds, ['oa', 'phone-coding', 'system-design', 'behavioral']);
  const long = readJd(`Requirements: ${'Strong Python skills and the will to ship, '.repeat(6)}every day`);
  assert.equal(long.skills[0].evidence.length, 120);
  assert.ok(long.skills[0].evidence.endsWith('…'));
  assert.deepEqual(readJd('5+ years building Java services. Take-home exercise, then a HackerRank test.').likelyRounds, [
    'oa',
    'phone-coding',
    'system-design',
    'behavioral',
    'take-home',
  ]);
  // "1-2 years" is junior: no design round from years alone; nor from an age or the company's history.
  assert.deepEqual(readJd('1-2 years of Java.').likelyRounds, ['phone-coding', 'behavioral']);
  assert.deepEqual(readJd('Python. Must be at least 18 years of age. We have shipped tools for over 25 years.').likelyRounds, ['phone-coding', 'behavioral']);
  for (const years of ['3+ years of professional software engineering experience', "Minimum 4 years' experience with Python", '3年以上后端开发经验，熟悉 Python'])
    assert.ok(readJd(years).likelyRounds.includes('system-design'), years);
  // Series C and "Go beyond" are no languages.
  assert.deepEqual(readJd('We are a fast-growing Series C startup. Go beyond the ordinary. 负责C端产品。'), { terms: [], skills: [], likelyRounds: [] });
  assert.deepEqual(readJd('We sell shoes and love customers.'), { terms: [], skills: [], likelyRounds: [] });
});

const me: Person = { id: 'jdk-me', name: 'Me', email: 'jdk-me@example.test', role: 'student', verified: true };
const post = (p: Person | null, body: unknown, method = 'POST') =>
  handleOj(
    new Request('https://cswork.test/api/oj/ai/jd', { method, body: method === 'POST' ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json' } }),
    p,
    ['ai', 'jd'],
  );
async function status(p: Person | null, body: unknown, method = 'POST') {
  try {
    return (await post(p, body, method)).status;
  } catch (error) {
    // The real error mapping: a ZodError is 400, anything unexpected 500.
    return fail(error).status;
  }
}

void test('AI off: POST oj/ai/jd measures the skill ids it is sent, and never takes the posting', async () => {
  sqlite()
    .prepare(
      "INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at) VALUES('jdk-1',?,'sql-1','sql','x','accepted',1,1,'judge',1,1)",
    )
    .run(me.id);
  const response = await post(me, { skills: ['sql', 'dsa', 'sql', 'frontend'] });
  assert.equal(response.status, 200);
  const reply = (await response.json()) as { skills: Record<string, unknown>[]; likelyRounds: string[]; planStops: string[] };
  // The same shape as the AI reply, less the quotes the browser keeps: each skill once, measured.
  assert.deepEqual(reply.skills, [
    { skill: 'sql', status: 'partial', done: 1, total: 30, certified: false },
    { skill: 'dsa', status: 'gap', done: 0, total: ROUTE_SLUGS.length, certified: false },
    { skill: 'frontend', status: 'unmeasured', done: 0, total: 0, certified: false },
  ]);
  assert.deepEqual(reply.likelyRounds, []);
  assert.deepEqual(reply.planStops, ROUTE_SLUGS);
  // The posting itself, an unknown skill or a stray field: refused.
  assert.equal(await status(me, { job: 'Requirements: Python, SQL and distributed systems for a new grad role.' }), 400);
  assert.equal(await status(me, { skills: ['kubernetes'] }), 400);
  assert.equal(await status(me, { skills: ['sql'], job: 'x' }), 400);
  assert.equal(await status(me, null, 'GET'), 404);
  assert.equal(await status(null, { skills: ['sql'] }), 401);
  // 30 an hour.
  const busy: Person = { ...me, id: 'jdk-busy', email: 'jdk-busy@example.test' };
  for (let i = 0; i < 30; i++) assert.equal(await status(busy, { skills: ['python'] }), 200);
  assert.equal(await status(busy, { skills: ['python'] }), 429);
});
