'use client';
import { useEffect, useState } from 'react';
import { api, type Person } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
type Preview = {
  email: string;
  titles: string[];
  used: boolean;
  requiresLogin: boolean;
  matchesAccount: boolean;
};
export function EnrollmentClaim({
  person,
  onSuccess,
  onLogin,
}: {
  person: Person | null;
  onSuccess: () => Promise<void>;
  onLogin: () => void;
}) {
  const t = useT();
  const [token, setToken] = useState(''),
    [open, setOpen] = useState(false),
    [data, setData] = useState<Preview | null>(null);
  const [name, setName] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const read = () => {
      const invite =
        new URLSearchParams(location.hash.slice(1)).get('invite') || '';
      setData(null);
      setError('');
      setToken(invite);
      setOpen(!!invite);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [person?.id]);
  useEffect(() => {
    let cancelled = false;
    if (token) {
      void api<Preview>('enrollment/inspect', { token })
        .then((r) => {
          if (!cancelled) setData(r);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token, person?.id]);
  if (!token) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="login-dialog">
        <DialogHeader>
          <DialogTitle>{t('欢迎加入 cswork。', 'Welcome to cswork')}</DialogTitle>
          <DialogDescription>
            {t(
              '接受老师的邀请，开启你的课程。',
              "Accept your teacher's invitation to start your course.",
            )}
          </DialogDescription>
        </DialogHeader>
        {data?.used ? (
          <>
            <p>
              {t(
                '这份邀请已经使用，你可以直接登录学习。',
                'This invitation has already been used. Sign in to keep learning.',
              )}
            </p>
            <Button
              onClick={() => {
                setOpen(false);
                onLogin();
              }}
            >
              {t('前往登录', 'Go to sign in')}
            </Button>
          </>
        ) : data ? (
          <>
            <p>
              <strong>{data.email}</strong>
            </p>
            <p className="muted">
              {t(
                `将开通：${data.titles.join('、')}`,
                `Unlocks: ${data.titles.map(englishMessage).join(', ')}`,
              )}
            </p>
            {!data.matchesAccount ? (
              <p role="alert">
                {t(
                  '当前账号与邀请邮箱不同。请先退出，再使用邀请对应的邮箱登录。',
                  "You're signed in with a different email than the invitation. Sign out, then sign in with the invited email.",
                )}
              </p>
            ) : data.requiresLogin && !person ? (
              <>
                <p>
                  {t(
                    '你已有 cswork 账号，请先登录后接受邀请。',
                    'You already have a cswork account. Sign in to accept the invitation.',
                  )}
                </p>
                <Button
                  onClick={() => {
                    setOpen(false);
                    onLogin();
                  }}
                >
                  {t('登录已有账号', 'Sign in to your account')}
                </Button>
              </>
            ) : (
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  try {
                    await api('enrollment/activate', { token, name, password });
                    setPassword('');
                    history.replaceState(
                      null,
                      '',
                      location.pathname + location.search,
                    );
                    setOpen(false);
                    setToken('');
                    await onSuccess();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {!data.requiresLogin && (
                  <>
                    <label htmlFor="enrollment-field-1">
                      {t('你的称呼', 'Your name')}
                      <Input
                        id="enrollment-field-1"
                        required
                        maxLength={100}
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label htmlFor="enrollment-field-2">
                      {t('设置密码', 'Set a password')}
                      <Input
                        id="enrollment-field-2"
                        required
                        type="password"
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    <small className="muted">
                      {t(
                        '至少 12 位。今后可使用此邮箱和密码登录。',
                        "At least 12 characters. You'll sign in with this email and password.",
                      )}
                    </small>
                  </>
                )}
                <Button type="submit" disabled={busy}>
                  {busy
                    ? t('正在开通…', 'Unlocking…')
                    : t('接受邀请并进入课程', 'Accept invitation and start')}
                </Button>
              </form>
            )}
          </>
        ) : !error ? (
          <output>{t('正在验证邀请…', 'Checking invitation…')}</output>
        ) : null}
        {error && (
          <p className="error-text" role="alert">
            {t(error, englishMessage(error))}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
