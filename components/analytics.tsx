'use client';
import { useEffect, useState } from 'react';
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_NAVIGATION_EVENT,
  analyticsPage,
  analyticsReferrer,
  measurementId,
} from '@/lib/analytics';
import './analytics.css';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};
export function Analytics({ id }: { id: string }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const validId = measurementId(id);
  useEffect(() => {
    if (!validId || location.origin !== 'https://cswork.org') return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    } catch {
      /* Fail closed. */
    }
    // oxlint-disable-next-line react/react-compiler -- Hydrate consent from browser storage after SSR.
    setChoice(
      stored === 'accepted'
        ? 'accepted'
        : stored === 'declined'
          ? 'declined'
          : null,
    );
    setOpen(stored !== 'accepted' && stored !== 'declined');
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_KEY) {
        (window as unknown as Record<string, unknown>)[
          `ga-disable-${validId}`
        ] = true;
        location.reload();
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [validId]);
  useEffect(() => {
    if (!ready || choice !== 'accepted' || !validId) return;
    const win = window as AnalyticsWindow;
    const disableKey = `ga-disable-${validId}`;
    (window as unknown as Record<string, unknown>)[disableKey] = false;
    win.dataLayer = win.dataLayer || [];
    // Google consumes the arguments object, not a spread array.
    win.gtag = function () {
      // oxlint-disable-next-line eslint/prefer-rest-params -- Google's documented queue protocol requires arguments.
      win.dataLayer!.push(arguments);
    };
    win.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    win.gtag('js', new Date());
    win.gtag('config', validId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: 'https://cswork.org/',
      page_title: 'CSWORK',
      page_referrer: analyticsReferrer(document.referrer),
      cookie_expires: 60 * 60 * 24 * 90,
    });
    let previous = '';
    let source = analyticsReferrer(document.referrer);
    const track = () => {
      const page = analyticsPage(location.href);
      if (!page) {
        previous = '';
        return;
      }
      if (previous === page.page_location) return;
      page.page_referrer = source;
      previous = page.page_location;
      source = previous;
      win.gtag!('set', page);
      win.gtag!('event', 'page_view', { ...page, send_to: validId });
    };
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${validId}`;
    document.head.appendChild(script);
    track();
    window.addEventListener(ANALYTICS_NAVIGATION_EVENT, track);
    window.addEventListener('popstate', track);
    return () => {
      window.removeEventListener(ANALYTICS_NAVIGATION_EVENT, track);
      window.removeEventListener('popstate', track);
      script.remove();
      (window as unknown as Record<string, unknown>)[disableKey] = true;
    };
  }, [ready, choice, validId]);
  function save(accepted: boolean) {
    const next = accepted ? 'accepted' : 'declined';
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, next);
    } catch {
      /* Current visit only. */
    }
    if (!accepted) {
      (window as unknown as Record<string, unknown>)[`ga-disable-${validId}`] =
        true;
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.trim().split('=')[0];
        if (name === '_ga' || name.startsWith('_ga_')) {
          for (const domain of [
            '',
            '; Domain=cswork.org',
            '; Domain=.cswork.org',
          ]) {
            document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
          }
        }
      }
    }
    setChoice(next);
    setOpen(false);
    // Unload the already-loaded Google runtime immediately on withdrawal.
    if (!accepted && choice === 'accepted') location.reload();
  }
  if (!ready) return null;
  return (
    <div className="analytics-consent">
      {open ? (
        <section aria-label="Analytics preferences" className="analytics-panel">
          <strong>Help improve CSWORK / 帮助改进网站</strong>
          <p>
            Allow Google Analytics to measure page visits? We do not send your
            email, code or private messages. Optional; you can change this
            anytime.
          </p>
          <p>
            是否允许 Google Analytics
            统计页面访问？不发送邮箱、代码或私密消息。拒绝不影响使用，可随时撤回。
          {/* A full navigation unloads the existing analytics runtime. */}
          {/* oxlint-disable-next-line next/no-html-link-for-pages */}
          <a href="/privacy">Privacy / 隐私说明</a>
          </p>
          <div className="analytics-actions">
            <button type="button" onClick={() => save(false)}>
              Decline / 拒绝
            </button>
            <button type="button" onClick={() => save(true)}>
              Allow / 允许
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="analytics-settings"
          onClick={() => setOpen(true)}
        >
          Privacy / 隐私设置
        </button>
      )}
    </div>
  );
}
