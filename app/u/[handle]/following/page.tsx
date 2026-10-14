import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { followPeople } from '@/lib/server/follows';
import { requestLocale } from '@/lib/server/locale';
import { FollowListView } from '../../views';

type Props = { params: Promise<{ handle: string }> };

/** A hidden or missing profile is the same 404 as on its page. */
const load = cache(async (handle: string) => {
  const people = followPeople(handle, 'following');
  if (!people) notFound();
  return { people, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { people, zh } = await load((await params).handle);
  return {
    ...seoMetadata({
      title: zh ? `@${people.handle} 的关注 · CSWork` : `People @${people.handle} follows · CSWork`,
      description: zh ? `@${people.handle} 在 CSWork 的关注。` : `Who @${people.handle} follows on CSWork.`,
      path: `/u/${people.handle}/following`,
    }),
    // Lists of people stay out of search.
    robots: { index: false, follow: false },
  };
}

export default async function FollowingPage({ params }: Props) {
  return <FollowListView {...await load((await params).handle)} which="following" />;
}
