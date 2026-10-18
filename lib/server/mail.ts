import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { setting } from './env';

export type AuthMailPurpose =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email';
// [zh, en]
const subjects: Record<AuthMailPurpose, [string, string]> = {
  'sign-in': ['cswork 登录验证码', 'Your cswork sign-in code'],
  'email-verification': ['验证你的 cswork 邮箱', 'Verify your cswork email'],
  'forget-password': ['重设你的 cswork 密码', 'Reset your cswork password'],
  'change-email': ['确认你的 cswork 新邮箱', 'Confirm your new cswork email'],
};
const actions: Record<AuthMailPurpose, [string, string]> = {
  'sign-in': ['登录或注册 cswork', 'sign in or sign up for cswork'],
  'email-verification': ['验证邮箱', 'verify your email'],
  'forget-password': ['重设密码', 'reset your password'],
  'change-email': ['修改邮箱', 'change your email'],
};
export function mailReady() {
  return !!(setting('RESEND_API_KEY') && setting('MAIL_FROM'));
}
export async function sendAuthOTP(
  {
    email,
    otp,
    type,
  }: {
    email: string;
    otp: string;
    type: AuthMailPurpose;
  },
  // better-auth's request context; lib/auth-client.ts sends the site language.
  ctx?: { getHeader: (key: string) => string | null },
) {
  const zh = ctx?.getHeader('x-locale') === 'zh';
  if (!mailReady())
    throw new Error('邮箱验证服务尚未开放，请使用已配置的登录方式或联系老师。');
  const key = createHash('sha256')
    .update(`${email}\n${type}\n${otp}`)
    .digest('hex');
  await sendMail({
    to: email,
    subject: subjects[type][zh ? 0 : 1],
    text: zh
      ? `你正在${actions[type][0]}。\n\n验证码：${otp}\n\n验证码 5 分钟内有效，请勿转发给他人。如果不是你发起的操作，请忽略这封邮件。`
      : `You asked to ${actions[type][1]}.\n\nYour code: ${otp}\n\nThe code is valid for 5 minutes. Don't share it with anyone. If you didn't ask for this, ignore this email.`,
    key: `cswork-otp-${key}`,
  }).catch((error: unknown) => {
    console.error('mail', error instanceof Error ? error.message : 'unknown');
    throw new Error('验证码邮件未能发送，请稍后重试。');
  });
}

/** The longest sendMail waits out rate limits in all: an OTP request waits on it. */
const MAIL_RETRY_MS = 3000;
/**
 * One plain-text mail through Resend; `key` makes retries idempotent. Throws unless sent.
 * Resend's ~2 requests a second are shared by the web process and the worker, so a 429 is sent
 * again with the same key after Retry-After (else 1 s, then 2 s), within MAIL_RETRY_MS.
 * ponytail: each process paces itself; a limiter shared by both if 429s outlast the budget.
 */
export async function sendMail({
  to,
  subject,
  text,
  key,
  headers,
}: {
  to: string;
  subject: string;
  text: string;
  key: string;
  headers?: Record<string, string>;
}) {
  if (!mailReady()) throw new Error('mail is not configured');
  const endpoint = new URL(
    '/emails',
    setting('MAIL_API_BASE_URL') || 'https://api.resend.com',
  );
  // A local capture server is useful for isolated end-to-end tests, never a browser-controlled URL.
  if (
    endpoint.protocol !== 'https:' &&
    !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
  )
    throw new Error('邮件服务地址必须使用 HTTPS');
  for (let retry = 0, waited = 0; ; retry++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${setting('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        from: setting('MAIL_FROM'),
        to: [to],
        subject,
        text,
        ...(headers ? { headers } : {}),
      }),
    });
    if (response.ok) return;
    const after = Number(response.headers.get('retry-after') || NaN) * 1000;
    const wait = Math.max(500, Number.isFinite(after) ? after : 1000 * 2 ** retry);
    if (response.status !== 429 || waited + wait > MAIL_RETRY_MS)
      throw new Error(`mail not sent (${response.status})`);
    waited += wait;
    await delay(wait);
  }
}

/** The newsletter's double opt-in mail (lib/server/newsletter.ts). */
export const newsletterConfirmation = (zh: boolean, link: string) =>
  zh
    ? {
        subject: '确认订阅 CSWork 周报',
        text: `点下面的链接确认订阅 CSWork 周报（每周一封：新题、学员面经、每日一题战报）：\n\n${link}\n\n不是你订阅的？忽略这封邮件就好，不会再收到。`,
      }
    : {
        subject: 'Confirm your CSWork weekly subscription',
        text: `Confirm your subscription to the CSWork weekly (one email a week: new problems, member interview reports and daily problem results):\n\n${link}\n\nDidn't subscribe? Ignore this email and you won't hear from us.`,
      };

/** The work email badge's code (lib/server/work-verify.ts). */
export const workCodeMail = (zh: boolean, code: string, company: string) =>
  zh
    ? {
        subject: 'cswork 员工身份验证码',
        text: `你正在用这个邮箱验证自己是 ${company} 的员工。\n\n验证码：${code}\n\n验证码 15 分钟内有效，请勿转发给他人。cswork 只保存这个邮箱的不可逆摘要，不保存邮箱本身，也不会再给它发邮件。如果不是你发起的操作，请忽略这封邮件。`,
      }
    : {
        subject: 'Your cswork work email code',
        text: `You asked to verify that you work at ${company} with this address.\n\nYour code: ${code}\n\nThe code is valid for 15 minutes. Don't share it with anyone. cswork keeps only a one-way digest of this address, never the address itself, and won't email it again. If you didn't ask for this, ignore this email.`,
      };

/** What a learner's daily reminder holds (lib/server/reminders.ts). */
export type ReminderDigest = {
  /** Problems due for review today (the progress page's review ladder). */
  reviews: number;
  /** A streak of 2+ days with nothing solved today; `breaks`: no streak freeze would cover today. */
  streak: { days: number; freezes: number; breaks: boolean } | null;
  daily: boolean;
  /** Weeklies and starters entered live that start within a day, `at` in the learner's time. */
  contests: { id: string; title: string; at: string }[];
  /** Tracker cards and contacts whose next follow-up is today or earlier (career-outreach). */
  followUps: { applications: number; contacts: number } | null;
};
/** The daily reminder's lines, each with the site path it links to; the notice joins them on one line. */
export function reminderLines(zh: boolean, d: ReminderDigest): [string, string][] {
  const lines: [string, string][] = [];
  if (d.reviews)
    lines.push([
      zh ? `${d.reviews} 道题到了复习时间` : `${d.reviews} ${d.reviews === 1 ? 'problem is' : 'problems are'} due for review`,
      '/?view=progress',
    ]);
  if (d.streak) {
    const { days, freezes, breaks } = d.streak;
    lines.push([
      zh
        ? `已连续打卡 ${days} 天，今天还没有通过的题${breaks ? '，今天不做就断了' : `（本月还剩 ${freezes} 次断签保护）`}`
        : `${days}-day streak and nothing solved today${breaks ? ': solve one today or it ends' : ` (${freezes} streak ${freezes === 1 ? 'freeze' : 'freezes'} left this month)`}`,
      '/?view=progress',
    ]);
  }
  if (d.daily) lines.push([zh ? '今天的每日一题' : 'Today’s daily problem', '/daily']);
  for (const c of d.contests) lines.push([zh ? `${c.title}：${c.at} 开始` : `${c.title}: starts ${c.at}`, `/contest/${c.id}`]);
  if (d.followUps) {
    const n = d.followUps.applications + d.followUps.contacts;
    lines.push([
      zh ? `${n} 项求职跟进到期了` : `${n} job-search ${n === 1 ? 'follow-up is' : 'follow-ups are'} due`,
      d.followUps.applications ? '/career/tracker' : '/career/contacts',
    ]);
  }
  return lines;
}
/** The daily reminder mail: the same lines with their links, where to change it and the one-click unsubscribe. */
export function reminderMail(zh: boolean, lines: [string, string][], site: string, unsubscribe: string) {
  const items = lines.map(([text, path]) => `· ${text}\n  ${site}${path}`).join('\n\n');
  const settings = `${site}/?view=account#reminders`;
  return zh
    ? {
        subject: 'CSWork 今日学习提醒',
        text: `${items}\n\n提醒的时间和内容可以在账户页修改：${settings}\n不想再收到提醒邮件？一键退订：${unsubscribe}`,
      }
    : {
        subject: 'Your CSWork reminder for today',
        text: `${items}\n\nChange when and what you’re reminded of on your account page: ${settings}\nNo more reminder emails? Unsubscribe in one click: ${unsubscribe}`,
      };
}
