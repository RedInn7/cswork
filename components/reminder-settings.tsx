'use client';
import { useEffect, useId, useState } from 'react';
import { BellRing } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import '@/app/learner-cloud.css';

type Prefs = {
  review: boolean;
  streak: boolean;
  daily: boolean;
  contest: boolean;
  email: boolean;
  hour: number;
  tz: number;
  locale: 'zh' | 'en';
};
/** GET/POST /api/oj/notify (lib/server/reminders.ts); `push` is the VAPID key, null while push is off. */
type Settings = { prefs: Prefs | null; push: string | null; mail: boolean; verified: boolean; endpoints: string[] };
const KINDS = [
  ['review', '到期复习的题', 'Problems due for review'],
  ['streak', '连续打卡快断时', 'When a streak is about to break'],
  ['daily', '每日一题', 'The daily problem'],
  ['contest', '报名的周赛和入门赛（开赛前 1 小时再提醒一次）', 'Weeklies and starters you entered (again an hour before)'],
] as const;

const key = (base64url: string) =>
  Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

/** The account page's learning reminders: opt-in, one digest a day, by in-app notice, push and email. */
export function ReminderSettings() {
  const id = useId();
  const t = useT();
  const locale = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  // This browser's subscription: undefined until read (or without Push API support).
  const [device, setDevice] = useState<PushSubscription | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const save = (prefs: Prefs | null) =>
    run(async () => {
      setSettings(
        await api<Settings>('oj/notify', { prefs: prefs && { ...prefs, tz: new Date().getTimezoneOffset(), locale } }),
      );
      // Off drops every device's push on the server; this browser lets go of its subscription too.
      if (prefs || !device) return;
      await device.unsubscribe();
      setDevice(null);
    });
  useEffect(() => {
    let live = true;
    api<Settings>('oj/notify').then(
      (s) => {
        if (!live) return;
        setSettings(s);
        // Moved time zones (or daylight saving): keep the hour local.
        if (s.prefs && s.prefs.tz !== new Date().getTimezoneOffset()) void save(s.prefs);
      },
      (e: Error) => live && setError(e.message),
    );
    if (pushSupported())
      navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.pushManager.getSubscription() ?? null)
        .then((s) => live && setDevice(s), () => {});
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Once on mount.
  }, []);
  const pushOn = (publicKey: string) =>
    run(async () => {
      if ((await Notification.requestPermission()) !== 'granted')
        throw new Error(t('浏览器没有允许通知，请在网站设置里打开。', 'Notifications are blocked. Allow them in the site settings.'));
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(publicKey) });
      setSettings(await api<Settings>('oj/notify/subscription', { endpoint: subscription.endpoint, on: true }));
      setDevice(subscription);
    });
  const pushOff = (subscription: PushSubscription) =>
    run(async () => {
      setSettings(await api<Settings>('oj/notify/subscription', { endpoint: subscription.endpoint, on: false }));
      await subscription.unsubscribe();
      setDevice(null);
    });
  const prefs = settings?.prefs;
  // Push is on here only while the server still has this browser's endpoint: turning reminders
  // off elsewhere, a gone push service or another account subscribing this browser drops it.
  const here = device && settings?.endpoints.includes(new URL(device.endpoint).href) ? device : null;
  return (
    <section className="form-card commerce-account-card" id="reminders" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <BellRing size={19} aria-hidden="true" />
        {t('学习提醒', 'Reminders')}
      </h2>
      <p className="muted">
        {t(
          '默认关闭。打开后每天在你选的时间汇总成一条提醒，没有要提醒的就不发；站内消息一定有，推送和邮件按你的选择。',
          'Off by default. When on, you get one reminder a day at the hour you pick, and none when there is nothing to say: always in your notifications, and by push or email if you choose.',
        )}
      </p>
      {!settings ? (
        !error && <output>{t('正在读取提醒设置…', 'Loading your reminder settings…')}</output>
      ) : !prefs ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void save({ review: true, streak: true, daily: false, contest: true, email: false, hour: 20, tz: 0, locale })
          }
        >
          {t('打开学习提醒', 'Turn reminders on')}
        </Button>
      ) : (
        <div className="cloud-profile-form">
          <fieldset className="cloud-profile-links" disabled={busy}>
            <legend>{t('提醒内容', 'Remind me about')}</legend>
            {KINDS.map(([kind, zh, en]) => (
              <label className="cloud-check" key={kind}>
                <input type="checkbox" checked={prefs[kind]} onChange={(e) => void save({ ...prefs, [kind]: e.target.checked })} />
                <span>{t(zh, en)}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${id}-hour`}>{t('每天提醒时间（本地时间）', 'Daily reminder time (your time)')}</label>
          <NativeSelect
            id={`${id}-hour`}
            value={prefs.hour}
            disabled={busy}
            onChange={(e) => void save({ ...prefs, hour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <NativeSelectOption key={h} value={h}>
                {`${String(h).padStart(2, '0')}:00`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <label className="cloud-check">
            <input
              type="checkbox"
              checked={prefs.email}
              disabled={busy || (!prefs.email && (!settings.mail || !settings.verified))}
              onChange={(e) => void save({ ...prefs, email: e.target.checked })}
            />
            <span>
              {t('同时发邮件到账户邮箱', 'Also email my account address')}
              <small>
                {!settings.mail
                  ? t('邮件发送尚未开通。', 'Email isn’t available yet.')
                  : !settings.verified
                    ? t('先验证邮箱才能打开。', 'Verify your email to turn this on.')
                    : t('每天最多一封，每封都能一键退订。', 'At most one a day, each with one-click unsubscribe.')}
              </small>
            </span>
          </label>
          {settings.push && pushSupported() && device !== undefined ? (
            here ? (
              <p>
                {t('这台设备已开启推送。', 'Push is on for this device.')}{' '}
                <Button variant="ghost" disabled={busy} onClick={() => void pushOff(here)}>
                  {t('关闭本设备推送', 'Turn push off here')}
                </Button>
              </p>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => void pushOn(settings.push!)}>
                {t('在这台设备上开启推送', 'Turn push on for this device')}
              </Button>
            )
          ) : (
            <small className="muted">
              {settings.push
                ? t('这个浏览器不支持推送；iPhone 和 iPad 要先把网站添加到主屏幕。', 'This browser can’t receive push; on iPhone and iPad, add the site to your Home Screen first.')
                : t('推送尚未开通。', 'Push isn’t available yet.')}
            </small>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => void save(null)}>
            {t('关闭学习提醒', 'Turn reminders off')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}
        </p>
      )}
    </section>
  );
}
