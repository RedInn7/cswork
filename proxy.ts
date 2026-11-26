import { NextResponse, type NextRequest } from 'next/server';
import { LANGUAGE_HEADER, languagePath, preferredLanguage, splitLanguagePath } from '@/lib/language';

/**
 * Language URLs. /en/oa is /oa rendered in English: the prefix is stripped and handed to the
 * page as a request header (lib/server/locale.ts). A first visit to an unprefixed page goes to
 * the browser's language; crawlers send no Accept-Language and keep reading Chinese there.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { language, path } = splitLanguagePath(pathname);
  const headers = new Headers(request.headers);
  // Only the URL sets it.
  headers.delete(LANGUAGE_HEADER);
  if (language) {
    headers.set(LANGUAGE_HEADER, language);
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  const cookie = request.headers.get('cookie') || '';
  if (
    request.method === 'GET' &&
    (request.headers.get('accept') || '').includes('text/html') &&
    // Crawlers read every language at its own URL; some do send Accept-Language.
    !/bot|spider|crawl|slurp|preview|facebookexternalhit|lighthouse/i.test(request.headers.get('user-agent') || '') &&
    // A reader who chose a language, or who already has an account, keeps what they see today.
    !/cswork_locale=|session_token=/.test(cookie)
  ) {
    const preferred = preferredLanguage(request.headers.get('accept-language'));
    if (preferred && preferred !== 'zh') {
      const response = NextResponse.redirect(new URL(languagePath(preferred, pathname) + search, request.url), 307);
      response.headers.set('Vary', 'Accept-Language, Cookie');
      return response;
    }
  }
  return NextResponse.next({ request: { headers } });
}

// Pages only: not the API, build assets, or files (sitemap.xml and robots.txt stay unprefixed).
export const config = { matcher: ['/((?!api/|_next/|assets/|.*\\.[a-z0-9]+$).*)'] };
