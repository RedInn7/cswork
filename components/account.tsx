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
} from '@/lib/commerce-types';
import { Heading } from './learning';
import '@/app/commerce.css';

type AuthError = { message?: string; code?: string } | null | undefined;
function check(error: AuthError) {
  if (!error) return;
  const messages: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: '邮箱或密码不正确。',
    INVALID_PASSWORD: '当前密码不正确。',
    INVALID_OTP: '验证码不正确，请重新输入。',
    OTP_EXPIRED: '验证码已过期，请重新发送。',
    TOO_MANY_ATTEMPTS: '尝试次数过多，请重新发送验证码。',
    PASSWORD_TOO_SHORT: '密码至少需要 12 个字符。',
    SESSION_EXPIRED: '请重新登录后再进行这个操作。',
    TOO_MANY_REQUESTS: '操作较频繁，请稍后再试。',
  };
  throw new Error(
    messages[error.code || ''] || error.message || '操作未完成，请稍后重试。',
  );
}
function timestamp(value: string | number | Date) {
  return new Date(value).toLocaleString('zh-CN', {
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
          if (password !== confirm) throw new Error('两次输入的密码不一致。');
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
        验证邮箱后设置新密码。完成后，所有设备需要重新登录。
      </p>
      <label>
        账号邮箱
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
            如果该邮箱已注册，验证码会发送到收件箱。5 分钟内有效。
          </p>
          <label>
            验证码
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
            新密码
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
            再次输入新密码
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
        {busy ? '正在处理…' : sent ? '确认设置密码' : '发送重置验证码'}
      </Button>
      {sent && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy || cooldown.seconds > 0}
          onClick={() => void send()}
        >
          {cooldown.seconds > 0
            ? `${cooldown.seconds} 秒后可重发`
            : '重新发送验证码'}
        </Button>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
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
      setMode(boot.services.email ? 'otp' : 'password');
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
  const registration =
    boot.services.email || boot.services.google || boot.services.github;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="login-dialog">
        <DialogHeader>
          <span className="login-mark">c</span>
          <DialogTitle>
            {mode === 'reset' ? '找回你的账号。' : '继续你的学习旅程。'}
          </DialogTitle>
          <DialogDescription>
            {registration
              ? '使用购买时的邮箱。首次邮箱验证或第三方登录会创建账号。'
              : '已有账号可用密码登录。新学员请使用老师提供的激活链接。'}
          </DialogDescription>
        </DialogHeader>
        {mode !== 'reset' && (
          <>
            <div className="login-providers">
              {(['google', 'github'] as const)
                .filter((provider) => boot.services[provider])
                .map((provider) => (
                  <Button
                    key={provider}
                    variant="outline"
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
                    <span className={provider === 'google' ? 'google-g' : ''}>
                      {provider === 'google' ? 'G' : '⌘'}
                    </span>
                    使用 {provider === 'google' ? 'Google' : 'GitHub'} 登录
                  </Button>
                ))}
            </div>
            {boot.services.email && (
              <div className="commerce-tabs" aria-label="登录方式">
                <Button
                  variant={mode === 'otp' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setMode('otp');
                    setError('');
                  }}
                >
                  邮箱验证码
                </Button>
                <Button
                  variant={mode === 'password' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setMode('password');
                    setError('');
                  }}
                >
                  密码登录
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
                邮箱
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
                  密码
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
                    验证码
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
                  ? '正在处理…'
                  : mode === 'password'
                    ? '登录 cswork'
                    : sent
                      ? '验证并登录 / 注册'
                      : '发送验证码'}
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
                      ? `${cooldown.seconds} 秒后可重发`
                      : '重新发送'}
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
                    更换邮箱
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
                忘记密码 / 首次设置密码
              </Button>
            ) : (
              <p className="muted">
                邮箱验证码暂未开放。忘记密码请联系老师，已有账号的密码不会被老师直接重置。
              </p>
            )}
          </>
        )}
        {mode === 'reset' && (
          <>
            <PasswordRecovery
              email={email}
              onDone={() => {
                setMode('password');
                setMessage('密码已更新，请用新密码登录。');
              }}
            />
            <Button variant="ghost" onClick={() => setMode('password')}>
              返回登录
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
            {error}
          </p>
        )}
        <p className="muted text-xs">
          了解账户与学习资料的使用方式，请阅读
          <Link
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            隐私说明
          </Link>
          。
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
  const [expanded, setExpanded] = useState(false),
    [detail, setDetail] = useState(order),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
          <small>{timestamp(detail.created_at)}</small>
        </span>
        <span className="commerce-order-summary">
          <strong>{money(detail.amount, detail.currency)}</strong>
          <span className={`commerce-status commerce-status-${detail.status}`}>
            {orderStatusNames[detail.status]}
          </span>
          <ChevronDown size={16} />
        </span>
      </button>
      {expanded && (
        <div className="commerce-order-body">
          <dl className="commerce-details">
            <div>
              <dt>订单编号</dt>
              <dd>{detail.id}</dd>
            </div>
            <div>
              <dt>课程权益</dt>
              <dd>{detail.has_access ? '已经开通' : '尚未开通'}</dd>
            </div>
            {detail.amount_refunded > 0 && (
              <div>
                <dt>已退款</dt>
                <dd>{money(detail.amount_refunded, detail.currency)}</dd>
              </div>
            )}
          </dl>
          {detail.refunds?.map((r) => (
            <div className="commerce-refund-row" key={r.id}>
              <span>
                {money(r.amount, detail.currency)} ·{' '}
                {refundStatusNames[r.status]}
                <small>{r.reason}</small>
              </span>
              <small>{timestamp(r.created_at)}</small>
            </div>
          ))}
          {detail.last_error && (
            <p className="commerce-hint">{detail.last_error}</p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load(true)}
            >
              <RefreshCw size={14} />
              {busy ? '正在确认…' : '刷新支付状态'}
            </Button>
            {detail.checkout_url && (
              <Button onClick={() => location.assign(detail.checkout_url!)}>
                继续支付
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
                查看收据
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
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
      <Heading label="YOUR LEARNING IDENTITY" title="你的账号与课程权益。" />
      <p className="muted mb-5 text-sm">
        <Link href="/privacy" className="underline underline-offset-4">
          隐私说明与资料删除请求
        </Link>
      </p>
      <div className="commerce-account-grid">
        <section className="form-card commerce-account-card">
          <div className="account-profile">
            <span className="avatar">{(p.name || p.email).slice(0, 1)}</span>
            <div>
              <h2>{p.name || '我的账号'}</h2>
              <p>{p.email}</p>
              <span className="tag">
                {p.verified ? '邮箱已验证' : '邮箱未验证'}
              </span>
            </div>
          </div>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                check(
                  (await authClient.updateUser({ name: name.trim() })).error,
                );
                await refresh();
              }, '昵称已保存。');
            }}
          >
            <label>
              昵称
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
              保存昵称
            </Button>
          </form>
        </section>
        <section className="form-card commerce-account-card">
          <h2>
            <ShieldCheck size={19} />
            登录方式
          </h2>
          <p className="muted">
            绑定同一邮箱的账号，课程与学习进度会保留在这里。
          </p>
          {(['google', 'github'] as const).map((provider) => {
            const linked = accounts.some((a) => a.providerId === provider);
            return (
              <div className="service-row" key={provider}>
                <span>
                  {provider === 'google' ? 'Google' : 'GitHub'}
                  {linked && <small className="commerce-success">已绑定</small>}
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
                      已绑定
                    </>
                  ) : boot.services[provider] ? (
                    <>
                      <LinkIcon size={14} />
                      绑定账号
                    </>
                  ) : (
                    '暂未开放'
                  )}
                </Button>
              </div>
            );
          })}
          <div className="service-row">
            <span>邮箱验证码</span>
            <span className="tag">
              {boot.services.email ? '已开放' : '暂未开放'}
            </span>
          </div>
        </section>
      </div>
      <section className="form-card commerce-account-card">
        <h2>
          <KeyRound size={19} />
          密码与账号恢复
        </h2>
        {hasPassword ? (
          <form
            className="commerce-password-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (password !== confirm)
                  throw new Error('两次输入的新密码不一致。');
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
              }, '密码已更新，其他设备已退出登录。');
            }}
          >
            <label>
              当前密码
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
              新密码
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                placeholder="至少 12 个字符"
              />
            </label>
            <label>
              确认新密码
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
            <Button disabled={busy}>更新密码并退出其他设备</Button>
          </form>
        ) : (
          <p className="muted">你尚未设置密码，可继续使用已绑定的方式登录。</p>
        )}
        {boot.services.email ? (
          <Button variant="ghost" onClick={() => setRecover(true)}>
            {hasPassword
              ? '忘记当前密码？通过邮箱重置'
              : '通过邮箱验证设置密码'}
          </Button>
        ) : (
          <p className="muted">
            邮箱找回暂未开放；请妥善保存密码，也可以使用已绑定的登录方式。
          </p>
        )}
      </section>
      <section className="form-card commerce-account-card">
        <div className="commerce-section-heading">
          <div>
            <h2>
              <Monitor size={19} />
              登录设备
            </h2>
            <p className="muted">发现不认识的设备时，可以立即让它退出。</p>
          </div>
          <Button
            variant="outline"
            disabled={busy || sessions.length < 2}
            onClick={() =>
              void run(async () => {
                check((await authClient.revokeOtherSessions()).error);
                await loadSecurity();
              }, '其他设备已退出登录。')
            }
          >
            退出其他设备
          </Button>
        </div>
        {loading ? (
          <p className="muted">正在读取登录设备…</p>
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
                          : '浏览器'}
                  {s.token === currentToken && (
                    <span className="tag">当前设备</span>
                  )}
                </strong>
                <small>
                  {s.ipAddress || '地址未记录'} · 最近活跃{' '}
                  {timestamp(s.updatedAt)}
                </small>
              </div>
              {s.token !== currentToken && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      check(
                        (await authClient.revokeSession({ token: s.token }))
                          .error,
                      );
                      await loadSecurity();
                    }, '该设备已退出登录。')
                  }
                >
                  退出
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
          退出当前账号
        </Button>
      </section>
      <section className="form-card commerce-account-card">
        <h2>课程权益</h2>
        {boot.courses.map((c) => (
          <div className="service-row" key={c.id}>
            <span>{c.title}</span>
            <span className="tag">{c.has_access ? '已开通' : '未开通'}</span>
          </div>
        ))}
      </section>
      <section className="form-card commerce-account-card">
        <h2>订单与收据</h2>
        <p className="muted">
          课程购买、支付进度与退款记录保存在这里。老师直接开通的权益会显示在上方。
        </p>
        {loading ? (
          <p className="muted">正在读取订单…</p>
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
            还没有订单，课程开通后就可以开始学习。
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="notice error">
          {error}
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
              {hasPassword ? '通过邮箱重设密码' : '为账号设置密码'}
            </DialogTitle>
            <DialogDescription>
              只有验证邮箱后，密码才会变更。
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
