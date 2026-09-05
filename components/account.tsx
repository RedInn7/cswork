'use client';
import { useEffect, useState } from 'react';
import {
  Code2 as Github,
  Mail,
  ArrowRight,
  LogOut,
  Link as LinkIcon,
  Check,
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
import { api, type Boot, statusNames, date } from '@/lib/types';
import { Heading } from './learning';
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
    [sent, setSent] = useState(false),
    [otp, setOtp] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="login-dialog">
        <DialogHeader>
          <span className="login-mark">S</span>
          <DialogTitle>继续你的学习旅程。</DialogTitle>
          <DialogDescription>
            新学员可以直接注册。已有学员请使用购买时的邮箱。
          </DialogDescription>
        </DialogHeader>
        <div className="login-providers">
          <Button
            variant="outline"
            disabled={busy || !boot.services.google}
            onClick={() =>
              run(async () => {
                const r = await authClient.signIn.social({
                  provider: 'google',
                  callbackURL: '/',
                });
                if (r.error) throw new Error(r.error.message);
              })
            }
          >
            <span className="google-g">G</span>使用 Google 登录
          </Button>
          <Button
            variant="outline"
            disabled={busy || !boot.services.github}
            onClick={() =>
              run(async () => {
                const r = await authClient.signIn.social({
                  provider: 'github',
                  callbackURL: '/',
                });
                if (r.error) throw new Error(r.error.message);
              })
            }
          >
            <Github size={19} />
            使用 GitHub 登录
          </Button>
        </div>
        {boot.services.email ? (
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!sent) {
                  const r = await authClient.emailOtp.sendVerificationOtp({
                    email,
                    type: 'sign-in',
                  });
                  if (r.error) throw new Error(r.error.message);
                  setSent(true);
                } else {
                  const r = await authClient.signIn.emailOtp({ email, otp });
                  if (r.error) throw new Error(r.error.message);
                  await onSuccess();
                  close();
                }
              });
            }}
          >
            <label>
              邮箱
              <Input
                type="email"
                value={email}
                disabled={sent}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            {sent && (
              <label>
                验证码
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {sent ? '验证并登录' : '发送验证码'}
              <ArrowRight size={15} />
            </Button>
            {sent && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setSent(false);
                  setOtp('');
                }}
              >
                更换邮箱 / 重新发送
              </Button>
            )}
          </form>
        ) : (
          <p className="muted">邮箱和第三方登录会在配置完成后开放。</p>
        )}
        {boot.services.chatgpt && (
          <a
            className="preview-login"
            href="/signin-with-chatgpt?return_to=%2F"
          >
            进入站点所有者预览
            <ArrowRight size={14} />
          </a>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function AccountView({
  boot,
  refresh,
}: {
  boot: Boot;
  refresh: () => Promise<void>;
}) {
  const [orders, setOrders] = useState<any[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    api<any[]>('orders')
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);
  const p = boot.person!;
  return (
    <>
      <Heading label="YOUR LEARNING IDENTITY" title="你的账号与课程权益。" />
      <div className="form-card">
        <div className="account-profile">
          <span className="avatar">{p.name.slice(0, 1)}</span>
          <div>
            <h2>{p.name}</h2>
            <p>{p.email}</p>
            <span className="tag">
              {p.verified ? '邮箱已验证' : '邮箱未验证'}
            </span>
          </div>
        </div>
        <h3>登录方式</h3>
        <p className="muted">
          先登录当前账号，再绑定第三方账号，避免课程权益分散。绑定时使用同一邮箱。
        </p>
        <div className="form-actions">
          {(['google', 'github'] as const).map((provider) => (
            <Button
              key={provider}
              variant="outline"
              disabled={!boot.services[provider] || p.id.startsWith('chatgpt:')}
              onClick={async () => {
                const r = await authClient.linkSocial({
                  provider,
                  callbackURL: '/?view=account',
                });
                if (r.error) setError(r.error.message || '绑定失败');
              }}
            >
              <LinkIcon size={15} />
              绑定 {provider === 'google' ? 'Google' : 'GitHub'}
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={async () => {
              if (p.id.startsWith('chatgpt:')) {
                location.assign('/signout-with-chatgpt?return_to=%2F');
                return;
              }
              await authClient.signOut();
              await refresh();
            }}
          >
            <LogOut size={15} />
            退出登录
          </Button>
        </div>
      </div>
      <div className="form-card">
        <h2>课程权益</h2>
        {boot.courses.map((c) => (
          <div className="service-row" key={c.id}>
            <span>{c.title}</span>
            <span className="tag">{c.has_access ? '已开通' : '未开通'}</span>
          </div>
        ))}
      </div>
      <div className="form-card">
        <h2>购买记录</h2>
        {orders.length ? (
          orders.map((o) => (
            <div className="service-row" key={o.id}>
              <span>
                GoMall 后端工程实战 <small>{date(o.created_at)}</small>
              </span>
              <span>
                {o.amount !== null
                  ? new Intl.NumberFormat('zh-CN', {
                      style: 'currency',
                      currency: o.currency || 'USD',
                    }).format(o.amount / 100)
                  : '等待支付'}
              </span>
              <span className="tag">{statusNames[o.status] || o.status}</span>
            </div>
          ))
        ) : (
          <p className="muted">
            暂时没有购买记录。老师直接开通的课程会显示在课程权益中。
          </p>
        )}
      </div>
      {error && <p className="notice error">{error}</p>}
    </>
  );
}
