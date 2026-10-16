'use client';
import { useEffect, useId, useState } from 'react';
import { Copy, Globe } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import '@/app/learner-cloud.css';

type LinkKind = 'website' | 'github' | 'linkedin' | 'x';
type Profile = {
  handle: string;
  visible: boolean;
  indexable: boolean;
  showContest: boolean;
  showPractice: boolean;
  bio: string;
  featuredBadge: string | null;
  links: { kind: LinkKind; url: string }[];
  school: string;
  gradYear: number | null;
  targetRole: string;
};
type Earned = { id: string; zh: string; en: string };
const HANDLE = '^[a-z0-9][a-z0-9\\-]{1,28}[a-z0-9]$';
const LINKS: [LinkKind, string, string, string][] = [
  ['website', '个人网站', 'Website', 'https://you.example.com'],
  ['github', 'GitHub', 'GitHub', 'https://github.com/you'],
  ['linkedin', 'LinkedIn', 'LinkedIn', 'https://www.linkedin.com/in/you'],
  ['x', 'X', 'X', 'https://x.com/you'],
];

/** Account settings: the opt-in public page /u/<handle>. Off until the learner turns it on. */
export function PublicProfileSettings() {
  const t = useT();
  const id = useId();
  const [saved, setSaved] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({
    handle: '',
    visible: false,
    indexable: false,
    showContest: false,
    showPractice: false,
    bio: '',
    featuredBadge: null,
    links: [],
    school: '',
    gradYear: null,
    targetRole: '',
  });
  const linkUrl = (kind: LinkKind) => form.links.find((l) => l.kind === kind)?.url ?? '';
  const setLink = (kind: LinkKind, url: string) =>
    setForm({
      ...form,
      links: LINKS.map(([k]) => ({ kind: k, url: k === kind ? url : linkUrl(k) })).filter((l) => l.url.trim()),
    });
  // Badges the page would show, from the server: the ones that may be featured.
  const [badges, setBadges] = useState<Earned[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const english = useLocale() === 'en';
  useEffect(() => {
    let live = true;
    api<{ profile: Profile | null; badges?: Earned[] }>('oj/profile').then(
      ({ profile, badges }) => {
        if (!live) return;
        setSaved(profile);
        // A featured badge no longer earned would be refused on the next save: let it go.
        if (profile)
          setForm((form) => ({
            ...form,
            ...profile,
            featuredBadge: badges?.some((b) => b.id === profile.featuredBadge) ? profile.featuredBadge : null,
          }));
        setBadges(badges ?? []);
        setLoaded(true);
      },
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  const href = saved?.visible ? `/u/${saved.handle}` : null;
  const badge =
    href && `[![CSWork @${saved!.handle}](https://cswork.org${href}/badge.svg${english ? '?lang=en' : ''})](https://cswork.org${href})`;
  return (
    <section className="form-card commerce-account-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <Globe size={19} />
        {t('公开主页', 'Public profile')}
      </h2>
      <p className="muted">
        {t(
          '默认关闭。打开后，别人能看到你的主页名、简介、你填写的链接、学校和目标岗位、按难度和站点统计的通过数、按年的刷题热力图和年度回顾、最近通过的题和公开题单，也能拿你的通过数和自己的对比；不会显示昵称和邮箱。',
          'Off by default. When on, others see your handle, bio, the links, school and target role you fill in, solved counts by difficulty and stop, yearly heatmaps and year in review, recent solves and public lists, and can compare your counts with theirs, never your name or email.',
        )}
      </p>
      <form
        className="cloud-profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          api<{ profile: Profile; badges?: Earned[] }>('oj/profile', {
            ...form,
            handle: form.handle.trim().toLowerCase(),
            indexable: form.visible && form.indexable,
            showContest: form.visible && form.showContest,
            showPractice: form.visible && form.showPractice,
            // A contest badge goes with the hidden curve.
            featuredBadge:
              form.featuredBadge?.startsWith('contest:') && !(form.visible && form.showContest) ? null : form.featuredBadge,
          })
            .then(({ profile, badges }) => {
              setSaved(profile);
              setForm((form) => ({ ...form, ...profile }));
              setBadges(badges ?? []);
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
        <label htmlFor={`${id}-school`}>{t('学校（可选）', 'School (optional)')}</label>
        <Input
          id={`${id}-school`}
          value={form.school}
          maxLength={80}
          autoComplete="organization"
          onChange={(e) => setForm({ ...form, school: e.target.value })}
          aria-describedby={`${id}-school-help`}
        />
        <small id={`${id}-school-help`} className="muted">
          {t(
            '学校会出现在学校排行榜上，需要同时开启比赛展示并有比赛积分；同校至少 3 位这样的人后才有这个学校的榜。学校是自填的，榜上会注明未经验证。',
            'Your school puts you on its school board, together with showing contests and a contest rating; a school gets a board once 3 such learners show it. Schools are self-reported and the board says so.',
          )}
        </small>
        <div className="cloud-profile-pair">
          <div>
            <label htmlFor={`${id}-grad`}>{t('毕业年份（可选）', 'Graduation year (optional)')}</label>
            <Input
              id={`${id}-grad`}
              type="number"
              inputMode="numeric"
              min={1990}
              max={2040}
              value={form.gradYear ?? ''}
              onChange={(e) => setForm({ ...form, gradYear: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <label htmlFor={`${id}-role`}>{t('目标岗位（可选）', 'Target role (optional)')}</label>
            <Input
              id={`${id}-role`}
              value={form.targetRole}
              maxLength={60}
              onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
            />
          </div>
        </div>
        <fieldset className="cloud-profile-links">
          <legend>{t('链接（可选，只接受 https）', 'Links (optional, https only)')}</legend>
          {LINKS.map(([kind, zh, en, placeholder]) => (
            <div key={kind}>
              <label htmlFor={`${id}-link-${kind}`}>{t(zh, en)}</label>
              <Input
                id={`${id}-link-${kind}`}
                type="url"
                pattern="https://.+"
                maxLength={200}
                placeholder={placeholder}
                value={linkUrl(kind)}
                onChange={(e) => setLink(kind, e.target.value)}
              />
            </div>
          ))}
        </fieldset>
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
        <label className="cloud-check">
          <input
            type="checkbox"
            checked={form.visible && form.showContest}
            disabled={!form.visible}
            onChange={(e) => setForm({ ...form, showContest: e.target.checked })}
          />
          <span>
            {t('显示周赛和入门赛 rating、1v1 排位战绩和比赛徽章', 'Show my weekly and starter ratings, ranked 1v1 record and contest badges')}
            <small>
              {t(
                '曲线带每场周赛和入门赛的名次和 rating，别人能据此在公开计分板上认出你的比赛昵称；排位战绩是对战 rating 和胜负平场数。',
                'The curve carries your rank and rating in each weekly and starter, which lets others find your contest name on the public scoreboards; the ranked 1v1 record is your duel rating and wins, losses and draws.',
              )}
            </small>
          </span>
        </label>
        <label className="cloud-check">
          <input
            type="checkbox"
            checked={form.visible && form.showPractice}
            disabled={!form.visible}
            onChange={(e) => setForm({ ...form, showPractice: e.target.checked })}
          />
          <span>
            {t('出现在练习排行榜', 'List me on the practice leaderboard')}
            <small>
              {t(
                '榜上显示你的主页名、练习积分、通过题数和连续打卡天数，可按你填写的学校和提交语言筛选；README 徽章也会带上积分和名次。',
                'The board shows your handle, practice points, problems solved and daily streak, filterable by the school you fill in and by language; your README badge adds your points and rank.',
              )}
            </small>
          </span>
        </label>
        {badges.length > 0 && (
          <>
            <label htmlFor={`${id}-featured`}>{t('主页名旁展示的徽章（可选）', 'Badge beside your handle (optional)')}</label>
            <NativeSelect
              id={`${id}-featured`}
              value={form.featuredBadge ?? ''}
              onChange={(e) => setForm({ ...form, featuredBadge: e.target.value || null })}
            >
              <NativeSelectOption value="">{t('不展示', 'None')}</NativeSelectOption>
              {badges.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {t(b.zh, b.en)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        )}
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
      {badge && (
        <div className="cloud-profile-badge">
          <label htmlFor={`${id}-badge`}>{t('README 徽章（Markdown）', 'README badge (Markdown)')}</label>
          <div>
            <Input id={`${id}-badge`} readOnly value={badge} onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void navigator.clipboard?.writeText(badge).then(
                  () => setCopied(true),
                  () => {},
                )
              }
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? t('已复制', 'Copied') : t('复制', 'Copy')}
            </Button>
          </div>
        </div>
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
