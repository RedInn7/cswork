import { sqlite } from '@/db/sqlite';
import { TEMPLATES } from '@/lib/mock-interview';
import { INSTANT_MINUTES, localSlot } from '@/lib/mock-peer';
import { origin } from './env';
import { mailReady, peerReminderMail, sendMail } from './mail';

const HOUR = 3600000;
// Resend's default limit is about 2 requests a second, shared with sign-in mails (scripts/newsletter.ts).
const GAP_MS = 500;
type Due = {
  id: string;
  kind: string;
  slot: number;
  a_user: string;
  a_name: string;
  b_name: string;
  meet_url: string;
  reminded_day_at: number | null;
  reminded_hour_at: number | null;
};

/**
 * Peer mock interview reminders, run every 10 minutes by the judge worker (lib/server/oj-worker.ts):
 * one mail a day ahead (sent from 24 down to 2 hours before) and one an hour ahead, to each side
 * whose request kept reminders on and whose account email is verified. A mail is claimed
 * (reminded_*_at) before it goes out, so no tick or second worker sends it twice; if a send fails the
 * claim is released for the next tick, and the Idempotency-Key keeps a side who already got it from
 * getting it again. Instant requests that found nobody in time are closed here too. Returns mails sent.
 */
export async function sendPeerReminders(now = Date.now()) {
  const db = sqlite();
  db.prepare(`UPDATE mock_match_requests SET status='cancelled',updated_at=? WHERE status='open' AND instant=1 AND created_at<?`).run(
    now,
    now - INSTANT_MINUTES * 60000,
  );
  if (!mailReady()) return 0;
  const due = db
    .prepare(
      `SELECT id,kind,slot,a_user,a_name,b_name,meet_url,reminded_day_at,reminded_hour_at FROM mock_match_pairs
      WHERE status='scheduled' AND slot>? AND slot<=? AND (reminded_day_at IS NULL OR reminded_hour_at IS NULL)`,
    )
    .all(now / HOUR, (now + 24 * HOUR) / HOUR) as Due[];
  const to = db.prepare(
    `SELECT r.user_id,r.tz,r.locale,u.email FROM mock_match_requests r JOIN "user" u ON u.id=r.user_id
    WHERE r.pair_id=? AND r.status='matched' AND r.remind=1 AND u.email_verified=1`,
  );
  let sent = 0;
  let tried = 0;
  for (const pair of due) {
    const lead = pair.slot * HOUR - now;
    const soon = lead <= HOUR;
    // Matched under two hours ahead: only the hour-before mail.
    if (soon ? pair.reminded_hour_at !== null : lead <= 2 * HOUR || pair.reminded_day_at !== null) continue;
    const column = soon ? 'reminded_hour_at' : 'reminded_day_at';
    if (!db.prepare(`UPDATE mock_match_pairs SET ${column}=? WHERE id=? AND ${column} IS NULL`).run(now, pair.id).changes) continue;
    let failed = false;
    for (const r of to.all(pair.id) as { user_id: string; tz: number; locale: string; email: string }[]) {
      const zh = r.locale === 'zh';
      const mail = peerReminderMail(zh, {
        soon,
        template: TEMPLATES.find((t) => t.id === pair.kind)?.name[zh ? 0 : 1] ?? pair.kind,
        when: localSlot(pair.slot, r.tz),
        partner: r.user_id === pair.a_user ? pair.b_name : pair.a_name,
        meetUrl: pair.meet_url,
        link: `${origin()}/?view=mock-peer&pair=${pair.id}`,
      });
      if (tried++) await new Promise((done) => setTimeout(done, GAP_MS));
      try {
        await sendMail({ to: r.email, ...mail, key: `cswork-peer-${pair.id}-${column}-${r.user_id}` });
        sent++;
      } catch (error) {
        failed = true;
        console.error('peer reminder', error instanceof Error ? error.message : 'unknown');
      }
    }
    if (failed) db.prepare(`UPDATE mock_match_pairs SET ${column}=NULL WHERE id=? AND ${column}=?`).run(pair.id, now);
  }
  return sent;
}
