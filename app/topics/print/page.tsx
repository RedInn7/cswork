import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { PRINT_COPY, TopicsPrintView, printLang } from './view';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata() {
  const c = PRINT_COPY[await requestLocale()];
  // One canonical page; ?lang= only picks the template language.
  return seoMetadata({ title: c.title, description: c.description, path: '/topics/print' });
}

export default async function TopicsPrintPage({ searchParams }: Props) {
  return <TopicsPrintView zh={(await requestLocale()) === 'zh'} lang={printLang((await searchParams).lang)} />;
}
