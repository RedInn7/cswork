export const ANALYTICS_CONSENT_KEY = 'cswork.analytics-consent.v1';
export const ANALYTICS_NAVIGATION_EVENT = 'cswork:analytics-navigation';
const pages: Record<string, string> = {
  home: 'Home',
  courses: 'Courses',
  knowledge: 'Knowledge',
  problems: 'Problem library',
  mock: 'Mock OA',
  problem: 'Practice',
  lesson: 'Lesson',
  questions: 'Questions',
  experiences: 'Experiences',
  resources: 'Resources',
  'mock-interview': 'Mock interview',
  status: 'Service status',
};
export function measurementId(value: string | undefined): string {
  return value && /^G-[A-Z0-9]{6,20}$/.test(value) ? value : '';
}
export function analyticsReferrer(referrer: string): string {
  try {
    const url = new URL(referrer);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    // A small source allowlist avoids leaking private hosts or user-controlled subdomains.
    const sources = [
      'google.com',
      'bing.com',
      'duckduckgo.com',
      'yahoo.com',
      'github.com',
      'linkedin.com',
      'reddit.com',
      'facebook.com',
      'youtube.com',
      't.co',
      'x.com',
      'baidu.com',
      'zhihu.com',
      'xiaohongshu.com',
      'bilibili.com',
      'v2ex.com',
      '1point3acres.com',
      'chatgpt.com',
      'perplexity.ai',
    ];
    const source = sources.find(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    return source ? `${url.protocol}//${source}/` : '';
  } catch {
    return '';
  }
}
/** The referring site for the owner dashboard: an allowlisted host, or 'other'. */
export function referrerHost(referrer: string, self: string) {
  const source = analyticsReferrer(referrer);
  if (source) return new URL(source).hostname;
  try {
    return new URL(referrer).host === self ? '' : 'other';
  } catch {
    return '';
  }
}
export function analyticsPage(href: string) {
  try {
    const url = new URL(href);
    if (url.origin !== 'https://cswork.org' || url.pathname !== '/')
      return null;
    const view = url.searchParams.get('view') || 'problems';
    if (!Object.hasOwn(pages, view)) return null;
    return {
      page_location: `https://cswork.org/${view === 'home' ? '' : view}`,
      page_title: `CSWORK · ${pages[view]}`,
      page_referrer: '',
    };
  } catch {
    return null;
  }
}

/**
 * Product events for GA4 and the owner dashboard (POST /api/metrics).
 * Values are strings (max 120 chars), finite numbers and booleans: never code,
 * emails, names or other personal data. Nothing here may break the page.
 */
type Params = Record<string, string | number | boolean | null | undefined>;
let memoryVid = '';

function clean(params: Params) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') out[key] = value.slice(0, 120);
    else if (
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      out[key] = value;
  }
  return out;
}

/** Random and anonymous; per page load when storage is blocked. */
function visitorId() {
  try {
    let vid = localStorage.getItem('cswork:vid');
    if (!vid) localStorage.setItem('cswork:vid', (vid = crypto.randomUUID()));
    return vid;
  } catch {
    return (memoryVid ||= crypto.randomUUID());
  }
}

/** Owner dashboard only, e.g. page_view, which GA4 already counts itself. */
export function beacon(name: string, params: Params = {}) {
  if (typeof window === 'undefined') return;
  try {
    // A text/plain JSON body: the one sendBeacon type every browser accepts.
    const body = JSON.stringify({
      vid: visitorId(),
      events: [{ name, params: clean(params) }],
    });
    if (!navigator.sendBeacon?.('/api/metrics', body))
      void fetch('/api/metrics', {
        method: 'POST',
        body,
        keepalive: true,
      }).catch(() => {});
  } catch {
    /* Analytics is best effort. */
  }
}

let lastPage = '',
  visited = false;
/**
 * Once per tab session, so a reload or an OAuth round trip is not a new visit;
 * per page load when storage is blocked.
 */
function newVisit() {
  if (visited) return false;
  visited = true;
  try {
    if (sessionStorage.getItem('cswork:visit')) return false;
    sessionStorage.setItem('cswork:visit', '1');
  } catch {
    /* Counted per page load. */
  }
  return true;
}
/**
 * One page_view per URL: StrictMode's second effect run doesn't repeat it.
 * The first of a visit also says where it came from: the referring host and
 * the UTM tags, never a URL.
 */
export function pageView(params: Params) {
  if (typeof window === 'undefined') return;
  const url = location.pathname + location.search;
  if (url === lastPage) return;
  lastPage = url;
  const p = new URLSearchParams(location.search);
  beacon(
    'page_view',
    newVisit()
      ? {
          ...params,
          ref: referrerHost(document.referrer, location.host) || null,
          utm_source: p.get('utm_source'),
          utm_medium: p.get('utm_medium'),
          utm_campaign: p.get('utm_campaign'),
        }
      : params,
  );
}

/** GA4 (no-op without the gtag snippet: dev, tests, ad blockers) plus the owner dashboard. */
export function track(name: string, params: Params = {}) {
  beacon(name, params);
  if (typeof window === 'undefined') return;
  try {
    const gtag: unknown = Reflect.get(window, 'gtag');
    // gtag reads `language` as the visitor's UI language (GA4's built-in dimension).
    const { language, ...rest } = clean(params);
    // GA4 loads only after consent (components/analytics.tsx); free-text searches stay first-party.
    if (typeof gtag === 'function' && name !== 'search')
      gtag(
        'event',
        name,
        language === undefined ? rest : { ...rest, code_language: language },
      );
  } catch {
    /* Analytics is best effort. */
  }
}
