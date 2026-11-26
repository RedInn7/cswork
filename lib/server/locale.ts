import { cookies, headers } from 'next/headers';
import { asLanguage, LANGUAGE_HEADER, localeOf, type Language, type Locale } from '@/lib/language';

/** The language in the URL (/en/..., set by proxy.ts); null on unprefixed pages. */
export async function urlLanguage(): Promise<Language | null> {
  const value = (await headers()).get(LANGUAGE_HEADER);
  return value ? asLanguage(value) : null;
}
/** The reader's site language: the URL's, else the one the header switch remembered (lib/i18n.ts writes the cookie). */
export async function requestLanguage(): Promise<Language> {
  return (await urlLanguage()) ?? asLanguage((await cookies()).get('cswork_locale')?.value);
}
/** The language the interface text is written in (lib/language.ts). */
export async function requestLocale(): Promise<Locale> {
  return localeOf(await requestLanguage());
}
