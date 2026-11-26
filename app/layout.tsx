import type { Metadata } from 'next';
import { LocaleProvider } from '@/lib/i18n';
import { htmlLang } from '@/lib/language';
import { requestLanguage } from '@/lib/server/locale';
import './globals.css';
import './theme.css';
import { THEME_SCRIPT } from '@/lib/theme-script';
import { Analytics } from '@/components/analytics';
import { SwRegister } from '@/components/sw-register';
import { CommandPalette } from '@/components/command-palette';
import { aiEnabled } from '@/lib/server/ai-tutor';
import { measurementId } from '@/lib/analytics';
import { homeCopy } from '@/lib/seo';
import { pageMetadata } from '@/lib/server/seo';
// In the reader's language from the first byte, so the tab title doesn't flash either.
export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = homeCopy(await requestLanguage());
  return {
    ...(await pageMetadata({ title, description, path: '/', localized: true })),
    // The home-screen icon on iOS; others read app/manifest.ts.
    icons: { apple: '/icons/apple-touch-icon.png' },
    // Search console ownership: paste each console's code into the server environment.
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: {
        ...(process.env.BING_SITE_VERIFICATION && { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }),
        ...(process.env.BAIDU_SITE_VERIFICATION && { 'baidu-site-verification': process.env.BAIDU_SITE_VERIFICATION }),
      },
    },
  };
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header switch mirrors the language into a cookie (lib/i18n.ts), so the
  // first HTML is already in the reader's language.
  const locale = await requestLanguage();
  // The theme (.dark, data-theme, color-scheme) is THEME_SCRIPT's alone: it runs before
  // first paint, and if React rendered those attributes too, the next server render of
  // this layout would diff them away after a switch.
  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider locale={locale}>
          {/* ⌘K search on every page; "Ask AI" only when the server has a key. */}
          <CommandPalette ai={aiEnabled()}>{children}</CommandPalette>
        </LocaleProvider>
        {/* Google Analytics loads only after the visitor opts in (components/analytics.tsx). */}
        <Analytics id={measurementId(process.env.GA_MEASUREMENT_ID)} />
        {/* Installable app and offline page (public/sw.js); never in dev, where files change under it. */}
        {process.env.NODE_ENV === 'production' && <SwRegister />}
      </body>
    </html>
  );
}
