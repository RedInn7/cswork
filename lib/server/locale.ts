import { cookies } from 'next/headers';

/** The reader's site language, remembered by the header switch (lib/i18n.ts writes the cookie). */
export async function requestLocale(): Promise<'en' | 'zh'> {
  return (await cookies()).get('cswork_locale')?.value === 'en' ? 'en' : 'zh';
}
