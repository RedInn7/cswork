import type { Metadata } from 'next';
import { LocaleProvider } from '@/lib/i18n';
import { requestLocale } from '@/lib/server/locale';
import './globals.css';
import { Analytics } from '@/components/analytics';
import { measurementId } from '@/lib/analytics';
// In the reader's language from the first byte, so the tab title doesn't flash either.
export async function generateMetadata(): Promise<Metadata> {
  return (await requestLocale()) === 'zh'
    ? { title: 'cswork · 学习工作台', description: '从 Go 后端到系统设计，学习、练习与一对一反馈。' }
    : {
        title: 'cswork · Learning workspace',
        description: 'From Go backends to system design: learn, practice and get one-on-one feedback.',
      };
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header switch mirrors the language into a cookie (lib/i18n.ts), so the
  // first HTML is already in the reader's language.
  const locale = await requestLocale();
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        {/* Google Analytics loads only after the visitor opts in (components/analytics.tsx). */}
        <Analytics id={measurementId(process.env.GA_MEASUREMENT_ID)} />
      </body>
    </html>
  );
}
