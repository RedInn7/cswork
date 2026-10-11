export const ANALYTICS_CONSENT_KEY = 'cswork.analytics-consent.v1';
export const ANALYTICS_NAVIGATION_EVENT = 'cswork:analytics-navigation';
const pages: Record<string, string> = {
  home: 'Home',
  courses: 'Courses',
  knowledge: 'Knowledge',
  problems: 'Problem library',
  problem: 'Practice',
  lesson: 'Lesson',
  questions: 'Questions',
  experiences: 'Experiences',
  resources: 'Resources',
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
    ];
    const source = sources.find(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    return source ? `${url.protocol}//${source}/` : '';
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
