import type { Metadata } from 'next';
import { LocaleProvider } from '@/lib/i18n';
import { requestLocale } from '@/lib/server/locale';
import './globals.css';
import './theme.css';
import { THEME_SCRIPT } from '@/lib/theme-script';
import { Analytics } from '@/components/analytics';
import { CommandPalette } from '@/components/command-palette';
import { aiEnabled } from '@/lib/server/ai-tutor';
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
  // The theme (.dark, data-theme, color-scheme) is THEME_SCRIPT's alone: it runs before
  // first paint, and if React rendered those attributes too, the next server render of
  // this layout would diff them away after a switch.
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'} suppressHydrationWarning>
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
      </body>
    </html>
  );
}
