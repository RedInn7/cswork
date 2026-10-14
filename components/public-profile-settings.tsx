'use client';
import { useEffect, useId, useState } from 'react';
import { Globe } from 'lucide-react';
import { api } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { Input } from './ui/input';
import '@/app/learner-cloud.css';

type Profile = { handle: string; visible: boolean; indexable: boolean; bio: string };
const HANDLE = '^[a-z0-9][a-z0-9\\-]{1,28}[a-z0-9]$';

/** Account settings: the opt-in public page /u/<handle>. Off until the learner turns it on. */
export function PublicProfileSettings() {
  const t = useT();
  const id = useId();
  const [saved, setSaved] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({ handle: '', visible: false, indexable: false, bio: '' });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    api<{ profile: Profile | null }>('oj/profile').then(
      ({ profile }) => {
        if (!live) return;
        setSaved(profile);
        if (profile) setForm(profile);
        setLoaded(true);
      },
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  const href = saved?.visible ? `/u/${saved.handle}` : null;
  return (
    <section className="form-card commerce-account-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <Globe size={19} />
        {t('公开主页', 'Public profile')}
      </h2>
      <p className="muted">
        {t(
          '默认关闭。打开后，别人能看到你的主页名、简介、按难度和站点统计的通过数、刷题热力图、最近通过的题和公开题单；不会显示昵称和邮箱。',
          'Off by default. When on, others see your handle, bio, solved counts by difficulty and stop, practice heatmap, recent solves and public lists, never your name or email.',
        )}
      </p>
      <form
        className="cloud-profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          api<{ profile: Profile }>('oj/profile', {
            ...form,
            handle: form.handle.trim().toLowerCase(),
            indexable: form.visible && form.indexable,
          })
            .then(({ profile }) => {
              setSaved(profile);
              setForm(profile);
              setMessage(profile.visible ? t('主页已公开。', 'Your profile is public.') : t('已保存，主页未公开。', 'Saved. Your profile is not public.'));
            }, (reason: Error) => setError(reason.message))
            .finally(() => setBusy(false));
        }}
      >
        <label htmlFor={`${id}-handle`}>{t('主页名', 'Handle')}</label>
        <div className="cloud-handle">
          <span aria-hidden="true">cswork.org/u/</span>
          <input
            id={`${id}-handle`}
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })}
            required
            minLength={3}
            maxLength={30}
            pattern={HANDLE}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-handle-help`}
          />
        </div>
        <small id={`${id}-handle-help`} className="muted">
          {t('3–30 位小写字母、数字或连字符。', '3–30 lowercase letters, digits or hyphens.')}
        </small>
        <label htmlFor={`${id}-bio`}>{t('一句话简介（可选）', 'Bio (optional)')}</label>
        <Input
          id={`${id}-bio`}
          value={form.bio}
          maxLength={160}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <label className="cloud-check">
          <input
            type="checkbox"
            checked={form.visible}
            onChange={(e) => setForm({ ...form, visible: e.target.checked })}
          />
          <span>{t('公开我的主页', 'Make my profile public')}</span>
        </label>
        <label className="cloud-check">
          <input
            type="checkbox"
            checked={form.visible && form.indexable}
            disabled={!form.visible}
            onChange={(e) => setForm({ ...form, indexable: e.target.checked })}
          />
          <span>
            {t('允许搜索引擎收录', 'Let search engines index it')}
            <small>{t('不勾选时页面带 noindex。', 'Unticked, the page carries noindex.')}</small>
          </span>
        </label>
        <Button variant="outline" disabled={busy || !loaded || !form.handle.trim()}>
          {t('保存公开主页设置', 'Save profile settings')}
        </Button>
      </form>
      {href && (
        <p className="cloud-profile-link">
          {t('你的主页：', 'Your page: ')}
          <a href={href} className="underline underline-offset-4">
            cswork.org{href}
          </a>
        </p>
      )}
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
    </section>
  );
}
