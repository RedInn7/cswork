import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import domainsFile from '@/lib/content/company-domains.json';
import type { Person } from './auth';
import { setting } from './env';
import { HttpError, json, limit, requirePerson } from './http';
import { reportCompanies, requireVerified } from './learner-cloud';
import { mailReady, sendMail, workCodeMail } from './mail';
import { readJson } from './my-practice';

/**
 * The verified employee badge (db/community-schema.ts work_verifications). A learner whose login
 * email is verified asks for a code at a work address on a listed company domain; the server
 * keeps only an HMAC of the address, keyed with a server secret (a plain hash of a guessable
 * address could be checked against a list of names), and one address verifies one account.
 * The badge lasts a year and shows only where its owner switched it on: the public profile,
 * community posts, referral threads. Never on experience comments.
 */
const DAY = 86400000;
export const BADGE_DAYS = 365;
const CODE_MS = 15 * 60000;
const TRIES = 5;
// Codes a day per learner, per address and site-wide: each one is a mail to someone's inbox.
const CODES_PER_DAY = 3;
const SITE_CODES_PER_DAY = 300;
export const PLACEMENTS = ['profile', 'posts', 'referrals'] as const;
export type Placement = (typeof PLACEMENTS)[number];
/** Anyone can open an address here, so it proves no employer. */
export const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'mail.com',
  'zoho.com', 'yandex.com', 'fastmail.com', 'hey.com', 'tutanota.com', 'qq.com', 'foxmail.com', '163.com',
  '126.com', 'yeah.net', 'sina.com', 'sina.cn', 'sohu.com', 'aliyun.com', '139.com', '189.cn', 'outlook.cn',
]);
const DOMAINS: Record<string, string[]> = domainsFile.domains;

// ponytail: falls back to the auth secret, set on every deployment; WORK_EMAIL_SECRET lets it rotate apart.
const key = () => setting('WORK_EMAIL_SECRET') || setting('BETTER_AUTH_SECRET') || 'cswork-test-work-email';
const mac = (value: string) => createHmac('sha256', key()).update(value).digest('base64url');
const domainOf = (email: string) => email.slice(email.lastIndexOf('@') + 1).toLowerCase();

/**
 * The company a work address belongs to: exactly a listed domain of a company with a page. Never
 * any subdomain: big companies relay or hand out mail on theirs (marketplace and booking relays,
 * customer inbound-mail handlers), so a code delivered there proves nothing.
 */
export function employerOf(email: string) {
  const domain = domainOf(email);
  if (FREE_MAIL.has(domain)) return null;
  const slug = Object.keys(DOMAINS).find((s) => DOMAINS[s].includes(domain));
  const company = slug ? reportCompanies().find((c) => c.slug === slug) : undefined;
  return company ? { ...company, domain } : null;
}
/** SQL for the company slug `user`'s badge shows at `placement` (verified within a year, switched on), or NULL. */
export const badgeSql = (user: string, placement: Placement) =>
  `(SELECT company_slug FROM work_verifications WHERE user_id=${user} AND show_${placement}=1
    AND verified_at>strftime('%s','now')*1000-${BADGE_DAYS * DAY})`;
/** A badge's company name while the company keeps its page: a hidden company's badge goes too. */
export const badgeName = (slug: string | null | undefined) =>
  (slug && reportCompanies().find((c) => c.slug === slug)?.name) || null;

type Row = {
  company_slug: string;
  domain: string;
  email_hash: string;
  code_hash: string | null;
  code_expires_at: number | null;
  attempts: number;
  verified_at: number | null;
  show_profile: number;
  show_posts: number;
  show_referrals: number;
};
const row = (userId: string) =>
  sqlite().prepare('SELECT * FROM work_verifications WHERE user_id=?').get(userId) as Row | undefined;
/** The account settings card: never the address, only its company and domain. */
export function workState(userId: string, now = Date.now()) {
  const r = row(userId);
  const expiresAt = r?.verified_at ? r.verified_at + BADGE_DAYS * DAY : null;
  return {
    mail: mailReady(),
    verification: r
      ? {
          company: { slug: r.company_slug, name: badgeName(r.company_slug) ?? r.company_slug },
          domain: r.domain,
          verifiedAt: r.verified_at,
          expiresAt,
          active: !!expiresAt && expiresAt > now,
          pending: !!r.code_hash && (r.code_expires_at ?? 0) > now && r.attempts < TRIES,
          show: { profile: !!r.show_profile, posts: !!r.show_posts, referrals: !!r.show_referrals },
        }
      : null,
  };
}

const bit = (on: boolean | undefined) => (on === undefined ? null : +on);

/** /api/oj/work: GET the state; POST verify {email}, confirm {code}, show {profile?,posts?,referrals?}, remove. */
export async function handleWorkVerify(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  if (request.method === 'GET' && !action) {
    await limit(p, 'work-read', 60);
    return json(workState(p.id));
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'work-write', 20);
  const db = sqlite();
  const now = Date.now();
  if (action === 'verify') {
    requireVerified(p);
    const { email } = z
      .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
      .strict()
      .parse(await readJson(request, 1000));
    if (FREE_MAIL.has(domainOf(email))) throw new HttpError(400, '个人邮箱不能验证员工身份，请用公司邮箱');
    const company = employerOf(email);
    if (!company) throw new HttpError(400, '暂不支持这个邮箱域名，目前只支持有公司页的公司');
    if (!mailReady()) throw new HttpError(503, '邮件服务尚未开放，暂时无法验证工作邮箱');
    // Plus addressing (ada+2@corp.com) reaches the same inbox: it is one address, for one account.
    const hash = mac(email.replace(/\+[^@]*@/, '@'));
    await limit(p, 'work-code', CODES_PER_DAY, 86400);
    await limit({ id: `work:${hash}` } as Person, 'work-code', CODES_PER_DAY, 86400);
    await limit({ id: 'site' } as Person, 'work-code', SITE_CODES_PER_DAY, 86400);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    await sendMail({
      to: email,
      ...workCodeMail(request.headers.get('x-locale') === 'zh', code, company.name),
      key: `cswork-work-${mac(`${email}\n${code}`)}`,
    }).catch((error: unknown) => {
      console.error('mail', error instanceof Error ? error.message : 'unknown');
      throw new HttpError(502, '验证码邮件未能发送，请稍后重试');
    });
    // Renewing the same address keeps the badge meanwhile; another address takes it down until confirmed.
    db.prepare(
      `INSERT INTO work_verifications(user_id,company_slug,domain,email_hash,code_hash,code_expires_at,attempts,created_at)
      VALUES(?,?,?,?,?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET company_slug=excluded.company_slug,
        domain=excluded.domain,email_hash=excluded.email_hash,code_hash=excluded.code_hash,
        code_expires_at=excluded.code_expires_at,attempts=0,
        verified_at=CASE WHEN email_hash=excluded.email_hash THEN verified_at END`,
    ).run(p.id, company.slug, company.domain, hash, mac(`${p.id}:${code}`), now + CODE_MS, now);
    return json(workState(p.id, now));
  }
  if (action === 'confirm') {
    const { code } = z
      .object({ code: z.string().trim().regex(/^\d{6}$/) })
      .strict()
      .parse(await readJson(request, 200));
    const r = row(p.id);
    if (!r?.code_hash || (r.code_expires_at ?? 0) < now || r.attempts >= TRIES)
      throw new HttpError(400, '验证码已失效，请重新获取');
    db.prepare('UPDATE work_verifications SET attempts=attempts+1 WHERE user_id=?').run(p.id);
    const want = Buffer.from(r.code_hash),
      got = Buffer.from(mac(`${p.id}:${code}`));
    if (want.length !== got.length || !timingSafeEqual(want, got)) throw new HttpError(400, '验证码不正确');
    // An address verified by another account over a year ago no longer holds it.
    db.prepare('DELETE FROM work_verifications WHERE email_hash=? AND user_id<>? AND verified_at<=?').run(
      r.email_hash,
      p.id,
      now - BADGE_DAYS * DAY,
    );
    try {
      db.prepare(
        'UPDATE work_verifications SET verified_at=?,code_hash=NULL,code_expires_at=NULL,attempts=0 WHERE user_id=?',
      ).run(now, p.id);
    } catch (error) {
      if ((error as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
      db.prepare('UPDATE work_verifications SET code_hash=NULL WHERE user_id=?').run(p.id);
      throw new HttpError(409, '这个工作邮箱已经验证过另一个账号');
    }
    return json(workState(p.id, now));
  }
  if (action === 'show') {
    const d = z
      .object({ profile: z.boolean(), posts: z.boolean(), referrals: z.boolean() })
      .partial()
      .strict()
      .parse(await readJson(request, 500));
    const { changes } = db
      .prepare(
        `UPDATE work_verifications SET show_profile=COALESCE(?,show_profile),show_posts=COALESCE(?,show_posts),
        show_referrals=COALESCE(?,show_referrals) WHERE user_id=?`,
      )
      .run(bit(d.profile), bit(d.posts), bit(d.referrals), p.id);
    if (!changes) throw new HttpError(404, '还没有验证工作邮箱');
    return json(workState(p.id, now));
  }
  if (action === 'remove') {
    db.prepare('DELETE FROM work_verifications WHERE user_id=?').run(p.id);
    return json(workState(p.id, now));
  }
  throw new HttpError(404, '接口不存在');
}
