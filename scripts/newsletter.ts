/**
 * The CSWork weekly (lib/server/newsletter.ts).
 *
 *   node --env-file=.env --import tsx scripts/newsletter.ts compose [2026-W42]
 *     Composes the issue from the site's data and stores it; /newsletter shows it at once.
 *     Default: the last full ISO week. Recomposing replaces an issue until it has been sent.
 *   node --env-file=.env --import tsx scripts/newsletter.ts send [2026-W42]
 *     Mails pending double opt-in confirmations, then the issue to confirmed subscribers,
 *     about 2 a second (Resend's default limit). Does nothing unless RESEND_API_KEY and
 *     MAIL_FROM are set. Safe to rerun: each subscriber gets each issue once.
 */
import { pathToFileURL } from 'node:url';
import { sqlite } from '../db/sqlite';
import { origin } from '../lib/server/env';
import { mailReady, sendMail } from '../lib/server/mail';
import {
  composeIssue,
  isoWeek,
  readIssue,
  saveIssue,
  sendConfirmation,
  unsubscribeUrl,
  weekStart,
  type Issue,
} from '../lib/server/newsletter';

const DAY = 86400000;
const GAP_MS = 500;

/** The plain-text mail for one subscriber. */
export function issueText(issue: Issue, zh: boolean, token: string) {
  const site = origin();
  const t = (a: string, b: string) => (zh ? a : b);
  const day = (ms: number) => new Date(ms).toISOString().slice(5, 10);
  const lines = [
    t(`CSWork 周报 · ${issue.id}（${day(issue.startsAt)} 至 ${day(issue.startsAt + 6 * DAY)}）`, `CSWork weekly · ${issue.id} (${day(issue.startsAt)} to ${day(issue.startsAt + 6 * DAY)})`),
    '',
  ];
  const section = (title: string, items: string[]) => {
    if (items.length) lines.push(title, ...items, '');
  };
  section(t('本周新题', 'New problems'), issue.problems.map((p) => `- ${p.title} (${p.companyName}): ${site}${p.href}`));
  section(t('学员面经', 'Member interview reports'), issue.experiences.map((e) => `- ${e.title} (${e.companyName}): ${site}${e.href}`));
  section(
    t('每日一题战报', 'Daily problem results'),
    issue.daily.map(
      (d) => `- ${d.date.slice(5)} ${(zh ? d.title : d.titleEn) || d.title}: ${t(`${d.solvers} 人通过`, `${d.solvers} solved`)} ${site}${d.href}`,
    ),
  );
  lines.push(
    t('在网页上看：', 'Read it online: ') + `${site}/newsletter/${issue.id}`,
    t('退订：', 'Unsubscribe: ') + `${site}/newsletter/unsubscribe?token=${token}`,
  );
  return lines.join('\n');
}

async function main() {
  const [command, week] = process.argv.slice(2);
  const start = week ? weekStart(week) : isoWeek(Date.now()).start - 7 * DAY;
  if (start === null || !['compose', 'send'].includes(command)) {
    console.error('usage: scripts/newsletter.ts compose|send [YYYY-Www]');
    process.exit(2);
  }
  const id = isoWeek(start).id;
  if (command === 'compose') {
    const issue = await composeIssue(start);
    saveIssue(issue);
    console.log(
      `${id}: ${issue.problems.length} problems, ${issue.experiences.length} reports, ${issue.daily.length} daily problems`,
    );
    return;
  }
  if (!mailReady()) {
    console.log('Mail is not configured (RESEND_API_KEY, MAIL_FROM): nothing sent.');
    return;
  }
  const issue = await readIssue(id);
  if (!issue) {
    console.error(`${id} has not been composed yet.`);
    process.exit(1);
  }
  const db = sqlite();
  const wait = () => new Promise((r) => setTimeout(r, GAP_MS));
  const pending = db
    .prepare(
      'SELECT user_id,email,locale,token FROM newsletter_subs WHERE unsubscribed_at IS NULL AND confirmed_at IS NULL AND confirm_sent_at IS NULL',
    )
    .all() as { user_id: string; email: string; locale: string; token: string }[];
  for (const sub of pending) {
    await sendConfirmation(sub);
    await wait();
  }
  const due = db
    .prepare(
      `SELECT user_id,email,locale,token FROM newsletter_subs
      WHERE unsubscribed_at IS NULL AND confirmed_at IS NOT NULL AND (last_issue IS NULL OR last_issue<>?)`,
    )
    .all(id) as { user_id: string; email: string; locale: string; token: string }[];
  let sent = 0;
  for (const sub of due) {
    const zh = sub.locale === 'zh';
    try {
      await sendMail({
        to: sub.email,
        subject: zh ? `CSWork 周报 · ${id}` : `CSWork weekly · ${id}`,
        text: issueText(issue, zh, sub.token),
        key: `cswork-newsletter-${id}-${sub.user_id}`,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl(sub.token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      db.prepare('UPDATE newsletter_subs SET last_issue=? WHERE user_id=?').run(id, sub.user_id);
      sent++;
    } catch (error) {
      console.error(`not sent to ${sub.user_id}:`, error instanceof Error ? error.message : error);
    }
    await wait();
  }
  db.prepare('UPDATE newsletter_issues SET sent_at=COALESCE(sent_at,?) WHERE id=?').run(Date.now(), id);
  console.log(`${id}: ${pending.length} confirmations, ${sent}/${due.length} issues sent`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
