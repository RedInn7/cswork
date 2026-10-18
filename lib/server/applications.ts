import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import {
  APPLICATIONS_MAX,
  httpsLink,
  JD_MAX,
  NOTES_MAX,
  REFERRAL_STATUS,
  STAGES,
  TIERS,
  type Application,
  type ApplicationFields,
  type StageEntry,
} from '@/lib/applications';
import { SOURCES } from '@/lib/experience';
import { companyHubPath, oaCompanyPath } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { companyDirectory } from './company-hub';
import { library } from './content-library';
import { companyMemberExperiences, memberExperienceStats } from './experience-submissions';
import { HttpError, json, limit, requirePerson } from './http';
import { reportCompanies } from './learner-cloud';
import { mockPresetFor } from './mock-oa-presets';
import { readJson } from './my-practice';
import { oaLibrary } from './oa-library';

/**
 * The application tracker (db/applications-schema.ts, /career/tracker): a learner's own job
 * applications, read and written by their owner only. Calendar and CSV exports are built in the
 * browser (lib/applications.ts). The job description snapshot stays out of the list (300 cards
 * of up to 10 000 characters); GET <id>/jd reads it.
 */
const at = z.number().int().min(0).max(4102444800000).nullable(); // up to 2100
const text = (max: number) => z.string().trim().max(max);
const key = (keys: Readonly<Record<string, unknown>>) => z.string().refine((v) => v === '' || Object.hasOwn(keys, v));
// No defaults: an update changes only the fields it sends.
const patch = z
  .object({
    company: text(100).min(1),
    role: text(120),
    stage: z.enum(STAGES),
    appliedAt: at,
    oaDeadline: at,
    interviewAt: at,
    // Kept at any stage (a partial update may not send the stage); only the Offer stage uses it.
    offerDeadline: at,
    referral: text(120),
    link: text(500).refine((v) => v === '' || httpsLink(v)),
    notes: z.string().max(NOTES_MAX),
    channel: key(SOURCES),
    referralStatus: key(REFERRAL_STATUS),
    nextAction: text(120),
    nextAt: at,
    resumeVersion: text(40),
    tier: key(TIERS),
    jdText: z.string().max(JD_MAX),
  })
  .partial()
  .strict();
const BLANK: Omit<ApplicationFields, 'company'> & { jdText: string } = {
  role: '',
  stage: 'applied',
  appliedAt: null,
  oaDeadline: null,
  interviewAt: null,
  offerDeadline: null,
  referral: '',
  link: '',
  notes: '',
  channel: '',
  referralStatus: '',
  nextAction: '',
  nextAt: null,
  resumeVersion: '',
  tier: '',
  jdText: '',
};
const COLUMNS = `id,company_slug AS companySlug,company_name AS company,role,stage,applied_at AS appliedAt,
  oa_deadline AS oaDeadline,interview_at AS interviewAt,offer_deadline AS offerDeadline,referral,link,notes,channel,
  referral_status AS referralStatus,next_action AS nextAction,next_at AS nextAt,resume_version AS resumeVersion,tier,stage_log AS stageLog,jd_text<>'' AS hasJd,
  created_at AS createdAt,updated_at AS updatedAt`;
type Row = Omit<Application, 'links' | 'stageLog' | 'hasJd' | 'closedAt' | 'prep' | 'process'> & { stageLog: string; hasJd: number };
/** Moves kept per card, the newest. */
const LOG_MAX = 40;


/** The company page a typed name (or slug) is, or ''. */
function companySlug(name: string) {
  const key = name.trim().toLowerCase();
  return reportCompanies().find((c) => c.name.toLowerCase() === key || c.slug === key)?.slug ?? '';
}

/** A posting link without tracking noise: no hash, no query but Greenhouse's job id, no trailing slash. */
function postingKey(link: string) {
  const url = new URL(link),
    job = url.searchParams.get('gh_jid');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${job ? `?gh_jid=${encodeURIComponent(job)}` : ''}`;
}

/**
 * Card links the company's job board stopped listing -> the posting's last sighting. Closed means
 * every matching posting was last seen before its board's own latest sync (kind 'board'): a board
 * that failed to load leaves both behind together, so nothing is reported closed by an outage.
 * Rows age out after KEEP_FOR (lib/server/job-openings.ts); then nothing is shown.
 */
function closedPostings(rows: Row[]) {
  const urls = rows.flatMap((r) => {
    if (!r.link) return [];
    const k = postingKey(r.link),
      q = k.includes('?') ? k.indexOf('?') : k.length;
    return [r.link, k, `${k.slice(0, q)}/${k.slice(q)}`];
  });
  const found = new Map<string, { open: boolean; last: number }>();
  if (!urls.length) return found;
  // ponytail: no index on url, a scan of the last 30 days of openings; index url if the table grows.
  const hits = sqlite()
    .prepare(
      `SELECT j.url,j.last_seen_at AS seen,b.last_seen_at AS board FROM job_openings j
      JOIN job_openings b ON b.kind='board' AND b.company_slug=j.company_slug AND substr(j.id,1,length(b.id))=b.id
      WHERE j.kind<>'board' AND j.url IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(urls)) as { url: string; seen: number; board: number }[];
  for (const h of hits) {
    const k = postingKey(h.url),
      was = found.get(k);
    found.set(k, { open: !!was?.open || h.seen >= h.board, last: Math.max(was?.last ?? 0, h.seen) });
  }
  return found;
}

const PREP: readonly string[] = ['oa', 'phone', 'onsite'];
/**
 * Adds the company's OA problems and mock OA links where it has them, whether the posting has
 * closed, and at OA, phone or onsite the interview prep links. While the learner has an offer
 * deadline ahead, those cards also get the company's median process length (expeditePlan).
 */
function withLinks(rows: Row[], userId: string): Application[] {
  const oa = rows.some((r) => r.companySlug) ? new Set(oaLibrary().companies().map((c) => c.slug)) : new Set();
  const closed = closedPostings(rows);
  const directory = rows.some((r) => r.companySlug && PREP.includes(r.stage)) ? companyDirectory(library()) : null;
  const counts = new Map<string, number>();
  // Library experiences plus approved member posts, as the company page counts them.
  const experiences = (slug: string) => {
    if (!counts.has(slug)) counts.set(slug, (directory?.get(slug)?.experiences ?? 0) + companyMemberExperiences(slug, 0).total);
    return counts.get(slug)!;
  };
  const offerAhead =
    rows.some((r) => r.companySlug && PREP.includes(r.stage)) &&
    !!sqlite()
      .prepare("SELECT 1 FROM job_applications WHERE user_id=? AND stage='offer' AND offer_deadline>?")
      .get(userId, Date.now());
  const medians = new Map<string, number | null>();
  const processWeeks = (slug: string) => {
    if (!medians.has(slug)) medians.set(slug, memberExperienceStats(slug)?.weeks?.median ?? null);
    return medians.get(slug)!;
  };
  return rows.map(({ stageLog, hasJd, ...r }) => {
    const posting = r.link ? closed.get(postingKey(r.link)) : undefined;
    const base = {
      ...r,
      stageLog: JSON.parse(stageLog) as StageEntry[],
      hasJd: !!hasJd,
      closedAt: posting && !posting.open ? posting.last : null,
      links: null,
      prep: null,
      process: null,
    };
    if (!r.companySlug) return base;
    const mock = mockPresetFor(r.companySlug)?.slug;
    const n = PREP.includes(r.stage) ? experiences(r.companySlug) : 0;
    const weeks = offerAhead && PREP.includes(r.stage) ? processWeeks(r.companySlug) : null;
    return {
      ...base,
      links: { oa: oa.has(r.companySlug) ? oaCompanyPath(r.companySlug) : null, mock: mock ? `/mock-oa/${mock}` : null },
      prep: PREP.includes(r.stage)
        ? {
            experiences: n ? { href: `${companyHubPath(r.companySlug)}#experiences`, n } : null,
            problems: `/?${new URLSearchParams({ view: 'problems', company: r.companySlug, sort: 'frequency' })}`,
          }
        : null,
      process: weeks === null ? null : { weeks },
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
    await limit(p, 'applications-read', 120);
    if (id) {
      if (action !== 'jd') throw new HttpError(404, '接口不存在');
      const row = db.prepare('SELECT jd_text AS jd FROM job_applications WHERE id=? AND user_id=?').get(id, p.id);
      if (!row) throw new HttpError(404, '投递记录不存在');
      return json(row);
    }
    const rows = db
      .prepare(`SELECT ${COLUMNS} FROM job_applications WHERE user_id=? ORDER BY updated_at DESC LIMIT ${APPLICATIONS_MAX}`)
      .all(p.id) as Row[];
    return json({ items: withLinks(rows, p.id), max: APPLICATIONS_MAX });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'applications-write', 60);
  const now = Date.now();
  // 10 000 Chinese characters of job description are 30 KB of UTF-8, plus notes and JSON escapes.
  const body = () => readJson(request, 48000);
  if (!id) {
    const d = { ...BLANK, ...patch.required({ company: true }).parse(await body()) };
    const newId = randomUUID();
    // Count and insert in one transaction: two tabs cannot both take the last place.
    db.transaction(() => {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM job_applications WHERE user_id=?').get(p.id) as { n: number };
      if (n >= APPLICATIONS_MAX) throw new HttpError(409, '投递记录已达上限');
      db.prepare(
        `INSERT INTO job_applications(id,user_id,company_slug,company_name,role,stage,applied_at,oa_deadline,interview_at,offer_deadline,
          referral,link,notes,channel,referral_status,next_action,next_at,resume_version,tier,jd_text,stage_log,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        newId, p.id, companySlug(d.company), d.company, d.role, d.stage, d.appliedAt, d.oaDeadline, d.interviewAt, d.offerDeadline, d.referral, d.link, d.notes,
        d.channel, d.referralStatus, d.nextAction, d.nextAt, d.resumeVersion, d.tier, d.jdText, JSON.stringify([[d.stage, now]]), now, now,
      );
    }).immediate();
    return json({ item: withLinks([own(p.id, newId)!], p.id)[0] });
  }
  // Someone else's id answers like a missing one.
  if (!own(p.id, id)) throw new HttpError(404, '投递记录不存在');
  if (action === 'delete') {
    db.prepare('DELETE FROM job_applications WHERE id=? AND user_id=?').run(id, p.id);
    // Its reminder notices carry the company and role (lib/server/reminders.ts ids `<kind>:<id>:<at>`).
    db.prepare("DELETE FROM notifications WHERE user_id=? AND kind='application' AND id LIKE ?").run(p.id, `%:${id}:%`);
    // And its interview retros (user notes retro:<id>/<time>, lib/applications.ts RETRO_TARGET).
    db.prepare('DELETE FROM user_notes WHERE user_id=? AND target LIKE ?').run(p.id, `retro:${id}/%`);
    return json({ ok: true });
  }
  if (action) throw new HttpError(404, '接口不存在');
  const d = patch.parse(await body());
  // Read again after the body: no await from here to the write, so a move appends to the latest log.
  const cur = own(p.id, id);
  if (!cur) throw new HttpError(404, '投递记录不存在');
  const moved = d.stage !== undefined && d.stage !== cur.stage;
  const set: Record<string, unknown> = {
    role: d.role,
    stage: d.stage,
    applied_at: d.appliedAt,
    oa_deadline: d.oaDeadline,
    interview_at: d.interviewAt,
    offer_deadline: d.offerDeadline,
    referral: d.referral,
    link: d.link,
    notes: d.notes,
    channel: d.channel,
    referral_status: d.referralStatus,
    next_action: d.nextAction,
    next_at: d.nextAt,
    resume_version: d.resumeVersion,
    tier: d.tier,
    jd_text: d.jdText,
    stage_log: moved ? JSON.stringify([...(JSON.parse(cur.stageLog) as StageEntry[]), [d.stage, now]].slice(-LOG_MAX)) : undefined,
    ...(d.company !== undefined && { company_name: d.company, company_slug: companySlug(d.company) }),
  };
  const changed = Object.entries(set).filter(([, v]) => v !== undefined);
  db.prepare(
    `UPDATE job_applications SET ${changed.map(([k]) => `${k}=@${k}`).join(',')}${changed.length ? ',' : ''}updated_at=@now
    WHERE id=@id AND user_id=@user`,
  ).run({ ...Object.fromEntries(changed), now, id, user: p.id });
  return json({ item: withLinks([own(p.id, id)!], p.id)[0] });
}
