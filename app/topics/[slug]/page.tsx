import { notFound } from 'next/navigation';
import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { topicPath } from '@/lib/route-templates';
import { topicStop } from '../stops';
import { TopicView, topicCopy } from '../views';

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props['params']) {
  const stop = topicStop((await params).slug);
  if (!stop) notFound();
  return { stop, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { stop, zh } = await load(params);
  const { pageTitle, description } = topicCopy(stop, zh);
  return seoMetadata({ title: pageTitle, description, path: topicPath(stop.slug) });
}

export default async function TopicPage({ params }: Props) {
  const { stop, zh } = await load(params);
  return <TopicView stop={stop} zh={zh} />;
}
