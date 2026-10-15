import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import {
  APPLICATIONS_MAX,
  httpsLink,
  NOTES_MAX,
  STAGES,
  type Application,
  type ApplicationFields,
} from '@/lib/applications';
import { oaCompanyPath } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { HttpError, json, limit, requirePerson } from './http';
import { reportCompanies } from './learner-cloud';
import { mockPresetFor } from './mock-oa-presets';
import { readJson } from './my-practice';
import { oaLibrary } from './oa-library';

/**
 * The application tracker (db/applications-schema.ts, /career/tracker): a learner's own job
 * applications, read and written by their owner only. Calendar and CSV exports are built in the
 * browser (lib/applications.ts).
 */
const at = z.number().int().min(0).max(4102444800000).nullable(); // up to 2100
const text = (max: number) => z.string().trim().max(max);
// No defaults: an update changes only the fields it sends.
const patch = z
  .object({
    company: text(100).min(1),
    role: text(120),
    stage: z.enum(STAGES),
    appliedAt: at,
    oaDeadline: at,
    interviewAt: at,
    referral: text(120),
    link: text(500).refine((v) => v === '' || httpsLink(v)),
    notes: z.string().max(NOTES_MAX),
  })
  .partial()
  .strict();
const BLANK: Omit<ApplicationFields, 'company'> = {
  role: '',
  stage: 'applied',
  appliedAt: null,
  oaDeadline: null,
  interviewAt: null,
  referral: '',
  link: '',
  notes: '',
};
const COLUMNS = `id,company_slug AS companySlug,company_name AS company,role,stage,applied_at AS appliedAt,
  oa_deadline AS oaDeadline,interview_at AS interviewAt,referral,link,notes,created_at AS createdAt,updated_at AS updatedAt`;
type Row = Omit<Application, 'links'>;

/** The company page a typed name (or slug) is, or ''. */
function companySlug(name: string) {
  const key = name.trim().toLowerCase();
  return reportCompanies().find((c) => c.name.toLowerCase() === key || c.slug === key)?.slug ?? '';
}

/** Adds the company's OA problems and mock OA links where it has them. */
function withLinks(rows: Row[]): Application[] {
  const oa = rows.some((r) => r.companySlug) ? new Set(oaLibrary().companies().map((c) => c.slug)) : new Set();
  return rows.map((r) => {
    if (!r.companySlug) return { ...r, links: null };
    const mock = mockPresetFor(r.companySlug)?.slug;
    return {
      ...r,
      links: { oa: oa.has(r.companySlug) ? oaCompanyPath(r.companySlug) : null, mock: mock ? `/mock-oa/${mock}` : null },
    };
  });
}

const own = (userId: string, id: string) =>
  sqlite().prepare(`SELECT ${COLUMNS} FROM job_applications WHERE id=? AND user_id=?`).get(id, userId) as Row | undefined;

/** /api/oj/applications: GET the list, POST one new; POST <id> changes it, POST <id>/delete removes it. */
export async function handleApplications(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const db = sqlite();
  if (request.method === 'GET') {
    if (id) throw new HttpError(404, '接口不存在');
    await limit(p, 'applications-read', 120);
    const rows = db
      .prepare(`SELECT ${COLUMNS} FROM job_applications WHERE user_id=? ORDER BY updated_at DESC LIMIT ${APPLICATIONS_MAX}`)
      .all(p.id) as Row[];
    return json({ items: withLinks(rows), max: APPLICATIONS_MAX });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'applications-write', 60);
  const now = Date.now();
  if (!id) {
    const d = { ...BLANK, ...patch.required({ company: true }).parse(await readJson(request, 16000)) };
    const newId = randomUUID();
    // Count and insert in one transaction: two tabs cannot both take the last place.
    db.transaction(() => {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM job_applications WHERE user_id=?').get(p.id) as { n: number };
      if (n >= APPLICATIONS_MAX) throw new HttpError(409, '投递记录已达上限');
      db.prepare(
        `INSERT INTO job_applications(id,user_id,company_slug,company_name,role,stage,applied_at,oa_deadline,interview_at,
          referral,link,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(newId, p.id, companySlug(d.company), d.company, d.role, d.stage, d.appliedAt, d.oaDeadline, d.interviewAt, d.referral, d.link, d.notes, now, now);
    }).immediate();
    return json({ item: withLinks([own(p.id, newId)!])[0] });
  }
  // Someone else's id answers like a missing one.
  if (!own(p.id, id)) throw new HttpError(404, '投递记录不存在');
  if (action === 'delete') {
    db.prepare('DELETE FROM job_applications WHERE id=? AND user_id=?').run(id, p.id);
    return json({ ok: true });
  }
  if (action) throw new HttpError(404, '接口不存在');
  const d = patch.parse(await readJson(request, 16000));
  const set: Record<string, unknown> = {
    role: d.role,
    stage: d.stage,
    applied_at: d.appliedAt,
    oa_deadline: d.oaDeadline,
    interview_at: d.interviewAt,
    referral: d.referral,
    link: d.link,
    notes: d.notes,
    ...(d.company !== undefined && { company_name: d.company, company_slug: companySlug(d.company) }),
  };
  const changed = Object.entries(set).filter(([, v]) => v !== undefined);
  db.prepare(
    `UPDATE job_applications SET ${changed.map(([k]) => `${k}=@${k}`).join(',')}${changed.length ? ',' : ''}updated_at=@now
    WHERE id=@id AND user_id=@user`,
  ).run({ ...Object.fromEntries(changed), now, id, user: p.id });
  return json({ item: withLinks([own(p.id, id)!])[0] });
}
