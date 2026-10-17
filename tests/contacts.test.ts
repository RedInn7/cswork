// Job-search contacts (lib/server/contacts.ts): each learner's own, at most 200, https links only,
// and linked only to the learner's own tracker cards.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { Contact } from '../lib/server/contacts';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-contacts-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { CONTACTS_MAX } = await import('../lib/server/contacts');

const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const ada = person('ct-ada'),
  ben = person('ct-ben');

async function call(p: Person | null, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body !== undefined && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
  try {
    const r = await handleOj(request, p, url.pathname.split('/').slice(3));
    return { status: r.status, data: (await r.json()) as { item: Contact; items: Contact[]; max: number } };
  } catch (e) {
    const err = e as { status?: number; name?: string };
    return { status: err.status ?? (err.name === 'ZodError' ? 400 : 500), data: null };
  }
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => rmSync(dir, { recursive: true, force: true }));

void test('a learner adds, changes and removes contacts, linked to their own tracker cards', async () => {
  assert.equal((await call(null, 'contacts')).status, 401);
  const card = (await call(ada, 'applications', { company: 'Acme' })).data!.item;
  const made = await call(ada, 'contacts', {
    name: 'Sam Lee',
    company: 'Acme',
    role: 'Engineer',
    howMet: 'Alumni',
    url: 'https://www.linkedin.com/in/sam',
    nextAt: Date.UTC(2099, 0, 2),
    applicationId: card.id,
  });
  assert.equal(made.status, 200);
  const item = made.data!.item;
  assert.deepEqual(
    [item.name, item.company, item.howMet, item.applicationId, item.lastContactAt, item.notes],
    ['Sam Lee', 'Acme', 'Alumni', card.id, null, ''],
  );
  // An update changes only what it sends; '' and null unlink the card.
  const changed = (await call(ada, `contacts/${item.id}`, { notes: 'Coffee chat', lastContactAt: 5 })).data!.item;
  assert.deepEqual([changed.notes, changed.lastContactAt, changed.role, changed.applicationId], ['Coffee chat', 5, 'Engineer', card.id]);
  assert.equal((await call(ada, `contacts/${item.id}`, { applicationId: '' })).data!.item.applicationId, null);
  await call(ada, `contacts/${item.id}`, { applicationId: card.id });
  // A deleted card drops the link.
  await call(ada, `applications/${card.id}/delete`, {});
  assert.equal((await call(ada, 'contacts')).data!.items[0].applicationId, null);
  assert.equal((await call(ada, `contacts/${item.id}/delete`, {})).status, 200);
  assert.deepEqual((await call(ada, 'contacts')).data!.items, []);
});

void test("nobody reads, changes or deletes another learner's contacts or links another learner's card", async () => {
  const { item } = (await call(ada, 'contacts', { name: 'Kim', notes: 'mine' })).data!;
  assert.deepEqual((await call(ben, 'contacts')).data!.items, []);
  assert.equal((await call(ben, `contacts/${item.id}`, { notes: 'theirs' })).status, 404);
  assert.equal((await call(ben, `contacts/${item.id}/delete`, {})).status, 404);
  const bensCard = (await call(ben, 'applications', { company: 'Initech' })).data!.item;
  assert.equal((await call(ada, 'contacts', { name: 'Lou', applicationId: bensCard.id })).status, 404);
  assert.equal((await call(ada, `contacts/${item.id}`, { applicationId: bensCard.id })).status, 404);
  // A link written into the table by hand still shows only to the card's owner.
  sqlite().prepare('UPDATE career_contacts SET application_id=? WHERE id=?').run(bensCard.id, item.id);
  assert.equal((await call(ada, 'contacts')).data!.items[0].applicationId, null);
  assert.deepEqual(sqlite().prepare('SELECT user_id,notes FROM career_contacts WHERE id=?').get(item.id), { user_id: ada.id, notes: 'mine' });
  await call(ada, `contacts/${item.id}/delete`, {});
});

void test('fields are checked: a name, https links only, bounded text, nothing extra', async () => {
  for (const url of ['http://example.com/', 'javascript:alert(1)', 'https://u:p@example.com/', 'nope'])
    assert.equal((await call(ada, 'contacts', { name: 'X', url })).status, 400, url);
  assert.equal((await call(ada, 'contacts', { name: '  ' })).status, 400);
  assert.equal((await call(ada, 'contacts', { company: 'Acme' })).status, 400, 'name is required');
  assert.equal((await call(ada, 'contacts', { name: 'X', notes: 'n'.repeat(2001) })).status, 400);
  assert.equal((await call(ada, 'contacts', { name: 'X', nextAt: -1 })).status, 400);
  assert.equal((await call(ada, 'contacts', { name: 'X', email: 'x@example.com' })).status, 400);
  assert.equal((await call(ada, 'contacts/nope', { notes: 'x' })).status, 404);
  assert.equal((await call(ada, 'contacts/a/b/c', { notes: 'x' })).status, 404);
});

void test('at most 200 contacts a learner', async () => {
  const insert = sqlite().prepare(
    "INSERT INTO career_contacts(id,user_id,name,created_at,updated_at) VALUES(?,?,'Someone',0,0)",
  );
  for (let i = 0; i < CONTACTS_MAX - 1; i++) insert.run(`ct-fill-${i}`, ada.id);
  assert.equal((await call(ada, 'contacts', { name: 'Last' })).status, 200);
  assert.equal((await call(ada, 'contacts', { name: 'One more' })).status, 409);
  assert.equal((await call(ben, 'contacts', { name: 'Ben has room' })).status, 200);
  assert.equal((await call(ada, 'contacts')).data!.items.length, CONTACTS_MAX);
});
