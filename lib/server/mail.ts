import { createHash } from 'node:crypto';
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

/** One plain-text mail through Resend; `key` makes retries idempotent. Throws unless sent. */
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
  if (!response.ok) throw new Error(`mail not sent (${response.status})`);
}

/** The newsletter's double opt-in mail (lib/server/newsletter.ts). */
export const newsletterConfirmation = (zh: boolean, link: string) =>
  zh
    ? {
        subject: '确认订阅 CSWork 周报',
        text: `点下面的链接确认订阅 CSWork 周报（每周一封：新题、热门讨论、每日一题战报）：\n\n${link}\n\n不是你订阅的？忽略这封邮件就好，不会再收到。`,
      }
    : {
        subject: 'Confirm your CSWork weekly subscription',
        text: `Confirm your subscription to the CSWork weekly (one email a week: new problems, top discussions and daily problem results):\n\n${link}\n\nDidn't subscribe? Ignore this email and you won't hear from us.`,
      };

/** A peer mock interview reminder (lib/server/peer-reminders.ts), a day or an hour ahead. */
export function peerReminderMail(
  zh: boolean,
  m: { soon: boolean; template: string; when: string; partner: string; meetUrl: string; link: string },
) {
  return zh
    ? {
        subject: m.soon ? '同伴模拟面试 1 小时后开始' : `同伴模拟面试提醒：${m.when}`,
        text: `${m.soon ? '你的同伴模拟面试 1 小时后开始。' : '提醒一下：你约了一场同伴模拟面试。'}\n\n类型：${m.template}\n时间：${m.when}\n同伴：${m.partner}\n会议链接：${m.meetUrl || '尚未填写，可以在场次页面里填上'}\n\n场次页面（两轮的候选人和面试官链接都在这里）：\n${m.link}\n\n不想收到这类提醒？下次预约时取消勾选「邮件提醒」。`,
      }
    : {
        subject: m.soon ? 'Your peer mock interview starts in an hour' : `Peer mock interview reminder: ${m.when}`,
        text: `${m.soon ? 'Your peer mock interview starts in an hour.' : 'A reminder: you booked a peer mock interview.'}\n\nType: ${m.template}\nTime: ${m.when}\nPartner: ${m.partner}\nCall link: ${m.meetUrl || 'not set yet; add one on the session page'}\n\nSession page (both rounds' candidate and interviewer links):\n${m.link}\n\nDon't want these reminders? Untick "Email reminders" the next time you book.`,
      };
}

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
