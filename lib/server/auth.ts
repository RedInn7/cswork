import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { setting, origin, database } from './env';
export type Person = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher';
  verified: boolean;
};
export function auth() {
  const secret = setting('BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('Authentication is not configured');
  return betterAuth({
    appName: 'cswork',
    baseURL: origin(),
    secret,
    // Production only listens on loopback; nginx overwrites this header.
    advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip'] } },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    socialProviders: {
      ...(setting('GOOGLE_CLIENT_ID') && setting('GOOGLE_CLIENT_SECRET')
        ? {
            google: {
              clientId: setting('GOOGLE_CLIENT_ID'),
              clientSecret: setting('GOOGLE_CLIENT_SECRET'),
            },
          }
        : {}),
      ...(setting('GITHUB_CLIENT_ID') && setting('GITHUB_CLIENT_SECRET')
        ? {
            github: {
              clientId: setting('GITHUB_CLIENT_ID'),
              clientSecret: setting('GITHUB_CLIENT_SECRET'),
            },
          }
        : {}),
    },
    account: { identityStrategy: 'provider-id', accountLinking: { enabled: true, allowDifferentEmails: false } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        async sendVerificationOTP({ email, otp }) {
          if (!setting('RESEND_API_KEY') || !setting('MAIL_FROM'))
            throw new Error('Email sign-in is not configured');
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${setting('RESEND_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: setting('MAIL_FROM'),
              to: [email],
              subject: 'cswork 登录验证码',
              text: `你的验证码是 ${otp}，5 分钟内有效。如果不是你发起的登录，请忽略。`,
            }),
          });
          if (!response.ok) throw new Error('邮件发送失败，请稍后重试');
        },
      }),
    ],
  });
}
export async function person(request: Request): Promise<Person | null> {
  let identity: {
    id: string;
    email: string;
    name: string;
    verified: boolean;
  } | null = null;
  if (setting('BETTER_AUTH_SECRET').length >= 32) {
    const s = await auth().api.getSession({ headers: request.headers });
    if (s)
      identity = {
        id: s.user.id,
        email: s.user.email.toLowerCase(),
        name: s.user.name,
        verified: s.user.emailVerified,
      };
  }
  if (!identity) return null;
  const db = database();
  const admins = setting('ADMIN_EMAILS')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const teacher = identity.verified && admins.includes(identity.email);
  await db
    .prepare(
      'INSERT INTO profiles (id,email,name,role,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role',
    )
    .bind(
      identity.id,
      identity.email,
      identity.name,
      teacher ? 'teacher' : 'student',
      Date.now(),
    )
    .run();
  return { ...identity, role: teacher ? 'teacher' : 'student' };
}
