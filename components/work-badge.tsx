'use client';
import { useEffect, useId, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { Input } from './ui/input';
import '@/app/learner-cloud.css';

type Placement = 'profile' | 'posts' | 'referrals';
type State = {
  mail: boolean;
  verification: {
    company: { slug: string; name: string };
    domain: string;
    expiresAt: number | null;
    active: boolean;
    pending: boolean;
    show: Record<Placement, boolean>;
  } | null;
};
// [zh, en, zh note, en note]
const PLACEMENTS: [Placement, string, string, string, string][] = [
  [
    'profile',
    '公开主页',
    'Public profile',
    '显示在主页名下面。显示时，主页的帖子列表不列面经、求职、上岸故事帖和公司 OA 题的题解；这些帖子仍署你的主页名，读者能顺着名字找到你的主页。',
    'Under your handle. While it shows, your profile’s post list leaves out interview, career and offer threads and solutions to company OA problems. Those posts still carry your handle, so readers can find your profile from them.',
  ],
  [
    'posts',
    '讨论帖和题解',
    'Threads and solutions',
    '只在题解和算法、内推、站务频道显示；公司 OA 题的题解、面经、求职、上岸故事和面经评论里永远不显示，以免透露「这家公司的员工在找工作」。',
    'Only on solutions and the Algorithms, Referrals and Site feedback channels. Never on solutions to a company’s OA problems, in interview, career or offer talk or on experience comments, where it would say an employee there is interviewing.',
  ],
  [
    'referrals',
    '内推帖',
    'Referral threads',
    '你在「内推」频道标了这家公司的帖子会带「可内推」，读者可以私信请求内推。',
    'Your referral threads tagged with this company show "Gives referrals", and readers can message you for one.',
  ],
];

/** Account settings: the verified employee badge, shown nowhere until switched on per placement. */
export function WorkBadgeSettings() {
  const t = useT();
  const english = useLocale() === 'en';
  const id = useId();
  const [state, setState] = useState<State | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    api<State>('oj/work').then(
      (s) => live && setState(s),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  async function run(path: string, body: unknown, done = '') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setState(await api<State>(`oj/work/${path}`, body));
      setMessage(done);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const v = state?.verification;
  return (
    <section className="form-card commerce-account-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <BadgeCheck size={19} />
        {t('员工身份徽章', 'Verified employee badge')}
      </h2>
      <p className="muted">
        {t(
          '用公司邮箱证明你在哪家公司工作。平台只保存这个邮箱的不可逆摘要和域名，不保存邮箱本身；一个工作邮箱只能验证一个账号，有效 1 年。徽章默认哪里都不显示，在下面逐项打开；换成另一家公司验证后，每一项都会重新关闭。',
          'Prove where you work with your work email. We keep only a one-way digest of the address and its domain, never the address; one work email verifies one account, for a year. The badge shows nowhere until you turn it on below, place by place, and every place turns off again when you verify at another company.',
        )}
      </p>
      {v?.active && (
        <p className="notice commerce-success">
          {t(
            `已验证：${v.company.name} 员工（${v.domain}），有效期至 ${new Date(v.expiresAt!).toLocaleDateString('zh-CN')}。`,
            `Verified: ${v.company.name} employee (${v.domain}), until ${new Date(v.expiresAt!).toLocaleDateString('en-US')}.`,
          )}
        </p>
      )}
      <form
        className="cloud-profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run('verify', { email: email.trim() }, t('验证码已发到这个邮箱，15 分钟内有效。', 'We sent a code to that address. It is valid for 15 minutes.'));
        }}
      >
        <label htmlFor={`${id}-email`}>{v?.active ? t('换一个工作邮箱', 'Verify another work email') : t('工作邮箱', 'Work email')}</label>
        <Input
          id={`${id}-email`}
          type="email"
          value={email}
          maxLength={254}
          autoComplete="off"
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={`${id}-email-help`}
          required
        />
        <small id={`${id}-email-help`} className="muted">
          {state && !state.mail
            ? t('邮件服务尚未开放，暂时不能验证。', "Email isn't set up yet, so verifying is unavailable for now.")
            : t(
                '只支持有公司页的公司；gmail、qq、163、outlook 这类个人邮箱不行。每天最多发 3 次。',
                'Only companies with a company page; personal addresses (gmail, qq, 163, outlook…) don’t count. Up to 3 codes a day.',
              )}
        </small>
        <Button type="submit" variant="outline" disabled={busy || !state?.mail || !email.trim()}>
          {t('发送验证码', 'Send code')}
        </Button>
      </form>
      {v?.pending && (
        <form
          className="cloud-profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run('confirm', { code: code.trim() }, t('验证成功。', 'Verified.')).then((ok) => ok && setCode(''));
          }}
        >
          <label htmlFor={`${id}-code`}>{t(`发到 @${v.domain} 邮箱的 6 位验证码`, `The 6-digit code sent to your @${v.domain} address`)}</label>
          <Input
            id={`${id}-code`}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Button type="submit" variant="outline" disabled={busy || code.trim().length !== 6}>
            {t('确认', 'Confirm')}
          </Button>
        </form>
      )}
      {v?.active && (
        <fieldset className="cloud-profile-form" disabled={busy}>
          <legend>{t('在哪里显示「已验证 · 公司员工」', 'Where to show "Verified · company employee"')}</legend>
          {PLACEMENTS.map(([key, zh, en, zhNote, enNote]) => (
            <label key={key} className="cloud-check">
              <input
                type="checkbox"
                checked={v.show[key]}
                onChange={(e) => void run('show', { [key]: e.target.checked })}
              />
              <span>
                {english ? en : zh}
                <small>{english ? enNote : zhNote}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {v && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void run('remove', {}, t('已删除验证记录。', 'Verification removed.'))}
        >
          {t('删除验证记录', 'Remove verification')}
        </Button>
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
