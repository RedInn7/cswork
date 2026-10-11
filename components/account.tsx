'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Link as LinkIcon,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  KeyRound,
  ExternalLink,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, type Boot } from '@/lib/types';
import {
  money,
  orderStatusNames,
  refundStatusNames,
  type CommerceOrder,
  type OrderStatus,
  type RefundStatus,
} from '@/lib/commerce-types';
import { readLocale, useLocale, useT, type Locale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Heading } from './learning';
import '@/app/commerce.css';

// English labels for the shared (Chinese) status maps in lib/commerce-types.
export const orderStatusEn: Record<OrderStatus, string> = {
  creating: 'Preparing checkout',
  pending: 'Awaiting payment',
  processing: 'Processing payment',
  paid: 'Paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
  expired: 'Closed',
};
const refundStatusEn: Record<RefundStatus, string> = {
  requested: 'Submitting',
  pending: 'Refund pending',
  succeeded: 'Refunded',
  failed: 'Refund failed',
  canceled: 'Cancelled',
  requires_action: 'Needs recipient confirmation',
};

type AuthError = { message?: string; code?: string } | null | undefined;
// Runs in event handlers, so the site language is read at call time.
function check(error: AuthError) {
  if (!error) return;
  const zh = readLocale() === 'zh';
  const messages: Record<string, [string, string]> = {
    INVALID_EMAIL_OR_PASSWORD: [
      '邮箱或密码不正确。',
      'Incorrect email or password.',
    ],
    INVALID_PASSWORD: ['当前密码不正确。', 'Your current password is incorrect.'],
    INVALID_OTP: ['验证码不正确，请重新输入。', 'Incorrect code. Please try again.'],
    OTP_EXPIRED: [
      '验证码已过期，请重新发送。',
      'This code has expired. Please request a new one.',
    ],
    TOO_MANY_ATTEMPTS: [
      '尝试次数过多，请重新发送验证码。',
      'Too many attempts. Please request a new code.',
    ],
    PASSWORD_TOO_SHORT: [
      '密码至少需要 12 个字符。',
      'Password must be at least 12 characters.',
    ],
    SESSION_EXPIRED: [
      '请重新登录后再进行这个操作。',
      'Please sign in again to do this.',
    ],
    TOO_MANY_REQUESTS: [
      '操作较频繁，请稍后再试。',
      'Too many requests. Please try again later.',
    ],
  };
  const known = messages[error.code || ''];
  throw new Error(
    known?.[zh ? 0 : 1] ||
      (error.message && (zh ? error.message : englishMessage(error.message))) ||
      (zh
        ? '操作未完成，请稍后重试。'
        : 'Something went wrong. Please try again later.'),
  );
}
function timestamp(value: string | number | Date, locale: Locale) {
  return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
function useCooldown() {
  const [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [until]);
  return {
    seconds: Math.max(0, Math.ceil((until - now) / 1000)),
    start: () => {
      setNow(Date.now());
      setUntil(Date.now() + 60000);
    },
  };
}
function PasswordRecovery({
  email: initialEmail = '',
  onDone,
}: {
  email?: string;
  onDone: () => Promise<void> | void;
}) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail),
    [otp, setOtp] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cooldown = useCooldown();
  async function send() {
    setBusy(true);
    setError('');
    try {
      check((await authClient.emailOtp.requestPasswordReset({ email })).error);
      setSent(true);
      cooldown.start();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!sent) {
          await send();
          return;
        }
        setBusy(true);
        setError('');
        try {
          if (password !== confirm)
            throw new Error(
              t('两次输入的密码不一致。', "Passwords don't match."),
            );
          check(
            (await authClient.emailOtp.resetPassword({ email, otp, password }))
              .error,
          );
          setPassword('');
          setConfirm('');
          await onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">
        {t(
          '验证邮箱后设置新密码。完成后，所有设备需要重新登录。',
          'Verify your email, then set a new password. All devices will need to sign in again.',
        )}
      </p>
      <label>
        {t('账号邮箱', 'Account email')}
        <Input
          type="email"
          autoComplete="email"
          value={email}
          disabled={sent || !!initialEmail}
          required
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {sent && (
        <>
          <p className="commerce-hint">
            {t(
              '如果该邮箱已注册，验证码会发送到收件箱。5 分钟内有效。',
              'If this email is registered, a code is on its way to your inbox. It expires in 5 minutes.',
            )}
          </p>
          <label>
            {t('验证码', 'Verification code')}
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          <label>
            {t('新密码', 'New password')}
            <Input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            {t('再次输入新密码', 'Confirm new password')}
            <Input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        </>
      )}
      <Button disabled={busy}>
        {busy
          ? t('正在处理…', 'Working…')
          : sent
            ? t('确认设置密码', 'Set password')
            : t('发送重置验证码', 'Send reset code')}
      </Button>
      {sent && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy || cooldown.seconds > 0}
          onClick={() => void send()}
        >
          {cooldown.seconds > 0
            ? t(
                `${cooldown.seconds} 秒后可重发`,
                `Resend in ${cooldown.seconds}s`,
              )
            : t('重新发送验证码', 'Resend code')}
        </Button>
      )}
      {error && (
        <p className="error-text" role="alert">
          {t(error, englishMessage(error))}
        </p>
      )}
    </form>
  );
}
export function LoginDialog({
  open,
  close,
  boot,
  onSuccess,
}: {
  open: boolean;
  close: () => void;
  boot: Boot;
  onSuccess: () => Promise<void>;
}) {
  const t = useT();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [otp, setOtp] = useState(''),
    [sent, setSent] = useState(false),
    [mode, setMode] = useState<'otp' | 'password' | 'reset'>('otp'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const cooldown = useCooldown();
  useEffect(() => {
    if (open) {
      setMode('password');
      setError('');
      setMessage('');
      setSent(false);
      setOtp('');
      setPassword('');
    }
  }, [open, boot.services.email]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    check(
      (
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
        })
      ).error,
    );
    setSent(true);
    cooldown.start();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="login-dialog">
        <DialogHeader>
          <span className="login-mark">c</span>
          <DialogTitle>
            {mode === 'reset'
              ? t('找回你的账号。', 'Recover your account')
              : t('登录 cswork', 'Sign in to cswork')}
          </DialogTitle>
          <DialogDescription>
            {boot.services.email
              ? t(
                  '支持 QQ、163、Gmail 等个人邮箱。新用户可通过邮箱验证码注册。',
                  'Works with personal email such as Gmail, QQ or 163. New users can sign up with an email code.',
                )
              : t(
                  '支持 QQ、163、Gmail 等个人邮箱。已有账号可直接用邮箱和密码登录。',
                  'Works with personal email such as Gmail, QQ or 163. Existing users can sign in with email and password.',
                )}
          </DialogDescription>
        </DialogHeader>
        {mode !== 'reset' && (
          <>
            {boot.services.email && (
              <div
                className="commerce-tabs"
                aria-label={t('登录方式', 'Sign-in method')}
              >
                <Button
                  variant={mode === 'otp' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setMode('otp');
                    setError('');
                  }}
                >
                  {t('邮箱注册 / 验证码', 'Sign up / email code')}
                </Button>
                <Button
                  variant={mode === 'password' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setMode('password');
                    setError('');
                  }}
                >
                  {t('邮箱密码登录', 'Email and password')}
                </Button>
              </div>
            )}
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (mode === 'otp') {
                    if (!sent) {
                      await send();
                      return;
                    }
                    check(
                      (await authClient.signIn.emailOtp({ email, otp })).error,
                    );
                  } else {
                    check(
                      (await authClient.signIn.email({ email, password }))
                        .error,
                    );
                  }
                  setPassword('');
                  await onSuccess();
                  close();
                });
              }}
            >
              <label>
                {t('个人邮箱', 'Email')}
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  disabled={mode === 'otp' && sent}
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {mode === 'password' ? (
                <label>
                  {t('密码', 'Password')}
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={128}
                  />
                </label>
              ) : (
                sent && (
                  <label>
                    {t('验证码', 'Verification code')}
                    <Input
                      value={otp}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      autoComplete="one-time-code"
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </label>
                )
              )}
              <Button type="submit" disabled={busy}>
                {busy
                  ? t('正在处理…', 'Working…')
                  : mode === 'password'
                    ? t('登录 cswork', 'Sign in to cswork')
                    : sent
                      ? t('验证并登录 / 注册', 'Verify and sign in / sign up')
                      : t('发送验证码', 'Send code')}
                <ArrowRight size={15} />
              </Button>
              {mode === 'otp' && sent && (
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || cooldown.seconds > 0}
                    onClick={() => void run(send)}
                  >
                    {cooldown.seconds > 0
                      ? t(
                          `${cooldown.seconds} 秒后可重发`,
                          `Resend in ${cooldown.seconds}s`,
                        )
                      : t('重新发送', 'Resend')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setSent(false);
                      setOtp('');
                    }}
                  >
                    {t('更换邮箱', 'Change email')}
                  </Button>
                </div>
              )}
            </form>
            {boot.services.email ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setMode('reset');
                  setError('');
                }}
              >
                {t('忘记密码 / 首次设置密码', 'Forgot password / set a password')}
              </Button>
            ) : (
              <p className="muted">
                {t(
                  '首次使用请打开老师提供的激活链接，设置密码后即可登录。邮箱验证码注册和找回密码暂未开放。',
                  "First time here? Open the activation link from your teacher and set a password to sign in. Email-code sign-up and password recovery aren't available yet.",
                )}
              </p>
            )}
            {(boot.services.google || boot.services.github) && (
              <p className="muted">
                {t('或使用第三方账号登录', 'Or use a third-party account')}
              </p>
            )}
            <div className="login-providers">
              {(['google', 'github'] as const)
                .filter((provider) => boot.services[provider])
                .map((provider) => (
                  <Button
                    key={provider}
                    variant="outline"
                    className={
                      provider === 'google' ? 'google-signin' : undefined
                    }
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        check(
                          (
                            await authClient.signIn.social({
                              provider,
                              callbackURL:
                                location.pathname +
                                location.search +
                                location.hash,
                              errorCallbackURL:
                                '/?view=account&auth_error=1' + location.hash,
                            })
                          ).error,
                        );
                      })
                    }
                  >
                    {provider === 'google' ? (
                      <img
                        src="/auth/google-g.png"
                        width={20}
                        height={20.4}
                        alt=""
                        aria-hidden="true"
                        className="google-signin-icon"
                      />
                    ) : (
                      <span aria-hidden="true">⌘</span>
                    )}
                    {provider === 'google'
                      ? t('使用 Google 登录', 'Sign in with Google')
                      : t('使用 GitHub 登录', 'Sign in with GitHub')}
                  </Button>
                ))}
            </div>
          </>
        )}
        {mode === 'reset' && (
          <>
            <PasswordRecovery
              email={email}
              onDone={() => {
                setMode('password');
                setMessage(
                  t(
                    '密码已更新，请用新密码登录。',
                    'Password updated. Sign in with your new password.',
                  ),
                );
              }}
            />
            <Button variant="ghost" onClick={() => setMode('password')}>
              {t('返回登录', 'Back to sign in')}
            </Button>
          </>
        )}
        {message && (
          <p role="status" className="commerce-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="error-text">
            {t(error, englishMessage(error))}
          </p>
        )}
        <p className="muted text-xs">
          {t(
            '了解账户与学习资料的使用方式，请阅读',
            'To learn how we use your account and study data, read the ',
          )}
          <Link
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {t('隐私说明', 'privacy notice')}
          </Link>
          {t('。', '.')}
        </p>
      </DialogContent>
    </Dialog>
  );
}

type SessionInfo = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
  updatedAt: Date | string;
};
type AccountInfo = { id: string; providerId: string; createdAt: Date | string };
export function OrderCard({
  order,
  onRefresh,
}: {
  order: CommerceOrder;
  onRefresh?: (order: CommerceOrder) => void;
}) {
  const t = useT(),
    locale = useLocale();
  const [expanded, setExpanded] = useState(false),
    [detail, setDetail] = useState(order),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  // ponytail: shared money() returns Chinese for a missing amount; only that case is localized here.
  const price = (amount: number | null) =>
    amount === null || !detail.currency
      ? t('待确认金额', 'Amount pending')
      : money(amount, detail.currency);
  useEffect(() => setDetail(order), [order]);
  async function load(sync = false) {
    setBusy(true);
    setError('');
    try {
      const data = await api<CommerceOrder>(
        `orders/${encodeURIComponent(order.id)}${sync ? '/refresh' : ''}`,
        sync ? {} : undefined,
      );
      setDetail(data);
      onRefresh?.(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="commerce-order">
      <button
        type="button"
        className="commerce-order-heading"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) void load();
        }}
      >
        <span>
          <strong>{detail.course_title}</strong>
          <small>{timestamp(detail.created_at, locale)}</small>
        </span>
        <span className="commerce-order-summary">
          <strong>{price(detail.amount)}</strong>
          <span className={`commerce-status commerce-status-${detail.status}`}>
            {t(orderStatusNames[detail.status], orderStatusEn[detail.status])}
          </span>
          <ChevronDown size={16} />
        </span>
      </button>
      {expanded && (
        <div className="commerce-order-body">
          <dl className="commerce-details">
            <div>
              <dt>{t('订单编号', 'Order ID')}</dt>
              <dd>{detail.id}</dd>
            </div>
            <div>
              <dt>{t('课程权益', 'Course access')}</dt>
              <dd>
                {detail.has_access
                  ? t('已经开通', 'Unlocked')
                  : t('尚未开通', 'Not unlocked yet')}
              </dd>
            </div>
            {detail.amount_refunded > 0 && (
              <div>
                <dt>{t('已退款', 'Refunded')}</dt>
                <dd>{price(detail.amount_refunded)}</dd>
              </div>
            )}
          </dl>
          {detail.refunds?.map((r) => (
            <div className="commerce-refund-row" key={r.id}>
              <span>
                {price(r.amount)} ·{' '}
                {t(refundStatusNames[r.status], refundStatusEn[r.status])}
                <small>{t(r.reason, englishMessage(r.reason))}</small>
              </span>
              <small>{timestamp(r.created_at, locale)}</small>
            </div>
          ))}
          {detail.last_error && (
            <p className="commerce-hint">
              {t(detail.last_error, englishMessage(detail.last_error))}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load(true)}
            >
              <RefreshCw size={14} />
              {busy
                ? t('正在确认…', 'Checking…')
                : t('刷新支付状态', 'Refresh payment status')}
            </Button>
            {detail.checkout_url && (
              <Button onClick={() => location.assign(detail.checkout_url!)}>
                {t('继续支付', 'Continue to payment')}
                <ArrowRight size={14} />
              </Button>
            )}
            {detail.receipt_url && (
              <a
                className="commerce-link"
                href={detail.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('查看收据', 'View receipt')}
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {error && (
            <p role="alert" className="error-text">
              {t(error, englishMessage(error))}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
export function AccountView({
  boot,
  refresh,
}: {
  boot: Boot;
  refresh: () => Promise<void>;
}) {
  const t = useT(),
    locale = useLocale();
  const [orders, setOrders] = useState<CommerceOrder[]>([]),
    [accounts, setAccounts] = useState<AccountInfo[]>([]),
    [sessions, setSessions] = useState<SessionInfo[]>([]),
    [currentToken, setCurrentToken] = useState(''),
    [name, setName] = useState(boot.person?.name || ''),
    [currentPassword, setCurrentPassword] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [recover, setRecover] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [loading, setLoading] = useState(true);
  const p = boot.person!;
  const loadSecurity = useCallback(async () => {
    const [a, s, c] = await Promise.all([
      authClient.listAccounts(),
      authClient.listSessions(),
      authClient.getSession(),
    ]);
    check(a.error);
    check(s.error);
    check(c.error);
    setAccounts((a.data || []) as AccountInfo[]);
    setSessions((s.data || []) as SessionInfo[]);
    setCurrentToken(c.data?.session.token || '');
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([api<CommerceOrder[]>('orders'), loadSecurity()])
      .then(([o]) => {
        if (alive) setOrders(o);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadSecurity]);
  async function run(fn: () => Promise<void>, success = '') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const hasPassword = accounts.some((a) => a.providerId === 'credential');
  return (
    <>
      <Heading
        title={t('你的账号与课程权益。', 'Your account and course access')}
      />
      <p className="muted mb-5 text-sm">
        <Link href="/privacy" className="underline underline-offset-4">
          {t(
            '隐私说明与资料删除请求',
            'Privacy notice and data deletion requests',
          )}
        </Link>
      </p>
      <div className="commerce-account-grid">
        <section className="form-card commerce-account-card">
          <div className="account-profile">
            <span className="avatar">{(p.name || p.email).slice(0, 1)}</span>
            <div>
              <h2>{p.name || t('我的账号', 'My account')}</h2>
              <p>{p.email}</p>
              <span className="tag">
                {p.verified
                  ? t('邮箱已验证', 'Email verified')
                  : t('邮箱未验证', 'Email not verified')}
              </span>
            </div>
          </div>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                async () => {
                  check(
                    (await authClient.updateUser({ name: name.trim() })).error,
                  );
                  await refresh();
                },
                t('昵称已保存。', 'Nickname saved.'),
              );
            }}
          >
            <label>
              {t('昵称', 'Nickname')}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={1}
                maxLength={80}
                required
                autoComplete="nickname"
              />
            </label>
            <Button
              variant="outline"
              disabled={busy || !name.trim() || name.trim() === p.name}
            >
              {t('保存昵称', 'Save nickname')}
            </Button>
          </form>
        </section>
        <section className="form-card commerce-account-card">
          <h2>
            <ShieldCheck size={19} />
            {t('登录方式', 'Sign-in methods')}
          </h2>
          <p className="muted">
            {t(
              '绑定同一邮箱的账号，课程与学习进度会保留在这里。',
              'Link accounts that use the same email. Your courses and progress stay with this account.',
            )}
          </p>
          {(['google', 'github'] as const).map((provider) => {
            const linked = accounts.some((a) => a.providerId === provider);
            return (
              <div className="service-row" key={provider}>
                <span>
                  {provider === 'google' ? 'Google' : 'GitHub'}
                  {linked && (
                    <small className="commerce-success">
                      {t('已绑定', 'Linked')}
                    </small>
                  )}
                </span>
                <Button
                  variant="outline"
                  disabled={busy || linked || !boot.services[provider]}
                  onClick={() =>
                    void run(async () => {
                      check(
                        (
                          await authClient.linkSocial({
                            provider,
                            callbackURL: '/?view=account',
                            errorCallbackURL: '/?view=account&auth_error=1',
                          })
                        ).error,
                      );
                    })
                  }
                >
                  {linked ? (
                    <>
                      <Check size={14} />
                      {t('已绑定', 'Linked')}
                    </>
                  ) : boot.services[provider] ? (
                    <>
                      <LinkIcon size={14} />
                      {t('绑定账号', 'Link account')}
                    </>
                  ) : (
                    t('暂未开放', 'Not available yet')
                  )}
                </Button>
              </div>
            );
          })}
          <div className="service-row">
            <span>{t('邮箱验证码', 'Email code')}</span>
            <span className="tag">
              {boot.services.email
                ? t('已开放', 'Available')
                : t('暂未开放', 'Not available yet')}
            </span>
          </div>
        </section>
      </div>
      <section className="form-card commerce-account-card">
        <h2>
          <KeyRound size={19} />
          {t('密码与账号恢复', 'Password and recovery')}
        </h2>
        {hasPassword ? (
          <form
            className="commerce-password-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                async () => {
                  if (password !== confirm)
                    throw new Error(
                      t('两次输入的新密码不一致。', "New passwords don't match."),
                    );
                  check(
                    (
                      await authClient.changePassword({
                        currentPassword,
                        newPassword: password,
                        revokeOtherSessions: true,
                      })
                    ).error,
                  );
                  setCurrentPassword('');
                  setPassword('');
                  setConfirm('');
                  await loadSecurity();
                },
                t(
                  '密码已更新，其他设备已退出登录。',
                  'Password updated. Other devices have been signed out.',
                ),
              );
            }}
          >
            <label>
              {t('当前密码', 'Current password')}
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label>
              {t('新密码', 'New password')}
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                placeholder={t('至少 12 个字符', 'At least 12 characters')}
              />
            </label>
            <label>
              {t('确认新密码', 'Confirm new password')}
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <Button disabled={busy}>
              {t(
                '更新密码并退出其他设备',
                'Update password and sign out other devices',
              )}
            </Button>
          </form>
        ) : (
          <p className="muted">
            {t(
              '你尚未设置密码，可继续使用已绑定的方式登录。',
              "You haven't set a password. You can keep signing in with your linked accounts.",
            )}
          </p>
        )}
        {boot.services.email ? (
          <Button variant="ghost" onClick={() => setRecover(true)}>
            {hasPassword
              ? t(
                  '忘记当前密码？通过邮箱重置',
                  'Forgot your password? Reset it by email',
                )
              : t('通过邮箱验证设置密码', 'Set a password by email')}
          </Button>
        ) : (
          <p className="muted">
            {t(
              '邮箱找回暂未开放；请妥善保存密码，也可以使用已绑定的登录方式。',
              "Email recovery isn't available yet. Keep your password safe, or sign in with a linked account.",
            )}
          </p>
        )}
      </section>
      <section className="form-card commerce-account-card">
        <div className="commerce-section-heading">
          <div>
            <h2>
              <Monitor size={19} />
              {t('登录设备', 'Signed-in devices')}
            </h2>
            <p className="muted">
              {t(
                '发现不认识的设备时，可以立即让它退出。',
                "If you see a device you don't recognize, sign it out right away.",
              )}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={busy || sessions.length < 2}
            onClick={() =>
              void run(
                async () => {
                  check((await authClient.revokeOtherSessions()).error);
                  await loadSecurity();
                },
                t('其他设备已退出登录。', 'Other devices have been signed out.'),
              )
            }
          >
            {t('退出其他设备', 'Sign out other devices')}
          </Button>
        </div>
        {loading ? (
          <p className="muted">{t('正在读取登录设备…', 'Loading devices…')}</p>
        ) : (
          sessions.map((s) => (
            <div className="commerce-session" key={s.id}>
              {/mobile|iphone|android/i.test(s.userAgent || '') ? (
                <Smartphone size={20} />
              ) : (
                <Monitor size={20} />
              )}
              <div>
                <strong>
                  {/iPhone/i.test(s.userAgent || '')
                    ? 'iPhone'
                    : /Android/i.test(s.userAgent || '')
                      ? 'Android'
                      : /Mac/i.test(s.userAgent || '')
                        ? 'Mac'
                        : /Windows/i.test(s.userAgent || '')
                          ? 'Windows'
                          : t('浏览器', 'Browser')}
                  {s.token === currentToken && (
                    <span className="tag">{t('当前设备', 'This device')}</span>
                  )}
                </strong>
                <small>
                  {s.ipAddress || t('地址未记录', 'IP not recorded')} ·{' '}
                  {t('最近活跃', 'Last active')} {timestamp(s.updatedAt, locale)}
                </small>
              </div>
              {s.token !== currentToken && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      async () => {
                        check(
                          (await authClient.revokeSession({ token: s.token }))
                            .error,
                        );
                        await loadSecurity();
                      },
                      t('该设备已退出登录。', 'That device has been signed out.'),
                    )
                  }
                >
                  {t('退出', 'Sign out')}
                </Button>
              )}
            </div>
          ))
        )}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              check((await authClient.signOut()).error);
              await refresh();
            })
          }
        >
          <LogOut size={15} />
          {t('退出当前账号', 'Sign out')}
        </Button>
      </section>
      <section className="form-card commerce-account-card">
        <h2>{t('课程权益', 'Course access')}</h2>
        {boot.courses.map((c) => (
          <div className="service-row" key={c.id}>
            <span>{c.title}</span>
            <span className="tag">
              {c.has_access ? t('已开通', 'Unlocked') : t('未开通', 'Locked')}
            </span>
          </div>
        ))}
      </section>
      <section className="form-card commerce-account-card">
        <h2>{t('订单与收据', 'Orders and receipts')}</h2>
        <p className="muted">
          {t(
            '课程购买、支付进度与退款记录保存在这里。老师直接开通的权益会显示在上方。',
            'Course purchases, payment status and refunds are kept here. Access granted directly by a teacher is listed above.',
          )}
        </p>
        {loading ? (
          <p className="muted">{t('正在读取订单…', 'Loading orders…')}</p>
        ) : orders.length ? (
          orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onRefresh={(next) => {
                setOrders((old) =>
                  old.map((v) => (v.id === next.id ? next : v)),
                );
                void refresh();
              }}
            />
          ))
        ) : (
          <div className="commerce-empty">
            {t(
              '还没有订单，课程开通后就可以开始学习。',
              'No orders yet. Once a course is unlocked, you can start learning.',
            )}
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}
        </p>
      )}
      {message && (
        <p role="status" className="notice commerce-success">
          {message}
        </p>
      )}
      <Dialog open={recover} onOpenChange={setRecover}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hasPassword
                ? t('通过邮箱重设密码', 'Reset password by email')
                : t('为账号设置密码', 'Set a password')}
            </DialogTitle>
            <DialogDescription>
              {t(
                '只有验证邮箱后，密码才会变更。',
                'Your password changes only after you verify your email.',
              )}
            </DialogDescription>
          </DialogHeader>
          <PasswordRecovery
            email={p.email}
            onDone={async () => {
              setRecover(false);
              await refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
