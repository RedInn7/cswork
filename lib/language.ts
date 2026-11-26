/** Site languages, shared by server code and the client switch (lib/i18n.ts). */
export type Locale = 'en' | 'zh';
/**
 * `Locale` is the language the interface text is written in. Traditional Chinese is the
 * Chinese text converted (lib/traditional.ts); Japanese, Korean and Vietnamese have their own
 * landing copy (lib/seo.ts) and otherwise read the English interface.
 */
export type Language = Locale | 'zh-Hant' | 'ja' | 'ko' | 'vi';
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'zh', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'vi', label: 'Tiếng Việt' },
];
const known = (value: string | null | undefined): Language | null =>
  LANGUAGES.find((option) => option.value === value)?.value ?? null;
export const asLanguage = (value: string | null | undefined): Language => known(value) ?? 'zh';
export const localeOf = (language: Language): Locale =>
  language === 'zh' || language === 'zh-Hant' ? 'zh' : 'en';
export const htmlLang = (language: Language) => (language === 'zh' ? 'zh-CN' : language);
/**
 * Languages a problem's statement, hints and editorial may be translated into beside Chinese and
 * English. Their readers keep the English interface (`localeOf`).
 */
export const CONTENT_LANGUAGES = ['ja', 'ko', 'vi'] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
export const contentLanguage = (value: string | null | undefined): ContentLanguage | null =>
  CONTENT_LANGUAGES.find((language) => language === value) ?? null;
/** Text kept per language, cut to what one reader can use: Chinese, English and their own language. */
export function forReader<T extends object>(text: T, own: ContentLanguage | null): T {
  return Object.fromEntries(
    Object.entries(text).filter(([key]) => !contentLanguage(key) || key === own),
  ) as T;
}

/**
 * Every language but Simplified Chinese has its own URLs under a prefix (/en/oa, /ja);
 * proxy.ts serves them from the same routes and tells the page through this request header.
 */
export const LANGUAGE_HEADER = 'x-cswork-language';
/** '/en/oa' -> { language: 'en', path: '/oa' }; an unprefixed path has no language. */
export function splitLanguagePath(pathname: string): { language: Language | null; path: string } {
  const [, first = '', ...rest] = pathname.split('/');
  const language = first === 'zh' ? null : known(first);
  return language ? { language, path: `/${rest.join('/')}` } : { language: null, path: pathname };
}
/** The same page in `language`; `path` may carry a query. */
export const languagePath = (language: Language, path: string) =>
  language === 'zh' ? path : `/${language}${path === '/' || path.startsWith('/?') ? path.slice(1) : path}`;

/**
 * The language for a first visit, from Accept-Language; null when the browser says nothing.
 * Any Chinese in the list wins, even behind English: most readers here are Chinese speakers
 * whose browsers are set to English.
 */
export function preferredLanguage(accept: string | null | undefined): Language | null {
  const tags = (accept || '')
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().toLowerCase().split(';q=');
      return { tag, q: q === undefined ? 1 : Number(q) };
    })
    .filter((item) => item.tag && item.q > 0)
    .sort((a, b) => b.q - a.q);
  if (!tags.length) return null;
  const chinese = tags.find((item) => item.tag.startsWith('zh'));
  if (chinese) return /hant|tw|hk|mo/.test(chinese.tag) ? 'zh-Hant' : 'zh';
  for (const { tag } of tags) {
    const language = known(tag.split('-')[0]);
    if (language) return language;
  }
  return 'en';
}
