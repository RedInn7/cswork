import { createHash } from 'node:crypto';
import { setting } from './env';

export type AuthMailPurpose =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email';
const subjects: Record<AuthMailPurpose, string> = {
  'sign-in': 'cswork 登录验证码',
  'email-verification': '验证你的 cswork 邮箱',
  'forget-password': '重设你的 cswork 密码',
  'change-email': '确认你的 cswork 新邮箱',
};
const actions: Record<AuthMailPurpose, string> = {
  'sign-in': '登录或注册 cswork',
  'email-verification': '验证邮箱',
  'forget-password': '重设密码',
  'change-email': '修改邮箱',
};
export function mailReady() {
  return !!(setting('RESEND_API_KEY') && setting('MAIL_FROM'));
}
export async function sendAuthOTP({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: AuthMailPurpose;
}) {
  if (!mailReady())
    throw new Error('邮箱验证服务尚未开放，请使用已配置的登录方式或联系老师。');
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
  const key = createHash('sha256')
    .update(`${email}\n${type}\n${otp}`)
    .digest('hex');
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${setting('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `cswork-otp-${key}`,
    },
    body: JSON.stringify({
      from: setting('MAIL_FROM'),
      to: [email],
      subject: subjects[type],
      text: `你正在${actions[type]}。\n\n验证码：${otp}\n\n验证码 5 分钟内有效，请勿转发给他人。如果不是你发起的操作，请忽略这封邮件。`,
    }),
  });
  if (!response.ok) throw new Error('验证码邮件未能发送，请稍后重试。');
}
