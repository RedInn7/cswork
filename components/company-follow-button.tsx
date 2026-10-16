'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { api } from '@/lib/types';
import { englishMessage } from '@/lib/messages-en';
import { companyHubPath } from '@/lib/oa-company-brands';
import { Button } from './ui/button';

/** GET/POST /api/oj/follows/companies (lib/server/follows.ts). */
type Follows = { signedIn: boolean; items: { slug: string; name: string }[] };

function useCompanyFollows() {
  const [state, setState] = useState<Follows | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<Follows>('oj/follows/companies').then(
      (s) => live && setState(s),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  async function toggle(slug: string, on: boolean) {
    // One request at a time; the controls stay enabled so keyboard focus stays put.
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setState(await api<Follows>('oj/follows/companies', { slug, on }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { state, busy, error, toggle };
}

/**
 * Follow a company (company and OA pages, the study plan): new member interview reports, OA
 * problems and intern or new-grad openings arrive as notifications. Signed out it leads to signing in. `hint` says so on the button.
 */
export function CompanyFollowButton({
  slug,
  name,
  zh,
  hint = false,
  className = 'company-follow',
}: {
  slug: string;
  name: string;
  zh: boolean;
  hint?: boolean;
  className?: string;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { state, busy, error, toggle } = useCompanyFollows();
  if (!state) return null;
  if (!state.signedIn)
    return (
      // oxlint-disable-next-line next/no-html-link-for-pages -- the SPA's account view signs in; also on public pages.
      <a className={className} href="/?view=account#companies">
        <Bell size={15} aria-hidden="true" />
        {t(`登录后关注 ${name}`, `Sign in to follow ${name}`)}
      </a>
    );
  const following = state.items.some((c) => c.slug === slug);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={following}
        aria-disabled={busy}
        title={t('有新面经、OA 题或在招岗位时通知你', 'Get notified of new interview reports, OA problems and open roles')}
        onClick={() => void toggle(slug, !following)}
      >
        <Bell size={15} aria-hidden="true" />
        {following
          ? t(`已关注 ${name}`, `Following ${name}`)
          : hint
            ? t(`关注 ${name}，有新面经、OA 题或在招岗位时提醒我`, `Follow ${name} for new interview reports, OA problems and open roles`)
            : t(`关注 ${name}`, `Follow ${name}`)}
      </button>
      {error && <span role="alert">{t(error, englishMessage(error))}</span>}
    </>
  );
}

/** The account page's followed companies, each with a link to its page and an unfollow button. */
export function FollowedCompanies({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { state, busy, error, toggle } = useCompanyFollows();
  if (!state) return null;
  return (
    <>
      {state.items.length ? (
        state.items.map((c) => (
          <div className="service-row" key={c.slug}>
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- a server page, left from the SPA. */}
            <a href={companyHubPath(c.slug)}>{c.name}</a>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={t(`取消关注 ${c.name}`, `Unfollow ${c.name}`)}
              onClick={() => void toggle(c.slug, false)}
            >
              <BellOff aria-hidden="true" />
              {t('取消关注', 'Unfollow')}
            </Button>
          </div>
        ))
      ) : (
        <p className="muted">
          {t(
            '还没有关注公司。在公司页点「关注」，有新面经、新 OA 题或新的实习/新毕业生岗位时会通知你（最多 20 家）。',
            'No companies yet. Press Follow on a company page to be notified of new interview reports, OA problems and intern or new-grad openings (up to 20).',
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}
        </p>
      )}
    </>
  );
}
