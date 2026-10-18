import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { GLOSSARY_COPY, GlossaryView } from './view';

export async function generateMetadata() {
  const c = GLOSSARY_COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/topics/glossary' });
}

export default async function GlossaryPage() {
  return <GlossaryView zh={(await requestLocale()) === 'zh'} />;
}
