/** Site languages, shared by server code and the client switch (lib/i18n.ts). */
export type Locale = 'en' | 'zh';
export type Language = Locale | 'zh-Hant';
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'zh', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'en', label: 'English' },
];
export const asLanguage = (value: string | null | undefined): Language =>
  value === 'en' || value === 'zh-Hant' ? value : 'zh';
export const htmlLang = (language: Language) =>
  language === 'en' ? 'en' : language === 'zh-Hant' ? 'zh-Hant' : 'zh-CN';
