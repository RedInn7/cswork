import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { topicHeat } from '@/lib/server/topic-page';
import { INDEX_COPY, TopicsIndexView } from './views';

export async function generateMetadata() {
  const c = INDEX_COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/topics' });
}

export default async function TopicsIndex() {
  return <TopicsIndexView zh={(await requestLocale()) === 'zh'} heat={topicHeat()} />;
}
