import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { guidePath } from '@/lib/career-guide';
import { requestLocale } from '@/lib/server/locale';
import { GUIDE_COPY, GuideIndexView } from './views';

export async function generateMetadata(): Promise<Metadata> {
  const c = GUIDE_COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: guidePath() });
}

export default async function GuideIndexPage() {
  return <GuideIndexView zh={(await requestLocale()) === 'zh'} />;
}
