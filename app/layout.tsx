import type { Metadata } from 'next';
import { LocaleProvider } from '@/lib/i18n';
import { requestLocale } from '@/lib/server/locale';
import './globals.css';
import './theme.css';
import { cookies } from 'next/headers';
import { cookieTheme, THEME_COOKIE, THEME_SCRIPT } from '@/lib/theme-script';
import { Analytics } from '@/components/analytics';
import { measurementId } from '@/lib/analytics';
import { SEO_HOME, seoMetadata } from '@/lib/seo';
// In the reader's language from the first byte, so the tab title doesn't flash either.
export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata({ ...SEO_HOME[await requestLocale()], path: '/' });
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header switch mirrors the language into a cookie (lib/i18n.ts), so the
  // first HTML is already in the reader's language.
  const locale = await requestLocale();
  // A pinned theme renders from the cookie; "system" is resolved by THEME_SCRIPT before
  // first paint, which is why <html> may differ from this markup on hydration.
  const theme = cookieTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className={theme === 'dark' ? 'dark' : undefined}
      data-theme={theme ?? undefined}
      style={theme ? { colorScheme: theme } : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        {/* Google Analytics loads only after the visitor opts in (components/analytics.tsx). */}
        <Analytics id={measurementId(process.env.GA_MEASUREMENT_ID)} />
      </body>
    </html>
  );
}
