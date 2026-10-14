import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { HttpError, limit } from './http';

/**
 * Courses bought as gifts (db/course-gift-schema.ts). The checkout marks the order; once paid
 * the buyer gets a one-time code instead of access, and whoever redeems it (signed in, email
 * verified) gets the course. The buyer can swap an unused code for a new one; a full refund
 * voids an unused code and takes back a redeemed one, as it would for a purchase.
 */
// No 0/O/1/I: codes get read aloud and typed from screenshots. 16 characters = 80 bits.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE = /^[A-HJ-NP-Z2-9]{16}$/;
// ponytail: 2^80 codes, so a UNIQUE clash on issue is not worth a retry loop.
const newCode = () =>
  [...randomBytes(16)]
    .map((b) => ALPHABET[b & 31])
    .join('')
    .replace(/(.{4})(?!$)/g, '$1-');
/** XXXX-XXXX-XXXX-XXXX from whatever was pasted, or null. */
export function giftCode(value: string) {
  const plain = value.replace(/[\s-]/g, '').toUpperCase();
  return CODE.test(plain) ? plain.replace(/(.{4})(?!$)/g, '$1-') : null;
}

type GiftRow = {
  order_id: string;
  buyer_id: string;
  course_id: string;
  code: string | null;
  issued_at: number | null;
  redeemed_at: number | null;
  redeemed_by: string | null;
  revoked_at: number | null;
};
const giftRow = (orderId: string) =>
  sqlite().prepare('SELECT * FROM course_gifts WHERE order_id=?').get(orderId) as GiftRow | undefined;
export const isGift = (orderId: string) => !!giftRow(orderId);
/** SQL: the order `column` names is (or with `negate`, is not) a gift. */
export const giftSql = (column: string, negate = false) =>
  ` AND ${negate ? 'NOT ' : ''}EXISTS(SELECT 1 FROM course_gifts g WHERE g.order_id=${column})`;

function notify(user: string, title: string, body: string, now: number) {
  sqlite()
    .prepare('INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES(?,?,?,?,?,?)')
    .run(randomBytes(16).toString('hex'), user, title, body, '/?view=account', now);
}
const courseTitle = (courseId: string) =>
  (sqlite().prepare('SELECT title FROM courses WHERE id=?').get(courseId) as { title: string } | undefined)?.title ??
  courseId;

/** Marks a new order as a gift; called in the checkout's own transaction. */
export function markGift(orderId: string, buyerId: string, courseId: string, now: number) {
  sqlite()
    .prepare('INSERT OR IGNORE INTO course_gifts(order_id,buyer_id,course_id,created_at) VALUES(?,?,?,?)')
    .run(orderId, buyerId, courseId, now);
}

/** Called in applySession's transaction for a gift order instead of granting the buyer access. */
export function settleGift(orderId: string, paid: boolean, fullyRefunded: boolean, now: number) {
  const db = sqlite();
  const gift = giftRow(orderId);
  if (!gift) return;
  if (paid && !fullyRefunded) {
    if (db.prepare('UPDATE course_gifts SET code=?,issued_at=? WHERE order_id=? AND code IS NULL AND revoked_at IS NULL').run(newCode(), now, orderId).changes)
      notify(gift.buyer_id, '课程礼物的兑换码已生成', courseTitle(gift.course_id), now);
  } else if (fullyRefunded) {
    db.prepare('UPDATE course_gifts SET revoked_at=? WHERE order_id=? AND revoked_at IS NULL').run(now, orderId);
    db.prepare('UPDATE grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(now, `gift:${orderId}`);
  }
}

/** What an order page shows about its gift; the code only to the buyer while it can be used. */
export function giftInfo(orderId: string, viewer: Person) {
  const gift = giftRow(orderId);
  if (!gift) return undefined;
  const usable = !!gift.code && !gift.redeemed_at && !gift.revoked_at;
  return {
    code: usable && viewer.id === gift.buyer_id ? gift.code : null,
    issuedAt: gift.issued_at,
    redeemedAt: gift.redeemed_at,
    revokedAt: gift.revoked_at,
  };
}

/** The buyer swaps an unused code for a new one: the old one stops working at once. */
export async function reissueGift(p: Person, orderId: string) {
  await limit(p, 'gift-reissue', 10, 3600);
  const gift = giftRow(orderId);
  if (!gift || gift.buyer_id !== p.id) throw new HttpError(404, '订单不存在');
  const changed = sqlite()
    .prepare(
      'UPDATE course_gifts SET code=?,issued_at=? WHERE order_id=? AND code IS NOT NULL AND redeemed_at IS NULL AND revoked_at IS NULL',
    )
    .run(newCode(), Date.now(), orderId).changes;
  if (!changed) throw new HttpError(409, '这个兑换码已被使用或已作废');
}

/** Redeems a code for the signed-in learner: one use, and never on a course they already have. */
export async function redeemGift(p: Person, input: unknown) {
  await limit(p, 'gift-redeem', 10);
  await limit(p, 'gift-redeem-hour', 30, 3600);
  if (!p.verified) throw new HttpError(403, '请先验证邮箱');
  const code = giftCode(z.object({ code: z.string().max(60) }).strict().parse(input).code);
  const db = sqlite();
  const now = Date.now();
  return db.transaction(() => {
    const gift = code
      ? (db.prepare('SELECT * FROM course_gifts WHERE code=?').get(code) as GiftRow | undefined)
      : undefined;
    if (!gift || gift.redeemed_at || gift.revoked_at) throw new HttpError(404, '兑换码无效或已被使用');
    if (
      db
        .prepare(
          "SELECT 1 FROM grants WHERE email=? AND (course_id=? OR course_id='*') AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)",
        )
        .get(p.email, gift.course_id, now)
    )
      throw new HttpError(409, '你已经开通了这门课程，兑换码可以留给别人');
    db.prepare('UPDATE course_gifts SET redeemed_at=?,redeemed_by=? WHERE order_id=?').run(now, p.id, gift.order_id);
    db.prepare("INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,'gift',?)").run(
      `gift:${gift.order_id}`,
      p.email,
      gift.course_id,
      now,
    );
    db.prepare('INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)').run(
      randomUUID(),
      p.id,
      'gift.redeem',
      gift.order_id,
      now,
    );
    const title = courseTitle(gift.course_id);
    if (gift.buyer_id !== p.id) notify(gift.buyer_id, '你送出的课程礼物已被兑换', title, now);
    return { courseId: gift.course_id, title };
  })();
}
