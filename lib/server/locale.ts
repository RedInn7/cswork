import { cookies } from 'next/headers';
import { asLanguage, type Language } from '@/lib/language';

/** The reader's site language, remembered by the header switch (lib/i18n.ts writes the cookie). */
export async function requestLanguage(): Promise<Language> {
  return asLanguage((await cookies()).get('cswork_locale')?.value);
}
/** Traditional Chinese renders as Chinese; the page converts it (lib/traditional.ts). */
export async function requestLocale(): Promise<'en' | 'zh'> {
  return (await requestLanguage()) === 'en' ? 'en' : 'zh';
}
