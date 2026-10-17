import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { httpsLink, NOTES_MAX } from '@/lib/applications';
import type { Person } from './auth';
import { HttpError, json, limit, requirePerson } from './http';
import { readJson } from './my-practice';

/**
 * Job-search contacts (db/career-contacts-schema.ts, /career/contacts): people a learner records
 * for their own outreach, read and written by that learner only. A contact may point at one of
 * their own tracker cards; a card deleted later just drops the link.
 */
export const CONTACTS_MAX = 200;
export type Contact = {
  id: string;
  name: string;
  company: string;
  role: string;
  howMet: string;
  url: string;
  /** Epoch ms or null. */
  lastContactAt: number | null;
  nextAt: number | null;
  notes: string;
  /** One of the learner's job_applications, or null. */
  applicationId: string | null;
  createdAt: number;
  updatedAt: number;
};

const at = z.number().int().min(0).max(4102444800000).nullable(); // up to 2100
const text = (max: number) => z.string().trim().max(max);
// No defaults: an update changes only the fields it sends.
const patch = z
  .object({
    name: text(100).min(1),
    company: text(100),
    role: text(120),
    howMet: text(200),
    url: text(500).refine((v) => v === '' || httpsLink(v)),
    lastContactAt: at,
    nextAt: at,
    notes: z.string().max(NOTES_MAX),
    applicationId: z.string().max(64).nullable(),
  })
  .partial()
  .strict();
// A card that is gone (or never was theirs) reads as no link.
const SELECT = `SELECT c.id,c.name,c.company,c.role,c.how_met AS howMet,c.url,c.last_contact_at AS lastContactAt,
  c.next_at AS nextAt,c.notes,a.id AS applicationId,c.created_at AS createdAt,c.updated_at AS updatedAt
  FROM career_contacts c LEFT JOIN job_applications a ON a.id=c.application_id AND a.user_id=c.user_id`;

const own = (userId: string, id: string) =>
  sqlite().prepare(`${SELECT} WHERE c.id=? AND c.user_id=?`).get(id, userId) as Contact | undefined;
function checkApplication(userId: string, id: string | null | undefined) {
  // Someone else's card answers like a missing one.
  if (id && !sqlite().prepare('SELECT 1 FROM job_applications WHERE id=? AND user_id=?').get(id, userId))
    throw new HttpError(404, '投递记录不存在');
}

/** /api/oj/contacts: GET the list, POST one new; POST <id> changes it, POST <id>/delete removes it. */
export async function handleContacts(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const db = sqlite();
  if (request.method === 'GET') {
    if (id) throw new HttpError(404, '接口不存在');
    await limit(p, 'contacts-read', 120);
    const items = db.prepare(`${SELECT} WHERE c.user_id=? ORDER BY c.updated_at DESC LIMIT ${CONTACTS_MAX}`).all(p.id);
    return json({ items, max: CONTACTS_MAX });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'contacts-write', 60);
  const now = Date.now();
  if (!id) {
    const d = patch.required({ name: true }).parse(await readJson(request, 16000));
    checkApplication(p.id, d.applicationId);
    const newId = randomUUID();
    // Count and insert in one transaction: two tabs cannot both take the last place.
    db.transaction(() => {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM career_contacts WHERE user_id=?').get(p.id) as { n: number };
      if (n >= CONTACTS_MAX) throw new HttpError(409, '联系人已达上限');
      db.prepare(
        `INSERT INTO career_contacts(id,user_id,name,company,role,how_met,url,last_contact_at,next_at,notes,application_id,
          created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        newId,
        p.id,
        d.name,
        d.company ?? '',
        d.role ?? '',
        d.howMet ?? '',
        d.url ?? '',
        d.lastContactAt ?? null,
        d.nextAt ?? null,
        d.notes ?? '',
        d.applicationId || null,
        now,
        now,
      );
    }).immediate();
    return json({ item: own(p.id, newId) });
  }
  // Someone else's id answers like a missing one.
  if (!own(p.id, id)) throw new HttpError(404, '联系人不存在');
  if (action === 'delete') {
    db.prepare('DELETE FROM career_contacts WHERE id=? AND user_id=?').run(id, p.id);
    return json({ ok: true });
  }
  if (action) throw new HttpError(404, '接口不存在');
  const d = patch.parse(await readJson(request, 16000));
  checkApplication(p.id, d.applicationId);
  const set: Record<string, unknown> = {
    name: d.name,
    company: d.company,
    role: d.role,
    how_met: d.howMet,
    url: d.url,
    last_contact_at: d.lastContactAt,
    next_at: d.nextAt,
    notes: d.notes,
    application_id: d.applicationId === undefined ? undefined : d.applicationId || null,
  };
  const changed = Object.entries(set).filter(([, v]) => v !== undefined);
  db.prepare(
    `UPDATE career_contacts SET ${changed.map(([k]) => `${k}=@${k}`).join(',')}${changed.length ? ',' : ''}updated_at=@now
    WHERE id=@id AND user_id=@user`,
  ).run({ ...Object.fromEntries(changed), now, id, user: p.id });
  return json({ item: own(p.id, id) });
}
