'use client';
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import '@/app/newsletter/newsletter.css';

/** `resend`: the confirmation mail went out over a day ago and was never clicked. */
type Status = { subscribed: boolean; confirmed: boolean; mail: boolean; resend?: boolean };

/** Subscribe or unsubscribe the signed-in account (the account page and /newsletter). */
export function NewsletterToggle() {
  const locale = useLocale();
  const t = (zh: string, en: string) => (locale === 'en' ? en : zh);
  const [status, setStatus] = useState<Status | 'signed-out' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    // A plain fetch: a signed-out reader of /newsletter is not an expired session.
    fetch('/api/oj/newsletter', { headers: { 'X-Locale': locale } })
      .then(async (r) => {
        if (!live) return;
        if (r.status === 401) setStatus('signed-out');
        else if (r.ok) setStatus((await r.json()) as Status);
        else setError(((await r.json().catch(() => ({}))) as { error?: string }).error || '操作失败');
      })
      .catch(() => live && setError('服务暂时不可用，请稍后重试'));
    return () => {
      live = false;
    };
  }, [locale]);
  async function change(subscribe: boolean) {
    setBusy(true);
    setError('');
    try {
      setStatus(await api<Status>('oj/newsletter', { subscribe, locale }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="newsletter-toggle">
      {status === null ? (
        !error && <output>{t('正在读取订阅状态…', 'Checking your subscription…')}</output>
      ) : status === 'signed-out' ? (
        <p>
          <a className="newsletter-button" href="/?view=account#newsletter">
            <Mail size={15} aria-hidden="true" />
            {t('登录后订阅', 'Sign in to subscribe')}
          </a>
        </p>
      ) : status.subscribed ? (
        <>
          <p role="status">
            {status.confirmed
              ? t('已订阅：每周一封，发到你账号的邮箱。', 'Subscribed: one email a week, to your account’s address.')
              : status.mail
                ? t('确认邮件已发出，点邮件里的链接就完成订阅。', 'We sent a confirmation email. Click its link to finish subscribing.')
                : t(
                    '已登记。邮件发送开通后，会先发一封确认邮件，你确认后才开始收周报。',
                    'You’re on the list. Once email delivery is switched on, we’ll send a confirmation email first; issues start after you confirm.',
                  )}
          </p>
          {status.resend && (
            <button type="button" className="newsletter-button is-quiet" disabled={busy} onClick={() => void change(true)}>
              {t('没收到？重发确认邮件', 'Didn’t get it? Send it again')}
            </button>
          )}
          <button type="button" className="newsletter-button is-quiet" disabled={busy} onClick={() => void change(false)}>
            {t('退订', 'Unsubscribe')}
          </button>
        </>
      ) : (
        <>
          <p>
            {t(
              '每周一封：新上线的题、学员面经和每日一题战报。只发到已验证的邮箱，每封都能一键退订。',
              'One email a week: new problems, member interview reports and daily problem results. Sent only to a verified address, with one-click unsubscribe in every issue.',
            )}
          </p>
          <button type="button" className="newsletter-button" disabled={busy} onClick={() => void change(true)}>
            <Mail size={15} aria-hidden="true" />
            {t('订阅周报', 'Subscribe')}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </p>
      )}
    </div>
  );
}
