import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { APIError } from 'better-auth/api';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { setting, origin, database } from './env';
import { sendAuthOTP } from './mail';
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
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, name: user.name.trim().slice(0, 80) || '学员' },
          }),
        },
        update: {
          before: async (user) => {
            if (user.name === undefined) return { data: user };
            if (
              typeof user.name !== 'string' ||
              !user.name.trim() ||
              user.name.trim().length > 80
            )
              throw new APIError('BAD_REQUEST', {
                message: '昵称需为 1–80 个字符',
              });
            return { data: { ...user, name: user.name.trim() } };
          },
        },
      },
    },
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
    account: {
      identityStrategy: 'provider-id',
      accountLinking: { enabled: true, allowDifferentEmails: false },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        sendVerificationOTP: sendAuthOTP,
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
