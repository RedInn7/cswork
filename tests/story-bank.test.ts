import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import {
  assignStory, blankStory, competenciesFor, keepLinks, parseStory, rankStories, storiesMarkdown, storyBody, wordCount,
  type Story,
} from '../lib/story-bank';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-story-bank-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');

const me: Person = { id: 'story-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'story-other', email: 'other@example.test' };
function send(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
async function call(p: Person, method: string, path: string, body?: unknown) {
  const response = await send(p, method, path, body);
  assert.equal(response.status, 200, path);
  return response.json();
}
before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const story = (patch: Partial<Story>): Story => ({ ...blankStory(), ...patch });

void test('a story round-trips through a note body; junk and unknown competencies are dropped', () => {
  const s = story({ id: 'a1', title: 'Cache rework', action: 'I profiled it', competencies: ['conflict', 'Ownership', 'made-up'] });
  const back = parseStory('story:a1', storyBody(s), 7)!;
  assert.equal(back.id, 'a1');
  assert.equal(back.updatedAt, 7);
  assert.equal(back.action, 'I profiled it');
  assert.deepEqual(back.competencies, ['conflict', 'Ownership']);
  assert.equal(storyBody(s).includes('"id"'), false, 'the id lives in the target');
  assert.equal(parseStory('story:x', 'not json'), null);
  assert.equal(parseStory('content:x', storyBody(s)), null);
});

void test('a question asks for the principles it names and the themes its words point at', () => {
  const wants = competenciesFor('Tell me about a time you disagreed with your manager. (Amazon LP: Have Backbone; Disagree and Commit)');
  assert.ok(wants.includes('Disagree and Commit'));
  assert.ok(wants.includes('conflict'));
  assert.equal(wants.includes('failure'), false);
  assert.ok(competenciesFor('Describe a project that failed').includes('failure'));
});

void test('stories sharing competencies rank first; a pick moves the question off every other story', () => {
  const q = { key: 'interview_question/conflict-1', title: 'Conflict', company: 'Amazon' };
  const a = story({ id: 'a', competencies: ['failure'], updatedAt: 3 });
  const b = story({ id: 'b', competencies: ['conflict', 'Earn Trust'], updatedAt: 1 });
  const c = story({ id: 'c', competencies: [], questions: [q], updatedAt: 2 });
  const ranked = rankStories([a, b, c], ['conflict', 'Earn Trust']);
  assert.deepEqual(ranked.map((r) => r.story.id), ['b', 'a', 'c']);
  assert.deepEqual(ranked[0].matches, ['conflict', 'Earn Trust']);
  // Ties go to the story already planned for the question.
  assert.deepEqual(rankStories([a, c], [], q.key).map((r) => r.story.id), ['c', 'a']);
  const changed = assignStory([a, b, c], 'b', q);
  assert.deepEqual(changed.map((s) => [s.id, s.questions.length]), [['b', 1], ['c', 0]]);
  assert.deepEqual(assignStory([a, b, c], 'c', q), [], 'already planned: nothing to save');
  assert.deepEqual(assignStory([a, b, c], null, q).map((s) => s.id), ['c'], 'clearing the pick');
});

void test('saving the editor keeps links made elsewhere and drops the ones unlinked in it', () => {
  const q = (key: string) => ({ key, title: key, company: null });
  const base = story({ id: 's', title: 'Old', questions: [q('a'), q('b')] });
  // Since opening: question c picked this story on another tab; the editor unlinked b and retitled it.
  const edited = { ...base, title: 'New', questions: [q('a')] };
  const stored = { ...base, questions: [q('a'), q('b'), q('c')] };
  const saved = keepLinks(edited, base, stored);
  assert.equal(saved.title, 'New');
  assert.deepEqual(saved.questions.map((x) => x.key), ['a', 'c']);
  // A question moved to another story elsewhere stays off this one.
  assert.deepEqual(keepLinks(base, base, { ...base, questions: [q('b')] }).questions.map((x) => x.key), ['b']);
  assert.equal(keepLinks(edited, base, null), edited, 'not stored yet');
});

void test('word counts read Chinese and English; the export lists every story with its STAR parts', () => {
  assert.equal(wordCount("I didn't wait for the fix."), 6);
  assert.ok(wordCount('我先复现了问题') >= 3);
  const md = storiesMarkdown(
    [story({ title: 'Cache rework', situation: 'Launch week.', result: 'p99 down 40%', competencies: ['Dive Deep'], questions: [{ key: 'k', title: 'Hardest bug', company: 'Amazon' }] })],
    true,
  );
  assert.ok(md.startsWith('# My STAR stories\n\n## Cache rework'));
  assert.ok(md.includes('**Competencies:** Dive Deep'));
  assert.ok(md.includes('- Hardest bug (Amazon)'));
  assert.ok(md.includes('### Situation\n\nLaunch week.'));
  assert.equal(md.includes('### Task'), false, 'empty parts are left out');
  assert.ok(storiesMarkdown([story({})], false).includes('## 未命名故事'));
});

void test('the notes API stores stories privately and lists them with their bodies', async () => {
  const s = story({ id: 'm1x', title: 'On-call', competencies: ['Ownership'] });
  await call(me, 'PUT', 'notes?target=story:m1x', { body: storyBody(s) });
  await call(me, 'PUT', 'notes?target=content:interview_question/q1', { body: 'my answer' });
  type Items = { items: { target: string; body?: string; updatedAt: number }[] };
  const mine = (await call(me, 'GET', 'notes?prefix=story:')) as Items;
  assert.deepEqual(mine.items.map((i) => i.target), ['story:m1x']);
  assert.equal(parseStory(mine.items[0].target, mine.items[0].body!)?.title, 'On-call');
  assert.equal(((await call(other, 'GET', 'notes?prefix=story:')) as Items).items.length, 0);
  // The plain list is the notes hub: written notes only, stories left out, snippets not bodies.
  const all = (await call(me, 'GET', 'notes')) as Items;
  assert.deepEqual(all.items.map((i) => i.target), ['content:interview_question/q1']);
  assert.equal(all.items.some((i) => 'body' in i), false);
  await call(me, 'PUT', 'notes?target=story:m1x', { body: '' });
  assert.equal(((await call(me, 'GET', 'notes?prefix=story:')) as Items).items.length, 0);
});

void test('stories are capped per learner, since the story list returns every body', async () => {
  const add = sqlite().prepare('INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,?)');
  for (let i = 0; i < 200; i++) add.run(me.id, `story:cap${i}`, '{}', i);
  const status = (target: string) =>
    send(me, 'PUT', `notes?target=${target}`, { body: '{"title":"x"}' }).then(
      (r) => r.status,
      (e: { status?: number }) => e.status,
    );
  assert.equal(await status('story:one-more'), 409);
  assert.equal(await status('story:cap7'), 200, 'editing a story is fine');
  assert.equal(await status('content:interview_question/q2'), 200, 'other notes are not stories');
  sqlite().prepare("DELETE FROM user_notes WHERE user_id=? AND target LIKE 'story:cap%'").run(me.id);
});
